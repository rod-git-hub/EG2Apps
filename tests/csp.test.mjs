// Tests for packages/shared/build/csp.ts: the built app gets connect-src 'none'; only the dev
// server relaxes it (for Vite's hot reload); nothing ever allows inline code, eval or remote hosts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CSP_BUILD, CSP_DEV, CSP_PLACEHOLDER, strictCsp } from "../packages/shared/build/csp.ts";

const transform = (html, ctx) => strictCsp().transformIndexHtml.handler(html, ctx);
const page = `<meta http-equiv="Content-Security-Policy" content="${CSP_PLACEHOLDER}" />`;

test("the build gets the strict policy, the dev server the hot-reload exception", () => {
  assert.ok(transform(page, {}).includes(CSP_BUILD));
  assert.ok(transform(page, { server: {} }).includes(CSP_DEV));
  assert.match(CSP_BUILD, /connect-src 'none'/);
  assert.match(CSP_DEV, /connect-src 'self'/);
});

test("no policy allows inline code, eval, wildcards or remote hosts", () => {
  for (const csp of [CSP_BUILD, CSP_DEV]) {
    assert.doesNotMatch(csp, /unsafe-|\*|https?:|data:|blob:/);
    assert.match(csp, /default-src 'none'/);
  }
});

test("a page without the placeholder fails the build instead of shipping without a policy", () => {
  assert.throws(() => transform("<html></html>", {}), /placeholder/);
});
