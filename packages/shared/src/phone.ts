// The phone page's building blocks. Text is always set with textContent (never innerHTML), so nothing typed or
// imported can run as code. Text boxes keep their unsaved text and their focus across redraws (a tick from the glasses
// redraws the page while you may be typing). Deletes take a second tap (browser confirm() dialogs may not work inside
// the Even app).

import { DOC_MAX_CHARS, DOC_WARN_CHARS, type Validated } from "./doc.ts";

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function button(label: string, onClick: () => void, cls = "btn", ariaLabel?: string): HTMLButtonElement {
  const b = el("button", cls, label);
  b.type = "button";
  if (ariaLabel) b.setAttribute("aria-label", ariaLabel);
  b.addEventListener("click", () => onClick());
  return b;
}

/** A button for destructive actions: the first tap arms it ("Tap again to delete"), a second tap within 4 s runs it. */
export function confirmButton(label: string, armedLabel: string, onConfirm: () => void, cls = "btn danger", ariaLabel?: string): HTMLButtonElement {
  let armed: ReturnType<typeof setTimeout> | undefined;
  const b = button(label, () => {
    if (armed === undefined) {
      b.textContent = armedLabel;
      b.classList.add("armed");
      armed = setTimeout(() => {
        armed = undefined;
        b.textContent = label;
        b.classList.remove("armed");
      }, 4000);
      return;
    }
    clearTimeout(armed);
    armed = undefined;
    b.textContent = label;
    b.classList.remove("armed");
    onConfirm();
  }, cls, ariaLabel);
  return b;
}

/** A page section that redraws itself, keeping text boxes' drafts and focus. */
export class Panel {
  readonly root: HTMLElement;
  private readonly view: () => HTMLElement[];
  private readonly drafts = new Map<string, string>();
  private focusNext: string | null = null;
  readonly message: HTMLElement;

  constructor(root: HTMLElement, view: () => HTMLElement[]) {
    this.root = root;
    this.view = view;
    this.message = el("p", "message");
    this.message.setAttribute("role", "status");
  }

  render(): void {
    const active = document.activeElement;
    const focusKey = this.focusNext ?? (active instanceof HTMLElement && this.root.contains(active) ? active.dataset.key : undefined);
    this.focusNext = null;
    this.root.replaceChildren(this.message, ...this.view());
    if (focusKey) {
      const box = this.root.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
      if (box instanceof HTMLInputElement || box instanceof HTMLTextAreaElement) {
        box.focus();
        box.setSelectionRange(box.value.length, box.value.length);
      }
    }
  }

  /** Forgets unsaved drafts (moving to another view). */
  clearDrafts(): void {
    this.drafts.clear();
    this.say("");
  }

  say(text: string, kind: "error" | "info" = "error"): void {
    this.message.textContent = text;
    this.message.className = `message ${kind}`;
  }

  /** Shows an edit's error (if any); returns true when it worked. */
  check(r: Validated<unknown>): boolean {
    this.say(r.ok ? "" : r.error);
    return r.ok;
  }

  /** Gives a text box a key: it keeps its unsaved text and its focus across redraws. */
  keyed<T extends HTMLInputElement | HTMLTextAreaElement>(box: T, key: string): T {
    box.dataset.key = key;
    const draft = this.drafts.get(key);
    if (draft !== undefined) box.value = draft;
    box.addEventListener("input", () => this.drafts.set(key, box.value));
    return box;
  }

  /** Saves a box's text with `apply`; on failure the error shows and the text stays. `stay` keeps the cursor there. */
  submit(box: HTMLInputElement | HTMLTextAreaElement, apply: (value: string) => Validated<unknown>, stay = false): boolean {
    const key = box.dataset.key;
    const value = box.value;
    if (key) this.drafts.delete(key);
    if (stay && key) this.focusNext = key;
    const ok = this.check(apply(value));
    if (!ok) {
      this.focusNext = null;
      if (key) this.drafts.set(key, value);
    }
    return ok;
  }

  /** A labelled one-line box with a button; Enter or the button runs `apply`. */
  boxRow(label: string, key: string, action: string, apply: (value: string) => Validated<unknown>, opts: { value?: string; stay?: boolean } = {}): HTMLElement {
    const id = `f-${key.replace(/[^A-Za-z0-9-]/g, "-")}`;
    const lab = el("label", "field-label", label);
    lab.htmlFor = id;
    const input = this.keyed(el("input", "inline-input"), key);
    input.id = id;
    input.type = "text";
    input.autocomplete = "off";
    if (opts.value !== undefined && !this.drafts.has(key)) input.value = opts.value;
    const go = () => void this.submit(input, apply, opts.stay);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    const row = el("div", "field");
    const line = el("div", "row");
    line.append(input, button(action, go));
    row.append(lab, line);
    return row;
  }

  /** A labelled multi-line box with a save button. */
  areaRow(label: string, key: string, action: string, value: string, apply: (value: string) => Validated<unknown>): HTMLElement {
    const id = `f-${key.replace(/[^A-Za-z0-9-]/g, "-")}`;
    const lab = el("label", "field-label", label);
    lab.htmlFor = id;
    const area = el("textarea", "text-area");
    area.id = id;
    area.value = value;
    this.keyed(area, key);
    const row = el("div", "field");
    row.append(lab, area, button(action, () => void this.submit(area, apply)));
    return row;
  }
}

/** ▲ / ▼ buttons with spoken labels. */
export function moveButtons(name: string, move: (delta: -1 | 1) => void): HTMLButtonElement[] {
  return [
    button("▲", () => move(-1), "icon-btn", `Move ${name} up`),
    button("▼", () => move(1), "icon-btn", `Move ${name} down`),
  ];
}

/**
 * Backup: Export shows the data as text to copy and keep; Import checks pasted text strictly, shows what it holds and
 * replaces the data only after a second tap. There is no server: this is the only backup.
 */
export function backupSection(opts: {
  panel: Panel;
  appName: string;
  exportText: () => string;
  /** Checks pasted text; on success, a short summary ("12 notes") and a function that replaces the data. */
  preview: (text: string) => Validated<{ summary: string; apply: () => void }>;
}): HTMLElement {
  const box = el("section", "card");
  box.append(el("h2", "", "Backup"));
  box.append(el("p", "muted", `Your ${opts.appName} data lives only on this phone. Export it now and then, and keep the text somewhere safe (it's plain text you can read). Uninstalling deletes the data.`));
  const area = el("textarea", "text-area mono");
  area.setAttribute("aria-label", "Export or import text");
  const size = opts.exportText().length;
  if (size > DOC_WARN_CHARS) {
    box.append(el("p", "warn", `Your data is getting large (${size.toLocaleString("en")} of ${DOC_MAX_CHARS.toLocaleString("en")} characters). Consider deleting old items.`));
  }
  const exportBtn = button("Export", () => {
    area.value = opts.exportText();
    area.focus();
    area.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch { /* not supported */ }
    opts.panel.say(copied ? "Copied. Paste it somewhere safe." : "Selected: copy it and keep it somewhere safe.", "info");
  });
  const importBtn = confirmButton("Import", "Tap again to replace", () => {
    const r = opts.preview(area.value);
    if (!r.ok) {
      opts.panel.say(`Import failed: ${r.error}. Nothing was changed.`);
      return;
    }
    r.value.apply();
    area.value = "";
    opts.panel.say(`Imported ${r.value.summary}.`, "info");
  }, "btn danger");
  const check = button("Check pasted text", () => {
    const r = opts.preview(area.value);
    opts.panel.say(r.ok ? `This holds ${r.value.summary}. Import replaces everything you have now.` : `Not importable: ${r.error}.`, r.ok ? "info" : "error");
  });
  const row = el("div", "row wrap");
  row.append(exportBtn, check, importBtn);
  box.append(area, row);
  return box;
}

/** The privacy note on the phone page (said once, plainly). */
export function privacyNote(appName: string): HTMLElement {
  const box = el("section", "card");
  box.append(
    el("h2", "", "Privacy"),
    el("p", "", `${appName} has no internet access, no account, no analytics and no AI. Your data stays on this phone, in the Even Realities app's storage.`),
    el("p", "", "That storage can be read by other plugins installed in the Even Realities app, and by the Even Realities app itself. Don't keep passwords or other secrets here."),
  );
  return box;
}
