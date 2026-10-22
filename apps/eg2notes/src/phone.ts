// EG2Notes on the phone: where notes are created and edited. The list of notes (add, open, tick done, reorder), a
// note (title, done, checklist: add, tick, rename, reorder, delete, check / uncheck all, clear ticked; text; delete),
// Backup (export / import) and the privacy note. Same data as the glasses; every change redraws both.

import { backupSection, button, confirmButton, el, listStyleSection, moveButtons, Panel, privacyNote, themeSection, type ListStyle, type Theme, type Validated } from "@eg2apps/shared";
import {
  addItem, addNote, clearDone, countDone, findNote, moveCheckItem, moveNote, parseNotes, removeItem, removeNote,
  renameItem, renameNote, serialise, setAllItems, setNoteText, summary, toggleItem, toggleNoteDone,
  type CheckItem, type Note, type NotesDoc,
} from "./notes.ts";

const box = (done: boolean) => (done ? "■" : "□");

export interface NotesPhoneOptions {
  root: HTMLElement;
  doc: () => NotesDoc;
  /** Runs an edit, then saves and redraws (refused while saved data couldn't be read). */
  edit: <T>(fn: (doc: NotesDoc) => Validated<T> | T) => Validated<T> | T;
  /** Replaces the whole document (Import). */
  replace: (doc: NotesDoc) => void;
  /** Set when the saved data couldn't be read: shown so it can be copied before anything else happens. */
  damaged: () => string | null;
  theme: () => Theme;
  setTheme: (t: Theme) => void;
  lists: () => ListStyle;
  setLists: (s: ListStyle) => void;
}

export class NotesPhone {
  private readonly opts: NotesPhoneOptions;
  private readonly panel: Panel;
  private openId: string | null = null;
  private renamingId: string | null = null;

  constructor(opts: NotesPhoneOptions) {
    this.opts = opts;
    this.panel = new Panel(opts.root, () => this.view());
  }

  render(): void {
    this.panel.render();
  }

  showError(message: string): void {
    this.panel.say(message);
  }

  private go(id: string | null): void {
    this.openId = id;
    this.renamingId = null;
    this.panel.clearDrafts();
    this.render();
    window.scrollTo(0, 0);
  }

  private edit<T>(fn: (doc: NotesDoc) => Validated<T> | T): Validated<unknown> {
    const r = this.opts.edit(fn);
    return r && typeof r === "object" && "ok" in r ? (r as Validated<unknown>) : { ok: true, value: r };
  }

  private view(): HTMLElement[] {
    const damaged = this.opts.damaged();
    if (damaged !== null) return [this.damagedView(damaged)];
    const note = this.openId ? findNote(this.opts.doc(), this.openId) : undefined;
    if (this.openId && !note) this.openId = null; // deleted (e.g. from the glasses)
    return note ? this.noteView(note) : this.listView();
  }

  private damagedView(raw: string): HTMLElement {
    const card = el("section", "card");
    const area = el("textarea", "text-area mono");
    area.value = raw;
    area.readOnly = true;
    area.setAttribute("aria-label", "Saved data that couldn't be read");
    card.append(
      el("h2", "", "Your saved notes couldn't be read"),
      el("p", "", "Nothing has been changed or deleted. Copy the text below and keep it, then import a good export, or contact the developer with it."),
      area,
    );
    return card;
  }

  // ── All notes ────────────────────────────────────────────────────────────
  private listView(): HTMLElement[] {
    const doc = this.opts.doc();
    const add = this.panel.boxRow("New note", "new-note", "Add", (v) => this.edit((d) => addNote(d, v)), { stay: true });
    const list = el("section", "card");
    list.append(el("h2", "", `Notes (${doc.notes.length})`));
    if (!doc.notes.length) list.append(el("p", "muted", "No notes yet. Add one above: it appears on your glasses too."));
    const ul = el("ul", "rows");
    for (const n of doc.notes) {
      const li = el("li", "item-row");
      const open = button(n.title, () => this.go(n.id), `title-btn${n.done ? " done" : ""}`, `Open ${n.title}`);
      if (n.items.length) open.append(el("span", "count", countDone(n.items)));
      li.append(
        button(box(n.done), () => this.edit((d) => toggleNoteDone(d, n.id)), "icon-btn", n.done ? `Mark ${n.title} open` : `Mark ${n.title} done`),
        open,
        ...moveButtons(n.title, (delta) => this.edit((d) => moveNote(d, n.id, delta))),
      );
      ul.append(li);
    }
    list.append(ul);
    return [add, list, themeSection(this.opts.theme(), (t) => this.opts.setTheme(t)), listStyleSection(this.opts.lists(), (s) => this.opts.setLists(s)), this.backup(), privacyNote("EG2Notes")];
  }

  private backup(): HTMLElement {
    return backupSection({
      panel: this.panel,
      appName: "EG2Notes",
      exportText: () => serialise(this.opts.doc()),
      preview: (text) => {
        const r = parseNotes(text.trim());
        if (!r.ok) return r;
        return { ok: true, value: { summary: summary(r.value), apply: () => this.opts.replace(r.value) } };
      },
    });
  }

  // ── One note ─────────────────────────────────────────────────────────────
  private noteView(n: Note): HTMLElement[] {
    const back = button("◀ All notes", () => this.go(null), "btn back");
    const title = this.panel.boxRow("Title", `title:${n.id}`, "Save", (v) => this.edit((d) => renameNote(d, n.id, v)), { value: n.title });
    const done = button(n.done ? "Mark note open" : "Mark note done", () => this.edit((d) => toggleNoteDone(d, n.id)));

    const list = el("section", "card");
    list.append(el("h2", "", `Checklist${n.items.length ? ` (${countDone(n.items)})` : ""}`));
    const ul = el("ul", "rows");
    for (const it of n.items) ul.append(this.itemRow(n, it));
    list.append(ul, this.panel.boxRow("Add an item", `new-item:${n.id}`, "Add", (v) => this.edit((d) => addItem(d, n.id, v)), { stay: true }));
    if (n.items.length) {
      const bulk = el("div", "row wrap");
      bulk.append(
        button("Check all", () => this.edit((d) => setAllItems(d, n.id, true))),
        button("Uncheck all", () => this.edit((d) => setAllItems(d, n.id, false))),
        confirmButton("Clear ticked", "Tap again to clear", () => this.edit((d) => clearDone(d, n.id))),
      );
      list.append(bulk);
    }

    const text = el("section", "card");
    text.append(this.panel.areaRow("Note text (on the glasses under ≡ Note text)", `text:${n.id}`, "Save text", n.text, (v) => this.edit((d) => setNoteText(d, n.id, v))));

    const danger = el("div", "row");
    danger.append(confirmButton("Delete note", "Tap again to delete", () => { this.edit((d) => removeNote(d, n.id)); this.go(null); }));
    return [back, title, done, list, text, danger];
  }

  private itemRow(n: Note, it: CheckItem): HTMLElement {
    const li = el("li", "item-row");
    if (this.renamingId === it.id) {
      const row = this.panel.boxRow("Rename item", `rename:${it.id}`, "Save", (v) => {
        this.renamingId = null; // set before the save redraws the page
        const r = this.edit((d) => renameItem(d, n.id, it.id, v));
        if (!r.ok) this.renamingId = it.id;
        return r;
      }, { value: it.text });
      li.append(row, button("Cancel", () => { this.renamingId = null; this.render(); }));
      return li;
    }
    li.append(
      button(box(it.done), () => this.edit((d) => toggleItem(d, n.id, it.id)), "icon-btn", it.done ? `Untick ${it.text}` : `Tick ${it.text}`),
      button(it.text, () => { this.renamingId = it.id; this.render(); }, `title-btn${it.done ? " done" : ""}`, `Rename ${it.text}`),
      ...moveButtons(it.text, (delta) => this.edit((d) => moveCheckItem(d, n.id, it.id, delta))),
      confirmButton("✕", "Delete?", () => this.edit((d) => removeItem(d, n.id, it.id)), "icon-btn danger", `Delete ${it.text}`),
    );
    return li;
  }
}
