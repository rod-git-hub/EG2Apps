# Data-flow map

Where the apps' data goes, and who can see it. Sources: Even's documentation (hub.evenrealities.com/docs:
Architecture, FAQ, Packaging, App Submission) and measurements on a real phone.
✅ stated in Even's docs · ⚠️ measured · ❓ not documented, to be measured.

## When you use the apps

```
Glasses  ⇄ Bluetooth ⇄  Even Realities app (phone)  →  the app's page (runs inside the Even Realities app)
                              │                                 │
                              │                                 └─ save / load through the Even Hub SDK
                              └─ Even's plugin storage on the phone  ◄──────────────────┘
```

| Hop | Data | Who can see it | Notes |
|---|---|---|---|
| Glasses ⇄ Even app (Bluetooth) | the text shown on the glasses; taps and swipes | Even's app and firmware | Only your own note and presentation text is sent |
| Even app ⇄ the app's page | display, input and storage calls | Even's app (it runs the page and the SDK, whose code is obfuscated) | The page's security policy blocks all connections; no permissions are requested |
| Page ⇄ storage | the app's one saved document | Even's app; **other installed plugins** (⚠️ measured 2026-10-05 and 2026-10-20) | Not encrypted, and encryption wouldn't help: the key would sit in the same storage |
| Page → network | **nothing**: no permissions, `connect-src 'none'`, no analytics, fonts or CDNs | — | Checked by a scan of the built app and a network capture before release |
| Even's storage → Even's cloud | ❓ Even doesn't document whether stored values are ever synced | Even, if so | We make no claim either way |
| Uninstall | stored data is cleared ✅ (FAQ, for browser storage; ❓ for the SDK's storage: to be verified) | — | Export first if you want to keep your data |

## Export and import (you start them)

Phone page text box ⇄ your clipboard ⇄ wherever you keep it. While text is on Android's clipboard, other apps may be
able to read it (depends on the Android version).

## Publishing

| Step | What goes where | Who sees it |
|---|---|---|
| Upload to Even Hub | the app package, release notes, icon, screenshots, privacy policy link, developer name | Even; after release, anyone ("anyone can extract its contents" ✅ Packaging) |
| Review | Even's reviewers install a test build; the phone's developer log is visible to them ✅ | Even's reviewers: **the apps log nothing from your data** |

## What Even can see

Even runs the page and holds the storage on the phone, so it can technically read what the apps save. Whether it
copies that to its servers isn't documented. The apps add no path that sends your data anywhere.
