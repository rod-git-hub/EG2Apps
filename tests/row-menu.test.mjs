// The glasses menu: Move up / Move down follow the item; Delete always asks first; Select marks rows and deletes them
// with one confirmation; an opened item's page closes when it's deleted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Navigator } from "../packages/shared/src/navigator.ts";
import { MENU_IDS, MenuActions } from "../packages/shared/src/row-menu.ts";
import { moveItem } from "../packages/shared/src/list.ts";

function setup(names = ["Groceries", "Packing", "Ideas"]) {
  const items = names.map((name, i) => ({ id: `n${i}`, name }));
  const frames = [];
  let changes = 0;
  const actions = new MenuActions(() => changes++);
  const nav = new Navigator({
    outputs: [{ show: (f) => frames.push(f) }],
    onExitRequest: () => {},
    onMenu: (id, screen, row) => actions.handle(id, screen, row),
    menuFor: (screen) => actions.menuFor(screen),
    decorate: (screen) => actions.decorate(screen),
  });
  actions.attach(nav);
  const rowFor = (it) => ({
    label: it.name, id: it.id,
    onSelect: () => nav.push(() => ({ kind: "text", header: it.name.toUpperCase(), body: "…", menu: menuOf(it) })),
    menu: menuOf(it),
  });
  const menuOf = (it) => ({
    name: it.name,
    move: (d) => moveItem(items, items.indexOf(it), d),
    remove: () => items.splice(items.indexOf(it), 1),
  });
  nav.push(() => ({ kind: "list", header: "NOTES", selectKey: "notes", rows: [{ label: "+ New on your phone" }, ...items.map(rowFor)] }));
  return { nav, items, frames, last: () => frames.at(-1), changes: () => changes };
}

test("the menu: Move up, Move down, Select, Delete on lists; the same items keep the same key", () => {
  const s = setup();
  assert.deepEqual(s.last().menu.items.map((i) => i.name), ["Move up", "Move down", "Select", "Delete"]);
});

test("Move down moves the item and the cursor follows it; at the edge nothing happens", () => {
  const s = setup();
  s.nav.handle({ type: "down" }); // Groceries
  s.nav.handle({ type: "menu", itemId: MENU_IDS.moveDown });
  assert.deepEqual(s.items.map((i) => i.name), ["Packing", "Groceries", "Ideas"]);
  assert.match(s.last().body, /> Groceries/);
  s.nav.handle({ type: "down" });
  s.nav.handle({ type: "menu", itemId: MENU_IDS.moveDown });
  assert.equal(s.changes(), 1, "Ideas is last: no change");
});

test("Delete asks first; double tap cancels; tap deletes", () => {
  const s = setup();
  s.nav.handle({ type: "down" });
  s.nav.handle({ type: "menu", itemId: MENU_IDS.delete });
  assert.equal(s.last().header, "DELETE?");
  assert.match(s.last().body, /Delete "Groceries"\?/);
  s.nav.handle({ type: "double-tap" });
  assert.equal(s.items.length, 3, "cancelled");
  s.nav.handle({ type: "menu", itemId: MENU_IDS.delete });
  s.nav.handle({ type: "tap" });
  assert.deepEqual(s.items.map((i) => i.name), ["Packing", "Ideas"]);
  assert.equal(s.last().header, "NOTES");
});

test("deleting an opened note closes its page too", () => {
  const s = setup();
  s.nav.handle({ type: "down" });
  s.nav.handle({ type: "tap" }); // open Groceries
  s.nav.handle({ type: "menu", itemId: MENU_IDS.delete });
  s.nav.handle({ type: "tap" });
  assert.equal(s.last().header, "NOTES");
  assert.equal(s.items.length, 2);
});

test("Select marks rows (★/☆), deletes them with one confirmation; double tap leaves select mode", () => {
  const s = setup();
  s.nav.handle({ type: "down" }); // Groceries
  s.nav.handle({ type: "menu", itemId: MENU_IDS.select });
  assert.match(s.last().header, /SELECT/);
  assert.match(s.last().body, /> ★ Groceries/);
  s.nav.handle({ type: "down" }); // Packing
  s.nav.handle({ type: "tap" }); // select it
  assert.match(s.last().body, /■ Delete 2 selected/);
  s.nav.setCursor(0);
  s.nav.handle({ type: "tap" }); // Delete 2 selected
  assert.match(s.last().body, /Delete 2 selected items\?/);
  s.nav.handle({ type: "tap" });
  assert.deepEqual(s.items.map((i) => i.name), ["Ideas"]);
  assert.doesNotMatch(s.last().header, /SELECT/, "select mode ended");
  s.nav.handle({ type: "menu", itemId: MENU_IDS.select });
  s.nav.handle({ type: "double-tap" });
  assert.equal(s.last().header, "NOTES", "double tap leaves select mode, stays on the list");
});
