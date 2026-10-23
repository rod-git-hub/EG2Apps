// The saved document of an app: one JSON value in Even's storage, also used for Export / Import. Everything read back
// (at start-up or pasted in by Import) goes through a strict check: unknown fields are dropped, every text has a
// length limit, and an error says what's wrong.

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Size of the saved document, in characters of JSON. Measured on a phone (2026-10-21): 1,000,000 characters save and
 * read back intact in ~0.1 s, so the hard limit sits there; the phone page warns from the soft limit.
 */
export const DOC_WARN_CHARS = 500_000;
export const DOC_MAX_CHARS = 1_000_000;

export const NAME_MAX_CHARS = 200;
export const TEXT_MAX_CHARS = 10_000;

/** A random version-4 UUID (crypto.randomUUID needs HTTPS; the QR dev page is plain HTTP). */
export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const ID = /^[A-Za-z0-9-]{1,64}$/;
export const isId = (v: unknown): v is string => typeof v === "string" && ID.test(v);
export const chars = (s: string): number => [...s].length;

/** A required name (title, folder, topic…): trimmed, 1 to NAME_MAX_CHARS characters, one line. */
export function cleanName(v: unknown, what: string): Validated<string> {
  if (typeof v !== "string") return { ok: false, error: `${what} must be text` };
  const s = v.replace(/\s+/g, " ").trim();
  if (!s) return { ok: false, error: `${what} can't be empty` };
  if (chars(s) > NAME_MAX_CHARS) return { ok: false, error: `${what} is too long (at most ${NAME_MAX_CHARS} characters)` };
  return { ok: true, value: s };
}

/**
 * Spaces and tabs at the end of every line removed, in one pass. No regular expression: `/[ \t]+$/gm` took time growing
 * with the square of a long run of spaces (6.6 s for 40,000), and this runs on imported text before its length check.
 */
export function trimLineEnds(s: string): string {
  const lines = s.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    let end = line.length;
    while (end > 0 && (line[end - 1] === " " || line[end - 1] === "\t")) end--;
    if (end < line.length) lines[i] = line.slice(0, end);
  }
  return lines.join("\n");
}

/** Free text (a note's text, a topic's details): at most TEXT_MAX_CHARS characters; line breaks kept. */
export function cleanText(v: unknown, what: string): Validated<string> {
  if (typeof v !== "string") return { ok: false, error: `${what} must be text` };
  const s = trimLineEnds(v.replace(/\r\n?/g, "\n")).trim();
  if (chars(s) > TEXT_MAX_CHARS) return { ok: false, error: `${what} is too long (at most ${TEXT_MAX_CHARS.toLocaleString("en")} characters)` };
  return { ok: true, value: s };
}

/** Parses saved or pasted JSON for `app`, after a size check; `check` validates the rest. */
export function parseDoc<T>(text: string, app: string, schema: number, check: (o: Record<string, unknown>) => Validated<T>): Validated<T> {
  if (text.length > DOC_MAX_CHARS) return { ok: false, error: `too big (${text.length.toLocaleString("en")} characters; at most ${DOC_MAX_CHARS.toLocaleString("en")})` };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "not a valid export (it isn't JSON)" };
  }
  if (!isObj(raw)) return { ok: false, error: "not a valid export" };
  if (raw.app !== app) return { ok: false, error: `this export isn't from ${app}` };
  if (raw.schema !== schema) return { ok: false, error: `this export's format (${String(raw.schema)}) isn't supported` };
  return check(raw);
}

/** Checks every element of a list with `check`; at most `max` elements; ids must be unique. */
export function checkList<T extends { id: string }>(v: unknown, what: string, max: number, check: (o: unknown, i: number) => Validated<T>): Validated<T[]> {
  if (!Array.isArray(v)) return { ok: false, error: `${what} must be a list` };
  if (v.length > max) return { ok: false, error: `too many ${what} (at most ${max})` };
  const out: T[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < v.length; i++) {
    const r = check(v[i], i);
    if (!r.ok) return { ok: false, error: `${what} ${i + 1}: ${r.error}` };
    if (seen.has(r.value.id)) return { ok: false, error: `${what} ${i + 1}: duplicate id` };
    seen.add(r.value.id);
    out.push(r.value);
  }
  return { ok: true, value: out };
}

/** The id of an element, or a new one when it's missing or malformed (an export written by hand). */
export const idOf = (o: Record<string, unknown>): string => (isId(o.id) ? o.id : newId());
