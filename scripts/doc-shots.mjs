#!/usr/bin/env node
// Documentation screenshots (docs/img/<app>/) with made-up data only: each run starts Even's simulator on the app's
// local preview with ?demo=reset (the sample data in the app's src/demo.ts, development only), drives the glasses
// with the simulator's automation API and saves what it shows. Dev tool, never shipped; Node built-ins only.
//
//   node scripts/doc-shots.mjs <eg2notes | eg2presentation> <preview URL> [out dir] [one screenshot name]
//
// The preview runs first (docs/how-to/screenshots.md). Phone pages are the simulator's phone view
// (GET /api/screenshot/webview): it can't click there, so the page's development-only ?show=Button|… does.
// Glasses shots (GET /api/screenshot/glasses) carry their brightness in the alpha channel: they're saved green on
// black at 2x, the way the glasses look.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync, inflateSync } from "node:zlib";

const PORT = Number(process.env.SIM_PORT ?? 9898);
const SIM = `http://127.0.0.1:${PORT}`;
const SIM_BIN = new URL("../node_modules/@evenrealities/sim-linux-x64/bin/evenhub-simulator", import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const die = (m) => { console.error(m); process.exit(1); };

// One simulator start per run: its URL parameters, then steps. "glasses:<name>" and "phone:<name>" save a shot;
// up / down / click / double_click are glasses gestures; "wait:ms" pauses.
const RUNS = {
  eg2notes: [
    { params: "", steps: ["glasses:glasses-01-notes", "phone:phone-01-notes", "click", "down", "down", "down", "click", "glasses:glasses-02-checklist", "double_click", "down", "down", "click", "click", "glasses:glasses-03-note-text"] },
    { params: "show=Groceries", steps: ["phone:phone-02-note"] },
    { params: "show=scroll:Appearance", steps: ["phone:phone-03-settings"] },
    { params: "show=Export|scroll:Backup", steps: ["phone:phone-04-backup"] },
    { params: "lists=native", steps: ["glasses:glasses-04-select-box"] },
    { params: "show=Dark", steps: ["phone:phone-05-dark"] },
    { params: "show=Match phone", steps: [] }, // the appearance back to the default
  ],
  eg2presentation: [
    { params: "", steps: ["glasses:glasses-01-folders", "phone:phone-01-folders", "click", "glasses:glasses-02-presentations", "click", "click", "wait:4000", "glasses:glasses-03-talk", "down", "click", "click", "glasses:glasses-04-topic-details"] },
    { params: "show=Work|Quarterly review|Start|wait:3000", steps: ["phone:phone-02-talk"] },
    { params: "show=Work|Quarterly review|2. Results this quarter", steps: ["phone:phone-03-topic"] },
    { params: "show=scroll:Appearance", steps: ["phone:phone-04-settings"] },
    { params: "lists=native", steps: ["glasses:glasses-05-select-box"] },
    { params: "show=Dark", steps: ["phone:phone-05-dark"] },
    { params: "show=Match phone", steps: [] },
  ],
};

// ── PNG: read the simulator's 8-bit RGBA, write 8-bit RGB ──────────────────────────────────────────────────────────
function readPng(buf) {
  let pos = 8, width = 0, height = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  return { width, height, px };
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

/** The glasses' framebuffer as green on black, 2x. Exported for tests. */
export function glassesPng(buf, scale = 2) {
  const img = readPng(buf);
  const W = img.width * scale, H = img.height * scale;
  const out = Buffer.alloc(H * (W * 3 + 1));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (Math.floor(y / scale) * img.width + Math.floor(x / scale)) * 4;
      const p = img.px;
      const lum = Math.max(p[i + 3], Math.round(((p[i] + p[i + 1] + p[i + 2]) / 3) * p[i + 3] / 255));
      const o = y * (W * 3 + 1) + 1 + x * 3;
      out[o] = Math.round(lum * 0.25); out[o + 1] = lum; out[o + 2] = Math.round(lum * 0.35);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(out)), chunk("IEND", Buffer.alloc(0))]);
}

// ── The simulator ──────────────────────────────────────────────────────────────────────────────────────────────────
async function simReady() {
  for (let i = 0; i < 60; i++) {
    if (await fetch(`${SIM}/api/ping`).then((r) => r.ok, () => false)) return;
    await sleep(500);
  }
  die("the simulator didn't start");
}

const get = async (path) => Buffer.from(await (await fetch(`${SIM}${path}`)).arrayBuffer());

async function run(url, steps, outDir, only) {
  const sim = spawn(SIM_BIN, [url, "--automation-port", String(PORT)], { stdio: "ignore" });
  try {
    await simReady();
    await sleep(7000); // the page, Even's bridge and the first glasses page
    for (const step of steps) {
      const [kind, name] = step.split(":");
      if (kind === "wait") await sleep(Number(name));
      else if (kind === "glasses" || kind === "phone") {
        if (only && name !== only) continue;
        const png = kind === "glasses" ? glassesPng(await get("/api/screenshot/glasses")) : await get("/api/screenshot/webview");
        writeFileSync(join(outDir, `${name}.png`), png);
        console.log(`  ${name}.png`);
      } else {
        const r = await fetch(`${SIM}/api/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: kind }) });
        if (!r.ok) die(`input ${kind}: ${r.status}`);
        await sleep(800);
      }
    }
  } finally {
    sim.kill();
    await sleep(1500);
  }
}

async function main() {
  const [app, preview, outArg, only] = process.argv.slice(2);
  if (!RUNS[app] || !preview) die("Usage: doc-shots.mjs <eg2notes | eg2presentation> <preview URL> [out dir] [one screenshot name]");
  const outDir = outArg ?? new URL(`../docs/img/${app}`, import.meta.url).pathname;
  mkdirSync(outDir, { recursive: true });
  for (const { params, steps } of RUNS[app]) {
    if (only && steps.length && !steps.some((s) => s.endsWith(`:${only}`))) continue;
    const query = ["demo=reset", ...params.split("&").filter(Boolean).map((p) => p.replace(/=(.*)$/, (_, v) => `=${encodeURIComponent(v)}`))].join("&");
    await run(`${preview.replace(/\/$/, "")}/?${query}`, steps, outDir, only);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
