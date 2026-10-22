# Features: user and developer guides

One **user guide** (how to use it, what each setting does, where your data goes) and one **developer guide** (files,
data, flow, limits, tests) per feature. The user guides are in this folder; the developer guides are in
[docs/reference/features/](../../reference/features), with the same file names. Living documents: a feature change
updates its two pages in the same commit.

| Feature | User guide | Developer guide |
|---|---|---|
| EG2Notes (notes, checklists, note text) | [eg2notes.md](eg2notes.md) | [reference/features/eg2notes.md](../../reference/features/eg2notes.md) |
| EG2Presentation (folders, presentations, topics, the stopwatch) | [eg2presentation.md](eg2presentation.md) | [reference/features/eg2presentation.md](../../reference/features/eg2presentation.md) |
| The glasses menu (Move up, Move down, Select, Delete) | [glasses-menu.md](glasses-menu.md) | [reference/features/glasses-menu.md](../../reference/features/glasses-menu.md) |
| Settings and Backup (Appearance, Glasses lists, Export / Import) | [settings.md](settings.md) | [reference/features/settings.md](../../reference/features/settings.md) |

## The basics, for every feature

**Gestures** (temple touchpads or the R1 ring):

| Gesture | Does |
|---|---|
| Swipe | Moves the `>` cursor (lists wrap around at both ends); on a text page, the next or previous page |
| Tap | Opens or does the row under the cursor |
| Double tap | Back. On the first page: Even's exit dialog |
| Tap, then press and hold | Even's glasses menu: Move up, Move down, Select, Delete ([glasses-menu.md](glasses-menu.md)) |

**Where things run:** the app runs inside the Even Realities app on your phone; the glasses only show its pages and
send your gestures. Creating and editing happen on the app's phone page.

**Where data lives:**

| | Phone (Even's plugin storage) | Anywhere else |
|---|---|---|
| Notes, checklists, presentations, topics | Yes, the only copy | No (Export, if you copy it somewhere) |
| The stopwatch, Appearance, Glasses lists | Yes | No |

Other plugins installed in the Even Realities app can read that storage, and so can the Even Realities app itself:
don't keep passwords or secrets in the apps. Full map: [data-flow.md](../../security/data-flow.md).
