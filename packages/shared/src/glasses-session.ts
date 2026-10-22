// Connects the glasses to the navigator: Even's events become gestures, frames go to the glasses.
//
// - Some gestures arrive twice (once per event envelope): exact repeats within 120 ms are ignored.
// - Taps say which device sent them (swipes don't): a tap from the ring turns ring mode on (quick ring flicks then
//   speed up), a tap from a temple turns it off.
// - A pick from Even's glasses menu runs once the menu has closed; any other gesture runs a held pick first.
// - Lifecycle (Even took the screen, gave it back, closed the app) is passed on, so the app can save at once.

import { EventSourceType, type EvenAppBridge, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { serial } from "./bridge-queue.ts";
import { FlickAccelerator } from "./flick.ts";
import { EvenOutput, toGesture, toLifecycle, type CornerImage, type Lifecycle } from "./glasses-output.ts";
import { MenuAfterClose } from "./menu-close.ts";
import type { Gesture } from "./model.ts";
import type { Navigator } from "./navigator.ts";

export const REPEAT_MS = 120;

/** Even's exit dialog (mode 1): required on the first screen's double tap; mode 0 isn't allowed there. */
export function askToExit(bridge: Pick<EvenAppBridge, "shutDownPageContainer">): void {
  void serial(() => bridge.shutDownPageContainer(1), 5_000, "exit dialog").catch(() => {});
}

export interface GlassesSessionOptions {
  bridge: Pick<EvenAppBridge, "onEvenHubEvent" | "createStartUpPageContainer" | "rebuildPageContainer" | "textContainerUpgrade"> &
    Partial<Pick<EvenAppBridge, "updateImageRawData">>;
  /** A picture for every page's top right corner (the app's wordmark). */
  corner?: CornerImage;
  nav: Navigator;
  onLifecycle?: (signal: Lifecycle) => void;
  log?: (line: string) => void;
  now?: () => number;
}

export class GlassesSession {
  readonly output: EvenOutput;
  readonly flick = new FlickAccelerator();
  private readonly nav: Navigator;
  private readonly now: () => number;
  private last = { type: "", at: -Infinity };
  private readonly menuPick: MenuAfterClose<Gesture>;

  constructor(opts: GlassesSessionOptions) {
    this.nav = opts.nav;
    this.now = opts.now ?? (() => performance.now());
    const log = opts.log ?? (() => {});
    this.output = new EvenOutput(opts.bridge, log, opts.corner ?? null);
    this.menuPick = new MenuAfterClose<Gesture>((g) => this.handle(g));
    opts.bridge.onEvenHubEvent((event) => this.onEvent(event, opts.onLifecycle));
    this.nav.addOutput(this.output);
  }

  /** One raw Even event (exported for tests through the instance). */
  onEvent(event: EvenHubEvent, onLifecycle?: (signal: Lifecycle) => void): void {
    if (event.audioEvent) return;
    const life = toLifecycle(event);
    if (life) {
      onLifecycle?.(life);
      if (life === "even-took") this.nav.refresh(); // redraw once Even's menu or notification is gone
      if (life === "even-gave") this.menuPick.closed(); // a pick from Even's menu runs now
    }
    const source = event.sysEvent?.eventSource;
    if (source === EventSourceType.TOUCH_EVENT_FROM_RING) this.flick.ringMode = true;
    else if (source === EventSourceType.TOUCH_EVENT_FROM_GLASSES_R || source === EventSourceType.TOUCH_EVENT_FROM_GLASSES_L) this.flick.ringMode = false;
    const g = toGesture(event);
    if (!g) return;
    if (g.type === "menu") this.menuPick.picked(g);
    else {
      this.menuPick.flush();
      this.handle(g);
    }
  }

  private handle(g: Gesture): void {
    const now = this.now();
    if (g.type === this.last.type && g.type !== "menu" && now - this.last.at < REPEAT_MS) return; // a repeat
    this.last = { type: g.type, at: now };
    if (g.type === "up" || g.type === "down") this.nav.handle({ type: g.type, rows: this.flick.rows(g.type, now) });
    else this.nav.handle(g);
  }
}
