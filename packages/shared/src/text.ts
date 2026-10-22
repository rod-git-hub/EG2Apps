// Text fitting for the G2 display.
// Limits: text boxes take 1,000 characters when a page is built and 2,000 in an in-place update; a native list row
// takes at most 63 bytes of UTF-8 (measured in Even's simulator, 2026-10-21; Even's Display page says "64 characters").
// Glyphs like ● ○ ▶ are 3 bytes in UTF-8.

import { GLYPH_WIDTHS } from "./glyph-widths.ts";

const encoder = new TextEncoder();

export const LIST_ITEM_MAX_BYTES = 63;
export const TEXT_CREATE_MAX_CHARS = 1000;
export const TEXT_UPGRADE_MAX_CHARS = 2000;
const ELLIPSIS = "…";

export function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}

/** Shortens text to fit `maxBytes` of UTF-8, adding "…" when cut. Never splits a character. */
export function truncateBytes(text: string, maxBytes: number): string {
  if (utf8Bytes(text) <= maxBytes) return text;
  const budget = maxBytes - utf8Bytes(ELLIPSIS);
  let out = "";
  for (const ch of text) {
    if (utf8Bytes(out + ch) > budget) break;
    out += ch;
  }
  return out.trimEnd() + ELLIPSIS;
}

/** Shortens text to `maxChars` characters (code points), adding "…" when cut. */
export function truncateChars(text: string, maxChars: number): string {
  const chars = [...text];
  if (chars.length <= maxChars) return text;
  return chars.slice(0, maxChars - 1).join("").trimEnd() + ELLIPSIS;
}

// Widths in pixels. The glasses font isn't monospaced and text is always left-aligned, so we add up the measured
// character widths (glyph-widths.ts). On real strings the sum is within ~3 px of what the simulator draws.

/** Width of a character missing from the table: about an average letter. */
const UNKNOWN_WIDTH = 11;
const SPACE_WIDTH = GLYPH_WIDTHS[" "] ?? 5;
/**
 * Measured in Even's simulator (2026-10-07): a run of padding spaces is 5.0 px each (the table's 5.2 is a space
 * between words), and text comes out at ~98.2% of the table's widths. Used wherever text is placed by padding with
 * spaces (centring, right-aligning).
 */
export const SPACE_RUN_PX = 5;
export const TEXT_SCALE = 0.982;

/** Pixel width of one line of text in the glasses font. */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += GLYPH_WIDTHS[ch] ?? UNKNOWN_WIDTH;
  return w;
}

/** Shortens one line to at most `maxPx` wide, adding "…" when cut. */
export function fitWidth(text: string, maxPx: number): string {
  if (textWidth(text) <= maxPx) return text;
  const budget = maxPx - textWidth(ELLIPSIS);
  let out = "";
  for (const ch of text) {
    if (textWidth(out + ch) > budget) break;
    out += ch;
  }
  return out.trimEnd() + ELLIPSIS;
}

/**
 * Wraps text into lines at most `maxPx` wide (and `maxBytes`, when given) between words; a word too long for a line
 * is cut. At most `maxLines`: the last one then ends with "…".
 */
export function wrapWidth(text: string, maxPx: number, maxLines: number, maxBytes = Infinity): string[] {
  const fits = (line: string) => textWidth(line) <= maxPx && utf8Bytes(line) <= maxBytes;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (fits(next)) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = fits(word) ? word : truncateBytes(fitWidth(word, maxPx), maxBytes);
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = `${kept[maxLines - 1]}${ELLIPSIS}`;
  while (!fits(last) && last.includes(" ")) last = `${last.slice(0, last.lastIndexOf(" "))}${ELLIPSIS}`;
  kept[maxLines - 1] = fits(last) ? last : truncateBytes(fitWidth(last, maxPx), maxBytes);
  return kept;
}

/**
 * A page's body box (glasses-output.ts: 568 px wide with 4 px padding, 226 px high): 8 lines of 27 px. The width for
 * wrapping keeps a margin, so the glasses never wrap a line onto a ninth (their measure differs a little).
 */
export const APP_BODY_WRAP_PX = 540;
export const APP_BODY_LINES = 8;

/**
 * Splits text into pages of whole lines for the body box, so a swipe turns a page instead of scrolling a line.
 * Paragraphs ("\n") are kept; a page never starts with a blank line.
 */
export function textPages(text: string, maxPx = APP_BODY_WRAP_PX, lines = APP_BODY_LINES): string[] {
  const all: string[] = [];
  for (const para of text.split("\n")) all.push(...(para.trim() ? wrapWidth(para, maxPx, Infinity) : [""]));
  const pages: string[] = [];
  let page: string[] = [];
  for (const line of all) {
    if (!page.length && !line) continue;
    page.push(line);
    if (page.length === lines) {
      pages.push(page.join("\n"));
      page = [];
    }
  }
  if (page.some((l) => l)) pages.push(page.join("\n").trimEnd());
  return pages.length ? pages : [""];
}

/** Centres one line in a box `boxPx` wide by putting spaces in front (shortened first so it never wraps). */
export function centreLine(text: string, boxPx: number): string {
  const line = fitWidth(text, boxPx - 2 * SPACE_WIDTH);
  const free = boxPx - TEXT_SCALE * textWidth(line);
  // Nearest to the middle, but keep ~4 px spare on the right (measuring error).
  const spaces = Math.max(0, Math.min(Math.round(free / 2 / SPACE_RUN_PX), Math.floor((free - 4) / SPACE_RUN_PX)));
  return " ".repeat(spaces) + line;
}

/** Two texts on one line of a box `boxPx` wide: `left` at its left edge, `right` against its right edge. */
export function spreadLine(left: string, right: string, boxPx: number): string {
  const free = boxPx - TEXT_SCALE * (textWidth(left) + textWidth(right));
  return `${left}${" ".repeat(Math.max(1, Math.floor((free - 6) / SPACE_RUN_PX)))}${right}`;
}

export interface CursorWindow {
  /** Lines to display, already prefixed with the cursor marker or padding. */
  lines: string[];
  /** Index of the first visible row. */
  top: number;
}

const CURSOR = "> ";
/** Three spaces (3 × 5.0 px) line rows up with "> " (10 + 5.2 px) in the proportional glasses font. */
const NO_CURSOR = "   ";

/**
 * Renders a list as text with an app-managed cursor (the "text cursor"), scrolling a window of `visible` rows so the
 * cursor row is always on screen; each row is cut to one line (`maxPx`). Shows ▲ / ▼ and the position when rows are
 * hidden above or below. `empty` is shown for a list with no rows.
 */
export function renderCursorWindow(rows: string[], cursor: number, visible: number, maxPx = APP_BODY_WRAP_PX, empty = "(empty)"): CursorWindow {
  if (rows.length === 0) return { lines: [`${NO_CURSOR}${empty}`], top: 0 };
  const c = Math.min(Math.max(cursor, 0), rows.length - 1);
  const size = Math.max(1, visible);
  const top = Math.min(Math.max(c - Math.floor(size / 2), 0), Math.max(rows.length - size, 0));
  const room = maxPx - textWidth(CURSOR);
  const lines: string[] = [];
  for (let i = top; i < Math.min(top + size, rows.length); i++) {
    lines.push((i === c ? CURSOR : NO_CURSOR) + fitWidth(rows[i]!, room));
  }
  const above = top > 0;
  const below = top + size < rows.length;
  if (above || below) lines.push(`${NO_CURSOR}${above ? "▲" : " "}${below ? "▼" : " "}  ${c + 1}/${rows.length}`);
  return { lines, top };
}
