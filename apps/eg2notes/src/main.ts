// EG2Notes: loads the notes from Even's storage, shows them on the glasses and on the phone page, saves every change.
// If the saved notes can't be read, nothing is overwritten: the phone page shows the saved text so it can be copied.

import { waitForEvenAppBridge, type EvenAppBridge } from "@evenrealities/even_hub_sdk";
import { applyTheme, askToExit, headerBoxWidth, parseListStyle, pngFromBase64, wordmarkSvg, bridgeKV, evenStorageWorks, GlassesSession, MenuActions, Navigator, parseTheme, Store, watchSystemTheme, type Validated } from "@eg2apps/shared";
import { notesScreens } from "./glasses.ts";
import { WORDMARK_IMAGE } from "./wordmark-image.ts";
import { emptyDoc, parseNotes, serialise, type NotesDoc } from "./notes.ts";
import { NotesPhone } from "./phone.ts";

const KEY = "eg2notes.v1";
const THEME_KEY = "eg2notes.theme";
const LISTS_KEY = "eg2notes.lists";
const BRIDGE_WAIT_MS = 10_000;

const root = document.getElementById("app") as HTMLElement;
document.querySelector(".top h1")?.replaceChildren(wordmarkSvg("EG2 NOTES", "EG2Notes"));
const store = new Store([KEY, THEME_KEY, LISTS_KEY] as const);
let doc: NotesDoc = emptyDoc();
let damaged: string | null = null;

const isValidated = (r: unknown): r is Validated<unknown> => typeof r === "object" && r !== null && "ok" in r;

async function start(): Promise<void> {
  const found: EvenAppBridge | null = await Promise.race([
    waitForEvenAppBridge(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), BRIDGE_WAIT_MS)),
  ]);
  // Inside the Even app (or its simulator) Even's storage works; in a plain browser it doesn't: preview mode, with
  // the browser's own storage and no glasses.
  const kv = found ? bridgeKV(found) : null;
  const bridge = kv && (await evenStorageWorks(kv)) ? found : null;
  let phone: NotesPhone | null = null;
  await store.init(bridge ? kv : null, (m) => phone?.showError(`Couldn't save: ${m}. Your last change is kept on this page; try again.`));
  let theme = parseTheme(store.read(THEME_KEY));
  let lists = parseListStyle(store.read(LISTS_KEY));
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("lists")) lists = parseListStyle(new URLSearchParams(location.search).get("lists")); // development only
  applyTheme(theme);
  watchSystemTheme(() => theme);
  const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get("demo") : null; // development only
  const saved = demo === "reset" ? null : store.read(KEY);
  if (saved) {
    const r = parseNotes(saved);
    if (r.ok) doc = r.value;
    else damaged = saved;
  } else if (import.meta.env.DEV && demo !== null) {
    doc = (await import("./demo.ts")).demoDoc(); // development only: removed from builds (?demo, or ?demo=reset)
    if (demo === "reset") store.write(KEY, serialise(doc));
  }

  const actions = new MenuActions(() => changed());
  const nav = new Navigator({
    outputs: [],
    onExitRequest: () => { if (bridge) askToExit(bridge); },
    onMenu: (id, screen, row) => actions.handle(id, screen, row),
    menuFor: (screen, native) => actions.menuFor(screen, native),
    listStyle: () => lists,
    headerRoom: headerBoxWidth(WORDMARK_IMAGE.width) - 24, // the wordmark sits top right
    decorate: (screen) => actions.decorate(screen),
  });
  actions.attach(nav);
  const screens = notesScreens(() => doc, nav, () => changed());

  /** After every edit: save (unless the saved data couldn't be read) and redraw the glasses and the phone. */
  function changed(): void {
    if (damaged === null) store.write(KEY, serialise(doc));
    nav.refresh();
    phone?.render();
  }

  phone = new NotesPhone({
    root,
    doc: () => doc,
    damaged: () => damaged,
    theme: () => theme,
    setTheme: (t) => {
      theme = t;
      applyTheme(t);
      store.write(THEME_KEY, t);
    },
    lists: () => lists,
    setLists: (style) => {
      lists = style;
      store.write(LISTS_KEY, style);
      nav.refresh(); // the glasses redraw the list in the chosen style at once
    },
    edit: (fn) => {
      if (damaged !== null) return { ok: false, error: "Your saved notes couldn't be read: nothing can be changed until that's sorted." };
      const r = fn(doc);
      if (!isValidated(r) || r.ok) changed();
      return r;
    },
    replace: (next) => {
      doc = next;
      damaged = null;
      changed();
    },
  });

  nav.push(screens.notesList);
  phone.render();
  const showing = import.meta.env.DEV ? new URLSearchParams(location.search).get("show") : null; // development only
  if (showing) void import("@eg2apps/shared/dev-shots").then((m) => m.show(showing.split("|"))); // the docs' screenshots
  if (bridge) new GlassesSession({
    bridge, nav, onLifecycle: () => void store.flush(),
    corner: { width: WORDMARK_IMAGE.width, height: WORDMARK_IMAGE.height, png: pngFromBase64(WORDMARK_IMAGE.png) },
    ...(import.meta.env.DEV ? { log: (m: string) => console.warn(`[glasses] ${m}`) } : {}), // development only
  });

  // Save at once when the phone page goes away (locked, backgrounded, closed).
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void store.flush(); });
  window.addEventListener("pagehide", () => void store.flush());
}

start().catch((e: unknown) => {
  root.textContent = `EG2Notes couldn't start: ${e instanceof Error ? e.message : String(e)}`;
});
