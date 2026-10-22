# EG2Apps documentation

The front pages stay at the top of the repository: [README.md](../README.md), [SECURITY.md](../SECURITY.md),
[CHANGELOG.md](../CHANGELOG.md). Everything else lives here.

## How it's organised

The documentation follows **[Diátaxis](https://diataxis.fr/)**: four kinds of page, each with one job.

| Folder | Kind | Answers |
|---|---|---|
| [tutorials/](tutorials) | Learning | "Take me through it, start to finish." |
| [how-to/](how-to) | Doing a task | "How do I …?" |
| [reference/](reference) | Looking something up | "What exactly is …?" |
| [explanation/](explanation) | Understanding | "Why is it like this?" |
| [security/](security) | The data-flow map and the residual-risk register | |
| [img/](img) | Screenshots, made-up data only ([how-to/screenshots.md](how-to/screenshots.md)) | |

The [privacy policy](privacy.md) and [terms of use](terms.md) sit at the top of `docs/`: Even Hub's listings link to
them, so they keep their addresses.

## Tutorials

| Page | What |
|---|---|
| [install.md](tutorials/install.md) | Installing the apps, the first start, the settings worth a look, updating, uninstalling |
| [user-guide.md](tutorials/user-guide.md) | A tour of both apps on the glasses and the phone, with screenshots |
| [development.md](tutorials/development.md) | Building from source: checks, the browser preview, Even's simulator, your phone (QR), packing |

## How-to guides

| Page | What |
|---|---|
| [features/](how-to/features/README.md) | Using each feature: EG2Notes, EG2Presentation, the glasses menu, settings and backup |
| [screenshots.md](how-to/screenshots.md) | Taking the documentation screenshots, with made-up data |
| [maintenance.md](how-to/maintenance.md) | Keeping packages, Even's SDK and Node.js up to date; releasing a new version |

## Reference

| Page | What |
|---|---|
| [features/](reference/features) | Each feature's developer page: files, data, flow, glasses details, tests (same file names as the how-to pages) |
| [shared-code.md](reference/shared-code.md) | The shared package: the glasses page, events, storage |
| [checks.md](reference/checks.md) | Every check and script, where it runs (hook, CI, before a release) |
| [approved-packages.md](reference/approved-packages.md) | Every dependency, why it's trusted, and the update rules (read by `npm run check:packages`) |

## Explanation

| Page | What |
|---|---|
| [security-and-privacy.md](explanation/security-and-privacy.md) | Why no network, where the data is and who can see it, untrusted input, the supply chain |

## Security records

| Page | What |
|---|---|
| [data-flow.md](security/data-flow.md) | Where the apps' data goes, hop by hop, and who can see it |
| [privacy-risk.md](security/privacy-risk.md) | The residual risks, what reduces them, and their status |

## Where a new page goes

- A lesson from nothing to working: `tutorials/`.
- The steps for one task: `how-to/` (a feature's user page: `how-to/features/`).
- Facts to look up (files, settings, limits, checks): `reference/` (a feature's developer page:
  `reference/features/`, same file name as its how-to page).
- The why (design, security model, trade-offs): `explanation/`.
- Data flows and risks: `security/`.
- Nothing personal or about a development machine, anywhere: the hygiene check runs on every commit.
