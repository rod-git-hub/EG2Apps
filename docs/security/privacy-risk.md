# Residual privacy and security risks

Risks that can't be fully removed, and what the apps do about each. Updated with every change.

| ID | Risk | Eliminate? | Control | Status |
|---|---|---|---|---|
| E1 | The Even app's plugin storage is **readable by other installed plugins** (measured on a real phone, 2026-10-05 and 2026-10-20) | No | The privacy policy and the phone page say so plainly; the apps store only your own text; no secrets by design; the page warns not to keep passwords or sensitive data in notes | Open |
| E2 | The apps run inside Even's app, which can read what they store | No | Minimal data; no permissions; nothing sent by the apps | Open |
| E3 | Even receives the uploaded app, and after release anyone can extract it | No (the code is public anyway) | Nothing secret in the build | Accepted |
| E4 | The developer name and the developer's domain (in the two package ids) are public on the listing | Partly | Chosen deliberately. The ids are names only; the apps never connect to the domain | Accepted |
| E5 | The Even SDK is obfuscated: its code inside the page can't be fully audited | No | Strict security policy (`connect-src 'none'`), no permissions, a scan of the built app, a network capture before release | Open |
| E6 | ❓ Whether Even syncs plugin storage to its cloud | Unknown | Network capture on the phone before release; the privacy policy makes no claim either way | Open |
| E7 | No backup: uninstalling, losing storage or a confirmed delete (on the phone, or from the glasses menu) removes data for good | Partly | Export / import; every delete asks first and says what's inside; clear wording on the phone page, in the privacy policy and the release notes | Open |
| E8 | Android's clipboard may expose exported text to other apps | No | Said next to the Export button; export only happens when you ask | Open |
| E9 | Imported text is untrusted input | Yes, mostly | Strict schema, size limits, shown only as text (never run or rendered as HTML), tests | Open |
| E10 | Supply chain (npm packages) | Reduced | `.npmrc` policy, approved-packages list, `npm ci`, audit and signature checks, advisories per package, 7-day minimum age for shipped builds | Open |
