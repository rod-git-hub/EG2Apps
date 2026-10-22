// Draws frames on the G2 and turns raw Even events into gestures.
//
// One page layout: a rounded frame with a header line (1 line) and the body (8 lines of 27 px), the gesture line
// under the frame, and an empty, borderless box over everything that catches the gestures (the glasses bounce the
// text in whichever box catches swipes, so the visible text sits in boxes that don't). The page is built once; every
// later screen change is an in-place text update of only the boxes that changed (flicker-free, ~60–90 ms on the
// glasses). A page is rebuilt only when its glasses menu changes (Even sets menus only when a page is built).
//
// Even answers a refused page with `false` (no error) and keeps the old page on screen (measured 2026-10-21), so every
// answer is checked: a refused page is retried as a plain page, never left stale.
//
// Event routing (measured on the glasses):
//   swipe up / down → textEvent SCROLL_TOP_EVENT (1) / SCROLL_BOTTOM_EVENT (2)
//   single tap      → sysEvent with no eventType (0 is left out on the wire), or a listEvent
//   double tap      → sysEvent DOUBLE_CLICK_EVENT (3)
//   menu pick       → menuItemClickEvent.itemID

import {
  CreateStartUpPageContainer, ImageContainerProperty, ImageRawDataUpdate, ImageRawDataUpdateResult, ListContainerProperty, ListItemContainerProperty, MenuContainerProperty, MenuItemProperty,
  OsEventTypeList, RebuildPageContainer, StartUpPageCreateResult, TextContainerProperty, TextContainerUpgrade,
  type EvenAppBridge, type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { serial } from "./bridge-queue.ts";
import { truncateChars, TEXT_CREATE_MAX_CHARS, TEXT_UPGRADE_MAX_CHARS } from "./text.ts";
import type { Frame, FrameOutput, Gesture } from "./model.ts";

const FRAME = { id: 1, name: "frame" } as const;
const HEADER = { id: 2, name: "hdr" } as const;
const BODY = { id: 3, name: "body" } as const;
const HINT = { id: 4, name: "hint" } as const;
const TOUCH = { id: 5, name: "touch" } as const;
const LIST = { id: 6, name: "list" } as const;
const CORNER = { id: 7, name: "corner" } as const;

/** A picture for the top right corner of every page (the app's wordmark): PNG bytes and its size. */
export interface CornerImage {
  width: number;
  height: number;
  png: Uint8Array;
}

/** Decodes a base64 PNG (the generated wordmark module) to bytes. */
export function pngFromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** The header box's width with a corner picture `width` px wide (the box ends 8 px before it). */
export function headerBoxWidth(cornerWidth = 0): number {
  return cornerWidth ? 576 - 8 - cornerWidth - 8 - 6 : 564;
}
/** The frame's height; the gesture line sits in the 29 px under it. */
const FRAME_H = 259;
const HEADER_H = 33;
const BORDER_LEVEL = 6;
const HEADER_LEVEL = 3;
const HINT_LEVEL = 2;
const DRAW_TIMEOUT_MS = 10_000;

/** Resolves an envelope's event type; CLICK (0) arrives as undefined. */
function typeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null;
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT;
}

/** The gesture in a raw Even event, or null (lifecycle events, long-press releases, audio…). */
export function toGesture(event: EvenHubEvent): Gesture | null {
  if (event.menuItemClickEvent?.itemID !== undefined) return { type: "menu", itemId: event.menuItemClickEvent.itemID };
  // Even's list (its select box): a tap reports the highlighted row (protobuf leaves out 0).
  const list = typeOf(event.listEvent);
  if (list === OsEventTypeList.CLICK_EVENT) return { type: "tap", row: event.listEvent?.currentSelectItemIndex ?? 0 };
  if (list === OsEventTypeList.DOUBLE_CLICK_EVENT) return { type: "double-tap" };
  const sys = typeOf(event.sysEvent);
  const text = event.textEvent?.eventType;
  if (sys === OsEventTypeList.DOUBLE_CLICK_EVENT) return { type: "double-tap" };
  if (text === OsEventTypeList.SCROLL_TOP_EVENT) return { type: "up" };
  if (text === OsEventTypeList.SCROLL_BOTTOM_EVENT) return { type: "down" };
  if (sys === OsEventTypeList.CLICK_EVENT || typeOf(event.textEvent) === OsEventTypeList.CLICK_EVENT) return { type: "tap" };
  return null;
}

/** Even's lifecycle signals: it took the screen (its menu, a notification), gave it back, or closed the app. */
export type Lifecycle = "even-took" | "even-gave" | "closed";

export function toLifecycle(event: EvenHubEvent): Lifecycle | null {
  switch (event.sysEvent?.eventType) {
    case OsEventTypeList.FOREGROUND_ENTER_EVENT: return "even-took";
    case OsEventTypeList.FOREGROUND_EXIT_EVENT: return "even-gave";
    case OsEventTypeList.ABNORMAL_EXIT_EVENT:
    case OsEventTypeList.SYSTEM_EXIT_EVENT: return "closed";
    default: return null;
  }
}

/** The parts of the bridge this output uses (a fake in the tests). */
export type PageBridge = Pick<EvenAppBridge, "createStartUpPageContainer" | "rebuildPageContainer" | "textContainerUpgrade"> &
  Partial<Pick<EvenAppBridge, "updateImageRawData">>;

type Sent = { header: string; body: string; hint: string; list: string };

export class EvenOutput implements FrameOutput {
  private readonly bridge: PageBridge;
  private readonly onError: (message: string) => void;
  private readonly corner: CornerImage | null;
  private created = false;
  /** The page on the glasses was built for this menu ("" = needs a rebuild). */
  private menuShown = "";
  private sent: Sent = { header: "", body: "", hint: "", list: "" };
  private waiting: Frame | null = null;
  private drawing: Promise<void> = Promise.resolve();

  constructor(bridge: PageBridge, onError: (message: string) => void = () => {}, corner: CornerImage | null = null) {
    this.bridge = bridge;
    this.onError = onError;
    this.corner = corner;
  }

  /** Shows a frame; a newer frame replaces one still waiting (no pile-up on a slow link). */
  show(frame: Frame): Promise<void> {
    const alreadyQueued = this.waiting !== null;
    this.waiting = frame;
    if (alreadyQueued) return this.drawing;
    this.drawing = serial(() => {
      const next = this.waiting as Frame;
      this.waiting = null;
      return this.draw(next);
    }, DRAW_TIMEOUT_MS, "draw").catch((e: unknown) => this.onError(`glasses update failed: ${e instanceof Error ? e.message : String(e)}`));
    return this.drawing;
  }

  /** The next frame rebuilds the page (e.g. after Even had the screen). */
  rebuildNext(): void {
    this.menuShown = "";
  }

  private page(frame: Frame) {
    const text = (box: { id: number; name: string }, x: number, y: number, w: number, h: number, content: string, extra: Partial<TextContainerProperty> = {}) =>
      new TextContainerProperty({
        xPosition: x, yPosition: y, width: w, height: h, paddingLength: 0, borderWidth: 0,
        containerID: box.id, containerName: box.name, content: truncateChars(content || " ", TEXT_CREATE_MAX_CHARS), isEventCapture: 0, ...extra,
      });
    const items = frame.menu?.items ?? [];
    const menu = items.length ? { menuObject: new MenuContainerProperty({ menuItems: items.map((m) => new MenuItemProperty({ itemName: m.name, itemID: m.id })) }) } : {};
    const frameBox = text(FRAME, 0, 0, 576, FRAME_H, " ", { borderWidth: 1, borderColor: BORDER_LEVEL, borderRadius: 8 });
    const header = text(HEADER, 6, 2, headerBoxWidth(this.corner?.width), HEADER_H - 2, frame.header, { paddingLength: 2, textColor: HEADER_LEVEL });
    // Pictures can't come with a page: the corner's box is empty until its picture is sent right after (sendCorner).
    const corner = this.corner
      ? { imageObject: [new ImageContainerProperty({ xPosition: 576 - 8 - this.corner.width, yPosition: Math.round((HEADER_H - this.corner.height) / 2), width: this.corner.width, height: this.corner.height, containerID: CORNER.id, containerName: CORNER.name })] }
      : {};
    const pictures = this.corner ? 1 : 0;
    // No padding: one 27-px line in the 29 px under the frame (with padding the line overflowed).
    const hint = text(HINT, 8, FRAME_H, 562, 288 - FRAME_H, frame.hint, { textColor: HINT_LEVEL });
    if (frame.list) {
      // Even's list catches the gestures itself: the glasses move its select box; a tap reports the row.
      const list = new ListContainerProperty({
        xPosition: 4, yPosition: HEADER_H, width: 568, height: FRAME_H - HEADER_H, paddingLength: 4, borderWidth: 0,
        containerID: LIST.id, containerName: LIST.name, isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({ itemCount: frame.list.length, itemWidth: 560, isItemSelectBorderEn: 1, itemName: frame.list }),
      });
      return { containerTotalNum: 4 + pictures, textObject: [frameBox, header, hint], listObject: [list], ...corner, ...menu };
    }
    return {
      containerTotalNum: 5 + pictures,
      ...corner,
      textObject: [frameBox, header, text(BODY, 4, HEADER_H, 568, FRAME_H - HEADER_H, frame.body, { paddingLength: 4 }), hint, text(TOUCH, 0, 0, 576, 288, " ", { isEventCapture: 1 })],
      ...menu,
    };
  }

  private async build(frame: Frame): Promise<boolean> {
    if (!this.created) {
      const result = await this.bridge.createStartUpPageContainer(new CreateStartUpPageContainer(this.page(frame)));
      if (result === StartUpPageCreateResult.success) {
        this.created = true;
        return true;
      }
      // "Create" is allowed once per session; after a page reload the page may already exist, so rebuild it. Only a
      // page Even confirms counts as created: a refused first page must not leave the glasses blank for good.
      const rebuilt = (await this.bridge.rebuildPageContainer(new RebuildPageContainer(this.page(frame)))) === true;
      if (rebuilt) this.created = true;
      else this.onError(`first glasses page refused (create answered ${String(result)})`);
      return rebuilt;
    }
    return (await this.bridge.rebuildPageContainer(new RebuildPageContainer(this.page(frame)))) === true;
  }

  /** Sends the corner picture after a page was built (a new page's picture boxes start empty). */
  private async sendCorner(): Promise<void> {
    if (!this.corner || !this.bridge.updateImageRawData) return;
    const result = await this.bridge.updateImageRawData(new ImageRawDataUpdate({ containerID: CORNER.id, containerName: CORNER.name, imageData: this.corner.png }));
    if (result !== ImageRawDataUpdateResult.success) this.onError(`corner picture not shown (${String(result)})`);
  }

  private async draw(frame: Frame): Promise<void> {
    const menuKey = frame.menu?.key ?? "none";
    // Even's list can't change in place: new rows (or a switch between the list and the text layout) rebuild the page.
    const listKey = frame.list ? JSON.stringify(frame.list) : "";
    if (menuKey !== this.menuShown || listKey !== this.sent.list) {
      let ok = await this.build(frame);
      if (!ok) {
        // Refused (too long, a bad menu…): a plain page instead, so the glasses never keep showing a stale one.
        this.onError(`glasses page refused (${frame.list ? "list" : "text"} layout)`); // never the user's text: reviewers see the log
        ok = await this.build({ header: frame.header.slice(0, 40), body: "Couldn't show this page.", hint: "double tap = back", cursor: null });
        if (!ok) return; // nothing shown: the next frame tries again
        this.menuShown = "";
        this.sent = { header: frame.header.slice(0, 40), body: "Couldn't show this page.", hint: "double tap = back", list: "" };
        return;
      }
      this.menuShown = menuKey;
      this.sent = { header: frame.header, body: frame.body, hint: frame.hint, list: listKey };
      await this.sendCorner();
      return;
    }
    for (const [key, box] of [["header", HEADER], ["body", BODY], ["hint", HINT]] as const) {
      if (key === "body" && frame.list) continue; // Even's list page has no body box
      const content = frame[key];
      if (content === this.sent[key]) continue; // unchanged: not sent again (the stopwatch redraws every second)
      const ok = await this.bridge.textContainerUpgrade(new TextContainerUpgrade({
        containerID: box.id, containerName: box.name, content: truncateChars(content || " ", TEXT_UPGRADE_MAX_CHARS),
      }));
      if (!ok) {
        this.onError(`glasses text update refused (${key})`);
        this.menuShown = ""; // rebuild with the next frame
        return;
      }
      this.sent[key] = content;
    }
  }
}
