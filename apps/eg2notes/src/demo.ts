// Development only (the simulator and browser preview): sample notes when the app is opened with ?demo and has none.
// Never in a build: main.ts only loads this file when import.meta.env.DEV is true.

import { addItem, addNote, emptyDoc, setNoteText, toggleItem, type NotesDoc } from "./notes.ts";

export function demoDoc(): NotesDoc {
  const doc = emptyDoc();
  const ideas = addNote(doc, "Ideas for the weekend");
  if (ideas.ok) setNoteText(doc, ideas.value.id, [
    "Saturday: farmers' market in the morning, then a walk along the river to the old bridge.",
    "Lunch at the little place by the harbour (book a table for four).",
    "Afternoon: bikes from the station, the coast path to the lighthouse and back.",
    "Sunday: slow breakfast, the new exhibition at the gallery, call Mum in the evening.",
    "If it rains: the cinema, or finish the puzzle.",
  ].join("\n"));
  const packing = addNote(doc, "Packing for the trip");
  if (packing.ok) for (const t of ["Passport", "Charger", "Glasses case", "Rain jacket", "Book"]) addItem(doc, packing.value.id, t);
  const groceries = addNote(doc, "Groceries");
  if (groceries.ok) {
    for (const t of ["Milk", "Bread", "Eggs", "Tomatoes", "Coffee", "Rice", "Apples", "Cheese", "Butter"]) addItem(doc, groceries.value.id, t);
    const first = groceries.value.items[1];
    if (first) toggleItem(doc, groceries.value.id, first.id);
  }
  return doc;
}
