// Even's glasses menu (tap, then press and hold), like its notifications, sends FOREGROUND_ENTER (4) when it opens and
// FOREGROUND_EXIT (5) when it closes; a pick arrives 0.2–0.3 s before the 5 (measured on the glasses, 2026-10-19 and
// 2026-10-21). A pick waits for the menu to close, then runs, so the page it changes is drawn after Even's menu is gone.

/** How long a pick waits for Even's menu to close (its 5 came within 0.3 s on the glasses; the simulator may send none). */
export const MENU_CLOSE_WAIT_MS = 800;

/** Holds a glasses-menu pick until Even's menu has closed (or MENU_CLOSE_WAIT_MS), then runs it. */
export class MenuAfterClose<T> {
  private held: { pick: T; at: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly run: (pick: T, waitedMs: number, closed: boolean) => void;
  private readonly waitMs: number;
  private readonly now: () => number;

  constructor(run: (pick: T, waitedMs: number, closed: boolean) => void, waitMs = MENU_CLOSE_WAIT_MS, now: () => number = () => performance.now()) {
    this.run = run;
    this.waitMs = waitMs;
    this.now = now;
  }

  /** A pick from Even's menu: runs when the menu closes. A second pick first runs the one before. */
  picked(pick: T): void {
    this.flush();
    this.held = { pick, at: this.now() };
    this.timer = setTimeout(() => this.release(false), this.waitMs);
  }

  /** Even's menu closed (FOREGROUND_EXIT): the pick held runs now. */
  closed(): void {
    this.release(true);
  }

  /** Another gesture came: the pick held runs first, so the order stays as you did it. */
  flush(): void {
    this.release(false);
  }

  get holding(): boolean {
    return this.held !== null;
  }

  private release(closed: boolean): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const h = this.held;
    if (!h) return;
    this.held = null;
    this.run(h.pick, Math.round(this.now() - h.at), closed);
  }
}
