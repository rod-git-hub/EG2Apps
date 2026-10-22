// Every symbol the apps put on the glasses must be in the measured font table: a missing one (like → or ✓, measured
// on the glasses 2026-10-04) shows as nothing there, even when the simulator draws it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { GLYPH_WIDTHS } from "../packages/shared/src/glyph-widths.ts";

const GLASSES_FILES = [
  "apps/eg2notes/src/glasses.ts", "apps/eg2presentation/src/glasses.ts",
  ...readdirSync("packages/shared/src").filter((f) => /^(navigator|row-menu|text)\.ts$/.test(f)).map((f) => `packages/shared/src/${f}`),
];

test("glasses screens use only characters the glasses font has (comments excepted)", () => {
  for (const file of GLASSES_FILES) {
    const code = readFileSync(file, "utf8").split("\n").map((l) => l.replace(/\/\/.*$/, "").replace(/\/\*\*?.*?\*\//g, "")).join("\n");
    const strings = code.match(/(["'`])(?:\\.|(?!\1).)*\1/g) ?? [];
    for (const s of strings) for (const ch of s) {
      if (ch.charCodeAt(0) < 128) continue; // ASCII is all in the font
      assert.ok(GLYPH_WIDTHS[ch] !== undefined, `${file}: "${ch}" (in ${s.slice(0, 40)}) isn't in the glasses font`);
    }
  }
});
