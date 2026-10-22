// EG2Presentation data: folders of presentations; a presentation is an ordered list of topics, each with a title,
// details and a done flag. One document, saved as JSON in Even's storage and used as-is for Export / Import. Every edit
// checks its input and returns an error to show, or changes the document. Plain TypeScript with no browser APIs, so
// tests run it in Node.

import { checkList, cleanName, cleanText, idOf, isObj, newId, parseDoc, type Validated } from "@eg2apps/shared/doc";
import { moveItem } from "@eg2apps/shared/list";

export const APP = "eg2presentation";
export const SCHEMA = 1;
export const MAX_FOLDERS = 100;
export const MAX_PRESENTATIONS = 100;
export const MAX_TOPICS = 200;

export interface Topic { id: string; title: string; details: string; done: boolean }
export interface Presentation { id: string; name: string; topics: Topic[] }
export interface Folder { id: string; name: string; presentations: Presentation[] }
export interface TalksDoc { app: typeof APP; schema: typeof SCHEMA; folders: Folder[] }

export const emptyDoc = (): TalksDoc => ({ app: APP, schema: SCHEMA, folders: [] });

const ok: Validated<void> = { ok: true, value: undefined };
const fail = (error: string): Validated<never> => ({ ok: false, error });

function checkTopic(v: unknown): Validated<Topic> {
  if (!isObj(v)) return fail("must be an object");
  const title = cleanName(v.title, "title");
  if (!title.ok) return title;
  const details = cleanText(v.details ?? "", "details");
  if (!details.ok) return details;
  return { ok: true, value: { id: idOf(v), title: title.value, details: details.value, done: v.done === true } };
}

function checkPresentation(v: unknown): Validated<Presentation> {
  if (!isObj(v)) return fail("must be an object");
  const name = cleanName(v.name, "name");
  if (!name.ok) return name;
  const topics = checkList(v.topics ?? [], "topics", MAX_TOPICS, checkTopic);
  if (!topics.ok) return topics;
  return { ok: true, value: { id: idOf(v), name: name.value, topics: topics.value } };
}

function checkFolder(v: unknown): Validated<Folder> {
  if (!isObj(v)) return fail("must be an object");
  const name = cleanName(v.name, "name");
  if (!name.ok) return name;
  const ps = checkList(v.presentations ?? [], "presentations", MAX_PRESENTATIONS, checkPresentation);
  if (!ps.ok) return ps;
  return { ok: true, value: { id: idOf(v), name: name.value, presentations: ps.value } };
}

/** Reads a saved or pasted document; unknown fields are dropped. */
export function parseTalks(text: string): Validated<TalksDoc> {
  return parseDoc(text, APP, SCHEMA, (o) => {
    const folders = checkList(o.folders, "folders", MAX_FOLDERS, checkFolder);
    return folders.ok ? { ok: true, value: { app: APP, schema: SCHEMA, folders: folders.value } } : folders;
  });
}

export const serialise = (doc: TalksDoc): string => JSON.stringify(doc, null, 1);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export function summary(doc: TalksDoc): string {
  const ps = doc.folders.reduce((n, f) => n + f.presentations.length, 0);
  const ts = doc.folders.reduce((n, f) => n + f.presentations.reduce((m, p) => m + p.topics.length, 0), 0);
  return `${plural(doc.folders.length, "folder")}, ${plural(ps, "presentation")}, ${plural(ts, "topic")}`;
}

/** "2/5": done of all. */
export const countDone = (topics: Topic[]): string => `${topics.filter((t) => t.done).length}/${topics.length}`;

// ── Finding things ──────────────────────────────────────────────────────────

export const findFolder = (doc: TalksDoc, id: string): Folder | undefined => doc.folders.find((f) => f.id === id);

export function findPresentation(doc: TalksDoc, id: string): { folder: Folder; presentation: Presentation } | undefined {
  for (const folder of doc.folders) {
    const presentation = folder.presentations.find((p) => p.id === id);
    if (presentation) return { folder, presentation };
  }
  return undefined;
}

export const findTopic = (doc: TalksDoc, presentationId: string, topicId: string): Topic | undefined =>
  findPresentation(doc, presentationId)?.presentation.topics.find((t) => t.id === topicId);

// ── Edits ───────────────────────────────────────────────────────────────────

export function addFolder(doc: TalksDoc, name: string): Validated<Folder> {
  if (doc.folders.length >= MAX_FOLDERS) return fail(`you have the most folders there can be (${MAX_FOLDERS})`);
  const n = cleanName(name, "the folder name");
  if (!n.ok) return n;
  const folder: Folder = { id: newId(), name: n.value, presentations: [] };
  doc.folders.push(folder);
  return { ok: true, value: folder };
}

export function renameFolder(doc: TalksDoc, id: string, name: string): Validated<void> {
  const f = findFolder(doc, id);
  if (!f) return fail("that folder no longer exists");
  const n = cleanName(name, "the folder name");
  if (!n.ok) return n;
  f.name = n.value;
  return ok;
}

export const removeFolder = (doc: TalksDoc, id: string): void => { doc.folders = doc.folders.filter((f) => f.id !== id); };
export const moveFolder = (doc: TalksDoc, id: string, d: -1 | 1): boolean => moveItem(doc.folders, doc.folders.findIndex((f) => f.id === id), d);

export function addPresentation(doc: TalksDoc, folderId: string, name: string): Validated<Presentation> {
  const f = findFolder(doc, folderId);
  if (!f) return fail("that folder no longer exists");
  if (f.presentations.length >= MAX_PRESENTATIONS) return fail(`this folder has the most presentations there can be (${MAX_PRESENTATIONS})`);
  const n = cleanName(name, "the presentation name");
  if (!n.ok) return n;
  const p: Presentation = { id: newId(), name: n.value, topics: [] };
  f.presentations.push(p);
  return { ok: true, value: p };
}

export function renamePresentation(doc: TalksDoc, id: string, name: string): Validated<void> {
  const found = findPresentation(doc, id);
  if (!found) return fail("that presentation no longer exists");
  const n = cleanName(name, "the presentation name");
  if (!n.ok) return n;
  found.presentation.name = n.value;
  return ok;
}

export function removePresentation(doc: TalksDoc, id: string): void {
  const found = findPresentation(doc, id);
  if (found) found.folder.presentations = found.folder.presentations.filter((p) => p.id !== id);
}

export function movePresentation(doc: TalksDoc, id: string, d: -1 | 1): boolean {
  const found = findPresentation(doc, id);
  return found ? moveItem(found.folder.presentations, found.folder.presentations.indexOf(found.presentation), d) : false;
}

/** Adds topics: one per line of `titles` (paste a whole outline at once). */
export function addTopics(doc: TalksDoc, presentationId: string, titles: string): Validated<Topic[]> {
  const found = findPresentation(doc, presentationId);
  if (!found) return fail("that presentation no longer exists");
  const lines = titles.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return fail("the topic can't be empty");
  if (found.presentation.topics.length + lines.length > MAX_TOPICS) return fail(`a presentation can have at most ${MAX_TOPICS} topics`);
  const added: Topic[] = [];
  for (const line of lines) {
    const t = cleanName(line, "a topic");
    if (!t.ok) return t;
    added.push({ id: newId(), title: t.value, details: "", done: false });
  }
  found.presentation.topics.push(...added);
  return { ok: true, value: added };
}

export function editTopic(doc: TalksDoc, presentationId: string, topicId: string, title: string, details: string): Validated<void> {
  const t = findTopic(doc, presentationId, topicId);
  if (!t) return fail("that topic no longer exists");
  const n = cleanName(title, "the topic title");
  if (!n.ok) return n;
  const d = cleanText(details, "the details");
  if (!d.ok) return d;
  t.title = n.value;
  t.details = d.value;
  return ok;
}

export function setTopicDone(doc: TalksDoc, presentationId: string, topicId: string, done: boolean): void {
  const t = findTopic(doc, presentationId, topicId);
  if (t) t.done = done;
}

export function removeTopic(doc: TalksDoc, presentationId: string, topicId: string): void {
  const found = findPresentation(doc, presentationId);
  if (found) found.presentation.topics = found.presentation.topics.filter((t) => t.id !== topicId);
}

export function moveTopic(doc: TalksDoc, presentationId: string, topicId: string, d: -1 | 1): boolean {
  const ts = findPresentation(doc, presentationId)?.presentation.topics;
  return ts ? moveItem(ts, ts.findIndex((t) => t.id === topicId), d) : false;
}

/** Clears every topic's done flag (ready to give the talk again). */
export function resetDone(doc: TalksDoc, presentationId: string): void {
  for (const t of findPresentation(doc, presentationId)?.presentation.topics ?? []) t.done = false;
}
