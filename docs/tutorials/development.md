# Building and testing the apps yourself

From a fresh clone to the apps in Even's simulator, on your own phone, and packed for Even Hub. Using the apps:
[user-guide.md](user-guide.md).

## Contents

1. [Requirements](#1-requirements)
2. [Get the code and check it](#2-get-the-code-and-check-it)
3. [Try it in a browser](#3-try-it-in-a-browser)
4. [Try it in Even's simulator](#4-try-it-in-evens-simulator)
5. [Try it on your phone and glasses](#5-try-it-on-your-phone-and-glasses)
6. [Build and pack](#6-build-and-pack)
7. [Troubleshooting](#7-troubleshooting)

## 1. Requirements

| | |
|---|---|
| **Node.js** | 24.22.1 or a later 24.x (`engine-strict` refuses other versions) |
| **git** | Any recent version |
| **Computer** | Linux x86-64 is what's tested; the simulator also ships for macOS and Windows |
| **For the phone** | G2 glasses, the Even Realities app with **Developer Mode** on, and the phone on the same network as the computer |
| **For Even Hub** | An Even developer account (the same as the phone app's) |

## 2. Get the code and check it

```bash
git clone https://github.com/rod-git-hub/EG2Apps.git
```

```bash
cd EG2Apps
```

Install exactly what `package-lock.json` lists. `.npmrc` makes sure no install scripts run and only the npm registry
is used:

```bash
npm ci
```

Run every check (approved packages, secret scan, hygiene check, type check, tests, build, bundle scan):

```bash
npm run check:all
```

Turn on the pre-commit hook (secret scan and hygiene check on every commit) if you'll commit:

```bash
git config core.hooksPath .githooks
```

## 3. Try it in a browser

Start EG2Notes' local preview (for EG2Presentation: `-w @eg2apps/eg2presentation`; both use port 5174, so one at a
time):

```bash
npm run dev:sim -w @eg2apps/eg2notes
```

Open `http://localhost:5174/?demo`. In a plain browser there's no Even app: the page runs in **preview mode**, with the
browser's own storage and no glasses. `?demo` loads sample data (development only; `?demo=reset` starts it afresh).

## 4. Try it in Even's simulator

With the preview running, in a second terminal:

```bash
node_modules/.bin/evenhub-simulator "http://localhost:5174/?demo"
```

The simulator shows the glasses (576×288) and the phone page, connected like a real phone. Its glasses take
**up**, **down**, **click** and **double click**; it has no ring and no Bluetooth. `?lists=native` shows Even's select
box (development only). Even's guide: [Simulator](https://hub.evenrealities.com/docs/test/simulator).

<img src="../img/eg2presentation/glasses-03-talk.png" alt="EG2Presentation in the simulator: a talk with its stopwatch" width="480">

## 5. Try it on your phone and glasses

Even's steps: [Local testing](https://hub.evenrealities.com/docs/test/local-testing). The phone loads the page from
your computer over your network, so the computer must accept connections from it.

1. Start the dev server for the network (port 5173):

   ```bash
   npm run dev -w @eg2apps/eg2notes
   ```

2. In a second terminal, show a QR code for your computer's address on your network (replace `<computer-ip>`, for
   example with what `hostname -I` prints first on Linux):

   ```bash
   npm exec -w @eg2apps/eg2notes -- evenhub qr --url "http://<computer-ip>:5173"
   ```

3. On the phone: Even Realities app → **Even Hub** tab. Even: "tap **Scan QR**, and aim the phone camera at the
   terminal". Developer Mode must be on first (Even: "Hardware → Enable Developer Mode").

The app runs with Even's real storage, glasses and ring. Code changes reload it. If it doesn't load, see
[Troubleshooting](#7-troubleshooting).

The dev server only serves the app, the shared code and installed packages (`server.fs.allow`), never the rest of
the project. Stop it when you're done.

## 6. Build and pack

Build both apps and scan the builds:

```bash
npm run check:all
```

Before shipping, every package must be at least 7 days old:

```bash
npm run check:release
```

Pack one app into an `.ehpk` for Even Hub (from its folder; `--sdk-ver` sets the oldest Even app it runs on):

```bash
cd apps/eg2notes && npx --no-install evenhub pack app.json dist --sdk-ver 0.0.16 -o eg2notes.ehpk
```

Then, in Even's developer portal, upload it as a private build and install it on your phone: Even's
[Private testing](https://hub.evenrealities.com/docs/test/private-testing) ("**Me → Apps → Private builds** lists your
upload. Tap **Install**"). Beta and public releases follow
[Beta testing](https://hub.evenrealities.com/docs/test/beta-testing) and
[App submission](https://hub.evenrealities.com/docs/ship/app-submission).

Packs are reproducible: the same commit builds the same `.ehpk`, byte for byte (compare with `sha256sum`).

## 7. Troubleshooting

| Problem | Try |
|---|---|
| `npm ci` refuses: wrong Node.js version | Install Node.js 24.22.1 or a later 24.x |
| The phone can't open the QR page | Same network? Firewall open for port 5173? Even: "Wi-Fi AP isolation blocks phone-to-laptop": try a phone hotspot |
| Simulator: the glasses stay black | Wait a few seconds after it starts; check the preview is running on that port |
| Simulator: nothing reacts to input | The app's page must be on screen; restart the simulator |
| Nothing on the glasses from the browser preview | Expected: preview mode has no glasses. Use the simulator or the phone |
| `check:release` fails on a new package | It's younger than 7 days: wait, or pin the previous version |
