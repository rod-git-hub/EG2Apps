// EG2Presentation: the data model's edits and strict check, and the glasses' talk flow (tap = done → next topic, the
// topic list's cursor follows, the stopwatch rows).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "../apps/eg2presentation/src/talks.ts";
import { talksScreens } from "../apps/eg2presentation/src/glasses.ts";
import { Stopwatch } from "../apps/eg2presentation/src/stopwatch.ts";
import { Navigator } from "../packages/shared/src/navigator.ts";

function sample() {
  const d = T.emptyDoc();
  const f = T.addFolder(d, "Work").value;
  const p = T.addPresentation(d, f.id, "Quarterly review").value;
  T.addTopics(d, p.id, "Welcome\n\n  Results \nQuestions");
  return { d, f, p };
}

test("edits: topics one per line (blank lines skipped, trimmed), done, reset, move, remove", () => {
  const { d, p } = sample();
  assert.deepEqual(p.topics.map((t) => t.title), ["Welcome", "Results", "Questions"]);
  const [a, b] = p.topics;
  T.setTopicDone(d, p.id, a.id, true);
  assert.equal(T.countDone(p.topics), "1/3");
  T.resetDone(d, p.id);
  assert.equal(T.countDone(p.topics), "0/3");
  assert.ok(T.moveTopic(d, p.id, b.id, -1));
  assert.equal(p.topics[0].title, "Results");
  assert.ok(T.editTopic(d, p.id, b.id, "Results 2026", "Up 10%\nDown 2%").ok);
  assert.equal(T.findTopic(d, p.id, b.id).details, "Up 10%\nDown 2%");
  T.removeTopic(d, p.id, b.id);
  assert.equal(p.topics.length, 2);
  assert.equal(T.addTopics(d, p.id, "\n  \n").ok, false, "nothing to add");
});

test("deleting a folder deletes what's inside; moving and renaming work", () => {
  const { d, f, p } = sample();
  const g = T.addFolder(d, "Home").value;
  assert.ok(T.moveFolder(d, g.id, -1));
  assert.equal(d.folders[0].name, "Home");
  assert.ok(T.renamePresentation(d, p.id, "Q4 review").ok);
  T.removeFolder(d, f.id);
  assert.equal(T.findPresentation(d, p.id), undefined);
});

test("export → import keeps everything; the strict check refuses bad imports", () => {
  const { d } = sample();
  const r = T.parseTalks(T.serialise(d));
  assert.ok(r.ok);
  assert.deepEqual(r.value, d);
  const bad = (o) => T.parseTalks(JSON.stringify(o));
  assert.match(bad({ app: "eg2notes", schema: 1, folders: [] }).error, /isn't from eg2presentation/);
  assert.match(bad({ app: "eg2presentation", schema: 1, folders: [{ name: "" }] }).error, /folders 1: name can't be empty/);
  assert.match(bad({ app: "eg2presentation", schema: 1, folders: [{ name: "a", presentations: [{ name: "b", topics: [{ title: 1 }] }] }] }).error, /topics 1: title must be text/);
  assert.match(T.summary(d), /1 folder, 1 presentation, 3 topics/);
});

function talk() {
  const { d, p } = sample();
  let t = 1_000_000;
  const sw = new Stopwatch(null, () => {}, () => t);
  const frames = [];
  let saves = 0;
  const nav = new Navigator({ outputs: [{ show: (f) => frames.push(f) }], onExitRequest: () => {} });
  const screens = talksScreens(() => d, nav, sw, () => { saves++; nav.refresh(); });
  nav.push(screens.folderList);
  nav.handle({ type: "tap" }); // Work
  nav.handle({ type: "tap" }); // Quarterly review
  return { d, p, nav, sw, last: () => frames.at(-1), saves: () => saves, advance: (ms) => { t += ms; } };
}

test("the topic list: stopwatch row first, then the topics with ○ / ● and numbers", () => {
  const s = talk();
  assert.match(s.last().header, /Quarterly review · 00:00 · 0\/3$/);
  assert.match(s.last().body, /> ▶ Start stopwatch/);
  assert.match(s.last().body, /○ 1\. Welcome/);
  s.nav.handle({ type: "tap" }); // start
  s.advance(65_000);
  s.nav.refresh();
  assert.match(s.last().body, /● Pause {2}01:05/);
  assert.match(s.last().header, /01:05/);
});

test("tap in a topic's details = done → next topic; back lands on the topic you're on; the last one returns", () => {
  const s = talk();
  s.nav.handle({ type: "down" }); // to topic 1 (blank line skipped)
  s.nav.handle({ type: "tap" }); // open Welcome
  assert.match(s.last().header, /topic 1\/3/);
  assert.match(s.last().hint, /done ▶ next/);
  s.nav.handle({ type: "tap" }); // done → next
  assert.equal(s.p.topics[0].done, true);
  assert.match(s.last().header, /topic 2\/3/);
  s.nav.handle({ type: "double-tap" });
  assert.match(s.last().body, /> ○ 2\. Results/, "the cursor followed to topic 2");
  assert.match(s.last().header, /· 1\/3$/);
  s.nav.handle({ type: "tap" }); // open Results
  s.nav.handle({ type: "tap" }); // done → Questions
  s.nav.handle({ type: "tap" }); // done → last: back to the list
  assert.match(s.last().header, /· 3\/3$/);
});

test("a swipe down past a topic's last page goes on to the next topic (not marked done)", () => {
  const s = talk();
  s.nav.handle({ type: "down" });
  s.nav.handle({ type: "tap" }); // Welcome (one page)
  s.nav.handle({ type: "down" });
  assert.match(s.last().header, /topic 2\/3/);
  assert.equal(s.p.topics[0].done, false);
});
