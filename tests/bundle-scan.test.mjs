// Tests for scripts/bundle-scan.mjs. Network-looking code is assembled at runtime so this
// file reads as plain text to other scanners.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIndexHtml, scanText } from "../scripts/bundle-scan.mjs";
import { CSP_BUILD } from "../packages/shared/build/csp.ts";

const rules = (text) => scanText("dist/assets/a.js", text).map((f) => f.rule);

test("flags network APIs and remote addresses", () => {
  assert.deepEqual(rules("fe" + "tch('/x')"), ["fetch() call"]);
  assert.deepEqual(rules("new " + "WebSocket(u)"), ["WebSocket"]);
  assert.deepEqual(rules("navigator.send" + "Beacon(u)"), ["sendBeacon"]);
  assert.deepEqual(rules("new " + "EventSource(u)"), ["EventSource connection"]);
  assert.deepEqual(rules("ev" + "al(code)"), ["eval / Function constructor"]);
  assert.deepEqual(rules('const u = "htt' + 'ps://tracker.example.net/p"'), ["remote address"]);
});

test("ignores look-alikes that aren't network calls", () => {
  assert.deepEqual(rules("uoMtx:`EventSource`"), []); // the SDK's event-source field name
  assert.deepEqual(rules("window.postMessage(m)"), []); // the bridge to the Even app
  assert.deepEqual(rules('xmlns="http://www.w3.org/2000/svg"'), []);
  assert.deepEqual(rules("prefetchRows(3)"), []);
});

const page = (csp, extra = "") =>
  `<meta http-equiv="Content-Security-Policy" content="${csp}" />${extra}<script type="module" crossorigin src="/assets/i.js"></script>`;

test("accepts a built page with the exact strict CSP", () => {
  assert.deepEqual(checkIndexHtml("dist/index.html", page(CSP_BUILD)), []);
});

test("rejects a relaxed CSP, a missing CSP and files from elsewhere", () => {
  const relaxed = CSP_BUILD.replace("connect-src 'none'", "connect-src 'self'");
  assert.equal(checkIndexHtml("i.html", page(relaxed))[0].rule, "CSP differs from the build policy");
  assert.match(checkIndexHtml("i.html", "<html></html>")[0].rule, /found 0/);
  const remote = page(CSP_BUILD, '<link rel="stylesheet" href="htt' + 'ps://cdn.example.net/x.css">');
  assert.equal(checkIndexHtml("i.html", remote)[0].rule, "loads a file from outside the app");
});
