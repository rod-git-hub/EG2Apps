# Approved packages

Only packages listed here may appear as **direct** dependencies in any `package.json` in this repo.
`scripts/check-approved.mjs` enforces this list in CI and in `npm run check`. To add or upgrade a package: re-run
the checks below, update this file in the same commit, and get the maintainer's approval for anything new.

**Approved:** 2026-10-21.

**Checks for every direct package** (npm registry metadata, read 2026-10-21):
- trusted publisher (the organisation's own npm accounts)
- registry signature, and provenance where offered
- no install scripts
- few dependencies
- release at least 2 days old while developing, 7 days for anything shipped (`min-release-age` in `.npmrc`)
- no open advisory for the version (`npm audit`, and the package's own GitHub advisories)

| Package | Approved version | Where | Role | Publisher | Released | Provenance | Install scripts | Direct deps | License |
|---|---|---|---|---|---|---|---|---|---|
| `@evenrealities/even_hub_sdk` | 0.0.16 | `apps/eg2notes` (runtime) | Even Hub SDK: glasses display, input, storage. **The only package that ships to the phone.** | Even Realities | 2026-09-24 | No (signed) | None | 0 | MIT |
| `@evenrealities/even_hub_sdk` | 0.0.16 | `apps/eg2presentation` (runtime) | same | same | same | same | same | same | same |
| `@evenrealities/even_hub_sdk` | 0.0.16 | `packages/shared` (runtime) | same (the shared glasses code) | same | same | same | same | same | same |
| `@evenrealities/evenhub-cli` | 0.1.14 | `apps/eg2notes` (dev) | QR sideload, `app.json`, `.ehpk` packaging. 0.2.0 later, once tested | Even Realities | 2026-08-20 | No (signed) | None | 8 (+ peer `typescript ^5`) | `UNLICENSED` in its metadata (dev tool, never shipped) |
| `@evenrealities/evenhub-cli` | 0.1.14 | `apps/eg2presentation` (dev) | same | same | same | same | same | same | same |
| `@evenrealities/evenhub-simulator` | 0.9.5 | root (dev) | Desktop simulator (native binary via a platform package) | Even Realities | 2026-09-01 | No (signed) | None | 0 (+6 optional platform binaries) | MIT |
| `vite` | 8.3.4 | root (dev) | Dev server with hot reload, production build | Vite team | 2026-10-08 | **Yes** | None | 5 (+1 optional) | MIT |
| `typescript` | 7.0.2 | root (dev) | Type checking (`tsc --noEmit`) | Microsoft | 2026-07-08 | No (signed) | None | 20 platform binaries (optional) | Apache-2.0 |
| `@types/node` | 24.19.2 | root (dev) | Type definitions for Node 24 built-ins (tests and scripts) | DefinitelyTyped | 2026-10-09 | No (signed) | None | 1 | MIT |

## Notes

- **Vite advisories (2026-10-21):** none affects 8.3.4. The three of 2026-10-06 were fixed in 8.3.3;
  GHSA-8g5g-mxqh-grgj (2026-10-21) affects Vite 6.4.4 only.
- **Why the CLI sits in each app, not at the root:** it declares a peer dependency on TypeScript `^5`, while the
  root type-checks with TypeScript 7. Inside a workspace, npm gives the CLI its own TypeScript 5.9.3 (an indirect
  dependency) without `--legacy-peer-deps` or overrides. The CLI's code never imports TypeScript (only its package
  metadata names it), and **CLI 0.2.0 has no peer dependencies and no dependencies at all** (npm registry, checked
  2026-10-21), so the nested copies go away with 0.2.0.
- **postcss pinned to 8.5.30** (`overrides` in the root `package.json`, 2026-10-21): Vite asks for `^8.5.29` and npm had
  installed 8.5.31, published 3 days before the first release build (the 7-day rule for shipped builds,
  `npm run check:release`). 8.5.30 (2026-10-12) is in Vite's range and has no known advisory (postcss's advisories
  affect 8.5.22 and older). Remove the override once a newer version is 7 days old.
- **Built-in instead of packages:** tests (`node:test`), TypeScript execution in tests (Node 24 type stripping),
  scans and checks (Node built-ins only).
- **First install (2026-10-21):** 87 packages, 0 vulnerabilities, 84 verified registry signatures (39 with
  provenance; the other 3 entries are this repo's own workspaces). Every package comes from `registry.npmjs.org`;
  none runs an install script (`fsevents` declares one but is macOS-only and isn't installed on Linux).
