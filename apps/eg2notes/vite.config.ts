import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { strictCsp } from "../../packages/shared/build/csp.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  plugins: [strictCsp()],
  // The dev server (reachable from the phone for QR testing) may only serve this app, the shared code
  // and installed packages: never the rest of the project.
  server: { fs: { strict: true, allow: [here, `${repo}packages/shared`, `${repo}node_modules`] } },
  build: {
    target: "es2022",
    // No source maps in the packaged app: smaller, and no source paths inside.
    sourcemap: false,
    // Vite's module-preload helper calls fetch(); the app makes no network calls at all.
    modulePreload: { polyfill: false },
  },
});
