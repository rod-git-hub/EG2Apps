// EG2Presentation on the phone: where presentations are created and edited. Folders → a folder's presentations → a
// presentation's topics (add one per line, reorder, mark done, reset) → a topic (title, details, done, delete); the
// stopwatch; Backup (export / import) and the privacy note. Same data as the glasses; every change redraws both.

import { backupSection, button, confirmButton, el, listStyleSection, moveButtons, Panel, privacyNote, themeSection, type ListStyle, type Theme, type Validated } from "@eg2apps/shared";
import { formatElapsed, type Stopwatch } from "./stopwatch.ts";
import {
  addFolder, addPresentation, addTopics, countDone, editTopic, findFolder, findPresentation, findTopic, moveFolder,
  movePresentation, moveTopic, parseTalks, removeFolder, removePresentation, removeTopic, renameFolder,
  renamePresentation, resetDone, serialise, setTopicDone, summary, type Folder, type Presentation, type TalksDoc, type Topic,
} from "./talks.ts";

const tick = (done: boolean) => (done ? "●" : "○");

export interface TalksPhoneOptions {
  root: HTMLElement;
  doc: () => TalksDoc;
  stopwatch: Stopwatch;
  /** Runs an edit, then saves and redraws (refused while saved data couldn't be read). */
  edit: <T>(fn: (doc: TalksDoc) => Validated<T> | T) => Validated<T> | T;
  replace: (doc: TalksDoc) => void;
  damaged: () => string | null;
  theme: () => Theme;
  setTheme: (t: Theme) => void;
  lists: () => ListStyle;
  setLists: (s: ListStyle) => void;
}

type Place = { folder?: string; presentation?: string; topic?: string };

export class TalksPhone {
  private readonly opts: TalksPhoneOptions;
  private readonly panel: Panel;
  private at: Place = {};
  private readonly clock = el("span", "sw-time", "00:00");

  constructor(opts: TalksPhoneOptions) {
    this.opts = opts;
    this.panel = new Panel(opts.root, () => this.view());
    // The stopwatch's time ticks in place (one text change), never redrawing the page while you type.
    setInterval(() => { if (opts.stopwatch.running) this.clock.textContent = formatElapsed(opts.stopwatch.elapsed()); }, 500);
  }

  render(): void {
    this.panel.render();
  }

  showError(message: string): void {
    this.panel.say(message);
  }

  private go(at: Place): void {
    this.at = at;
    this.panel.clearDrafts();
    this.render();
    window.scrollTo(0, 0);
  }

  private edit<T>(fn: (doc: TalksDoc) => Validated<T> | T): Validated<unknown> {
    const r = this.opts.edit(fn);
    return r && typeof r === "object" && "ok" in r ? (r as Validated<unknown>) : { ok: true, value: r };
  }

  private view(): HTMLElement[] {
    const damaged = this.opts.damaged();
    if (damaged !== null) return [this.damagedView(damaged)];
    const doc = this.opts.doc();
    const { folder, presentation, topic } = this.at;
    if (presentation && topic) {
      const found = findPresentation(doc, presentation);
      const t = findTopic(doc, presentation, topic);
      if (found && t) return this.topicView(found.presentation, t);
    }
    if (presentation) {
      const found = findPresentation(doc, presentation);
      if (found) return this.presentationView(found.folder, found.presentation);
    }
    if (folder) {
      const f = findFolder(doc, folder);
      if (f) return this.folderView(f);
    }
    this.at = {}; // what was open has been deleted (e.g. from the glasses)
    return this.foldersView();
  }

  private damagedView(raw: string): HTMLElement {
    const card = el("section", "card");
    const area = el("textarea", "text-area mono");
    area.value = raw;
    area.readOnly = true;
    area.setAttribute("aria-label", "Saved data that couldn't be read");
    card.append(
      el("h2", "", "Your saved presentations couldn't be read"),
      el("p", "", "Nothing has been changed or deleted. Copy the text below and keep it, then import a good export, or contact the developer with it."),
      area,
    );
    return card;
  }

  private stopwatchCard(): HTMLElement {
    const sw = this.opts.stopwatch;
    const card = el("section", "card");
    this.clock.textContent = formatElapsed(sw.elapsed());
    const state = { ready: "Ready", running: "Running", paused: "Paused" }[sw.mode];
    const toggle = button({ ready: "Start", running: "Pause", paused: "Resume" }[sw.mode], () => sw.toggle());
    const reset = confirmButton("Reset", "Tap again to reset", () => sw.reset());
    const row = el("div", "row");
    row.append(toggle, reset);
    const time = el("p", "sw-line");
    time.append(this.clock, el("span", "muted", `  ${state}`));
    card.append(el("h2", "", "Stopwatch"), time, row, el("p", "muted", "Also on the glasses, at the top of a talk's topics. It keeps time while the phone is locked."));
    return card;
  }

  // ── Folders ──────────────────────────────────────────────────────────────
  private foldersView(): HTMLElement[] {
    const doc = this.opts.doc();
    const add = this.panel.boxRow("New folder", "new-folder", "Add", (v) => this.edit((d) => addFolder(d, v)), { stay: true });
    const card = el("section", "card");
    card.append(el("h2", "", `Folders (${doc.folders.length})`));
    if (!doc.folders.length) card.append(el("p", "muted", "No folders yet. Add one above (for example \"Work\"), then your presentations in it."));
    const ul = el("ul", "rows");
    for (const f of doc.folders) {
      const li = el("li", "item-row");
      const open = button(f.name, () => this.go({ folder: f.id }), "title-btn", `Open ${f.name}`);
      open.append(el("span", "count", String(f.presentations.length)));
      li.append(open, ...moveButtons(f.name, (delta) => this.edit((d) => moveFolder(d, f.id, delta))));
      ul.append(li);
    }
    card.append(ul);
    return [add, card, this.stopwatchCard(), themeSection(this.opts.theme(), (t) => this.opts.setTheme(t)), listStyleSection(this.opts.lists(), (s) => this.opts.setLists(s)), this.backup(), privacyNote("EG2Presentation")];
  }

  private backup(): HTMLElement {
    return backupSection({
      panel: this.panel,
      appName: "EG2Presentation",
      exportText: () => serialise(this.opts.doc()),
      preview: (text) => {
        const r = parseTalks(text.trim());
        if (!r.ok) return r;
        return { ok: true, value: { summary: summary(r.value), apply: () => this.opts.replace(r.value) } };
      },
    });
  }

  // ── A folder ─────────────────────────────────────────────────────────────
  private folderView(f: Folder): HTMLElement[] {
    const back = button("◀ All folders", () => this.go({}), "btn back");
    const name = this.panel.boxRow("Folder name", `folder:${f.id}`, "Save", (v) => this.edit((d) => renameFolder(d, f.id, v)), { value: f.name });
    const add = this.panel.boxRow("New presentation", `new-pres:${f.id}`, "Add", (v) => this.edit((d) => addPresentation(d, f.id, v)), { stay: true });
    const card = el("section", "card");
    card.append(el("h2", "", `Presentations (${f.presentations.length})`));
    const ul = el("ul", "rows");
    for (const p of f.presentations) {
      const li = el("li", "item-row");
      const open = button(p.name, () => this.go({ folder: f.id, presentation: p.id }), "title-btn", `Open ${p.name}`);
      open.append(el("span", "count", countDone(p.topics)));
      li.append(open, ...moveButtons(p.name, (delta) => this.edit((d) => movePresentation(d, p.id, delta))));
      ul.append(li);
    }
    card.append(ul, add);
    const danger = el("div", "row");
    danger.append(confirmButton("Delete folder", "Tap again: deletes everything in it", () => { this.edit((d) => removeFolder(d, f.id)); this.go({}); }));
    return [back, name, card, danger];
  }

  // ── A presentation ───────────────────────────────────────────────────────
  private presentationView(f: Folder, p: Presentation): HTMLElement[] {
    const back = button(`◀ ${f.name}`, () => this.go({ folder: f.id }), "btn back");
    const name = this.panel.boxRow("Presentation name", `pres:${p.id}`, "Save", (v) => this.edit((d) => renamePresentation(d, p.id, v)), { value: p.name });
    const card = el("section", "card");
    card.append(el("h2", "", `Topics (${countDone(p.topics)} done)`));
    const ul = el("ul", "rows");
    p.topics.forEach((t, i) => {
      const li = el("li", "item-row");
      li.append(
        button(tick(t.done), () => this.edit((d) => setTopicDone(d, p.id, t.id, !t.done)), "icon-btn", t.done ? `Mark ${t.title} not done` : `Mark ${t.title} done`),
        button(`${i + 1}. ${t.title}`, () => this.go({ folder: f.id, presentation: p.id, topic: t.id }), `title-btn${t.done ? " done" : ""}`, `Edit ${t.title}`),
        ...moveButtons(t.title, (delta) => this.edit((d) => moveTopic(d, p.id, t.id, delta))),
      );
      ul.append(li);
    });
    const addKey = `new-topics:${p.id}`;
    const add = this.panel.areaRow("Add topics: one per line", addKey, "Add topics", "", (v) => this.edit((d) => addTopics(d, p.id, v)));
    card.append(ul, add);
    const tools = el("div", "row wrap");
    if (p.topics.some((t) => t.done)) tools.append(confirmButton("Reset done", "Tap again to reset", () => this.edit((d) => resetDone(d, p.id)), "btn"));
    tools.append(confirmButton("Delete presentation", "Tap again to delete", () => { this.edit((d) => removePresentation(d, p.id)); this.go({ folder: f.id }); }));
    return [back, name, this.stopwatchCard(), card, tools];
  }

  // ── A topic ──────────────────────────────────────────────────────────────
  private topicView(p: Presentation, t: Topic): HTMLElement[] {
    const back = button(`◀ ${p.name}`, () => this.go({ ...this.at, topic: undefined }), "btn back");
    const card = el("section", "card");
    const title = this.panel.boxRow("Topic title", `topic-title:${t.id}`, "Save", (v) => this.edit((d) => {
      const cur = findTopic(d, p.id, t.id);
      return editTopic(d, p.id, t.id, v, cur?.details ?? "");
    }), { value: t.title });
    const details = this.panel.areaRow("Details (shown on the glasses, a page at a time)", `topic-details:${t.id}`, "Save details", t.details, (v) => this.edit((d) => {
      const cur = findTopic(d, p.id, t.id);
      return editTopic(d, p.id, t.id, cur?.title ?? t.title, v);
    }));
    const done = button(t.done ? "Mark not done" : "Mark done", () => this.edit((d) => setTopicDone(d, p.id, t.id, !t.done)));
    card.append(title, details, done);
    const danger = el("div", "row");
    danger.append(confirmButton("Delete topic", "Tap again to delete", () => { this.edit((d) => removeTopic(d, p.id, t.id)); this.go({ ...this.at, topic: undefined }); }));
    return [back, card, danger];
  }
}
