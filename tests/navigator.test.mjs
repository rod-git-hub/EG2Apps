// Glasses navigation: the text cursor wraps around at the ends and skips blank lines; double tap goes back (the first
// screen asks Even for its exit dialog); text pages turn a page per swipe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitHeader, LIST_HINT, Navigator, ROOT_LIST_HINT, splitHint } from "../packages/shared/src/navigator.ts";
import { FlickAccelerator, rowsForStreak } from "../packages/shared/src/flick.ts";
import { textWidth } from "../packages/shared/src/text.ts";

function setup(rows) {
  const frames = [];
  let exits = 0;
  const nav = new Navigator({ outputs: [{ show: (f) => frames.push(f) }], onExitRequest: () => exits++ });
  nav.push(() => ({ kind: "list", header: "NOTES", rows }));
  return { nav, frames, cursor: () => frames.at(-1).cursor, exits: () => exits };
}

test("swipe down past the last row goes to the first; up past the first goes to the last", () => {
  const { nav, cursor } = setup([{ label: "a" }, { label: "b" }, { label: "c" }]);
  assert.equal(cursor(), 0);
  nav.handle({ type: "up" });
  assert.equal(cursor(), 2, "up from the first row → the last");
  nav.handle({ type: "down" });
  assert.equal(cursor(), 0, "down from the last row → the first");
});

test("blank lines are skipped, also when wrapping; several rows per swipe when asked (fast ring)", () => {
  const { nav, cursor } = setup([{ label: "+ New" }, { label: "", spacer: true }, { label: "a" }, { label: "b" }, { label: "c" }]);
  nav.handle({ type: "down" });
  assert.equal(cursor(), 2, "the blank line is skipped");
  nav.handle({ type: "down", rows: 3 });
  assert.equal(cursor(), 0, "b, c, then wrapped to + New");
  nav.handle({ type: "up" });
  assert.equal(cursor(), 4, "wrapped to the bottom");
});

test("tap runs the row's action; double tap goes back; on the first screen it asks to exit", () => {
  const { nav, frames, exits } = setup([{ label: "Groceries", onSelect: () => nav.push(() => ({ kind: "text", header: "GROCERIES", body: "Milk" })) }]);
  assert.equal(frames.at(-1).hint, ROOT_LIST_HINT);
  nav.handle({ type: "tap" });
  assert.equal(frames.at(-1).header, "GROCERIES");
  nav.handle({ type: "double-tap" });
  assert.equal(frames.at(-1).header, "NOTES");
  nav.handle({ type: "double-tap" });
  assert.equal(exits(), 1, "Even's exit dialog, not a custom one");
  nav.push(() => ({ kind: "list", header: "SUB", rows: [{ label: "x" }] }));
  assert.equal(frames.at(-1).hint, LIST_HINT, "deeper lists: double tap = back");
});

test("an empty list says so instead of showing a blank page", () => {
  const frames = [];
  const nav = new Navigator({ outputs: [{ show: (f) => frames.push(f) }], onExitRequest: () => {} });
  nav.push(() => ({ kind: "list", header: "NOTES", rows: [], empty: "No notes yet. Add one on your phone." }));
  assert.match(frames.at(-1).body, /No notes yet/);
  assert.equal(frames.at(-1).cursor, null);
  nav.handle({ type: "down" }); // nothing to move to: no crash
});

test("text pages: a swipe turns the page; past the end runs the page's own action", () => {
  const frames = [];
  let pastEnd = 0;
  const nav = new Navigator({ outputs: [{ show: (f) => frames.push(f) }], onExitRequest: () => {} });
  const body = Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1}.`).join("\n");
  nav.push(() => ({ kind: "text", header: "TOPIC", body, onPastEnd: () => pastEnd++ }));
  assert.match(frames.at(-1).header, /TOPIC · 1\/3$/);
  nav.handle({ type: "down" });
  assert.match(frames.at(-1).header, / · 2\/3$/);
  assert.match(frames.at(-1).body, /^Paragraph 9\./);
  nav.handle({ type: "down" });
  nav.handle({ type: "down" });
  assert.equal(pastEnd, 1, "on the last page, a swipe down goes on");
  nav.handle({ type: "up" });
  assert.match(frames.at(-1).header, / · 2\/3$/);
});

test("the cursor stays on its row after a redraw (the data changed) and is kept inside a shorter list", () => {
  let rows = [{ label: "a" }, { label: "b" }, { label: "c" }];
  const frames = [];
  const nav = new Navigator({ outputs: [{ show: (f) => frames.push(f) }], onExitRequest: () => {} });
  nav.push(() => ({ kind: "list", header: "L", rows }));
  nav.handle({ type: "down" });
  nav.handle({ type: "down" });
  nav.refresh();
  assert.equal(frames.at(-1).cursor, 2);
  rows = [{ label: "a" }];
  nav.refresh();
  assert.equal(frames.at(-1).cursor, 0);
});

test("fast ring: in ring mode quick flicks move 1, 1, 2, 2, 3 rows; temple repeats and slow flicks stay at 1", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(rowsForStreak), [1, 1, 2, 2, 3, 3]);
  const f = new FlickAccelerator();
  const flicks = (times, dir = "down") => times.map((t) => f.rows(dir, t));
  assert.deepEqual(flicks([0, 600, 1200, 1800, 2400]), [1, 1, 1, 1, 1], "not in ring mode: always 1");
  f.ringMode = true;
  assert.deepEqual(flicks([10000, 10600, 11200, 11800, 12400, 13000]), [1, 1, 2, 2, 3, 3]);
  assert.deepEqual(flicks([20000]), [1], "a pause over 1 s starts again");
  assert.deepEqual(flicks([30000, 30250, 30500, 30750]), [1, 1, 1, 1], "temple repeats (~0.25 s) never speed up");
});

test("splitHint: a last line of gestures goes under the frame; text with an = sign stays", () => {
  assert.deepEqual(splitHint("Couldn't show this.\n\n(double tap = back)"), { body: "Couldn't show this.", hint: "double tap = back" });
  assert.deepEqual(splitHint("Budget: 2 + 2 = 4"), { body: "Budget: 2 + 2 = 4", hint: null });
});

test("fitHeader: the title gives way so the status after it stays", () => {
  const h = fitHeader("A really very long presentation title for the quarterly review · 00:10 · 2/5");
  assert.match(h, /… · 00:10 · 2\/5$/);
  assert.ok(textWidth(h) <= 540);
});
