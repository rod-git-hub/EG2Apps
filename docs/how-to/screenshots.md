# How to take the documentation screenshots

The screenshots in `docs/img/<app>/` use **made-up data only**: each app's development-only sample data
(`src/demo.ts`, loaded with `?demo=reset`), in Even's simulator. Nothing touches real data. The tool:
`scripts/doc-shots.mjs` (dev only, never shipped).

## 1. Start the app's local preview

One app at a time (both previews use port 5174):

```bash
npm run dev:sim -w @eg2apps/eg2notes
```

## 2. Take the shots

In a second terminal. The script starts and stops the simulator itself (one start per group of screens), so close
any other simulator first:

```bash
node scripts/doc-shots.mjs eg2notes http://localhost:5174
```

Then stop the preview (Ctrl+C), start EG2Presentation's (`npm run dev:sim -w @eg2apps/eg2presentation`) and run:

```bash
node scripts/doc-shots.mjs eg2presentation http://localhost:5174
```

One screenshot only: add the output folder and its name, e.g.
`node scripts/doc-shots.mjs eg2notes http://localhost:5174 docs/img/eg2notes phone-02-note`.

## What it does

- **Glasses** (`glasses-NN-*.png`): drives the simulator with its automation API (`POST /api/input` up, down, click,
  double click) and saves `GET /api/screenshot/glasses`. That picture keeps the brightness in its alpha channel, so
  the script saves it green on black at 2x (1152×576), the way the glasses look.
- **Phone** (`phone-NN-*.png`): the simulator's phone view (`GET /api/screenshot/webview`, 600×800). The simulator
  can't click there, so the page's development-only `?show=Button|Button|…` clicks the named buttons in turn
  (`scroll:Text` scrolls to a heading, `wait:ms` pauses). It lives in `packages/shared/src/dev-shots.ts` and is only
  loaded when `import.meta.env.DEV` is true: never in a build.
- The screens and their order are the `RUNS` list at the top of the script; numbering follows the user guide.

## Things that catch you out

- **One simulator per automation port** (9898). Another one running: set `SIM_PORT=9899`.
- **Editing the code reloads the simulator's page** (hot reload): don't edit while it runs.
- The script waits until the glasses show the app's first page before it taps: a freshly started preview is slow on
  its first load, and taps sent before then are lost (the whole sequence shifts).
- The last step of each app's run sets Appearance back to Match phone (in case the simulator keeps settings between starts).
- Changing the sample data or the screens changes the pictures: run both apps again and look at every picture before
  committing.

## In the docs

- Glasses alone: `<img … width="480">`; side by side in a table: glasses `width="420"`, phone `width="260"`.
- The submission screenshots for Even Hub are plain simulator captures (576×288), made the same way but kept outside
  the repository with the rest of the submission kit.
