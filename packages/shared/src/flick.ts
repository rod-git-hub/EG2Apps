// Ring flicks speed up. Measured on the glasses (2026-10-06): a ring flick sends exactly one swipe event; a temple
// slide keeps sending one about every 0.25 s while the finger moves, so it covers several rows. Swipe events don't say
// which device sent them, only taps do (`sysEvent.eventSource`), so "ring mode" starts with a tap from the ring and
// ends with a tap from a temple.
//
// In ring mode, quick flicks in the same direction (0.3–1 s apart) speed up: flicks 1–2 move 1 row, 3–4 move 2, from
// the 5th 3. A pause over 1 s or a change of direction starts again at 1. Temple repeats come faster than 0.3 s, so
// they always move 1 row each and never count as flicks.

export const FLICK_MIN_GAP_MS = 300;
export const FLICK_MAX_GAP_MS = 1000;

/** Rows for the n-th quick flick in a row. */
export const rowsForStreak = (streak: number): number => (streak <= 2 ? 1 : streak <= 4 ? 2 : 3);

export class FlickAccelerator {
  /** A phone setting can switch it off. */
  enabled = true;
  /** True after a tap from the ring; false after a tap from a temple. */
  ringMode = false;
  private streak = 0;
  private lastAt = -Infinity;
  private lastDir: "up" | "down" | null = null;

  /** How many rows a swipe at `now` (ms) moves. */
  rows(dir: "up" | "down", now: number): number {
    const gap = now - this.lastAt;
    if (gap < FLICK_MIN_GAP_MS && dir === this.lastDir) {
      this.lastAt = now; // a temple repeat: one row, and not a flick
      return 1;
    }
    this.streak = dir === this.lastDir && gap <= FLICK_MAX_GAP_MS ? this.streak + 1 : 1;
    this.lastAt = now;
    this.lastDir = dir;
    return this.enabled && this.ringMode ? rowsForStreak(this.streak) : 1;
  }
}
