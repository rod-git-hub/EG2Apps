// Development only (the simulator and browser preview): sample presentations when the app is opened with ?demo and
// has none. Never in a build: main.ts only loads this file when import.meta.env.DEV is true.

import { addFolder, addPresentation, addTopics, editTopic, emptyDoc, type TalksDoc } from "./talks.ts";

export function demoDoc(): TalksDoc {
  const doc = emptyDoc();
  const work = addFolder(doc, "Work");
  const club = addFolder(doc, "Book club");
  if (work.ok) {
    const q = addPresentation(doc, work.value.id, "Quarterly review");
    if (q.ok) {
      const ts = addTopics(doc, q.value.id, "Welcome and agenda\nResults this quarter\nWhat went well\nWhat we'll change\nQuestions");
      if (ts.ok) {
        const [welcome, results] = ts.value;
        if (welcome) editTopic(doc, q.value.id, welcome.id, welcome.title, "Thank everyone for coming.\nToday: results, lessons, next steps.\nAbout 20 minutes, questions at the end.");
        if (results) editTopic(doc, q.value.id, results.id, results.title, [
          "Sales up 12% on last quarter, ahead of plan.",
          "Two new customers in the north region.",
          "Support tickets down a third since the new help pages.",
          "Delivery times: 4 days on average (was 6).",
          "One miss: the spring launch slipped two weeks; the fix is in place.",
        ].join("\n"));
      }
    }
    addPresentation(doc, work.value.id, "Team onboarding");
  }
  if (club.ok) {
    const b = addPresentation(doc, club.value.id, "October book");
    if (b.ok) addTopics(doc, b.value.id, "The author\nThe story so far\nFavourite chapter");
  }
  return doc;
}
