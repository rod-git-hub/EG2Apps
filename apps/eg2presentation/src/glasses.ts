// EG2Presentation on the glasses: folders → presentations → topics (with the stopwatch rows at the top) → a topic's
// details a page at a time. In a topic's details, tap = tick / untick and stay; a swipe past the last page goes to the
// next topic, before the first page to the previous one. Creating and editing happen on the phone; the glasses
// mark done, run the stopwatch, move and delete (glasses menu, every delete confirmed).

import { textPages, type ListStyle, type Navigator, type Row, type RowMenu, type Screen } from "@eg2apps/shared";
import { formatElapsed, type Stopwatch } from "./stopwatch.ts";
import {
  countDone, findFolder, findPresentation, moveFolder, movePresentation, moveTopic, removeFolder, removePresentation,
  removeTopic, setTopicDone, type TalksDoc,
} from "./talks.ts";

/** ✓ isn't in the glasses font: ● done, ○ not yet. */
const tick = (done: boolean) => (done ? "●" : "○");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export interface TalksScreens {
  folderList: () => Screen;
}

/** `doc()` gives the current document; `changed()` saves and redraws after an edit. */
export function talksScreens(doc: () => TalksDoc, nav: Navigator, sw: Stopwatch, changed: () => void, listStyle: () => ListStyle = () => "cursor"): TalksScreens {
  const gone = (): Screen => ({ kind: "text", header: "PRESENTATIONS", body: "This was deleted.\n\n(double tap = back)" });
  const menu = (name: string, move: (d: -1 | 1) => boolean, remove: () => void, contains?: string): RowMenu =>
    ({ name, move, remove, ...(contains ? { contains } : {}) });

  /** The stopwatch rows at the top of a talk. ⏱ isn't in the glasses font, so ▶ ● ○. */
  const stopwatchRows = (now: string): Row[] => {
    // On Even's list a row can't change in place: the time stays in the header, not in the row (else every second
    // would rebuild the list and send its highlight back to the top).
    const time = listStyle() === "native" ? "stopwatch" : now;
    switch (sw.mode) {
      case "ready": return [{ label: "▶ Start stopwatch", onSelect: () => sw.start() }];
      case "running": return [{ label: `● Pause  ${time}`, onSelect: () => sw.pause() }];
      case "paused": return [
        { label: `▶ Resume  ${time}`, onSelect: () => sw.start() },
        { label: "○ Reset stopwatch", onSelect: () => sw.reset() },
      ];
    }
  };

  // Short enough to fit beside the corner wordmark (measured: "Quarterly review · 00:10 · 1/5" is 244 of 287 px).
  const talkHeader = (name: string, done: string, now: string) => `${name} · ${now} · ${done}`;

  /**
   * A topic's details, a page at a time. Tap = tick / untick this topic and stay (the ○ / ● changes in front of you);
   * swipe down past the last page = the next topic, swipe up on the first page = the previous one; double tap = back to
   * the topics, on the topic you reached. (1.1.0: "tap ticks, swipe moves"; before, a tap marked the topic done and
   * jumped to the next, and nothing unticked on the glasses.)
   */
  const topicDetails = (presentationId: string, topicId: string): Screen => {
    const found = findPresentation(doc(), presentationId);
    const topics = found?.presentation.topics ?? [];
    const i = topics.findIndex((t) => t.id === topicId);
    const t = topics[i];
    if (!found || !t) return gone();
    const go = (other: number) => {
      const to = topics[other];
      if (!to) return; // the first or the last topic: nothing to move to
      nav.parentCursorBy(other - i); // back from the details lands on the topic you're on
      nav.replace(() => topicDetails(presentationId, to.id));
    };
    const body = `${tick(t.done)} ${t.title}${t.details ? `\n\n${t.details}` : ""}`;
    const swipes = topics.length > 1 || textPages(body).length > 1; // another topic or another page to swipe to
    return {
      kind: "text",
      header: `${formatElapsed(sw.elapsed())} · topic ${i + 1}/${topics.length}`, // the topic's title is the page's first line
      ticks: true,
      body,
      hint: `tap = ${t.done ? "untick" : "tick"}${swipes ? " · swipe = next / previous" : ""} · double tap = back`,
      onTap: () => {
        setTopicDone(doc(), presentationId, t.id, !t.done);
        changed(); // saves and redraws this page: the cursor and page stay
      },
      onPastEnd: () => go(i + 1),
      onPastStart: () => go(i - 1),
      menu: menu(t.title, (d) => moveTopic(doc(), presentationId, t.id, d), () => removeTopic(doc(), presentationId, t.id)),
    };
  };

  const topicList = (presentationId: string): Screen => {
    const found = findPresentation(doc(), presentationId);
    if (!found) return gone();
    const topics = found.presentation.topics;
    const rows: Row[] = topics.map((t, i) => ({
      label: `${tick(t.done)} ${i + 1}. ${t.title}`,
      id: t.id,
      onSelect: () => nav.push(() => topicDetails(presentationId, t.id)),
      menu: menu(t.title, (d) => moveTopic(doc(), presentationId, t.id, d), () => removeTopic(doc(), presentationId, t.id)),
    }));
    const now = formatElapsed(sw.elapsed()); // read once, so the header and the stopwatch row always agree
    return {
      kind: "list",
      header: talkHeader(found.presentation.name, countDone(topics), now),
      ticks: true,
      selectKey: `topics:${presentationId}`,
      rows: [...stopwatchRows(now), ...(rows.length ? [{ label: "", spacer: true }, ...rows] : [{ label: "", spacer: true }, { label: "No topics yet: add them on your phone." }])],
    };
  };

  const presentationList = (folderId: string): Screen => {
    const f = findFolder(doc(), folderId);
    if (!f) return gone();
    return {
      kind: "list",
      header: `[${f.name}]`,
      selectKey: `presentations:${folderId}`,
      empty: "No presentations here yet. Add them on your phone.",
      rows: f.presentations.map((p) => ({
        label: `${p.name} (${countDone(p.topics)})`,
        id: p.id,
        onSelect: () => nav.push(() => topicList(p.id)),
        menu: menu(p.name, (d) => movePresentation(doc(), p.id, d), () => removePresentation(doc(), p.id),
          p.topics.length ? `${plural(p.topics.length, "topic")} inside` : undefined),
      })),
    };
  };

  const folderList = (): Screen => ({
    kind: "list",
    header: "", // the wordmark in the corner names the app
    selectKey: "folders",
    empty: "No presentations yet. Add them on your phone.",
    rows: doc().folders.map((f) => ({
      label: `${f.name} (${f.presentations.length})`,
      id: f.id,
      onSelect: () => nav.push(() => presentationList(f.id)),
      menu: menu(f.name, (d) => moveFolder(doc(), f.id, d), () => removeFolder(doc(), f.id),
        f.presentations.length ? `${plural(f.presentations.length, "presentation")} inside` : undefined),
    })),
  });

  return { folderList };
}
