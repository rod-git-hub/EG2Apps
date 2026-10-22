// The apps' wordmarks ("EG2 NOTES", "EG2 PRESENTATION") in their own stroke lettering: letters
// are stroke centrelines on a 10-unit-high grid, square caps and miter joins, curves only on the round letters. The
// last word is bright, the words before it pale. Drawn as SVG on the phone page and rasterised to greyscale for the
// store icons (scripts/make-icons.mjs). Plain TypeScript: no browser APIs except in wordmarkSvg().

const LETTERS: Record<string, { d: string; w: number }> = {
  A: { d: "M0 10 V4 Q0 0 4 0 Q8 0 8 4 V10 M0 6.2 H8", w: 8 },
  B: { d: "M0 0 V10 H4.6 Q8 10 8 7.5 Q8 5 4.6 5 H0 M0 0 H4.2 Q7.4 0 7.4 2.5 Q7.4 5 4.2 5", w: 8 },
  C: { d: "M8 0 H4 Q0 0 0 4 V6 Q0 10 4 10 H8", w: 8 },
  D: { d: "M0 0 V10 H4 Q8 10 8 6 V4 Q8 0 4 0 Z", w: 8 },
  E: { d: "M8 0 H0 V10 H8 M0 5 H6.5", w: 8 },
  F: { d: "M8 0 H0 V10 M0 5 H6.5", w: 8 },
  G: { d: "M8 0 H4 Q0 0 0 4 V6 Q0 10 4 10 H8 V5.6 H4.6", w: 8 },
  H: { d: "M0 0 V10 M8 0 V10 M0 5 H8", w: 8 },
  I: { d: "M0 0 V10", w: 0 },
  J: { d: "M8 0 V6 Q8 10 4 10 H0", w: 8 },
  K: { d: "M0 0 V10 M8 0 L0 6.4 M2.8 4.2 L8 10", w: 8 },
  L: { d: "M0 0 V10 H7", w: 7 },
  M: { d: "M0 10 V0 L4.5 6 L9 0 V10", w: 9 },
  N: { d: "M0 10 V0 L8 10 V0", w: 8 },
  O: { d: "M4 0 Q0 0 0 4 V6 Q0 10 4 10 Q8 10 8 6 V4 Q8 0 4 0 Z", w: 8 },
  P: { d: "M0 10 V0 H4.6 Q8 0 8 2.8 Q8 5.6 4.6 5.6 H0", w: 8 },
  Q: { d: "M4 0 Q0 0 0 4 V6 Q0 10 4 10 Q8 10 8 6 V4 Q8 0 4 0 Z M5.4 7.6 L8 10.4", w: 8 },
  R: { d: "M0 10 V0 H4.6 Q8 0 8 2.8 Q8 5.6 4.6 5.6 H0 M4.6 5.6 L8 10", w: 8 },
  S: { d: "M8 0 H3.2 Q0 0 0 2.5 Q0 5 3.2 5 H4.8 Q8 5 8 7.5 Q8 10 4.8 10 H0", w: 8 },
  T: { d: "M0 0 H8 M4 0 V10", w: 8 },
  U: { d: "M0 0 V6.5 Q0 10 3.5 10 H4.5 Q8 10 8 6.5 V0", w: 8 },
  V: { d: "M0 0 L4 10 L8 0", w: 8 },
  W: { d: "M0 0 L2.5 10 L5 3.6 L7.5 10 L10 0", w: 10 },
  X: { d: "M0 0 L8 10 M8 0 L0 10", w: 8 },
  Y: { d: "M0 0 L4 5.2 L8 0 M4 5.2 V10", w: 8 },
  Z: { d: "M0 0 H8 L0 10 H8", w: 8 },
  // Added for "EG2", in the same style: the S's 2.5-unit top curve, a straight diagonal, a flat base.
  "2": { d: "M0 2.5 Q0 0 3.2 0 H4.8 Q8 0 8 2.8 Q8 4.6 6 5.8 L0 10 H8", w: 8 },
};

export const WORDMARK_STYLE = { stroke: 2.8, letterGap: 5, wordGap: 11, pad: 1.6 } as const;

export interface Glyph {
  d: string;
  x: number;
  tone: "pale" | "bright";
}

export interface WordmarkLayout {
  glyphs: Glyph[];
  viewBox: { x: number; y: number; w: number; h: number };
}

/** The last word bright, the words before it pale (a single word is all bright); `tone` forces one tone for all. */
export function layoutWordmark(text: string, tone?: Glyph["tone"]): WordmarkLayout {
  const s = WORDMARK_STYLE;
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const glyphs: Glyph[] = [];
  let x = 0;
  words.forEach((word, i) => {
    const t: Glyph["tone"] = tone ?? (i === words.length - 1 ? "bright" : "pale");
    for (const ch of word) {
      const letter = LETTERS[ch];
      if (!letter) throw new Error(`no glyph for ${ch}`);
      glyphs.push({ d: letter.d, x, tone: t });
      x += letter.w + s.letterGap;
    }
    x += s.wordGap - s.letterGap;
  });
  const end = x - s.wordGap;
  const edge = s.pad + s.stroke / 2;
  return { glyphs, viewBox: { x: -edge, y: -edge, w: end + 2 * edge, h: 10 + 2 * edge } };
}

/** The wordmark as an SVG element for the phone page (colours from the page's theme, see phone.css). */
export function wordmarkSvg(text: string, label: string): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const { glyphs, viewBox: v } = layoutWordmark(text);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  svg.setAttribute("class", "wordmark");
  const title = document.createElementNS(NS, "title");
  title.textContent = label;
  svg.append(title);
  for (const tone of ["pale", "bright"] as const) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", `wm-${tone}`);
    for (const glyph of glyphs.filter((x) => x.tone === tone)) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", glyph.d);
      p.setAttribute("transform", `translate(${glyph.x} 0)`);
      g.append(p);
    }
    svg.append(g);
  }
  return svg;
}

// ── Rasterising (for the store icons) ───────────────────────────────────────

type Pt = [number, number];
/** One straight piece of a glyph; `curve` when it's part of a flattened Q curve. */
export interface Segment { a: Pt; b: Pt; curve: boolean }

/** A glyph's path as segments (absolute M, L, H, V, Q and Z only, which is all the letters use). */
export function pathSegments(d: string): Segment[] {
  const tokens = d.match(/[MLHVQZ]|-?\d*\.?\d+/g) ?? [];
  const segs: Segment[] = [];
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  let i = 0;
  const num = () => Number(tokens[i++]);
  const line = (b: Pt) => { segs.push({ a: cur, b, curve: false }); cur = b; };
  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case "M": cur = [num(), num()]; start = cur; break;
      case "L": line([num(), num()]); break;
      case "H": line([num(), cur[1]]); break;
      case "V": line([cur[0], num()]); break;
      case "Q": {
        const c: Pt = [num(), num()];
        const e: Pt = [num(), num()];
        const from = cur;
        for (let k = 1; k <= 16; k++) {
          const t = k / 16;
          const p: Pt = [(1 - t) ** 2 * from[0] + 2 * (1 - t) * t * c[0] + t * t * e[0], (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * c[1] + t * t * e[1]];
          segs.push({ a: cur, b: p, curve: true });
          cur = p;
        }
        break;
      }
      case "Z": line(start); break;
      default: throw new Error(`unsupported path command ${cmd}`);
    }
  }
  return segs;
}

/**
 * True when point `u` is on the stroke of `s` (half-width `half`). Straight segments are rectangles extended by `half`
 * at both ends: square caps, and square (miter) corners where two meet at a right angle, as the lettering is drawn.
 * Curve pieces are round-ended, so a curve stays smooth.
 */
function onStroke(u: Pt, s: Segment, half: number): boolean {
  const dx = s.b[0] - s.a[0];
  const dy = s.b[1] - s.a[1];
  const len = Math.hypot(dx, dy);
  if (!len) return Math.hypot(u[0] - s.a[0], u[1] - s.a[1]) <= half;
  const along = ((u[0] - s.a[0]) * dx + (u[1] - s.a[1]) * dy) / len;
  const across = Math.abs((u[0] - s.a[0]) * dy - (u[1] - s.a[1]) * dx) / len;
  if (!s.curve) return across <= half && along >= -half && along <= len + half;
  const t = Math.max(0, Math.min(len, along));
  return Math.hypot(u[0] - s.a[0] - (t / len) * dx, u[1] - s.a[1] - (t / len) * dy) <= half;
}

/**
 * Coverage of each pixel (0–1) for the wordmark drawn `scale` px per unit, with its top-left at (ox, oy) px, split by
 * tone. 4×4 samples per pixel for smooth edges.
 */
export function rasterWordmark(text: string, width: number, height: number, scale: number, ox: number, oy: number, tone?: Glyph["tone"]): { pale: number[][]; bright: number[][] } {
  const { glyphs } = layoutWordmark(text, tone);
  const half = WORDMARK_STYLE.stroke / 2;
  const strokes = glyphs.map((g) => {
    const segs = pathSegments(g.d).map((s) => ({ ...s, a: [s.a[0] + g.x, s.a[1]] as Pt, b: [s.b[0] + g.x, s.b[1]] as Pt }));
    const xs = segs.flatMap((s) => [s.a[0], s.b[0]]);
    const ys = segs.flatMap((s) => [s.a[1], s.b[1]]);
    return { tone: g.tone, segs, box: { x0: Math.min(...xs) - half, x1: Math.max(...xs) + half, y0: Math.min(...ys) - half, y1: Math.max(...ys) + half } };
  });
  const pale = Array.from({ length: height }, () => Array<number>(width).fill(0));
  const bright = Array.from({ length: height }, () => Array<number>(width).fill(0));
  const N = 4;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let p = 0;
      let b = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const u: Pt = [(px + (sx + 0.5) / N - ox) / scale, (py + (sy + 0.5) / N - oy) / scale];
          for (const st of strokes) {
            if (u[0] < st.box.x0 || u[0] > st.box.x1 || u[1] < st.box.y0 || u[1] > st.box.y1) continue;
            if (st.segs.some((sg) => onStroke(u, sg, half))) {
              if (st.tone === "pale") p++;
              else b++;
              break;
            }
          }
        }
      }
      pale[py]![px] = p / (N * N);
      bright[py]![px] = b / (N * N);
    }
  }
  return { pale, bright };
}
