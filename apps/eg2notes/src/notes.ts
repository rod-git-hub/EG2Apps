// EG2Notes data: notes, each with a title, optional text, a done flag and an optional checklist. One document, saved
// as JSON in Even's storage and used as-is for Export / Import. Every edit is a small function that checks its input
// and returns an error to show, or changes the document. Plain TypeScript with no browser APIs, so tests run it in Node.

import { checkList, cleanName, cleanText, idOf, isObj, newId, parseDoc, type Validated } from "@eg2apps/shared/doc";
import { moveItem } from "@eg2apps/shared/list";

export const APP = "eg2notes";
export const SCHEMA = 1;
export const MAX_NOTES = 500;
export const MAX_ITEMS = 200;

export interface CheckItem { id: string; text: string; done: boolean }
export interface Note { id: string; title: string; text: string; done: boolean; items: CheckItem[] }
export interface NotesDoc { app: typeof APP; schema: typeof SCHEMA; notes: Note[] }

export const emptyDoc = (): NotesDoc => ({ app: APP, schema: SCHEMA, notes: [] });

const ok: Validated<void> = { ok: true, value: undefined };
const fail = (error: string): Validated<never> => ({ ok: false, error });

function checkItem(v: unknown): Validated<CheckItem> {
  if (!isObj(v)) return fail("must be an object");
  const text = cleanName(v.text, "text");
  if (!text.ok) return text;
  return { ok: true, value: { id: idOf(v), text: text.value, done: v.done === true } };
}

function checkNote(v: unknown): Validated<Note> {
  if (!isObj(v)) return fail("must be an object");
  const title = cleanName(v.title, "title");
  if (!title.ok) return title;
  const text = cleanText(v.text ?? "", "text");
  if (!text.ok) return text;
  const items = checkList(v.items ?? [], "checklist items", MAX_ITEMS, checkItem);
  if (!items.ok) return items;
  return { ok: true, value: { id: idOf(v), title: title.value, text: text.value, done: v.done === true, items: items.value } };
}

/** Reads a saved or pasted document; unknown fields are dropped. */
export function parseNotes(text: string): Validated<NotesDoc> {
  return parseDoc(text, APP, SCHEMA, (o) => {
    const notes = checkList(o.notes, "notes", MAX_NOTES, checkNote);
    return notes.ok ? { ok: true, value: { app: APP, schema: SCHEMA, notes: notes.value } } : notes;
  });
}

export const serialise = (doc: NotesDoc): string => JSON.stringify(doc, null, 1);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export function summary(doc: NotesDoc): string {
  const items = doc.notes.reduce((n, x) => n + x.items.length, 0);
  return `${plural(doc.notes.length, "note")}${items ? ` with ${plural(items, "checklist item")}` : ""}`;
}

/** "2/5": ticked of all, for notes with a checklist. */
export const countDone = (items: CheckItem[]): string => `${items.filter((i) => i.done).length}/${items.length}`;

// ── Edits ───────────────────────────────────────────────────────────────────

export const findNote = (doc: NotesDoc, id: string): Note | undefined => doc.notes.find((n) => n.id === id);

export function addNote(doc: NotesDoc, title: string): Validated<Note> {
  if (doc.notes.length >= MAX_NOTES) return fail(`you have the most notes there can be (${MAX_NOTES})`);
  const t = cleanName(title, "the title");
  if (!t.ok) return t;
  const note: Note = { id: newId(), title: t.value, text: "", done: false, items: [] };
  doc.notes.unshift(note); // newest first
  return { ok: true, value: note };
}

export function renameNote(doc: NotesDoc, id: string, title: string): Validated<void> {
  const n = findNote(doc, id);
  if (!n) return fail("that note no longer exists");
  const t = cleanName(title, "the title");
  if (!t.ok) return t;
  n.title = t.value;
  return ok;
}

export function setNoteText(doc: NotesDoc, id: string, text: string): Validated<void> {
  const n = findNote(doc, id);
  if (!n) return fail("that note no longer exists");
  const t = cleanText(text, "the text");
  if (!t.ok) return t;
  n.text = t.value;
  return ok;
}

export function toggleNoteDone(doc: NotesDoc, id: string): void {
  const n = findNote(doc, id);
  if (n) n.done = !n.done;
}

export function removeNote(doc: NotesDoc, id: string): void {
  doc.notes = doc.notes.filter((n) => n.id !== id);
}

export function moveNote(doc: NotesDoc, id: string, delta: -1 | 1): boolean {
  return moveItem(doc.notes, doc.notes.findIndex((n) => n.id === id), delta);
}

export function addItem(doc: NotesDoc, noteId: string, text: string): Validated<CheckItem> {
  const n = findNote(doc, noteId);
  if (!n) return fail("that note no longer exists");
  if (n.items.length >= MAX_ITEMS) return fail(`this checklist has the most items there can be (${MAX_ITEMS})`);
  const t = cleanName(text, "the item");
  if (!t.ok) return t;
  const item: CheckItem = { id: newId(), text: t.value, done: false };
  n.items.push(item);
  return { ok: true, value: item };
}

const findItem = (doc: NotesDoc, noteId: string, itemId: string) => findNote(doc, noteId)?.items.find((i) => i.id === itemId);

export function renameItem(doc: NotesDoc, noteId: string, itemId: string, text: string): Validated<void> {
  const it = findItem(doc, noteId, itemId);
  if (!it) return fail("that item no longer exists");
  const t = cleanName(text, "the item");
  if (!t.ok) return t;
  it.text = t.value;
  return ok;
}

export function toggleItem(doc: NotesDoc, noteId: string, itemId: string): void {
  const it = findItem(doc, noteId, itemId);
  if (it) it.done = !it.done;
}

export function removeItem(doc: NotesDoc, noteId: string, itemId: string): void {
  const n = findNote(doc, noteId);
  if (n) n.items = n.items.filter((i) => i.id !== itemId);
}

export function moveCheckItem(doc: NotesDoc, noteId: string, itemId: string, delta: -1 | 1): boolean {
  const n = findNote(doc, noteId);
  return n ? moveItem(n.items, n.items.findIndex((i) => i.id === itemId), delta) : false;
}

export function setAllItems(doc: NotesDoc, noteId: string, done: boolean): void {
  for (const it of findNote(doc, noteId)?.items ?? []) it.done = done;
}

/** Removes the ticked items; returns how many. */
export function clearDone(doc: NotesDoc, noteId: string): number {
  const n = findNote(doc, noteId);
  if (!n) return 0;
  const before = n.items.length;
  n.items = n.items.filter((i) => !i.done);
  return before - n.items.length;
}
