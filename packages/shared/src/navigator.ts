// Screen stack + gesture handling. A tap picks the row under the cursor (or runs a text page's action), a double tap
// goes back, swipes move the cursor (lists) or turn the page (text). Double tap on the first screen asks Even for its
// exit dialog (Even Hub's review rules).

import {
  APP_BODY_LINES, APP_BODY_WRAP_PX, fitWidth, LIST_ITEM_MAX_BYTES, renderCursorWindow, textPages, textWidth, truncateBytes, truncateChars,
  TEXT_UPGRADE_MAX_CHARS,
} from "./text.ts";
import type { Frame, FrameOutput, Gesture, GlassesMenu, ListStyle, Row, Screen } from "./model.ts";

/** Even's list: at most 20 rows (measured 2026-10-21: 21 are refused); longer lists page with ▲ / ▼ rows. */
export const NATIVE_MAX_ROWS = 20;
export const NATIVE_PAGE_ROWS = 18;
/** Room for a row's text in Even's list (560 px wide with its padding; a margin for measuring error). */
const NATIVE_ROW_PX = 520;
export const NATIVE_PREVIOUS = "▲ Previous";
export const NATIVE_MORE = "▼ More";

/** Rows visible in the body: 8 lines of 27 px, one kept for the ▲▼ line. */
export const VISIBLE_ROWS = APP_BODY_LINES - 1;
/** Room for the header line (the header box is 564 px wide with 2 px padding; a margin for measuring error). */
export const HEADER_PX = 540;

export const LIST_HINT = "tap = open · double tap = back";
export const ROOT_LIST_HINT = "tap = open · double tap = exit";

/**
 * A header in `room` px: when it's too long, its first part (a title, before " · ") gives way with "…" so the status
 * after it stays; otherwise it's cut at the end.
 */
export function fitHeader(header: string, room: number = HEADER_PX): string {
  if (textWidth(header) <= room) return header;
  const at = header.indexOf(" · ");
  if (at > 0) {
    const rest = header.slice(at);
    const left = room - textWidth(rest);
    if (left >= 60) return `${fitWidth(header.slice(0, at), left)}${rest}`;
  }
  return fitWidth(header, room);
}

/**
 * A text page's last line when it only holds gesture instructions ("tap = save · double tap = cancel", "(double tap =
 * back)"): taken out of the body for the line under the frame.
 */
export function splitHint(body: string): { body: string; hint: string | null } {
  const m = /\n+\(?((?:tap|double tap|swipe)\b[^\n]*?=[^\n]*?)\)?[ \t]*$/.exec(body);
  if (!m) return { body, hint: null };
  return { body: body.slice(0, m.index).replace(/\s+$/, ""), hint: m[1]!.trim() };
}

export interface NavigatorOptions {
  outputs: FrameOutput[];
  /** Called on double tap at the first screen. */
  onExitRequest: () => void;
  /** A glasses-menu pick, with the screen on show and the cursor's row (null on a text page). */
  onMenu?: (itemId: number, screen: Screen, row: Row | null) => void;
  /** The glasses menu for a screen (none: no menu); `native`: drawn as Even's list (no highlighted row known). */
  menuFor?: (screen: Screen, native: boolean) => GlassesMenu | undefined;
  /** How lists look on the glasses (a phone setting); the text cursor when absent. */
  listStyle?: () => ListStyle;
  /** Room for the header text in px (less when a corner picture sits beside it). */
  headerRoom?: number;
  /** Changes a screen before it's shown (select mode marks the rows). */
  decorate?: (screen: Screen) => Screen;
}

interface StackEntry {
  build: () => Screen;
  cursor: number;
  page: number;
}

export class Navigator {
  private stack: StackEntry[] = [];
  private current: Screen | null = null;
  private pages: string[] = [];
  /** What each row of Even's list stands for (on show when the screen is drawn as Even's list). */
  private nativeMap: ({ kind: "row"; index: number } | { kind: "previous" } | { kind: "more" })[] = [];
  private readonly opts: NavigatorOptions;

  constructor(opts: NavigatorOptions) {
    this.opts = opts;
  }

  /** Adds an output (e.g. the glasses once the Even bridge is ready) and shows the current screen on it. */
  addOutput(out: FrameOutput): void {
    this.opts.outputs.push(out);
    this.render();
  }

  /** Screens are built by functions, so every redraw shows the latest data. */
  push(build: () => Screen): void {
    this.stack.push({ build, cursor: 0, page: 0 });
    this.render();
  }

  pop(): void {
    if (this.stack.length <= 1) {
      this.opts.onExitRequest();
      return;
    }
    this.stack.pop();
    this.render();
  }

  /** Replaces the top screen (e.g. the next topic's details) without growing the stack. */
  replace(build: () => Screen): void {
    this.stack[this.stack.length - 1] = { build, cursor: 0, page: 0 };
    this.render();
  }

  /** Back to the first screen. */
  home(): void {
    this.stack.length = Math.min(this.stack.length, 1);
    this.render();
  }

  /** Redraws the current screen (after data changed), keeping the cursor and page. */
  refresh(): void {
    this.render();
  }

  /** Puts the cursor on row `index` of the current screen and redraws. */
  setCursor(index: number): void {
    const top = this.stack.at(-1);
    if (top) top.cursor = Math.max(index, 0);
    this.render();
  }

  /** Moves the cursor by `delta` rows and redraws (to follow an item moved with the glasses menu). */
  cursorBy(delta: number): void {
    const top = this.stack.at(-1);
    if (top) top.cursor = Math.max(top.cursor + delta, 0);
    this.render();
  }

  /** Moves the cursor of the screen below the top one (e.g. the topic list while stepping through details). */
  parentCursorBy(delta: number): void {
    const parent = this.stack.at(-2);
    if (parent) parent.cursor = Math.max(parent.cursor + delta, 0);
  }

  get depth(): number {
    return this.stack.length;
  }

  get currentScreen(): Screen | null {
    return this.current;
  }

  /** The row under the cursor on a list (undefined on a text page, and on Even's list: its highlight isn't known). */
  get cursorRow(): Row | undefined {
    const top = this.stack.at(-1);
    return top && this.current?.kind === "list" && !this.isNative(this.current) ? this.current.rows[top.cursor] : undefined;
  }

  /** True when a screen is drawn as Even's list. */
  private isNative(screen: Screen): boolean {
    return screen.kind === "list" && !screen.cursorOnly && this.opts.listStyle?.() === "native" && screen.rows.some((r) => !r.spacer);
  }

  /** True when the screen on show must be redrawn every second. */
  get ticking(): boolean {
    return this.current?.ticks === true;
  }

  handle(g: Gesture): void {
    const top = this.stack.at(-1);
    const screen = this.current;
    if (!top || !screen) return;
    switch (g.type) {
      case "double-tap":
        if (screen.onBack?.() === true) {
          this.render(); // the screen handled it (e.g. left select mode)
          return;
        }
        this.pop();
        return;
      case "up":
      case "down": {
        const delta = g.type === "up" ? -1 : 1;
        if (this.isNative(screen)) return; // Even's list: the glasses move the highlight themselves
        if (screen.kind === "list") {
          const rows = screen.rows;
          if (!rows.some((r) => !r.spacer)) return;
          // Past the last row comes the first, and the other way round; blank lines are skipped.
          let next = top.cursor;
          for (let step = 0; step < Math.max(1, g.rows ?? 1); step++) {
            for (let k = 0; k < rows.length; k++) {
              next = (next + delta + rows.length) % rows.length;
              if (!rows[next]?.spacer) break;
            }
          }
          top.cursor = next;
          this.render();
          return;
        }
        // A text page: one page per swipe; past either end, the page's own action (if any).
        const page = top.page + delta;
        if (page < 0) screen.onPastStart?.();
        else if (page >= this.pages.length) screen.onPastEnd?.();
        else {
          top.page = page;
          this.render();
        }
        return;
      }
      case "tap":
        if (screen.kind === "list" && this.isNative(screen)) {
          const target = g.row === undefined ? undefined : this.nativeMap[g.row];
          if (target?.kind === "row") screen.rows[target.index]?.onSelect?.();
          else if (target) {
            top.page += target.kind === "more" ? 1 : -1;
            this.render();
          }
        } else if (screen.kind === "list") this.cursorRow?.onSelect?.();
        else screen.onTap?.();
        return;
      case "menu":
        this.opts.onMenu?.(g.itemId, screen, this.cursorRow ?? null);
        return;
    }
  }

  private render(): void {
    const top = this.stack.at(-1);
    if (!top) return;
    const built = top.build();
    const screen = this.opts.decorate?.(built) ?? built;
    this.current = screen;
    const atRoot = this.stack.length === 1;
    let frame: Frame;
    if (screen.kind === "list" && this.isNative(screen)) {
      frame = this.nativeFrame(screen.header, screen.rows, top, screen.hint ?? (atRoot ? ROOT_LIST_HINT : LIST_HINT));
    } else if (screen.kind === "list") {
      const rows = screen.rows;
      top.cursor = Math.min(top.cursor, Math.max(rows.length - 1, 0));
      // Never rest on a blank line (e.g. after the rows changed): step down, else up.
      if (rows[top.cursor]?.spacer) {
        const down = rows.findIndex((r, i) => i > top.cursor && !r.spacer);
        let up = top.cursor - 1;
        while (up > 0 && rows[up]?.spacer) up--;
        top.cursor = down >= 0 ? down : Math.max(up, 0);
      }
      const win = renderCursorWindow(rows.map((r) => (r.spacer ? "" : r.label)), top.cursor, VISIBLE_ROWS, APP_BODY_WRAP_PX, screen.empty);
      frame = {
        header: fitHeader(screen.header, this.opts.headerRoom),
        body: win.lines.join("\n"),
        cursor: rows.length ? top.cursor : null,
        hint: screen.hint ?? (atRoot ? ROOT_LIST_HINT : LIST_HINT),
      };
    } else {
      const split = screen.hint === undefined ? splitHint(screen.body) : { body: screen.body, hint: screen.hint };
      this.pages = textPages(split.body);
      top.page = Math.min(top.page, this.pages.length - 1);
      const many = this.pages.length > 1;
      frame = {
        header: fitHeader(many ? `${screen.header} · ${top.page + 1}/${this.pages.length}` : screen.header, this.opts.headerRoom),
        body: truncateChars(this.pages[top.page] ?? "", TEXT_UPGRADE_MAX_CHARS),
        cursor: null,
        hint: split.hint ?? "",
      };
    }
    const menu = this.opts.menuFor?.(screen, this.isNative(screen));
    if (menu) frame.menu = menu;
    for (const out of this.opts.outputs) void out.show(frame);
  }

  /** A list as Even's list: up to 20 rows; longer ones in pages of 18 with ▲ Previous / ▼ More rows. */
  private nativeFrame(header: string, rows: Row[], top: StackEntry, hint: string): Frame {
    const items = rows.map((r, index) => ({ r, index })).filter((x) => !x.r.spacer);
    const paged = items.length > NATIVE_MAX_ROWS;
    const pages = paged ? Math.ceil(items.length / NATIVE_PAGE_ROWS) : 1;
    top.page = Math.max(0, Math.min(top.page, pages - 1));
    const shown = paged ? items.slice(top.page * NATIVE_PAGE_ROWS, (top.page + 1) * NATIVE_PAGE_ROWS) : items;
    this.nativeMap = [
      ...(paged && top.page > 0 ? [{ kind: "previous" as const }] : []),
      ...shown.map((x) => ({ kind: "row" as const, index: x.index })),
      ...(paged && top.page < pages - 1 ? [{ kind: "more" as const }] : []),
    ];
    const label = (m: (typeof this.nativeMap)[number]) =>
      m.kind === "previous" ? NATIVE_PREVIOUS : m.kind === "more" ? NATIVE_MORE : truncateBytes(fitWidth(rows[m.index]!.label, NATIVE_ROW_PX), LIST_ITEM_MAX_BYTES);
    return {
      header: fitHeader(paged ? `${header ? `${header} · ` : ""}${top.page + 1}/${pages}` : header, this.opts.headerRoom),
      body: "",
      list: this.nativeMap.map(label),
      cursor: null,
      hint,
    };
  }
}
