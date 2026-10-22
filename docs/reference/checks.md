# Checks and scripts

Every check the project runs, where, and what it catches. All scripts use Node.js built-ins only.

## npm scripts

| Command | What |
|---|---|
| `npm run check` | `check:packages`, `check:secrets`, `check:hygiene`, `typecheck`, `test` |
| `npm run check:all` | `check`, then `build` and `check:bundle` |
| `npm run check:packages` | Every direct dependency is on the approved list ([approved-packages.md](approved-packages.md)) |
| `npm run check:secrets` | Secret scan over every tracked file (API keys, tokens, private keys, `.env` files) |
| `npm run check:hygiene` | Public-hygiene check: no personal or development details in tracked files |
| `npm run typecheck` | TypeScript over the Vite plugin, the shared package and both apps |
| `npm test` | The `node:test` suites in `tests/` |
| `npm run build` | Both apps → `apps/*/dist` |
| `npm run check:bundle` | The built apps: no network code or remote addresses, the exact strict CSP, only bundled files |
| `npm run check:release` | Every package in the lockfile is at least 7 days old (before shipping) |
| `npm run check:history` | Secret scan and hygiene check over every file version and commit message in the history |

## Where they run

| | Pre-commit hook (`.githooks/pre-commit`) | CI (`.github/workflows/ci.yml`) | Before a release |
|---|---|---|---|
| Secret scan, hygiene check | Staged files | All files | |
| Approved packages, typecheck, tests, build, bundle scan | | Yes | Yes |
| `npm audit`, `npm audit signatures` | | Yes | Yes |
| Release age (7 days), history scan | | | Yes |

Turn the hook on once per clone:

```bash
git config core.hooksPath .githooks
```

CI runs on every push and pull request with read-only permissions (`contents: read`) and actions pinned to exact
commits. Dependabot proposes updates after a 7-day cooldown.

## Supply-chain settings (`.npmrc`)

`save-exact=true`, `ignore-scripts=true` (no install scripts run), `min-release-age=2`, `allow-git=none`,
`allow-remote=none`, `engine-strict=true`. Installs use `npm ci` (exactly the lockfile).

## Dev-only scripts

| Script | What |
|---|---|
| `scripts/make-icons.mjs` | The store icons, backgrounds and the corner wordmark module (`src/wordmark-image.ts`) |
| `scripts/doc-shots.mjs` | The documentation screenshots, with made-up data ([how-to/screenshots.md](../how-to/screenshots.md)) |

## Tests

Each scan has its own tests: `tests/secret-scan.test.mjs`, `tests/hygiene-check.test.mjs`, `tests/bundle-scan.test.mjs`,
`tests/release-tools.test.mjs`, `tests/csp.test.mjs`, `tests/manifest.test.mjs`.
