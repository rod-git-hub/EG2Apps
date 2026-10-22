# Settings and Backup (developer guide)

User guide: [how-to/features/settings.md](../../how-to/features/settings.md).

## Files

| File | What |
|---|---|
| `packages/shared/src/theme.ts` | `themeSection`, `listStyleSection` (radio groups), `applyTheme`, `watchSystemTheme`, the parsers |
| `packages/shared/src/phone.ts` | `backupSection` (Export, Check pasted text, Import), `privacyNote`, the page helpers |
| `packages/shared/src/phone.css` | The phone page's styles; light and dark colours under `data-theme` |
| `packages/shared/src/navigator.ts` | Draws lists with the text cursor or as Even's list (`listStyle`) |

## Settings

| Setting | Key (per app) | Values | Default |
|---|---|---|---|
| Appearance | `<app>.theme` | `system`, `light`, `dark` | `system` (follows `prefers-color-scheme`) |
| Glasses lists | `<app>.lists` | `cursor`, `native` | `cursor` |

Unknown saved values fall back to the default. `applyTheme` sets `data-theme` on `<html>`; with `system`, a change of
the phone's setting is followed live. A Glasses lists change calls `nav.refresh()`: the glasses redraw at once.

## Even's list (`native`)

- Even's `ListContainerProperty`: at most 20 rows (21 are refused, measured 2026-10-21) of up to 63 bytes. Longer
  lists page by 18 rows with `▲ Previous` / `▼ More` rows (`NATIVE_PAGE_ROWS`).
- A tap arrives as a `listEvent` with `currentSelectItemIndex` (left out when 0); swipes move Even's highlight and
  never reach the app.
- Screens marked `cursorOnly` (checklists, select mode) keep the text cursor; lists have no glasses menu.

## Backup

- **Export** puts `serialise(doc)` (the stored JSON, indented) in the text box and selects it for copying.
- **Check pasted text** runs the app's parser (`parseNotes` / `parseTalks`): the same strict check as start-up, with
  the app name and schema checked. It shows a summary or the error; nothing changes.
- **Import** needs a second tap ("Import replaces everything you have now"), then `replace(doc)` saves and redraws.
- Imported text is only ever shown as text (`textContent`, `value`), never as HTML.

## Tests

`tests/eg2notes.test.mjs` and `tests/eg2presentation.test.mjs` (parsing, limits, wrong app), `tests/native-lists.test.mjs`,
`tests/navigator.test.mjs`.
