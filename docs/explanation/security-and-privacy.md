# Security and privacy, explained

Why the apps are built the way they are. The policy users agree to is the [privacy policy](../privacy.md); the
detailed records are the [data-flow map](../security/data-flow.md) and the
[residual-risk register](../security/privacy-risk.md).

## The goal

Even Realities and any third party should hold as little of your data as possible. Where that can't be avoided, it's
reduced and said plainly.

## No network at all

The apps have nothing to send and nowhere to send it:

- **No permissions** in `app.json`, where Even's apps declare what they use (network, microphone, location…):
  these declare nothing.
- **A Content Security Policy with `connect-src 'none'`:** even if code tried to connect somewhere, the page would block
  it. All code, styles and images are bundled; no fonts, CDNs, analytics or tracking.
- **A scan of every build** (`npm run check:bundle`) looks for network code and remote addresses, and checks the exact
  policy is in place.

Even's SDK is published obfuscated, so its code can't be fully read. The policy is the control that holds either way.

## Where the data is, and who can see it

Everything is saved with the SDK's storage (`setLocalStorage`) on your phone. That has limits the apps can't change:

- **Other plugins can read it.** Measured on a real phone: a test plugin read another plugin's saved values. Hence the
  warning on every phone page and in the privacy policy: don't keep passwords or secrets in the apps.
- **The Even Realities app can read it**, since it runs the apps and holds the storage. Whether Even ever copies it
  to its servers isn't documented; the apps make no claim either way.
- **Encryption wouldn't help:** the key would have to sit in the same storage.
- **No server means no backup.** Export and Import on the phone page are the safety net.

## Input is untrusted

Import accepts text from anywhere, so it's checked strictly: the app name and schema, every field's type and length,
the number of items, the total size. Text is only ever shown as text, never run or rendered as HTML. If the saved data
itself fails the check, the app doesn't overwrite it: it shows it, read-only, so it can be copied.

## The code you install

- Only official Even Realities packages ship to the phone (the SDK); the build tools come from well-known
  publishers, each reviewed and listed in [approved-packages.md](../reference/approved-packages.md).
- Exact versions, no install scripts, registry-only installs, a minimum release age, and `npm audit` in CI
  ([checks.md](../reference/checks.md)).
- Every commit is scanned for secrets and private details, and so is the whole history (`npm run check:history`). There are no secrets to leak: the apps need no keys or tokens.

## What's public

The source code, the package ids, and the developer name on Even Hub. Even receives the packed app, and anyone can
unpack a published one, so nothing in it is secret.

Found a problem? See [SECURITY.md](../../SECURITY.md).
