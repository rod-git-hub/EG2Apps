// The apps' Content Security Policy, written into each index.html by Vite.
// The built app allows only its own scripts, styles and images, and NO connections at all
// (connect-src 'none'). The dev server alone allows 'self' so Vite's hot reload can reach it;
// that relaxed policy never reaches a build.

import type { Plugin } from "vite";

export const CSP_BUILD = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export const CSP_DEV = CSP_BUILD.replace("connect-src 'none'", "connect-src 'self'");

/** The placeholder in index.html that this plugin replaces. */
export const CSP_PLACEHOLDER = "%EG2_CSP%";

export function strictCsp(): Plugin {
  return {
    name: "eg2-strict-csp",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        if (!html.includes(CSP_PLACEHOLDER)) throw new Error(`index.html has no ${CSP_PLACEHOLDER} placeholder`);
        return html.replace(CSP_PLACEHOLDER, ctx.server ? CSP_DEV : CSP_BUILD);
      },
    },
  };
}
