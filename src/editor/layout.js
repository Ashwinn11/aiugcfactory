// Shared layout + background geometry. Everything the preview and the exporter
// need to agree on is computed HERE, once, in format space:
//   - line wrapping + per-line widths (measured on an offscreen canvas)
//   - per-line background rects
//   - the single continuous rounded-union SVG path for the `overlay` style
// The preview scales this by CSS; the exporter draws it at native px via Path2D.
// Same numbers in both places -> guaranteed parity.

import { getFont } from './fonts.js';
import { LINE_HEIGHT, PAD_X_RATIO, RADIUS_RATIO } from './textLayers.js';

let _measureCtx = null;
function measureCtx() {
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  return _measureCtx;
}

// Split a string into graphemes (Intl.Segmenter keeps emoji/combining marks
// intact; Array.from is the code-point fallback).
function graphemes(str) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)].map((s) => s.segment);
  }
  return Array.from(str);
}

// A single word wider than maxWidth (URL, hashtag chain, CJK run) breaks at
// grapheme boundaries — TikTok wraps such text at the box edge instead of
// overflowing. Returns the last (unfinished) chunk so following words can
// continue the line; full chunks are pushed to `out`.
function breakLongWord(word, maxWidth, measure, out) {
  let chunk = '';
  for (const g of graphemes(word)) {
    if (chunk && measure(chunk + g) > maxWidth) {
      out.push(chunk);
      chunk = g;
    } else {
      chunk += g; // always take at least one grapheme -> guaranteed progress
    }
  }
  return chunk;
}

// Wrap text to maxWidth honouring manual newlines. measure(str) -> px width.
export function wrapText(text, maxWidth, measure) {
  const out = [];
  for (const para of String(text).split('\n')) {
    if (para === '') { out.push(''); continue; }
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && measure(test) > maxWidth) {
        out.push(line);
        line = measure(word) > maxWidth ? breakLongWord(word, maxWidth, measure, out) : word;
      } else if (!line && measure(word) > maxWidth) {
        line = breakLongWord(word, maxWidth, measure, out);
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

// TikTok snaps near-equal adjacent line widths flush: when two neighbouring
// overlay rects differ by less than 2*radius on a side, the recessed edge is
// widened to match the prouder one — otherwise the rounded union draws a tiny
// S-wiggle notch TikTok never shows. Mutates rects in place; iterates to a
// fixed point (edges only ever grow, so it terminates).
function snapAdjacentRects(lines, radius) {
  const solid = lines.filter((l) => l.text && l.rect.w > 0);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < solid.length; i++) {
      const a = solid[i - 1].rect;
      const b = solid[i].rect;
      if (Math.abs((a.y + a.h) - b.y) > 0.5) continue; // not vertically contiguous
      // left edges
      const dl = a.x - b.x;
      if (Math.abs(dl) > 1e-3 && Math.abs(dl) < 2 * radius) {
        const target = Math.min(a.x, b.x);
        const r = dl > 0 ? a : b; // recessed one
        r.w += r.x - target;
        r.x = target;
        changed = true;
      }
      // right edges
      const ar = a.x + a.w;
      const br = b.x + b.w;
      const dr = ar - br;
      if (Math.abs(dr) > 1e-3 && Math.abs(dr) < 2 * radius) {
        const target = Math.max(ar, br);
        const r = dr < 0 ? a : b;
        r.w = target - r.x;
        changed = true;
      }
    }
  }
}

// Full layout of a layer in FORMAT space.
// Returns { font, fontSize, lineHeightPx, boxW, totalH, radius, lines }
// where each line = { text, width, rect:{x,y,w,h} } (rect x relative to box-left).
export function layoutLayer(layer, format) {
  const W = format.w;
  const font = getFont(layer.fontId);
  const fontSize = layer.fontSize;
  const lineHeightPx = fontSize * LINE_HEIGHT;
  const padX = fontSize * PAD_X_RATIO;      // scales with the text
  const boxW = (layer.widthPct / 100) * W;

  const ctx = measureCtx();
  ctx.font = `${font.weight} ${fontSize}px ${font.stack}`;
  const measure = (s) => ctx.measureText(s).width;

  const radius = Math.min(fontSize * RADIUS_RATIO, lineHeightPx * 0.5);

  const strs = wrapText(layer.text, boxW, measure);
  const lines = strs.map((str, i) => {
    const width = str ? measure(str) : 0;
    // Empty lines get a zero-width rect so buildBackgroundPath splits the
    // overlay into separate boxes across the gap (TikTok behaviour) instead
    // of drawing a floating padding-wide pill.
    const rectW = str ? width + 2 * padX : 0;
    let x;
    if (layer.align === 'left') x = -padX;
    else if (layer.align === 'right') x = boxW - width - padX;
    else x = boxW / 2 - rectW / 2;
    return { text: str, width, rect: { x, y: i * lineHeightPx, w: rectW, h: lineHeightPx } };
  });

  snapAdjacentRects(lines, radius);

  // Where CSS half-leading puts the baseline inside a line box — lets the
  // canvas exporter reproduce the DOM preview's vertical text position
  // exactly (canvas textBaseline='middle' uses the em midpoint, which is NOT
  // where CSS centres the ascent+descent content area).
  const m = ctx.measureText('Hg');
  const baselineY = m.fontBoundingBoxAscent !== undefined
    ? (lineHeightPx + m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2
    : null;

  return {
    font,
    fontSize,
    lineHeightPx,
    boxW,
    totalH: lines.length * lineHeightPx,
    radius,
    baselineY,
    lines,
  };
}

// ---------------------------------------------------------------------------
// buildBackgroundPath: rounded union of stacked per-line rects as an SVG path.
// Convex outer corners + concave (inward) inner corners = the sticker look.
// Handles 1..n lines of differing widths and any alignment; splits into
// separate subpaths across blank-line gaps.
// ---------------------------------------------------------------------------
export function buildBackgroundPath(rects, radius) {
  const filled = rects.filter((r) => r.w > 0 && r.h > 0);
  if (!filled.length) return '';

  // group into vertically-contiguous runs
  const runs = [];
  let run = [filled[0]];
  for (let i = 1; i < filled.length; i++) {
    const prev = filled[i - 1];
    const r = filled[i];
    if (Math.abs((prev.y + prev.h) - r.y) < 0.5) run.push(r);
    else { runs.push(run); run = [r]; }
  }
  runs.push(run);

  return runs.map((rr) => runPath(rr, radius)).filter(Boolean).join(' ');
}

function runPath(run, radius) {
  const corners = cleanPolygon(rawPolygon(run));
  return roundedPath(corners, radius);
}

// Rectilinear outline of stacked rects, traced clockwise.
function rawPolygon(run) {
  const n = run.length;
  const L = (i) => run[i].x;
  const R = (i) => run[i].x + run[i].w;
  const T = (i) => run[i].y;
  const B = (i) => run[i].y + run[i].h;
  const p = [];
  p.push([L(0), T(0)], [R(0), T(0)]);        // top edge
  for (let i = 0; i < n; i++) {              // right side, descending
    p.push([R(i), B(i)]);
    if (i < n - 1) p.push([R(i + 1), B(i)]);
  }
  p.push([L(n - 1), B(n - 1)]);              // bottom edge
  for (let i = n - 1; i >= 0; i--) {         // left side, ascending
    p.push([L(i), T(i)]);
    if (i > 0) p.push([L(i - 1), T(i)]);
  }
  return p;
}

// Drop duplicate + collinear vertices so every remaining vertex is a real 90° corner.
function cleanPolygon(pts) {
  const a = [];
  for (const pt of pts) {
    const last = a[a.length - 1];
    if (!last || Math.abs(last[0] - pt[0]) > 1e-3 || Math.abs(last[1] - pt[1]) > 1e-3) a.push(pt);
  }
  if (a.length > 1) {
    const f = a[0];
    const l = a[a.length - 1];
    if (Math.abs(f[0] - l[0]) < 1e-3 && Math.abs(f[1] - l[1]) < 1e-3) a.pop();
  }
  const n = a.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = a[(i - 1 + n) % n];
    const cur = a[i];
    const next = a[(i + 1) % n];
    const cross = (cur[0] - prev[0]) * (next[1] - cur[1]) - (cur[1] - prev[1]) * (next[0] - cur[0]);
    if (Math.abs(cross) > 1e-6) out.push(cur);
  }
  return out;
}

const f2 = (n) => Math.round(n * 100) / 100;

// Round every corner: convex corners get a normal arc, concave (reflex) corners
// an inverted arc, distinguished purely by the sign of the turn (sweep flag).
function roundedPath(corners, radius) {
  const n = corners.length;
  if (n < 3) return '';
  const info = corners.map((V, i) => {
    const P = corners[(i - 1 + n) % n];
    const N = corners[(i + 1) % n];
    const inLen = Math.hypot(V[0] - P[0], V[1] - P[1]) || 1;
    const outLen = Math.hypot(N[0] - V[0], N[1] - V[1]) || 1;
    const inDir = [(V[0] - P[0]) / inLen, (V[1] - P[1]) / inLen];
    const outDir = [(N[0] - V[0]) / outLen, (N[1] - V[1]) / outLen];
    const r = Math.max(0, Math.min(radius, inLen / 2, outLen / 2));
    const cross = inDir[0] * outDir[1] - inDir[1] * outDir[0];
    return {
      r,
      start: [V[0] - inDir[0] * r, V[1] - inDir[1] * r],
      end: [V[0] + outDir[0] * r, V[1] + outDir[1] * r],
      sweep: cross > 0 ? 1 : 0, // convex vs concave 90° arc
    };
  });

  let d = `M ${f2(info[0].start[0])} ${f2(info[0].start[1])}`;
  for (let i = 0; i < n; i++) {
    const c = info[i];
    if (c.r > 0.01) d += ` A ${f2(c.r)} ${f2(c.r)} 0 0 ${c.sweep} ${f2(c.end[0])} ${f2(c.end[1])}`;
    else d += ` L ${f2(c.end[0])} ${f2(c.end[1])}`;
    const ns = info[(i + 1) % n].start;
    d += ` L ${f2(ns[0])} ${f2(ns[1])}`;
  }
  return `${d} Z`;
}
