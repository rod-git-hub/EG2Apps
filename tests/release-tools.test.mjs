// The release tools: icons are greyscale PNGs of the right size; the release-age check reads every locked package
// (and skips the workspaces); the bundle scan accepts real PNGs only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { greyPng, levels } from "../scripts/make-icons.mjs";
import { lockedPackages } from "../scripts/release-age.mjs";

test("icons: 8-bit greyscale PNG, 24×24, scaled crisp", () => {
  const art = Array.from({ length: 24 }, (_, i) => (i === 0 ? "#".repeat(24) : " ".repeat(24)));
  const png = greyPng(levels(art));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), 24); // IHDR width
  assert.equal(png.readUInt32BE(20), 24); // IHDR height
  assert.equal(png[25], 0, "colour type 0: greyscale");
  const big = levels(art, 10);
  assert.equal(big.length, 240);
  assert.equal(big[9][239], 255, "the top row stays bright when scaled");
  assert.equal(big[10][0], 0);
  assert.throws(() => levels(["##", "#"]), /rows must be/);
});

test("release-age: every locked package, nested copies too; workspace links left out", () => {
  const lock = { packages: {
    "": { name: "root" },
    "node_modules/vite": { version: "8.3.4" },
    "node_modules/vite/node_modules/postcss": { version: "8.5.30" },
    "node_modules/@eg2apps/shared": { link: true, resolved: "packages/shared" },
    "packages/shared": { version: "0.1.0" },
  } };
  assert.deepEqual(lockedPackages(lock).map((p) => `${p.name}@${p.version}`).sort(), ["postcss@8.5.30", "vite@8.3.4"]);
});
