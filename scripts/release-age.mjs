#!/usr/bin/env node
// Release rule: every package a shipped build is made with (package-lock.json) must have been published at least
// MIN_DAYS days ago, so a freshly compromised version has time to be caught and pulled first. Asks the npm registry for
// each package's publish dates.
//
//   node scripts/release-age.mjs [days]      (default 7)
//
// No dependencies: Node built-ins only (fetch).

import { readFileSync } from "node:fs";

const MIN_DAYS = Number(process.argv[2] ?? 7);
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

/** name@version for every installed package (workspace links left out). Exported for tests. */
export function lockedPackages(lockfile) {
  const out = new Map();
  for (const [path, entry] of Object.entries(lockfile.packages ?? {})) {
    if (!path || entry.link || !entry.version || !path.includes("node_modules/")) continue;
    const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    out.set(`${name}@${entry.version}`, { name, version: entry.version });
  }
  return [...out.values()];
}

async function publishedAt(name, version) {
  const r = await fetch(`https://registry.npmjs.org/${name.replaceAll("/", "%2F")}`, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${name}: registry answered ${r.status}`);
  const doc = await r.json();
  const t = doc.time?.[version];
  if (!t) throw new Error(`${name}@${version}: no publish date in the registry`);
  return new Date(t);
}

async function main() {
  const pkgs = lockedPackages(lock);
  const now = Date.now();
  const young = [];
  const failed = [];
  let i = 0;
  const worker = async () => {
    while (i < pkgs.length) {
      const p = pkgs[i++];
      try {
        const days = (now - (await publishedAt(p.name, p.version)).getTime()) / 86_400_000;
        if (days < MIN_DAYS) young.push(`${p.name}@${p.version} (${days.toFixed(1)} days)`);
      } catch (e) {
        failed.push(e instanceof Error ? e.message : String(e));
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (failed.length) {
    console.error(`Release-age check FAILED: couldn't check ${failed.length} packages:`);
    for (const f of failed) console.error(`  - ${f}`);
    process.exit(1);
  }
  if (young.length) {
    console.error(`Release-age check FAILED: published less than ${MIN_DAYS} days ago:`);
    for (const y of young) console.error(`  - ${y}`);
    process.exit(1);
  }
  console.log(`Release-age check passed: all ${pkgs.length} packages were published at least ${MIN_DAYS} days ago.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
