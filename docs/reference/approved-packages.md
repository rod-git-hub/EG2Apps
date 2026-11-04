# Approved packages

Only packages listed here may appear as **direct** dependencies in any `package.json` in this repo.
`scripts/check-approved.mjs` enforces this list in CI and in `npm run check`. To add or upgrade a package: re-run
the checks below, update this file in the same commit, and get the maintainer's approval for anything new.

**Approved:** 2026-10-21; Even CLI 0.2.0 on 2026-10-26; Vite 8.3.5 on 2026-11-01.

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
| `@evenrealities/evenhub-cli` | 0.2.0 | `apps/eg2notes` (dev) | QR sideload, `.ehpk` packaging (its app-management commands need a login: not used) | Even Realities | 2026-10-20 | No (signed) | None | 0 (8 bundled inside it) | `UNLICENSED` in its metadata (dev tool, never shipped) |
| `@evenrealities/evenhub-cli` | 0.2.0 | `apps/eg2presentation` (dev) | same | same | same | same | same | same | same |
| `@evenrealities/evenhub-simulator` | 0.9.5 | root (dev) | Desktop simulator (native binary via a platform package) | Even Realities | 2026-09-01 | No (signed) | None | 0 (+6 optional platform binaries) | MIT |
| `vite` | 8.3.5 | root (dev) | Dev server with hot reload, production build | Vite team | 2026-10-21 | **Yes** | None | 5 (+1 optional) | MIT |
| `typescript` | 7.0.2 | root (dev) | Type checking (`tsc --noEmit`) | Microsoft | 2026-07-08 | No (signed) | None | 20 platform binaries (optional) | Apache-2.0 |
| `@types/node` | 24.19.2 | root (dev) | Type definitions for Node 24 built-ins (tests and scripts) | DefinitelyTyped | 2026-10-09 | No (signed) | None | 1 | MIT |

## Notes

- **Vite advisories (2026-11-01):** none affects 8.3.5. The three of 2026-10-06 were fixed in 8.3.3;
  GHSA-8g5g-mxqh-grgj (2026-10-21) affects Vite 6.4.4 only. Moving from 8.3.4 to 8.3.5 didn't change either built app
  (byte-identical `.ehpk` files).
- **The Even CLI (moved from 0.1.14 to 0.2.0 on 2026-10-26):** it sits in each app's workspace, where its `pack` and
  `qr` commands run. 0.1.14 needed TypeScript `^5` as a peer (a nested 5.9.3 next to the root's 7); 0.2.0 has no
  dependencies, so 62 packages left the lockfile. The catch: its 8 dependencies are now bundled inside it, so
  `npm audit` can't check them (it's Even's own tool and never ships to the phone). The same build packs
  byte-identical `.ehpk` files with 0.1.14 and 0.2.0 (sha256 compared). Its new commands (upload, promote, testers…)
  need `evenhub login`; we don't log in on the development machine: uploads happen in Even's portal.
- **postcss** (an indirect dependency, through Vite) is no longer pinned: 8.5.32 passed the 7-day rule, so the
  `overrides` entry in the root `package.json` came out on 2026-11-04. The lockfile holds the exact version. The
  built apps didn't change (byte-identical `.ehpk` files). If a brand-new indirect release ever fails
  `npm run check:release`, hold it back the same way until it's 7 days old.
- **Built-in instead of packages:** tests (`node:test`), TypeScript execution in tests (Node 24 type stripping),
  scans and checks (Node built-ins only).
- **First install (2026-10-21):** 87 packages, 0 vulnerabilities, 84 verified registry signatures (39 with
  provenance; the other 3 entries are this repo's own workspaces). Every package comes from `registry.npmjs.org`;
  none runs an install script (`fsevents` declares one but is macOS-only and isn't installed on Linux).
