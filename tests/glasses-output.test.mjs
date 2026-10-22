// The glasses page: built once, then only changed boxes are updated in place; a menu change rebuilds; a refused page
// is replaced by a plain one (Even answers false and keeps the old page). And raw events → gestures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EvenOutput, toGesture, toLifecycle } from "../packages/shared/src/glasses-output.ts";

function fakeBridge({ refuse = () => false } = {}) {
  const calls = [];
  return {
    calls,
    createStartUpPageContainer: async (p) => { calls.push(["create", p]); return 0; },
    rebuildPageContainer: async (p) => { calls.push(["rebuild", p]); return !refuse(p); },
    textContainerUpgrade: async (u) => { calls.push(["update", u.containerName, u.content]); return true; },
  };
}

const frame = (over = {}) => ({ header: "NOTES", body: "> Groceries", cursor: 0, hint: "tap = open", ...over });

test("first frame builds the page (5 boxes, one catching gestures); later frames update only what changed", async () => {
  const b = fakeBridge();
  const out = new EvenOutput(b);
  await out.show(frame());
  assert.equal(b.calls[0][0], "create");
  const boxes = b.calls[0][1].textObject;
  assert.equal(boxes.length, 5);
  assert.equal(boxes.filter((t) => t.isEventCapture === 1).length, 1, "one box catches gestures");
  assert.equal(boxes.find((t) => t.isEventCapture === 1).content.trim(), "", "and it's empty (no bounce)");
  await out.show(frame({ body: "  Groceries\n> Packing" }));
  assert.deepEqual(b.calls.slice(1).map((c) => c.slice(0, 2)), [["update", "body"]], "only the body was sent");
  await out.show(frame({ body: "  Groceries\n> Packing" }));
  assert.equal(b.calls.length, 2, "nothing changed: nothing sent");
});

test("a different glasses menu rebuilds the page (Even sets menus only then)", async () => {
  const b = fakeBridge();
  const out = new EvenOutput(b);
  await out.show(frame());
  await out.show(frame({ menu: { key: "2,3,4", items: [{ name: "Move up", id: 2 }, { name: "Move down", id: 3 }, { name: "Delete", id: 4 }] } }));
  const [kind, page] = b.calls.at(-1);
  assert.equal(kind, "rebuild");
  assert.deepEqual(page.menuObject.menuItems.map((m) => m.itemID), [2, 3, 4]);
});

test("a refused page is replaced by a plain one, never left stale", async () => {
  const errors = [];
  const b = fakeBridge({ refuse: (p) => p.textObject[2].content !== "Couldn't show this page." });
  const out = new EvenOutput(b, (m) => errors.push(m));
  await out.show(frame()); // create succeeds
  await out.show(frame({ menu: { key: "x", items: [{ name: "Delete", id: 4 }] } })); // rebuild refused
  const shown = b.calls.at(-1)[1].textObject[2].content;
  assert.equal(shown, "Couldn't show this page.");
  assert.match(errors[0], /refused/);
});

test("events → gestures: tap (type left out), double tap, swipes, menu picks; lifecycle", () => {
  assert.deepEqual(toGesture({ sysEvent: { eventSource: 2 } }), { type: "tap" });
  assert.deepEqual(toGesture({ textEvent: {} }), { type: "tap" });
  assert.deepEqual(toGesture({ sysEvent: { eventType: 3 } }), { type: "double-tap" });
  assert.deepEqual(toGesture({ textEvent: { eventType: 1 } }), { type: "up" });
  assert.deepEqual(toGesture({ textEvent: { eventType: 2 } }), { type: "down" });
  assert.deepEqual(toGesture({ menuItemClickEvent: { itemID: 4 } }), { type: "menu", itemId: 4 });
  assert.equal(toGesture({ sysEvent: { eventType: 4 } }), null);
  assert.equal(toGesture({ sysEvent: { eventType: 10 } }), null, "a long-press release is no gesture");
  assert.equal(toLifecycle({ sysEvent: { eventType: 4 } }), "even-took");
  assert.equal(toLifecycle({ sysEvent: { eventType: 5 } }), "even-gave");
  assert.equal(toLifecycle({ sysEvent: { eventType: 7 } }), "closed");
  assert.equal(toLifecycle({ sysEvent: {} }), null);
});

test("a refused first page doesn't leave the glasses blank: the plain page is created instead", async () => {
  const calls = [];
  const bridge = {
    // Even refuses the first page it's asked to create (e.g. a layout it doesn't take at start-up)…
    createStartUpPageContainer: async (p) => { calls.push(["create", p]); return p.textObject[2]?.content === "Couldn't show this page." ? 0 : 1; },
    rebuildPageContainer: async (p) => { calls.push(["rebuild", p]); return false; }, // …and nothing exists to rebuild yet
    textContainerUpgrade: async () => true,
  };
  const out = new EvenOutput(bridge);
  await out.show({ header: "NOTES", body: "", cursor: null, hint: "", list: ["A"] });
  const created = calls.filter((c) => c[0] === "create");
  assert.equal(created.length, 2, "asked to create again with the plain page");
  assert.equal(created[1][1].textObject[2].content, "Couldn't show this page.");
});
