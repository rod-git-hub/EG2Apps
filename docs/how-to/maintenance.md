# How to keep the project up to date

What needs updating, how you find out, and how to update it safely. Every update runs the full checks before it's
committed.

## What, and how you find out

| What | How you find out | How often |
|---|---|---|
| Even Hub SDK, CLI, simulator (`@evenrealities/*`) | [Even's changelog](https://hub.evenrealities.com/docs/reference/changelog); Dependabot pull requests | Each session / weekly |
| Vite, TypeScript, `@types/node` | Dependabot pull requests (after a 7-day cooldown) | Weekly |
| GitHub Actions in CI | Dependabot pull requests | Weekly |
| Security advisories | `npm audit` in CI; GitHub's Dependabot alerts | Every push |
| Node.js 24 | [nodejs.org releases](https://nodejs.org/en/about/previous-releases) | Monthly |
| Even's review rules | [App submission](https://hub.evenrealities.com/docs/ship/app-submission) | Before each release |

## Update a package

1. Check the new version against the rules in [approved-packages.md](../reference/approved-packages.md): publisher,
   signature, install scripts, dependencies, age, advisories.
2. Update `package.json` (exact version) and the lockfile:

   ```bash
   npm install --save-exact vite@<version>
   ```

3. Update the table in `docs/reference/approved-packages.md` in the **same commit** (CI's approved-packages gate fails
   otherwise: every upgrade gets a deliberate look).
4. Run everything:

   ```bash
   npm run check:all
   ```

5. Before shipping a build from it, every package must be 7 days old:

   ```bash
   npm run check:release
   ```

A brand-new release (younger than 7 days) that a transitive dependency pulls in can be held back with `overrides` in
the root `package.json` (as done for `postcss`).

## Update Even's SDK

The SDK ships to the phone, so it gets the most care: read Even's changelog for the version, update all three
`package.json` files (both apps and `packages/shared`) to the same version, run the checks, test in the simulator,
then on a phone (QR), before any build. `min_sdk_version` in each `app.json` and `--sdk-ver` when packing follow it.

## Release a new version

1. Bump `version` in both `app.json` and `package.json` of the app (versions only go up).
2. Add the user-visible changes to [CHANGELOG.md](../../CHANGELOG.md).
3. Run `npm run check:all`, `npm run check:release` and `npm run check:history`.
4. Pack ([development.md, section 6](../tutorials/development.md#6-build-and-pack)), install as a private build, run the
   full test on a phone, then upload for beta or review.
5. If the screens changed, take the screenshots again ([screenshots.md](screenshots.md)).
