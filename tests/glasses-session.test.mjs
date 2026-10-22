// Gesture wiring: repeats within 120 ms are ignored; a tap from the ring turns ring mode on (a temple tap, off);
// a pick from Even's menu runs when the menu closes; lifecycle signals reach the app.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlassesSession } from "../packages/shared/src/glasses-session.ts";
import { MENU_CLOSE_WAIT_MS, MenuAfterClose } from "../packages/shared/src/menu-close.ts";

function setup() {
  let listener = null;
  let t = 0;
  const gestures = [];
  const signals = [];
  const nav = { handle: (g) => gestures.push(g), refresh: () => {}, addOutput: () => {} };
  const bridge = {
    onEvenHubEvent: (fn) => { listener = fn; return () => {}; },
    createStartUpPageContainer: async () => 0,
    rebuildPageContainer: async () => true,
    textContainerUpgrade: async () => true,
  };
  const session = new GlassesSession({ bridge, nav, now: () => t, onLifecycle: (s) => signals.push(s) });
  return { send: (e) => listener(e), at: (ms) => { t = ms; }, gestures, signals, session };
}

test("an exact repeat within 120 ms is ignored; later ones count", () => {
  const s = setup();
  s.at(1000); s.send({ textEvent: { eventType: 2 } });
  s.at(1050); s.send({ textEvent: { eventType: 2 } });
  s.at(1200); s.send({ textEvent: { eventType: 2 } });
  assert.equal(s.gestures.length, 2);
});

test("ring mode: on after a ring tap, off after a temple tap", () => {
  const s = setup();
  s.send({ sysEvent: { eventSource: 2 } });
  assert.equal(s.session.flick.ringMode, true);
  s.at(500); s.send({ sysEvent: { eventSource: 1 } });
  assert.equal(s.session.flick.ringMode, false);
});

test("a menu pick waits for Even's menu to close; lifecycle signals are passed on", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const s = setup();
    s.send({ sysEvent: { eventType: 4 } });
    s.send({ menuItemClickEvent: { itemID: 4 } });
    assert.equal(s.gestures.length, 0, "not while the menu is up");
    s.send({ sysEvent: { eventType: 5 } });
    assert.deepEqual(s.gestures, [{ type: "menu", itemId: 4 }]);
    assert.deepEqual(s.signals, ["even-took", "even-gave"]);
  } finally {
    mock.timers.reset();
  }
});

test("MenuAfterClose: no close seen (the simulator) → the pick runs after the wait; another gesture runs it first", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const ran = [];
    const gate = new MenuAfterClose((pick, _w, closed) => ran.push([pick, closed]));
    gate.picked("delete");
    mock.timers.tick(MENU_CLOSE_WAIT_MS - 1);
    assert.deepEqual(ran, []);
    mock.timers.tick(1);
    assert.deepEqual(ran, [["delete", false]]);
    gate.picked("move");
    gate.flush();
    assert.deepEqual(ran.at(-1), ["move", false]);
    assert.equal(gate.holding, false);
  } finally {
    mock.timers.reset();
  }
});
