#!/usr/bin/env node
// Supply-chain gate: every direct dependency in every
// package.json must be listed in docs/reference/approved-packages.md with the same exact
// version, in the same place ("root" or a workspace folder such as apps/eg2notes), and in
// the same section (runtime = "dependencies", dev = "devDependencies").
// Exits 1 on any mismatch. No dependencies: Node built-ins only.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const SECTIONS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

// Parse the approved table: | `name` | version | where (runtime|dev) | ...
function loadApproved() {
  const md = readFileSync(join(repoRoot, "docs/reference/approved-packages.md"), "utf8");
  const approved = new Map();
  for (const line of md.split("\n")) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|\s]+)\s*\|\s*`?(root|[a-z0-9._/-]+)`?\s*\((runtime|dev)\)/);
    if (!m) continue;
    const [, name, version, where, kind] = m;
    approved.set(`${where}:${name}`, {
      name,
      version,
      where,
      section: kind === "runtime" ? "dependencies" : "devDependencies",
    });
  }
  return approved;
}

function loadManifests() {
  const root = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const manifests = [{ where: "root", pkg: root }];
  for (const ws of root.workspaces ?? []) {
    const file = join(repoRoot, ws, "package.json");
    if (existsSync(file)) manifests.push({ where: ws, pkg: JSON.parse(readFileSync(file, "utf8")) });
  }
  return manifests;
}

const approved = loadApproved();
const problems = [];
// An unreadable table must fail loudly, never pass as "nothing to check".
if (approved.size === 0) problems.push("docs/reference/approved-packages.md: no package rows could be read");
let checked = 0;

for (const { where, pkg } of loadManifests()) {
  for (const section of SECTIONS) {
    for (const [name, version] of Object.entries(pkg[section] ?? {})) {
      checked++;
      const entry = approved.get(`${where}:${name}`);
      if (!entry) {
        problems.push(`${where}/package.json: "${name}" is not in docs/reference/approved-packages.md for ${where}`);
      } else if (entry.version !== version) {
        problems.push(`${where}/package.json: "${name}" is ${version}, approved version is ${entry.version}`);
      } else if (entry.section !== section) {
        problems.push(`${where}/package.json: "${name}" is in ${section}, approved as ${entry.section}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error("Approved-packages check FAILED:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("Fix package.json or update docs/reference/approved-packages.md (with the maintainer's approval).");
  process.exit(1);
}
console.log(`Approved-packages check passed: ${checked} direct dependencies, all on the approved list.`);
