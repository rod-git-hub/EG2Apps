// Tests for packages/shared/src/doc.ts: the free-text clean-up gives the same results as the regular expression it
// replaced, and stays fast on hostile text (a long run of spaces before a letter).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, trimLineEnds } from "../packages/shared/src/doc.ts";

const old = (s) => s.replace(/[ \t]+$/gm, "");

test("trimLineEnds matches the old /[ \\t]+$/gm on random text", () => {
  const parts = [" ", "\t", "\n", "x", "é", "  ", "\n\n", "a b"];
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31);
  for (let i = 0; i < 5000; i++) {
    let s = "";
    for (let n = next() % 40; n > 0; n--) s += parts[next() % parts.length];
    assert.equal(trimLineEnds(s), old(s), JSON.stringify(s));
  }
});

test("cleanText: line ends trimmed, line breaks kept, Windows line breaks unified", () => {
  assert.deepEqual(cleanText("  one  \r\ntwo\t\r\n\r\nthree  ", "text"), { ok: true, value: "one\ntwo\n\nthree" });
});

test("cleanText stays fast on hostile text (linear time)", () => {
  const started = performance.now();
  const r = cleanText(" ".repeat(1_000_000) + "x", "text");
  assert.equal(r.ok, true); // trimmed to "x"
  cleanText((" \t".repeat(20_000) + "y\n").repeat(10), "text");
  assert.ok(performance.now() - started < 300, "took too long");
});
