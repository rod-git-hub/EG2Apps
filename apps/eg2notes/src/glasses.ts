// EG2Notes on the glasses: the list of notes, a note (its text row, done row and checklist: tap = tick), the note's
// text a page at a time. Creating and editing happen on the phone; the glasses tick, mark done, move and delete
// (glasses menu, every delete confirmed). Screens are built by id on every redraw, so phone edits show up at once.

import type { Navigator, Row, RowMenu, Screen } from "@eg2apps/shared";
import {
  countDone, findNote, moveCheckItem, moveNote, removeItem, removeNote, toggleItem, toggleNoteDone,
  type Note, type NotesDoc,
} from "./notes.ts";

const box = (done: boolean) => (done ? "■" : "□");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export interface NotesScreens {
  notesList: () => Screen;
}

/** `doc()` gives the current document; `changed()` saves and redraws after an edit. */
export function notesScreens(doc: () => NotesDoc, nav: Navigator, changed: () => void): NotesScreens {
  const noteMenu = (n: Note): RowMenu => ({
    name: n.title,
    move: (d) => moveNote(doc(), n.id, d),
    remove: () => removeNote(doc(), n.id),
    ...(n.items.length ? { contains: `${plural(n.items.length, "checklist item")}` } : {}),
  });

  const gone = (): Screen => ({ kind: "text", header: "NOTES", body: "This note was deleted.\n\n(double tap = back)" });

  const noteText = (id: string): Screen => {
    const n = findNote(doc(), id);
    if (!n) return gone();
    return { kind: "text", header: n.title.toUpperCase(), body: n.text || "(no text)", hint: "swipe = page · double tap = back", menu: noteMenu(n) };
  };

  const note = (id: string): Screen => {
    const n = findNote(doc(), id);
    if (!n) return gone();
    const actions: Row[] = [
      ...(n.text ? [{ label: "≡ Note text", onSelect: () => nav.push(() => noteText(id)) }] : []),
      { label: n.done ? "● Mark note open" : "● Mark note done", onSelect: () => { toggleNoteDone(doc(), id); changed(); } },
    ];
    const items: Row[] = n.items.map((it) => ({
      label: `${box(it.done)} ${it.text}`,
      id: it.id,
      onSelect: () => { toggleItem(doc(), id, it.id); changed(); }, // tap = tick; the cursor stays on the row
      menu: { name: it.text, move: (d) => moveCheckItem(doc(), id, it.id, d), remove: () => removeItem(doc(), id, it.id) },
    }));
    return {
      kind: "list",
      header: `${n.title.toUpperCase()}${n.items.length ? ` · ${countDone(n.items)}` : ""}`,
      selectKey: `items:${id}`,
      cursorOnly: items.length > 0, // a tick changes the list: Even's list would jump back to the top
      rows: items.length ? [...actions, { label: "", spacer: true }, ...items] : actions,
      hint: items.length ? "tap = tick · double tap = back" : "tap = choose · double tap = back",
    };
  };

  const notesList = (): Screen => ({
    kind: "list",
    header: "", // the wordmark in the corner names the app
    selectKey: "notes",
    empty: "No notes yet. Add one on your phone.",
    rows: doc().notes.map((n) => ({
      label: `${box(n.done)} ${n.title}${n.items.length ? ` (${countDone(n.items)})` : ""}`,
      id: n.id,
      onSelect: () => nav.push(() => note(n.id)),
      menu: noteMenu(n),
    })),
  });

  return { notesList };
}
