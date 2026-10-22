// Text fitting for the glasses: widths, wrapping, pages, the text cursor's window.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APP_BODY_LINES, APP_BODY_WRAP_PX, fitWidth, renderCursorWindow, textPages, textWidth, truncateBytes, utf8Bytes, wrapWidth,
} from "../packages/shared/src/text.ts";

test("truncateBytes never splits a character and keeps within the byte limit", () => {
  const t = truncateBytes("●".repeat(30), 63);
  assert.ok(utf8Bytes(t) <= 63);
  assert.ok(t.endsWith("…"));
  assert.equal(truncateBytes("short", 63), "short");
});

test("fitWidth cuts by measured pixels, with an ellipsis", () => {
  const long = "A fairly long note title that will not fit on one line of the glasses at all";
  const fitted = fitWidth(long, 200);
  assert.ok(textWidth(fitted) <= 200);
  assert.ok(fitted.endsWith("…"));
  assert.equal(fitWidth("Bread", 200), "Bread");
});

test("wrapWidth keeps every line within the width and ends a cut text with an ellipsis", () => {
  const lines = wrapWidth("one two three four five six seven eight nine ten eleven twelve", 120, 3);
  assert.equal(lines.length, 3);
  for (const l of lines) assert.ok(textWidth(l) <= 120, l);
  assert.ok(lines[2].endsWith("…"));
});

test("textPages: whole lines per page, paragraphs kept, no page starting blank", () => {
  const text = Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of the note.`).join("\n");
  const pages = textPages(text);
  assert.equal(pages.length, Math.ceil(30 / APP_BODY_LINES));
  for (const p of pages) {
    assert.ok(p.split("\n").length <= APP_BODY_LINES);
    assert.notEqual(p.split("\n")[0], "");
    for (const l of p.split("\n")) assert.ok(textWidth(l) <= APP_BODY_WRAP_PX);
  }
  assert.deepEqual(textPages(""), [""]);
});

test("renderCursorWindow: the cursor row is always visible, rows fit one line, ▲▼ and the position when cut", () => {
  const rows = Array.from({ length: 20 }, (_, i) => `Note ${i + 1} ${"with a long title ".repeat(4)}`);
  const w = renderCursorWindow(rows, 15, 7);
  assert.equal(w.lines.filter((l) => l.startsWith("> ")).length, 1);
  assert.ok(w.lines.some((l) => l.startsWith("> Note 16")));
  assert.match(w.lines.at(-1), /▲▼ {2}16\/20$/);
  for (const l of w.lines) assert.ok(textWidth(l) <= APP_BODY_WRAP_PX, l);
  assert.deepEqual(renderCursorWindow([], 0, 7, APP_BODY_WRAP_PX, "No notes yet.").lines, ["   No notes yet."]);
  assert.equal(renderCursorWindow(["a", "b"], 1, 7).lines.length, 2, "short lists: no ▲▼ line");
});
