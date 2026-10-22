#!/usr/bin/env node
// Secret scan, on every commit (pre-commit hook) and in CI, alongside GitHub's own secret
// scanning. Blocks secret-looking text and committed .env files.
//
//   node scripts/secret-scan.mjs --staged   # pre-commit hook: files staged for commit
//   node scripts/secret-scan.mjs --all      # CI: every tracked file
//
// To allow a known false positive, put "secret-scan: allow" on that line.
// No dependencies: Node built-ins only.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const RULES = [
  { name: "Anthropic API key", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "GitHub token", re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key", re: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/ },
  { name: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  {
    name: "Hard-coded secret assignment",
    re: /\b(?:api[_-]?key|secret|token|passw(?:or)?d)\b\s*[:=]\s*["'][^"'\s]{16,}["']/i,
  },
];

const ALLOW_MARKER = "secret-scan: allow";
const ENV_FILE = /(^|\/)\.env(\.[^/]*)?$/;
const MAX_BYTES = 2 * 1024 * 1024;

/** Returns the findings for one file's text. Exported for tests. */
export function scanText(path, text) {
  const findings = [];
  if (ENV_FILE.test(path) && !path.endsWith(".env.example")) {
    findings.push({ path, line: 0, rule: ".env file must never be committed" });
  }
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    for (const rule of RULES) {
      if (rule.re.test(line)) findings.push({ path, line: i + 1, rule: rule.name });
    }
  });
  return findings;
}

function git(args) {
  return execFileSync("git", args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
}

function filesToScan(mode) {
  const out =
    mode === "--staged"
      ? git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
      : git(["ls-files", "-z"]);
  return out.toString("utf8").split("\0").filter(Boolean);
}

function readFile(mode, path) {
  // Staged mode reads the version about to be committed, not the working copy.
  return mode === "--staged" ? git(["show", `:${path}`]) : readFileSync(path);
}

function main() {
  const mode = process.argv[2];
  if (mode !== "--staged" && mode !== "--all") {
    console.error("Usage: secret-scan.mjs --staged | --all");
    process.exit(2);
  }
  const findings = [];
  let scanned = 0;
  for (const path of filesToScan(mode)) {
    let buf;
    try {
      buf = readFile(mode, path);
    } catch {
      continue; // deleted or unreadable
    }
    if (buf.length > MAX_BYTES || buf.includes(0)) continue; // skip large / binary files
    scanned++;
    findings.push(...scanText(path, buf.toString("utf8")));
  }
  if (findings.length > 0) {
    console.error("Secret scan FAILED. Remove these before committing:");
    for (const f of findings) console.error(`  - ${f.path}${f.line ? `:${f.line}` : ""}  (${f.rule})`);
    console.error(`If a line is a false positive, add "${ALLOW_MARKER}" to it.`);
    process.exit(1);
  }
  console.log(`Secret scan passed: ${scanned} files checked.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
