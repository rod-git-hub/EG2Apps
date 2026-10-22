#!/usr/bin/env node
// Before a release or a push: runs the secret scan and the public-hygiene check over EVERY version of every
// file in the history (not just the current files), and over every commit message and author address.
//
//   node scripts/history-scan.mjs [revision range]     (default: all local branches)
//
// Uses the local deny list (.git/info/hygiene-deny) like the pre-commit hook. No dependencies: Node built-ins only.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { scanText as secretScan } from "./secret-scan.mjs";
import { parseDeny, scanText as hygieneScan } from "./hygiene-check.mjs";

const git = (args) => execFileSync("git", args, { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 });
const range = process.argv[2] ? [process.argv[2]] : ["--branches"];
const gitDir = git(["rev-parse", "--git-dir"]).toString("utf8").trim();
const denyFile = `${gitDir}/info/hygiene-deny`;
const deny = existsSync(denyFile) ? parseDeny(readFileSync(denyFile, "utf8")) : [];

const findings = [];
// Every file version (blob) reachable from the range, with a path it had.
const objects = git(["rev-list", "--objects", ...range]).toString("utf8").split("\n").filter(Boolean);
const seen = new Set();
let blobs = 0;
for (const line of objects) {
  const [sha, ...pathParts] = line.split(" ");
  const path = pathParts.join(" ");
  if (!path || seen.has(sha)) continue;
  seen.add(sha);
  if (git(["cat-file", "-t", sha]).toString("utf8").trim() !== "blob") continue;
  const buf = git(["cat-file", "-p", sha]);
  if (buf.length > 2 * 1024 * 1024 || buf.includes(0)) continue; // large or binary
  blobs++;
  const text = buf.toString("utf8");
  for (const f of [...secretScan(path, text), ...hygieneScan(path, text, deny)]) findings.push(`${path}:${f.line} (${f.rule}) [blob ${sha.slice(0, 7)}]`);
}
// Every commit's message and author / committer addresses.
const log = git(["log", ...range, "--format=%H%x1f%an <%ae>%x1f%cn <%ce>%x1f%B%x1e"]).toString("utf8").split("\x1e").map((s) => s.trim()).filter(Boolean);
for (const entry of log) {
  const [sha, author, committer, message] = entry.split("\x1f");
  const text = `${author}\n${committer}\n${message}`;
  for (const f of [...secretScan("commit", text), ...hygieneScan("commit", text, deny)]) {
    // Claude's co-author line is a public, intended address.
    const lineText = text.split("\n")[f.line - 1] ?? "";
    if (/^Co-Authored-By: Claude .*<noreply@anthropic\.com>$/.test(lineText)) continue;
    findings.push(`commit ${sha.slice(0, 7)} line ${f.line}: ${f.rule} ("${lineText.slice(0, 60)}")`);
  }
}
if (findings.length) {
  console.error(`History scan FAILED (${findings.length}):`);
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`History scan passed: ${blobs} file versions and ${log.length} commits checked${deny.length ? `, with ${deny.length} local deny entries` : ""}.`);
