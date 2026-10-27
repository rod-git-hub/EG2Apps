# EG2Presentation (developer guide)

User guide: [how-to/features/eg2presentation.md](../../how-to/features/eg2presentation.md). Shared code:
[shared-code.md](../shared-code.md).

## Files

| File | What |
|---|---|
| `apps/eg2presentation/app.json` | Even's manifest: `net.techdivision.eg2presentation`, `permissions: []`, `min_sdk_version` 0.0.16 |
| `src/main.ts` | Start-up, as in EG2Notes, plus the stopwatch |
| `src/talks.ts` | The data model and every edit (plain TypeScript: tested in Node) |
| `src/stopwatch.ts` | The talk stopwatch (plain TypeScript: tested in Node) |
| `src/glasses.ts` | The glasses screens: folders, presentations, topics, a topic's details |
| `src/phone.ts` | The phone page: folders, a folder, a presentation, a topic, the stopwatch card |
| `src/wordmark-image.ts`, `src/demo.ts`, `public/icon.png` | As in EG2Notes (`demo.ts` is development only) |

## Data model

One JSON document under `eg2presentation.v1` (also the Export format):

```json
{ "app": "eg2presentation", "schema": 1, "folders": [
  { "id": "…", "name": "Work", "presentations": [
    { "id": "…", "name": "Quarterly review", "topics": [
      { "id": "…", "title": "Welcome and agenda", "details": "…", "done": false } ] } ] } ] }
```

| Limit | Value | Where |
|---|---|---|
| Folders | 100 | `MAX_FOLDERS` |
| Presentations a folder | 100 | `MAX_PRESENTATIONS` |
| Topics a presentation | 200 | `MAX_TOPICS` |
| Names, titles | 200 characters, one line | `NAME_MAX_CHARS` |
| Details | 10,000 characters | `TEXT_MAX_CHARS` |
| Whole document | as EG2Notes (500,000 / 1,000,000 characters) | `DOC_WARN_CHARS`, `DOC_MAX_CHARS` |

Other keys: `eg2presentation.stopwatch` (`{"startedAt": epoch ms or null, "elapsedMs": n}`), `eg2presentation.theme`,
`eg2presentation.lists`.

## The stopwatch

One stopwatch for the app, kept on the phone only. Time is calculated from saved moments (`startedAt`, `elapsedMs`),
not counted tick by tick, so it stays right while Android pauses the page or the phone is locked. Modes: `ready`,
`running`, `paused`. The phone card updates its time in place every 500 ms while running (no page redraw).

## Glasses details

- **Folders** → **presentations** (`Name (done/total)`) → **topics**: the stopwatch rows (`▶ Start stopwatch`;
  `● Pause  00:04`; `▶ Resume  00:04` + `○ Reset stopwatch`), a spacer, then `○ 1. Title` / `● 1. Title`.
- **Header:** `Name · 00:04 · 1/5`, measured to fit beside the corner wordmark; the time is read once per redraw, so
  the header and the row always agree. With Even's list the row says "stopwatch" (a row can't change in place there).
- **A topic's details** (1.1.0): header `00:04 · topic 2/5`; `onTap` toggles the topic's done
  flag (`setTopicDone`, then `changed()` redraws the same page); `onPastEnd` / `onPastStart` (a swipe past the last or
  before the first page) `replace` the page with the next / previous topic, and `parentCursorBy(other − i)` keeps the
  topics list's cursor in step; nothing past the ends. The hint says `tap = tick` or `tap = untick`, plus
  `swipe = next / previous` when there's another topic or page. Before 1.1.0 a tap marked the topic done and jumped to
  the next. `✓` and `→` aren't in the glasses font: `●` `○` `▶` instead (`tests/glyphs.test.mjs`).

## Privacy

As EG2Notes. The stopwatch saves only two numbers.

## Tests

`tests/eg2presentation.test.mjs`, `tests/stopwatch.test.mjs`, plus the shared navigator, menu and list tests.
