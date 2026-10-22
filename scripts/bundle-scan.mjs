#!/usr/bin/env node
// Bundle privacy scan: checks each built app (dist/) for network code and remote addresses,
// and that its index.html carries the strict Content Security Policy with connect-src 'none'.
//
//   node scripts/bundle-scan.mjs apps/eg2notes/dist apps/eg2presentation/dist
//
// A tripwire, not a proof: Even's SDK ships obfuscated (its strings are decoded at run time), so
// a text scan can't rule out a call it builds itself. The CSP (no connections at all) is the
// control that holds either way; a network capture before release checks it on a real phone.
// No dependencies: Node built-ins only.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { CSP_BUILD } from "../packages/shared/build/csp.ts";

/** Network APIs and remote addresses that must never appear in a built app. Exported for tests. */
export const RULES = [
  { name: "fetch() call", re: /\bfetch\s*\(/ },
  { name: "XMLHttpRequest", re: /\bXMLHttpRequest\b/ },
  { name: "WebSocket", re: /\bnew\s+WebSocket\b/ },
  { name: "EventSource connection", re: /\bnew\s+EventSource\b/ },
  { name: "sendBeacon", re: /\bsendBeacon\b/ },
  { name: "WebRTC", re: /\bRTCPeerConnection\b/ },
  { name: "web worker", re: /\bnew\s+(?:Shared)?Worker\b|\bimportScripts\b/ },
  { name: "eval / Function constructor", re: /\beval\s*\(|\bnew\s+Function\s*\(/ },
  // Remote addresses; XML namespace URIs (w3.org) are names, not connections.
  { name: "remote address", re: /\b(?:https?|wss?):\/\/(?!www\.w3\.org\/)[A-Za-z0-9.-]+/ },
];

const TEXT_FILE = /\.(?:js|mjs|css|html|json|svg|txt)$/;
const PNG_FILE = /\.png$/;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Findings for one built file. Exported for tests. */
export function scanText(path, text) {
  const findings = [];
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (m) {
      const at = Math.max(0, m.index - 40);
      findings.push({ path, rule: rule.name, near: text.slice(at, m.index + 60).replace(/\s+/g, " ") });
    }
  }
  return findings;
}

/** Findings for a built index.html: the exact strict CSP, and nothing loaded from elsewhere. Exported for tests. */
export function checkIndexHtml(path, html) {
  const findings = [];
  const metas = [...html.matchAll(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/gi)];
  if (metas.length !== 1) findings.push({ path, rule: `expected one CSP meta tag, found ${metas.length}`, near: "" });
  else if (metas[0][1] !== CSP_BUILD) findings.push({ path, rule: "CSP differs from the build policy", near: metas[0][1] });
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/gi)) {
    if (!m[1].startsWith("/assets/") && !m[1].startsWith("./assets/")) {
      findings.push({ path, rule: "loads a file from outside the app", near: m[0] });
    }
  }
  return findings;
}

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

function main() {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error("Usage: bundle-scan.mjs <dist folder>...");
    process.exit(2);
  }
  const findings = [];
  let scanned = 0;
  for (const dir of dirs) {
    let files;
    try {
      files = filesUnder(dir);
    } catch {
      findings.push({ path: dir, rule: "no build found (run npm run build first)", near: "" });
      continue;
    }
    if (!files.some((f) => f.endsWith("index.html"))) findings.push({ path: dir, rule: "no index.html in the build", near: "" });
    for (const file of files) {
      const path = relative(process.cwd(), file);
      if (PNG_FILE.test(file)) {
        // Pictures (the app icon) can't run code; check it really is a PNG and not something renamed.
        if (!readFileSync(file).subarray(0, 8).equals(PNG_SIGNATURE)) findings.push({ path, rule: "not a real PNG", near: "" });
        continue;
      }
      if (!TEXT_FILE.test(file)) {
        findings.push({ path, rule: "unexpected file type in the build", near: "" });
        continue;
      }
      const text = readFileSync(file, "utf8");
      scanned++;
      findings.push(...scanText(path, text));
      if (file.endsWith("index.html")) findings.push(...checkIndexHtml(path, text));
    }
  }
  if (findings.length) {
    console.error("Bundle privacy scan FAILED:");
    for (const f of findings) console.error(`  - ${f.path}: ${f.rule}${f.near ? `  [${f.near}]` : ""}`);
    process.exit(1);
  }
  console.log(`Bundle privacy scan passed: ${scanned} files in ${dirs.length} builds, no network code found, strict CSP in place.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
