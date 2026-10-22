# Security policy

## Reporting a vulnerability

Please report privately through GitHub's **Security → Report a vulnerability** on this repository (available once
the repository is public). Don't open a public issue for security problems. You'll get a reply within 7 days.

## What the apps do and don't do

- **No permissions** in `app.json` (no network, microphone, location, camera or photos).
- **No network:** a Content Security Policy with `connect-src 'none'`; all code and assets are bundled; no fonts,
  CDNs, analytics or tracking.
- **Data:** only what the user types (notes, checklists, presentations, topics, stopwatch times), stored with the
  Even Hub SDK's `setLocalStorage` on the phone.
- **Known limitation:** Even's plugin storage is readable by other installed plugins (measured on a real phone,
  2026-10-05 and 2026-10-20). The apps can't prevent this, and encryption wouldn't help (the key would sit in the
  same storage). The privacy policy and the phone page say so.
- **Imported text** (Import on the phone page) is validated against a strict schema and size limits, and is only
  ever shown as text, never run or rendered as HTML.

The full list of residual risks is in [`docs/security/privacy-risk.md`](docs/security/privacy-risk.md).

## Development safeguards

- Exact-pinned dependencies, no install scripts, registry-only installs, a minimum release age
  ([`.npmrc`](.npmrc)); an approved-packages list enforced in CI.
- A secret scan and a public-hygiene check on every commit (pre-commit hook) and in CI.
- CI runs with read-only permissions and actions pinned to exact commits.
