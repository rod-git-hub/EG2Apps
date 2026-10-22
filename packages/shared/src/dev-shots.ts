// Development only (loaded from each app's main.ts behind import.meta.env.DEV, so never in a build): the
// documentation screenshots (scripts/doc-shots.mjs). Even's simulator can't click in its phone view, so
// `?show=Button|Button|…` clicks those buttons in turn once the page has loaded. `wait:ms` pauses; `scroll:Text`
// scrolls to that text (and the page stays there); `type:Placeholder=text` fills a field.

/** Visible buttons (or other elements) whose own text is `label`; buttons first. */
function find(label: string): HTMLElement | undefined {
  const hits = [...document.querySelectorAll<HTMLElement>("button, a, summary, label, legend, h2, h3, span, p, div")].filter(
    (e) => e.offsetParent !== null && (e.textContent?.trim() === label || e.firstChild?.nodeValue?.trim() === label),
  );
  return hits.find((e) => e.tagName === "BUTTON") ?? hits.at(-1);
}

export async function show(labels: string[]): Promise<void> {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await wait(1500); // the first render
  let scrolled = false;
  for (const label of labels) {
    if (label.startsWith("wait:")) {
      await wait(Number(label.slice(5)) || 0);
      continue;
    }
    if (label.startsWith("scroll:")) {
      const el = find(label.slice(7));
      if (el) {
        el.scrollIntoView({ block: "start" });
        scrolled = true;
      } else console.warn(`dev-shots: no "${label.slice(7)}" to scroll to`);
      continue;
    }
    if (label.startsWith("type:")) {
      const [hint, text] = label.slice(5).split("=");
      const field = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")].find((f) => f.offsetParent !== null && f.placeholder.startsWith(hint ?? ""));
      if (field) {
        field.value = text ?? "";
        field.dispatchEvent(new Event("input", { bubbles: true }));
      } else console.warn(`dev-shots: no field "${hint}"`);
      continue;
    }
    const el = find(label);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.click();
    } else console.warn(`dev-shots: no "${label}" to click`);
    await wait(800);
  }
  if (!scrolled) window.scrollTo(0, 0);
}
