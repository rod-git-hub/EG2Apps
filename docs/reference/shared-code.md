# Shared code (`packages/shared`)

What both apps use. Each app's own code is only its data model, its screens and its phone page
([features/eg2notes.md](features/eg2notes.md), [features/eg2presentation.md](features/eg2presentation.md)).

## Files

| File | What |
|---|---|
| `build/csp.ts` | The Content Security Policy, written into `index.html` by a Vite plugin: `connect-src 'none'` in builds; `'self'` on the dev server only (hot reload) |
| `src/bridge-queue.ts` | `serial()`: one Even bridge call at a time, each with a time limit (Even: concurrent calls can break the connection) |
| `src/model.ts` | The screen model: `ListScreen` (rows), `TextScreen` (paged text), `Row`, `RowMenu`, `Frame`, `Gesture` |
| `src/navigator.ts` | The screen stack and gestures: cursor, paging, back, exit, select mode; draws frames as text or as Even's list |
| `src/glasses-output.ts` | Draws frames on the glasses; turns Even's events into gestures and lifecycle signals |
| `src/glasses-session.ts` | Connects the bridge, the navigator and the output: repeats filter, ring mode, held menu picks, `askToExit` |
| `src/row-menu.ts`, `src/menu-close.ts` | The glasses menu ([features/glasses-menu.md](features/glasses-menu.md)) |
| `src/flick.ts` | Ring mode: quick flick streaks move 1, then 2, then 3 rows |
| `src/text.ts`, `src/glyph-widths.ts` | Text fitting by pixel width (the glasses' font, measured), the cursor window, paging |
| `src/storage.ts` | `Store`: Even's storage (or the browser's in preview), chunked writes, save shortly after a change, `flush()` |
| `src/doc.ts`, `src/list.ts` | The saved document's checks and limits; moving and removing list items |
| `src/phone.ts`, `src/phone.css`, `src/theme.ts` | The phone page's helpers, styles, Appearance and Glasses lists |
| `src/wordmark.ts` | The "EG2 NOTES" / "EG2 PRESENTATION" lettering: SVG on the phone, rasterised for the glasses and the icons |
| `src/dev-shots.ts` | **Development only:** the documentation screenshots' clicks (`?show=`); never in a build |

## The glasses page

One layout for every screen (576×288): a rounded frame with a header line and an 8-line body, the gesture line under
the frame, the app's wordmark in the top-right corner (a 20 px high image), and an invisible box over everything that
catches the gestures.

- The page is built once (`createStartUpPageContainer`), then only the text boxes that changed are updated in place
  (`textContainerUpgrade`, no flicker). It's rebuilt (`rebuildPageContainer`) only when the glasses menu or Even's
  list changes.
- Even answers a refused page with `false` (no error) and keeps the old page: every answer is checked, and a refused
  page is retried as a plain page, so the glasses never stay blank.
- Text is fitted by measured pixel widths (`glyph-widths.ts`): one proportional font, one size, no bold. `✓`, `→` and
  `⏱` aren't in it (`tests/glyphs.test.mjs` checks every symbol the apps use).

## Events

| Gesture | Arrives as |
|---|---|
| Swipe up / down | `textEvent` 1 / 2 (Even's list: handled by the glasses) |
| Tap | `sysEvent` with no `eventType` (0 is left out), or a `listEvent` with `currentSelectItemIndex` |
| Double tap | `sysEvent` 3 |
| Menu pick | `menuItemClickEvent.itemID` |
| Even took / gave back the screen, exit dialog | lifecycle 4 / 5 / 7: the app saves at once |

Some gestures arrive twice: exact repeats within 120 ms are ignored. Taps say whether they came from the ring or a
temple; swipes don't.

## Storage

- Inside the Even app: `bridge.setLocalStorage` / `getLocalStorage`, as Even recommends. The page's own browser
  storage isn't used there: an installed app runs at `http://127.0.0.1` on a port that changes every launch, so it
  would be lost.
- Values are read into memory at start-up; writes are saved 300 ms after a change, in chunks of up to 50,000
  characters, through the bridge queue. Measured on a phone: 1,000,000 characters save and read back intact in about
  0.1 s.
- `evenStorageWorks()` tests a write before trusting the bridge (in a plain browser the SDK's calls answer `false`).

## Tests

`tests/navigator.test.mjs`, `tests/glasses-output.test.mjs`, `tests/glasses-session.test.mjs`,
`tests/storage.test.mjs`, `tests/text.test.mjs`, `tests/glyphs.test.mjs`, `tests/bridge-queue.test.mjs`,
`tests/csp.test.mjs`.
