// The talk stopwatch: one stopwatch, kept on this phone only. Time is calculated from saved moments, not counted
// tick by tick, so it stays right when Android pauses the app or the phone is locked (Even's background-lifecycle
// guidance). Plain TypeScript with no browser APIs, so the tests run it in Node.

interface State {
  /** When the current run started (epoch ms), or null when stopped. */
  startedAt: number | null;
  /** Time from earlier runs (before the last pause). */
  elapsedMs: number;
}

function parse(saved: string | null): State {
  try {
    const s = JSON.parse(saved ?? "") as Partial<State>;
    const startedAt = typeof s.startedAt === "number" && Number.isFinite(s.startedAt) ? s.startedAt : null;
    const elapsedMs = typeof s.elapsedMs === "number" && s.elapsedMs >= 0 ? s.elapsedMs : 0;
    return { startedAt, elapsedMs };
  } catch {
    return { startedAt: null, elapsedMs: 0 };
  }
}

/** "04:12", or "1:04:12" from one hour. */
export function formatElapsed(ms: number): string {
  const total = Math.floor(Math.max(ms, 0) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export class Stopwatch {
  private state: State;
  private readonly save: (json: string) => void;
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();

  /**
   * @param saved what `save` last wrote (null the first time)
   * @param save  writes the state to phone storage (only on start / pause / reset)
   * @param now   the clock (tests pass a fake one)
   */
  constructor(saved: string | null, save: (json: string) => void, now: () => number = Date.now) {
    this.state = parse(saved);
    this.save = save;
    this.now = now;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get running(): boolean {
    return this.state.startedAt !== null;
  }

  /** Total time so far (never negative, even if the phone's clock moved back). */
  elapsed(): number {
    const run = this.state.startedAt === null ? 0 : Math.max(this.now() - this.state.startedAt, 0);
    return this.state.elapsedMs + run;
  }

  /** "ready" (0:00, stopped), "running" or "paused" (stopped with time on it). */
  get mode(): "ready" | "running" | "paused" {
    if (this.running) return "running";
    return this.state.elapsedMs > 0 ? "paused" : "ready";
  }

  start(): void {
    if (this.running) return;
    this.set({ startedAt: this.now(), elapsedMs: this.state.elapsedMs });
  }

  pause(): void {
    if (!this.running) return;
    this.set({ startedAt: null, elapsedMs: this.elapsed() });
  }

  toggle(): void {
    if (this.running) this.pause();
    else this.start();
  }

  reset(): void {
    this.set({ startedAt: null, elapsedMs: 0 });
  }

  private set(state: State): void {
    this.state = state;
    this.save(JSON.stringify(state));
    for (const fn of this.listeners) fn();
  }
}
