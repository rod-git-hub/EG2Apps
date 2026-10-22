// The phone page's appearance: Match phone (the default), Light or Dark, saved on this phone. The colours are in
// phone.css; this only picks the set (`data-theme` on the page).

import { el } from "./phone.ts";
import type { ListStyle } from "./model.ts";

export type Theme = "system" | "light" | "dark";
export const THEMES: readonly Theme[] = ["system", "light", "dark"];
const LABELS: Record<Theme, string> = { system: "Match phone", light: "Light", dark: "Dark" };

export const parseTheme = (saved: string | null): Theme => ((THEMES as readonly string[]).includes(saved ?? "") ? (saved as Theme) : "system");

const prefersDark = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

/** Sets the colours on the page (Match phone follows the phone's setting). */
export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t === "dark" || (t === "system" && prefersDark()) ? "dark" : "light";
}

/** Follows the phone switching between light and dark while Match phone is chosen. */
export function watchSystemTheme(current: () => Theme): void {
  if (typeof matchMedia !== "function") return;
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (current() === "system") applyTheme("system");
  });
}

/** A labelled group of radio buttons (screen readers announce it as one choice). */
function choiceSection<T extends string>(legend: string, name: string, options: readonly { value: T; label: string }[], current: T, choose: (v: T) => void, note?: string): HTMLElement {
  const box = el("section", "card");
  const group = el("fieldset", "choice");
  group.append(el("legend", "", legend));
  for (const o of options) {
    const label = el("label", "choice-option");
    const radio = el("input");
    radio.type = "radio";
    radio.name = name;
    radio.value = o.value;
    radio.checked = o.value === current;
    radio.addEventListener("change", () => { if (radio.checked) choose(o.value); });
    label.append(radio, document.createTextNode(` ${o.label}`));
    group.append(label);
  }
  box.append(group);
  if (note) box.append(el("p", "muted", note));
  return box;
}

/** The Appearance section: Match phone, Light or Dark. */
export function themeSection(current: Theme, choose: (t: Theme) => void): HTMLElement {
  return choiceSection("Appearance", "theme", THEMES.map((t) => ({ value: t, label: LABELS[t] })), current, choose);
}

export const parseListStyle = (saved: string | null): ListStyle => (saved === "native" ? "native" : "cursor");

/** The Glasses lists section: the app's text cursor (default) or Even's own select box. */
export function listStyleSection(current: ListStyle, choose: (s: ListStyle) => void): HTMLElement {
  return choiceSection("Glasses lists", "list-style", [
    { value: "cursor", label: "Text cursor (recommended)" },
    { value: "native", label: "Even's select box" },
  ], current, choose,
  "Even's select box: the glasses draw and move the highlight. Long lists show 18 items at a time, with ▲ Previous and ▼ More; after a change the highlight goes back to the top; the glasses menu works on an item once you open it. Checklists always use the text cursor, so ticking keeps your place.");
}
