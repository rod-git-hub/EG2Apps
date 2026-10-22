// Even's select box (the "Glasses lists" setting): lists drawn as Even's native list. Up to 20 rows; longer lists page
// with ▲ Previous / ▼ More; a tap reports the row; swipes are the glasses' own; no row menu (a pick can't tell the
// row); checklists and select mode keep the text cursor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Navigator, NATIVE_MORE, NATIVE_PREVIOUS } from "../packages/shared/src/navigator.ts";
import { EvenOutput, toGesture } from "../packages/shared/src/glasses-output.ts";
import { MenuActions } from "../packages/shared/src/row-menu.ts";
import { utf8Bytes } from "../packages/shared/src/text.ts";

function setup(n, { style = "native", cursorOnly = false } = {}) {
  const frames = [];
  const opened = [];
  let mode = style;
  const actions = new MenuActions(() => {});
  const nav = new Navigator({
    outputs: [{ show: (f) => frames.push(f) }],
    onExitRequest: () => {},
    listStyle: () => mode,
    menuFor: (s, native) => actions.menuFor(s, native),
  });
  actions.attach(nav);
  const rows = Array.from({ length: n }, (_, i) => ({ label: `Note ${i + 1}`, id: `n${i}`, onSelect: () => opened.push(i + 1), menu: { name: `Note ${i + 1}`, move: () => true, remove: () => {} } }));
  nav.push(() => ({ kind: "list", header: "NOTES", rows, selectKey: "notes", cursorOnly }));
  return { nav, last: () => frames.at(-1), opened, setMode: (m) => { mode = m; nav.refresh(); } };
}

test("a short list is Even's list: every row, no body; a tap opens the reported row", () => {
  const s = setup(5);
  assert.deepEqual(s.last().list, ["Note 1", "Note 2", "Note 3", "Note 4", "Note 5"]);
  assert.equal(s.last().body, "");
  s.nav.handle({ type: "tap", row: 3 });
  assert.deepEqual(s.opened, [4]);
});

test("20 rows fit; 45 rows page by 18 with ▲ Previous / ▼ More, and the header says which page", () => {
  assert.equal(setup(20).last().list.length, 20);
  const s = setup(45);
  assert.equal(s.last().list.length, 19);
  assert.equal(s.last().list.at(-1), NATIVE_MORE);
  assert.match(s.last().header, /NOTES · 1\/3/);
  s.nav.handle({ type: "tap", row: 18 }); // ▼ More
  assert.equal(s.last().list[0], NATIVE_PREVIOUS);
  assert.equal(s.last().list[1], "Note 19");
  assert.equal(s.last().list.length, 20);
  s.nav.handle({ type: "tap", row: 1 }); // Note 19
  assert.deepEqual(s.opened, [19]);
  s.nav.handle({ type: "tap", row: 19 }); // ▼ More → page 3
  assert.match(s.last().header, / · 3\/3/);
  assert.deepEqual(s.last().list.slice(-1), ["Note 45"], "the last page has no ▼ More");
  s.nav.handle({ type: "tap", row: 0 }); // ▲ Previous
  assert.match(s.last().header, / · 2\/3/);
});

test("rows are cut to fit Even's limit (63 bytes) and the row width", () => {
  const frames = [];
  const nav = new Navigator({ outputs: [{ show: (f) => frames.push(f) }], onExitRequest: () => {}, listStyle: () => "native" });
  nav.push(() => ({ kind: "list", header: "L", rows: [{ label: "●".repeat(40) }, { label: "A very long note title ".repeat(6) }] }));
  for (const item of frames.at(-1).list) assert.ok(utf8Bytes(item) <= 63, item);
});

test("swipes are the glasses' own on Even's list; the row menu is off there; checklists keep the text cursor", () => {
  const s = setup(5);
  const before = s.last();
  s.nav.handle({ type: "down" });
  assert.equal(s.last(), before, "no redraw for a swipe");
  assert.equal(s.last().menu, undefined, "no Move / Select / Delete on Even's list");
  const c = setup(5, { cursorOnly: true });
  assert.equal(c.last().list, undefined, "a checklist stays on the text cursor");
  assert.match(c.last().body, /> Note 1/);
  assert.ok(c.last().menu, "and keeps its glasses menu");
});

test("switching the setting redraws at once", () => {
  const s = setup(3, { style: "cursor" });
  assert.equal(s.last().list, undefined);
  s.setMode("native");
  assert.deepEqual(s.last().list, ["Note 1", "Note 2", "Note 3"]);
});

test("events: a tap on Even's list reports its row (0 is left out on the wire); double tap", () => {
  assert.deepEqual(toGesture({ listEvent: { containerID: 6, currentSelectItemIndex: 4 } }), { type: "tap", row: 4 });
  assert.deepEqual(toGesture({ listEvent: { containerID: 6 } }), { type: "tap", row: 0 });
  assert.deepEqual(toGesture({ listEvent: { eventType: 3 } }), { type: "double-tap" });
});

test("the page: Even's list container catches the gestures; new rows rebuild; the header alone updates in place", async () => {
  const calls = [];
  const bridge = {
    createStartUpPageContainer: async (p) => { calls.push(["create", p]); return 0; },
    rebuildPageContainer: async (p) => { calls.push(["rebuild", p]); return true; },
    textContainerUpgrade: async (u) => { calls.push(["update", u.containerName]); return true; },
  };
  const out = new EvenOutput(bridge);
  await out.show({ header: "NOTES", body: "", cursor: null, hint: "tap = open", list: ["A", "B"] });
  const page = calls[0][1];
  assert.equal(page.listObject.length, 1);
  assert.equal(page.listObject[0].isEventCapture, 1);
  assert.deepEqual(page.listObject[0].itemContainer.itemName, ["A", "B"]);
  assert.ok(page.textObject.every((t) => t.isEventCapture === 0), "no text box catches gestures");
  await out.show({ header: "NOTES · 00:05", body: "", cursor: null, hint: "tap = open", list: ["A", "B"] });
  assert.deepEqual(calls.at(-1), ["update", "hdr"], "same rows: the header updates in place");
  await out.show({ header: "NOTES", body: "", cursor: null, hint: "tap = open", list: ["A", "B", "C"] });
  assert.equal(calls.at(-1)[0], "rebuild", "new rows: the page is rebuilt");
  await out.show({ header: "NOTE", body: "text", cursor: null, hint: "" });
  assert.equal(calls.at(-1)[0], "rebuild", "back to the text layout: rebuilt");
  assert.equal(calls.at(-1)[1].listObject, undefined);
});
