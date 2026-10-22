# The glasses menu (developer guide)

User guide: [how-to/features/glasses-menu.md](../../how-to/features/glasses-menu.md).

## Files

| File | What |
|---|---|
| `packages/shared/src/row-menu.ts` | `MenuActions`: which items a screen gets, select mode, confirmations, the actions |
| `packages/shared/src/menu-close.ts` | `MenuAfterClose`: holds a pick until Even's menu has closed |
| `packages/shared/src/model.ts` | `RowMenu` (on a row or a text page), `GlassesMenu` |
| `packages/shared/src/glasses-output.ts` | Sends the menu with the page (`MenuContainerProperty`); decodes `menuItemClickEvent.itemID` |

## Items

| Item | id (`MENU_IDS`) | On |
|---|---|---|
| Move up | 2 | lists with menu rows; text pages with a `menu` |
| Move down | 3 | as Move up |
| Delete | 4 | as Move up |
| Select | 6 | lists with a `selectKey` |

At most 10 items, names up to 32 bytes (Even's limits). Even sets a page's menu only when the page is built, so the
output rebuilds the page when the menu's key (its item ids) changes, and updates text in place otherwise.

## Flow

1. Tap, then press and hold: Even shows its menu and sends lifecycle `FOREGROUND_ENTER` (4).
2. A pick arrives as `menuItemClickEvent.itemID`, **before** Even's menu has closed (`FOREGROUND_EXIT`, 5). Drawing
   then would be lost, so `MenuAfterClose` holds the pick until the menu has closed (or 800 ms), then runs it. Any
   other gesture first runs a held pick.
3. `MenuActions.handle(id, screen, row)` acts on the row under the cursor (lists) or the page's `menu` (text pages).
4. Delete pushes a confirmation page (`DELETE?`, tap = delete, double tap = cancel) naming what goes with it
   (`RowMenu.contains`). Select mode: `decorate()` redraws the list as `■ Delete N selected`, `○ Cancel`, a spacer
   and `★` / `☆` rows; `onBack` leaves select mode.

## With Even's list

Even's list (`listStyle: "native"`) doesn't report the highlighted row when the menu opens, so `menuFor(screen, true)`
returns no menu on lists. Opened items (text pages) keep theirs. Select mode is always drawn with the text cursor
(`cursorOnly`).

## Tests

`tests/row-menu.test.mjs` (items per screen, moves, select, confirmations), `tests/glasses-session.test.mjs` (held
picks, repeats), `tests/native-lists.test.mjs`.
