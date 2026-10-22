#!/usr/bin/env node
// Draws the apps' icons as greyscale PNGs (Even Hub: icons must be monochrome / greyscale; the template's app icon is
// 24×24, public/icon.png). Each icon is pixel art below: "#" bright, "+" mid grey, " " black (off on the glasses).
//
//   node scripts/make-icons.mjs [store folder]
//
// Writes apps/<app>/public/icon.png (24×24, packed with the app) and, when a folder is given, the portal's foreground
// and background at 24, 240 and 480 px (nearest-neighbour, so the pixels stay crisp). No dependencies: Node built-ins.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { layoutWordmark, rasterWordmark } from "../packages/shared/src/wordmark.ts";

const ICONS = {
  eg2notes: [
    "                        ",
    "  ####################  ",
    "  #                  #  ",
    "  #  ###  #########  #  ",
    "  #  ###             #  ",
    "  #  ###  ++++++     #  ",
    "  #                  #  ",
    "  #                  #  ",
    "  #  ###  #########  #  ",
    "  #  # #             #  ",
    "  #  ###  +++++++    #  ",
    "  #                  #  ",
    "  #                  #  ",
    "  #  ###  ########   #  ",
    "  #  # #             #  ",
    "  #  ###  +++++      #  ",
    "  #                  #  ",
    "  #                  #  ",
    "  #  ###  ######     #  ",
    "  #  # #             #  ",
    "  #  ###  ++++++     #  ",
    "  #                  #  ",
    "  ####################  ",
    "                        ",
  ],
  eg2presentation: [
    "                        ",
    " ###################### ",
    " #                    # ",
    " #  ++++++++++++      # ",
    " #                    # ",
    " #               ##   # ",
    " #           ##  ##   # ",
    " #       ##  ##  ##   # ",
    " #   ##  ##  ##  ##   # ",
    " #   ##  ##  ##  ##   # ",
    " #   ##  ##  ##  ##   # ",
    " #                    # ",
    " ###################### ",
    "           ##           ",
    "           ##           ",
    "          ####          ",
    "         ##  ##         ",
    "        ##    ##        ",
    "       ##      ##       ",
    "      ##        ##      ",
    "     ##          ##     ",
    "    ##            ##    ",
    "                        ",
    "                        ",
  ],
};
const LEVEL = { "#": 255, "+": 150, " ": 0 };
/** The store icons' wordmark: "EG2" large and pale on top, the app's name bright under it. */
const WORDMARKS = { eg2notes: "NOTES", eg2presentation: "PRESENTATION" };
/**
 * The glasses' corner wordmark: 20 px high (the SDK's minimum picture height). Input greys are dark on purpose: the
 * glasses brighten greys a lot (measured in the simulator, whose conversion matches the glasses, 2026-10-04: #262626
 * shows at ~131/255, #707070 at ~230/255).
 */
const CORNER_HEIGHT = 20;
const CORNER_PALE = 0x26;
const CORNER_BRIGHT = 0x70;
const PALE = 150;
/** The portal's background: an even dark grey (greyscale, so the icon reads on it). */
const BACKGROUND = 32;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** An 8-bit greyscale PNG from rows of grey levels. Exported for tests. */
export function greyPng(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type 0: greyscale
  const raw = Buffer.concat(rows.map((r) => Buffer.from([0, ...r]))); // filter byte 0 per row
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A square store icon (`px` wide): "EG2" pale over the app's word, bright, each centred, on black. */
export function wordmarkIcon(word, px) {
  const rows = Array.from({ length: px }, () => Array(px).fill(0));
  const draw = (text, tone, maxW, top) => {
    const v = layoutWordmark(text, tone).viewBox;
    const scale = Math.min(maxW / v.w, (px * 0.3) / v.h);
    const w = Math.ceil(v.w * scale);
    const h = Math.ceil(v.h * scale);
    const ox = Math.round((px - w) / 2);
    const { pale, bright } = rasterWordmark(text, w, h, scale, -v.x * scale, -v.y * scale, tone);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const level = Math.round(Math.max(pale[y][x] * PALE, bright[y][x] * 255));
      if (rows[top + y]) rows[top + y][ox + x] = Math.max(rows[top + y][ox + x], level);
    }
    return h;
  };
  const h1 = draw("EG2", "pale", px * 0.62, Math.round(px * 0.2));
  draw(word, "bright", px * 0.84, Math.round(px * 0.2) + h1 + Math.round(px * 0.08));
  return rows;
}

/** The corner wordmark's grey levels ("EG2 NOTES": EG2 pale, NOTES bright). Exported for tests. */
export function cornerWordmark(text) {
  const v = layoutWordmark(text).viewBox;
  const scale = CORNER_HEIGHT / v.h;
  const w = Math.ceil(v.w * scale);
  const { pale, bright } = rasterWordmark(text, w, CORNER_HEIGHT, scale, -v.x * scale, -v.y * scale);
  return pale.map((row, y) => row.map((p, x) => Math.round(Math.max(p * CORNER_PALE, bright[y][x] * CORNER_BRIGHT))));
}

/** Grey levels of an icon, scaled up `scale` times. Exported for tests. */
export function levels(art, scale = 1) {
  for (const line of art) if (line.length !== art.length) throw new Error(`icon rows must be ${art.length} wide: "${line}"`);
  const rows = [];
  for (const line of art) {
    const row = [...line].flatMap((ch) => Array(scale).fill(LEVEL[ch] ?? 0));
    for (let i = 0; i < scale; i++) rows.push(row);
  }
  return rows;
}

function main() {
  const store = process.argv[2];
  for (const [app, art] of Object.entries(ICONS)) {
    mkdirSync(join("apps", app, "public"), { recursive: true });
    writeFileSync(join("apps", app, "public", "icon.png"), greyPng(levels(art)));
    const corner = cornerWordmark(`EG2 ${WORDMARKS[app]}`);
    writeFileSync(join("apps", app, "src", "wordmark-image.ts"), [
      "// Generated by scripts/make-icons.mjs: don't edit. The app's wordmark for the glasses' top right corner, as a",
      "// greyscale PNG (embedded, so the app loads nothing from anywhere).",
      `export const WORDMARK_IMAGE = { width: ${corner[0].length}, height: ${corner.length}, png: "${greyPng(corner).toString("base64")}" } as const;`,
      "",
    ].join("\n"));
    if (!store) continue;
    mkdirSync(store, { recursive: true });
    for (const scale of [1, 10, 20]) {
      const px = art.length * scale;
      writeFileSync(join(store, `${app}-icon-${px}.png`), greyPng(levels(art, scale)));
      writeFileSync(join(store, `${app}-background-${px}.png`), greyPng(Array.from({ length: px }, () => Array(px).fill(BACKGROUND))));
    }
    for (const px of [240, 480]) writeFileSync(join(store, `${app}-wordmark-icon-${px}.png`), greyPng(wordmarkIcon(WORDMARKS[app], px)));
  }
  console.log(`Icons written${store ? ` (store assets in ${store})` : ""}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
