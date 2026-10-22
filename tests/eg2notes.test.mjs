// EG2Notes: the data model's edits and its strict check (saved data and Import), and the glasses screens.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as N from "../apps/eg2notes/src/notes.ts";
import { notesScreens } from "../apps/eg2notes/src/glasses.ts";
import { Navigator } from "../packages/shared/src/navigator.ts";
import { DOC_MAX_CHARS, NAME_MAX_CHARS, TEXT_MAX_CHARS } from "../packages/shared/src/doc.ts";

test("edits: add (newest first, trimmed), rename, text, tick, move, clear ticked, remove", () => {
  const d = N.emptyDoc();
  const a = N.addNote(d, "  Groceries ");
  const b = N.addNote(d, "Packing");
  assert.ok(a.ok && b.ok);
  assert.deepEqual(d.notes.map((n) => n.title), ["Packing", "Groceries"]);
  assert.equal(N.addNote(d, "   ").ok, false, "empty titles are refused");
  const id = a.value.id;
  for (const t of ["Milk", "Bread", "Eggs"]) assert.ok(N.addItem(d, id, t).ok);
  const [milk, bread] = N.findNote(d, id).items;
  N.toggleItem(d, id, bread.id);
  assert.equal(N.countDone(N.findNote(d, id).items), "1/3");
  assert.ok(N.moveCheckItem(d, id, milk.id, 1));
  assert.deepEqual(N.findNote(d, id).items.map((i) => i.text), ["Bread", "Milk", "Eggs"]);
  assert.equal(N.moveCheckItem(d, id, milk.id, 1) && N.moveCheckItem(d, id, milk.id, 1), false, "can't move past the end");
  assert.equal(N.clearDone(d, id), 1);
  assert.ok(N.renameNote(d, id, "Shopping").ok);
  assert.ok(N.setNoteText(d, id, "line 1\r\nline 2   ").ok);
  assert.equal(N.findNote(d, id).text, "line 1\nline 2");
  assert.ok(N.moveNote(d, id, -1));
  assert.equal(d.notes[0].title, "Shopping");
  N.removeNote(d, id);
  assert.deepEqual(d.notes.map((n) => n.title), ["Packing"]);
});

test("limits: names, text, number of notes and items", () => {
  const d = N.emptyDoc();
  assert.equal(N.addNote(d, "x".repeat(NAME_MAX_CHARS + 1)).ok, false);
  const n = N.addNote(d, "ok");
  assert.equal(N.setNoteText(d, n.value.id, "y".repeat(TEXT_MAX_CHARS + 1)).ok, false);
  for (let i = 0; i < N.MAX_ITEMS; i++) N.addItem(d, n.value.id, `i${i}`);
  assert.equal(N.addItem(d, n.value.id, "one too many").ok, false);
});

test("export → import round trip keeps everything; unknown fields are dropped", () => {
  const d = N.emptyDoc();
  const n = N.addNote(d, "Trip");
  N.addItem(d, n.value.id, "Passport");
  N.setNoteText(d, n.value.id, "Gate 12");
  const r = N.parseNotes(N.serialise(d));
  assert.ok(r.ok);
  assert.deepEqual(r.value, d);
  const extra = JSON.parse(N.serialise(d));
  extra.notes[0].secret = "x";
  extra.tracking = true;
  assert.deepEqual(Object.keys(N.parseNotes(JSON.stringify(extra)).value.notes[0]).sort(), ["done", "id", "items", "text", "title"]);
});

test("the strict check refuses bad imports with a clear reason and changes nothing", () => {
  const bad = (o) => N.parseNotes(typeof o === "string" ? o : JSON.stringify(o));
  assert.match(bad("not json").error, /isn't JSON/);
  assert.match(bad({ app: "other", schema: 1, notes: [] }).error, /isn't from eg2notes/);
  assert.match(bad({ app: "eg2notes", schema: 2, notes: [] }).error, /format/);
  assert.match(bad({ app: "eg2notes", schema: 1, notes: {} }).error, /must be a list/);
  assert.match(bad({ app: "eg2notes", schema: 1, notes: [{ title: "" }] }).error, /notes 1: title can't be empty/);
  assert.match(bad({ app: "eg2notes", schema: 1, notes: [{ title: 5 }] }).error, /title must be text/);
  assert.match(bad({ app: "eg2notes", schema: 1, notes: [{ id: "a", title: "x" }, { id: "a", title: "y" }] }).error, /duplicate id/);
  assert.match(bad(" ".repeat(DOC_MAX_CHARS + 1)).error, /too big/);
  const many = { app: "eg2notes", schema: 1, notes: Array.from({ length: N.MAX_NOTES + 1 }, (_, i) => ({ title: `n${i}` })) };
  assert.match(bad(many).error, /too many notes/);
});

test("hostile text is kept as plain text (shown with textContent, never run)", () => {
  const r = N.parseNotes(JSON.stringify({ app: "eg2notes", schema: 1, notes: [{ title: "<img src=x onerror=alert(1)>", text: "<script>x</script>" }] }));
  assert.ok(r.ok);
  assert.equal(r.value.notes[0].title, "<img src=x onerror=alert(1)>");
});

function glasses(doc) {
  const frames = [];
  let saves = 0;
  const nav = new Navigator({ outputs: [{ show: (f) => frames.push(f) }], onExitRequest: () => {} });
  const screens = notesScreens(() => doc, nav, () => { saves++; nav.refresh(); });
  nav.push(screens.notesList);
  return { nav, last: () => frames.at(-1), saves: () => saves };
}

test("glasses: the list shows done boxes and ticked counts; an empty list says where to add notes", () => {
  const d = N.emptyDoc();
  assert.match(glasses(d).last().body, /No notes yet\. Add one on your phone\./);
  const n = N.addNote(d, "Groceries");
  N.addItem(d, n.value.id, "Milk");
  N.addItem(d, n.value.id, "Bread");
  N.toggleItem(d, n.value.id, n.value.items[0].id);
  assert.match(glasses(d).last().body, /> □ Groceries \(1\/2\)/);
});

test("glasses: tap ticks a checklist item, saves, and the cursor stays on it", () => {
  const d = N.emptyDoc();
  const n = N.addNote(d, "Groceries");
  for (const t of ["Milk", "Bread", "Eggs"]) N.addItem(d, n.value.id, t);
  const g = glasses(d);
  g.nav.handle({ type: "tap" }); // open
  assert.match(g.last().header, /GROCERIES · 0\/3/);
  g.nav.handle({ type: "down" }); // past "● Mark note done" (blank line skipped) to Milk
  g.nav.handle({ type: "down" }); // Bread
  g.nav.handle({ type: "tap" });
  assert.equal(g.saves(), 1);
  assert.match(g.last().body, /> ■ Bread/);
  assert.match(g.last().header, /1\/3/);
});

test("glasses: a note with text has a ≡ Note text row that opens its pages", () => {
  const d = N.emptyDoc();
  const n = N.addNote(d, "Ideas");
  N.setNoteText(d, n.value.id, Array.from({ length: 20 }, (_, i) => `Idea ${i + 1}.`).join("\n"));
  const g = glasses(d);
  g.nav.handle({ type: "tap" });
  assert.match(g.last().body, /> ≡ Note text/);
  g.nav.handle({ type: "tap" });
  assert.match(g.last().header, /IDEAS · 1\/3/);
  g.nav.handle({ type: "double-tap" });
  g.nav.handle({ type: "down" });
  g.nav.handle({ type: "tap" }); // ● Mark note done
  assert.equal(d.notes[0].done, true);
});
