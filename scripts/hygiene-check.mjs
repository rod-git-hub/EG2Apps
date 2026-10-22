#!/usr/bin/env node
// Public-hygiene check: this repository is (or will be) public, so nothing personal or
// private may enter it. Blocks:
//   - private IPv4 addresses (10.x, 172.16-31.x, 192.168.x, 100.64-127.x)
//   - email addresses, except example domains and GitHub's noreply addresses
//   - absolute home-folder paths (/home/<name>/, /Users/<name>/, C:\Users\<name>\)  hygiene-check: allow
//   - the developer's domain name anywhere except inside the two package ids
//   - any string in the local deny list .git/info/hygiene-deny (one per line, # comments,
//     matched case-insensitively). That file lives inside .git, so it is never committed:
//     the private strings it protects are never published by the check itself.
//
//   node scripts/hygiene-check.mjs --staged   # pre-commit hook: files staged for commit
//   node scripts/hygiene-check.mjs --all      # CI: every tracked file (no local deny list there)
//
// To allow a known false positive, put "hygiene-check: allow" on that line.
// No dependencies: Node built-ins only.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const ALLOW_MARKER = "hygiene-check: allow";
const MAX_BYTES = 2 * 1024 * 1024;

const PRIVATE_IPV4 = /\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\.\d{1,3}\.\d{1,3}\b/;
const EMAIL = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const ALLOWED_EMAIL_DOMAINS = /^(?:example\.(?:com|org|net)|users\.noreply\.github\.com)$/i;
const HOME_PATH = /(?:\/home\/[a-z_][a-z0-9_-]*\/|\/Users\/[^/\s]+\/|C:\\Users\\[^\\\s]+\\)/;
const DOMAIN_WORD = /techdivision/gi; // hygiene-check: allow
const PACKAGE_IDS = /net\.techdivision\.(?:eg2notes|eg2presentation)\b/g; // hygiene-check: allow

/** Returns the findings for one file's text. Exported for tests. */
export function scanText(path, text, deny = []) {
  const findings = [];
  text.split("\n").forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    const at = (rule) => findings.push({ path, line: i + 1, rule });
    if (PRIVATE_IPV4.test(line)) at("private IP address");
    for (const m of line.matchAll(EMAIL)) {
      if (!ALLOWED_EMAIL_DOMAINS.test(m[1])) at("email address");
    }
    if (HOME_PATH.test(line)) at("home-folder path");
    if ((line.replace(PACKAGE_IDS, "").match(DOMAIN_WORD) ?? []).length > 0) at("domain name outside the package ids");
    const lower = line.toLowerCase();
    for (const d of deny) if (lower.includes(d)) at("local deny list");
  });
  return findings;
}

/** Reads the local deny list: one string per line, blank lines and # comments ignored. */
export function parseDeny(text) {
  return text
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith("#"));
}

function git(args) {
  return execFileSync("git", args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
}

function main() {
  const mode = process.argv[2];
  if (mode !== "--staged" && mode !== "--all") {
    console.error("Usage: hygiene-check.mjs --staged | --all");
    process.exit(2);
  }
  const gitDir = git(["rev-parse", "--git-dir"]).toString("utf8").trim();
  const denyFile = `${gitDir}/info/hygiene-deny`;
  const deny = existsSync(denyFile) ? parseDeny(readFileSync(denyFile, "utf8")) : [];
  const list =
    mode === "--staged"
      ? git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
      : git(["ls-files", "-z"]);
  const findings = [];
  let scanned = 0;
  for (const path of list.toString("utf8").split("\0").filter(Boolean)) {
    let buf;
    try {
      buf = mode === "--staged" ? git(["show", `:${path}`]) : readFileSync(path);
    } catch {
      continue; // deleted or unreadable
    }
    if (buf.length > MAX_BYTES || buf.includes(0)) continue; // skip large / binary files
    scanned++;
    findings.push(...scanText(path, buf.toString("utf8"), deny));
  }
  if (findings.length > 0) {
    console.error("Hygiene check FAILED. Remove these private details before committing:");
    for (const f of findings) console.error(`  - ${f.path}:${f.line}  (${f.rule})`);
    console.error(`If a line is a false positive, add "${ALLOW_MARKER}" to it.`);
    process.exit(1);
  }
  const extra = deny.length ? ` with ${deny.length} local deny entries` : " (no local deny list)";
  console.log(`Hygiene check passed: ${scanned} files checked${extra}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
