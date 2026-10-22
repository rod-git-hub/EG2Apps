// EG2Presentation: loads the presentations from Even's storage, shows them on the glasses and on the phone page,
// saves every change; the talk stopwatch is kept on this phone. If the saved data can't be read, nothing is
// overwritten: the phone page shows the saved text so it can be copied.

import { waitForEvenAppBridge, type EvenAppBridge } from "@evenrealities/even_hub_sdk";
import { applyTheme, askToExit, headerBoxWidth, parseListStyle, pngFromBase64, wordmarkSvg, bridgeKV, evenStorageWorks, GlassesSession, MenuActions, Navigator, parseTheme, Store, watchSystemTheme, type Validated } from "@eg2apps/shared";
import { talksScreens } from "./glasses.ts";
import { TalksPhone } from "./phone.ts";
import { Stopwatch } from "./stopwatch.ts";
import { WORDMARK_IMAGE } from "./wordmark-image.ts";
import { emptyDoc, parseTalks, serialise, type TalksDoc } from "./talks.ts";

const KEY = "eg2presentation.v1";
const STOPWATCH_KEY = "eg2presentation.stopwatch";
const THEME_KEY = "eg2presentation.theme";
const LISTS_KEY = "eg2presentation.lists";
const BRIDGE_WAIT_MS = 10_000;

const root = document.getElementById("app") as HTMLElement;
document.querySelector(".top h1")?.replaceChildren(wordmarkSvg("EG2 PRESENTATION", "EG2Presentation"));
const store = new Store([KEY, STOPWATCH_KEY, THEME_KEY, LISTS_KEY] as const);
let doc: TalksDoc = emptyDoc();
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
  let phone: TalksPhone | null = null;
  await store.init(bridge ? kv : null, (m) => phone?.showError(`Couldn't save: ${m}. Your last change is kept on this page; try again.`));
  let theme = parseTheme(store.read(THEME_KEY));
  let lists = parseListStyle(store.read(LISTS_KEY));
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("lists")) lists = parseListStyle(new URLSearchParams(location.search).get("lists")); // development only
  applyTheme(theme);
  watchSystemTheme(() => theme);
  const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get("demo") : null; // development only
  const saved = demo === "reset" ? null : store.read(KEY);
  if (saved) {
    const r = parseTalks(saved);
    if (r.ok) doc = r.value;
    else damaged = saved;
  } else if (import.meta.env.DEV && demo !== null) {
    doc = (await import("./demo.ts")).demoDoc(); // development only: removed from builds (?demo, or ?demo=reset)
    if (demo === "reset") store.write(KEY, serialise(doc));
  }

  const stopwatch = new Stopwatch(store.read(STOPWATCH_KEY), (json) => store.write(STOPWATCH_KEY, json));
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
  const screens = talksScreens(() => doc, nav, stopwatch, () => changed(), () => lists);

  /** After every edit: save (unless the saved data couldn't be read) and redraw the glasses and the phone. */
  function changed(): void {
    if (damaged === null) store.write(KEY, serialise(doc));
    nav.refresh();
    phone?.render();
  }

  phone = new TalksPhone({
    root,
    doc: () => doc,
    stopwatch,
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
      if (damaged !== null) return { ok: false, error: "Your saved presentations couldn't be read: nothing can be changed until that's sorted." };
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

  stopwatch.onChange(() => { nav.refresh(); phone?.render(); });
  // While the stopwatch runs and a talk's screen shows, redraw just after each new second (only the header changes).
  const tickNext = () => setTimeout(() => {
    if (stopwatch.running && nav.ticking) nav.refresh();
    tickNext();
  }, stopwatch.running ? 1000 - (stopwatch.elapsed() % 1000) + 25 : 1000);
  tickNext();

  nav.push(screens.folderList);
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
  root.textContent = `EG2Presentation couldn't start: ${e instanceof Error ? e.message : String(e)}`;
});
