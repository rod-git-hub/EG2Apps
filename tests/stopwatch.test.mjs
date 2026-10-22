// Stopwatch tests: start / pause / resume / reset with a fake clock, surviving a restart while running, the clock
// moving back, formatting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Stopwatch, formatElapsed } from "../apps/eg2presentation/src/stopwatch.ts";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("start, pause, resume and reset add up the right time", () => {
  const c = clock();
  const sw = new Stopwatch(null, () => {}, c.now);
  assert.equal(sw.mode, "ready");
  sw.start();
  c.advance(65_000);
  assert.equal(sw.elapsed(), 65_000);
  assert.equal(sw.mode, "running");
  sw.pause();
  c.advance(30_000); // paused time doesn't count
  assert.equal(sw.elapsed(), 65_000);
  assert.equal(sw.mode, "paused");
  sw.toggle(); // resume
  c.advance(5_000);
  assert.equal(sw.elapsed(), 70_000);
  sw.reset();
  assert.equal(sw.elapsed(), 0);
  assert.equal(sw.mode, "ready");
});

test("a restart (or a 5-minute phone lock) while running keeps counting from the saved start", () => {
  const c = clock();
  let saved = null;
  const sw = new Stopwatch(null, (j) => { saved = j; }, c.now);
  sw.start();
  c.advance(10_000);
  // The app is closed or frozen; 5 minutes later it starts again from storage.
  c.advance(300_000);
  const again = new Stopwatch(saved, () => {}, c.now);
  assert.equal(again.running, true);
  assert.equal(again.elapsed(), 310_000);
});

test("only start / pause / reset save (not every tick); listeners hear them", () => {
  const c = clock();
  let saves = 0;
  let heard = 0;
  const sw = new Stopwatch(null, () => { saves++; }, c.now);
  sw.onChange(() => { heard++; });
  sw.start();
  for (let i = 0; i < 10; i++) { c.advance(1000); sw.elapsed(); }
  sw.start(); // already running: nothing
  sw.pause();
  sw.reset();
  assert.equal(saves, 3);
  assert.equal(heard, 3);
});

test("the phone's clock moving back never shows negative time; bad saved data starts fresh", () => {
  const c = clock();
  const sw = new Stopwatch(null, () => {}, c.now);
  sw.start();
  c.advance(-60_000);
  assert.equal(sw.elapsed(), 0);
  for (const bad of ["{oops", "[]", JSON.stringify({ startedAt: "x", elapsedMs: -5 })]) {
    const s = new Stopwatch(bad, () => {}, c.now);
    assert.equal(s.mode, "ready");
    assert.equal(s.elapsed(), 0);
  }
});

test("formatting: mm:ss, then h:mm:ss", () => {
  assert.equal(formatElapsed(0), "00:00");
  assert.equal(formatElapsed(59_999), "00:59");
  assert.equal(formatElapsed(252_000), "04:12");
  assert.equal(formatElapsed(3_600_000 + 252_000), "1:04:12");
  assert.equal(formatElapsed(-5), "00:00");
});
