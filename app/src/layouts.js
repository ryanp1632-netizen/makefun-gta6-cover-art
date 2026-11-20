// Layout presets for Golden Mile Cover Studio: for every output ratio, poster compositions made of photo panels cut
// by slanted gutters, plus the zones for the lettering, the seal, the barcode and the code-drawn sunset scenery.
// Panels are built from straight cut lines (nearly vertical "v" lines and nearly horizontal "h" lines), so
// neighbouring panels share an edge; each panel is then inset by half a gutter, which leaves even, slanted gaps.
// Every layout knows where its lettering sits (keepClearRects) and gives each panel a "focus": the largest free
// rectangle inside the panel that no lettering covers. Crops put the face there, so text never lands on a face.
// Panel 0 is always the hero.

export const COVER_SIZES = {
  square: { key: 'square', label: '1:1', w: 1080, h: 1080 },
  portrait: { key: 'portrait', label: '4:5', w: 1080, h: 1350 },
  wide: { key: 'wide', label: '16:9', w: 1920, h: 1080 },
};

/** A nearly vertical cut line: x = x0 + slope * (y - cy). */
function vLine(x0, slope = 0) {
  return { kind: 'v', at: x0, slope };
}

/** A nearly horizontal cut line: y = y0 + slope * (x - cx). */
function hLine(y0, slope = 0) {
  return { kind: 'h', at: y0, slope };
}

/** Where a v line and an h line cross, both measured around the canvas centre (cx, cy). */
function intersectCutLines(v, h, cx, cy) {
  const x = (v.at + v.slope * (h.at - cy - h.slope * cx)) / (1 - v.slope * h.slope);
  const y = h.at + h.slope * (x - cx);
  return { x, y };
}

/** The four corners of the cell bounded by the given left/right v lines and top/bottom h lines. */
function cellBetween(left, right, top, bottom, W, H) {
  const cx = W / 2;
  const cy = H / 2;
  return [
    intersectCutLines(left, top, cx, cy),
    intersectCutLines(right, top, cx, cy),
    intersectCutLines(right, bottom, cx, cy),
    intersectCutLines(left, bottom, cx, cy),
  ];
}

/** Shrinks a convex polygon (clockwise on screen) by moving every edge inward by d. */
export function insetPolygon(points, d) {
  const n = points.length;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    lines.push({ a: { x: a.x + nx * d, y: a.y + ny * d }, dx, dy });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i + n - 1) % n];
    const l2 = lines[i];
    const den = l1.dx * l2.dy - l1.dy * l2.dx;
    if (Math.abs(den) < 1e-9) {
      out.push(l2.a);
      continue;
    }
    const t = ((l2.a.x - l1.a.x) * l2.dy - (l2.a.y - l1.a.y) * l2.dx) / den;
    out.push({ x: l1.a.x + l1.dx * t, y: l1.a.y + l1.dy * t });
  }
  return out;
}

/** Axis-aligned bounds of a polygon. */
export function polygonBounds(points) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Even-odd point-in-polygon test. */
export function pointInPolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The x range a convex polygon covers on the horizontal line at y (null when the line misses it). */
export function polygonXRangeAt(points, y) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if ((a.y <= y && b.y >= y) || (b.y <= y && a.y >= y)) {
      const x = a.y === b.y ? Math.min(a.x, b.x) : a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
      const x2 = a.y === b.y ? Math.max(a.x, b.x) : x;
      lo = Math.min(lo, x);
      hi = Math.max(hi, x2);
    }
  }
  return lo <= hi ? [lo, hi] : null;
}

/** Whether two rectangles overlap. */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * The rectangles the lettering of a layout occupies (title, script subtitle, tagline ribbon, quote, seal, barcode,
 * release line, billing), slightly padded. Faces and name tags stay out of them.
 */
export function keepClearRects(text) {
  const rects = [];
  const pad = 10;
  const add = (x, y, w, h) => rects.push({ x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 });
  const t = text.title;
  add(t.x, t.y, t.w, t.h);
  const st = text.subtitle;
  if (st) {
    // the script hangs off the end of the last title line, its baseline near the bottom of the title box
    const base = t.y + t.h * 0.9 + st.dy;
    add(t.x + t.w * 0.42, base - st.size * 0.8, t.w * 0.58 + Math.max(0, st.dx) + st.size * 0.3, st.size * 1.22);
  }
  if (text.tagline) add(text.tagline.x, text.tagline.y - 6, text.tagline.w, text.tagline.h + 12);
  if (text.quote) {
    const q = text.quote;
    const size = Math.min(q.w * 0.085, 56);
    add(q.x - q.w / 2, q.y - size * 0.45, q.w, size * 2.25);
  }
  if (text.seal) add(text.seal.x - text.seal.r, text.seal.y - text.seal.r, text.seal.r * 2, text.seal.r * 2);
  if (text.barcode) add(text.barcode.x - text.barcode.w / 2, text.barcode.y - text.barcode.h / 2, text.barcode.w, text.barcode.h);
  if (text.coming) {
    const c = text.coming;
    const w = c.size * 5.4;
    const x = c.align === 'right' ? c.x - w : c.align === 'center' ? c.x - w / 2 : c.x;
    add(x, c.y - c.size * 0.85, w, c.size * 1.05);
  }
  if (text.billing) {
    const b = text.billing;
    const x = b.align === 'center' ? b.x - b.w / 2 : b.align === 'right' ? b.x - b.w : b.x;
    add(x, b.y - 26, b.w, 34);
  }
  for (const r of text.keepClear ?? []) add(r.x, r.y, r.w, r.h);
  return rects;
}

/**
 * The panel's focus: the largest axis-aligned rectangle inside the (slightly shrunk) panel polygon that overlaps
 * none of the keep-clear rectangles, scored by usable area (very flat or very thin strips count less).
 * Searched exactly over pairs of rows: for each top/bottom pair the free x range is the polygon's span at both rows
 * minus every blocked rectangle that reaches into those rows.
 */
export function findPanelFocusBox(panel, clear, margin = 12) {
  const poly = insetPolygon(panel.poly, margin);
  const b = polygonBounds(poly);
  const step = Math.max(8, Math.round(b.h / 60));
  const ys = [];
  for (let y = b.y; y <= b.y + b.h + 0.01; y += step) ys.push(Math.min(y, b.y + b.h));
  let best = null;
  for (let i = 0; i < ys.length; i++) {
    for (let j = i + 1; j < ys.length; j++) {
      const y0 = ys[i];
      const y1 = ys[j];
      const r0 = polygonXRangeAt(poly, y0 + 0.01);
      const r1 = polygonXRangeAt(poly, y1 - 0.01);
      if (!r0 || !r1) continue;
      let segs = [[Math.max(r0[0], r1[0]), Math.min(r0[1], r1[1])]];
      for (const r of clear) {
        if (r.y >= y1 || r.y + r.h <= y0) continue;
        const next = [];
        for (const [a, c] of segs) {
          if (r.x >= c || r.x + r.w <= a) next.push([a, c]);
          else {
            if (r.x > a) next.push([a, r.x]);
            if (r.x + r.w < c) next.push([r.x + r.w, c]);
          }
        }
        segs = next;
        if (!segs.length) break;
      }
      const h = y1 - y0;
      for (const [a, c] of segs) {
        const w = c - a;
        if (w < 40 || h < 40) continue;
        const score = Math.min(w, h * 1.5) * Math.min(h, w * 1.9) - y0 * 0.5;
        if (!best || score > best.score) best = { x: a, y: y0, w, h, score };
      }
    }
  }
  return best ? { x: best.x, y: best.y, w: best.w, h: best.h } : { ...panel.bounds };
}

/** Turns cell definitions into finished panels: inset polygon, bounds, role and hero flag. */
function buildPanels(cells, W, H, gutter) {
  return cells.map((c, index) => {
    const raw = cellBetween(c.l, c.r, c.t, c.b, W, H);
    const poly = insetPolygon(raw, gutter / 2);
    return { index, poly, bounds: polygonBounds(poly), role: c.role ?? 'wide', hero: !!c.hero };
  });
}

/** Adds the keep-clear rectangles and every panel's focus box to a layout. */
function finishLayout(layout) {
  layout.clear = keepClearRects(layout.text);
  for (const p of layout.panels) p.focus = findPanelFocusBox(p, layout.clear);
  return layout;
}

function frameLines(W, H, gutter) {
  const m = gutter / 2;
  return { L: vLine(m), R: vLine(W - m), T: hLine(m), B: hLine(H - m) };
}

// ---------------------------------------------------------------------------------------------------------------
// Cast Mosaic: one tall hero and a block of portraits, the title band across the middle of the block.

/** 16:9: a tall hero on the left, three portraits above and three below a title band across the middle. */
export function layoutCastMosaic16x9(W = 1920, H = 1080) {
  const g = 16;
  const { L, R, T, B } = frameLines(W, H, g);
  const heroCut = vLine(642, -0.08);
  const row = hLine(618, -0.03);
  const t1 = vLine(1092, -0.08);
  const t2 = vLine(1508, -0.08);
  const b1 = vLine(1052, -0.08);
  const b2 = vLine(1480, -0.08);
  const cells = [
    { l: L, r: heroCut, t: T, b: B, hero: true, role: 'mid' },
    { l: heroCut, r: t1, t: T, b: row, role: 'face' },
    { l: t1, r: t2, t: T, b: row, role: 'face' },
    { l: t2, r: R, t: T, b: row, role: 'face' },
    { l: heroCut, r: b1, t: row, b: B, role: 'wide' },
    { l: b1, r: b2, t: row, b: B, role: 'detail' },
    { l: b2, r: R, t: row, b: B, role: 'sky' },
  ];
  return finishLayout({
    id: 'cast-mosaic',
    name: 'Cast Mosaic',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 900, sunX: 1250, sunY: 820, sunR: 260 },
    text: {
      title: { x: 628, y: 404, w: 1262, h: 196, align: 'center', maxLines: 1 },
      subtitle: { anchor: 'br', dx: -30, dy: 14, size: 86, rot: -5 },
      tagline: { x: 880, y: 360, w: 740, h: 40, rot: -1.5, align: 'center' },
      band: { x: 1255, y: 496, rx: 820, ry: 196 },
      quote: { x: 324, y: 800, w: 560, align: 'center' },
      coming: { x: 324, y: 1006, size: 54, align: 'center' },
      billing: { x: 1196, y: 1064, w: 1080, align: 'center' },
      seal: { x: 1836, y: 976, r: 72 },
      barcode: { x: 74, y: 1036, w: 100, h: 58 },
      scrims: [
        { x0: 0, y0: 690, x1: 700, y1: 1080, from: 0, to: 0.86 },
        { x0: 640, y0: 990, x1: 1920, y1: 1080, from: 0, to: 0.82 },
      ],
      glow: { x: 1250, y: 510, r: 640 },
    },
  });
}

/** 4:5: the hero top-left beside two stacked portraits, the title band across, three portraits below. */
export function layoutCastMosaic4x5(W = 1080, H = 1350) {
  const g = 14;
  const { L, R, T, B } = frameLines(W, H, g);
  const heroCut = vLine(604, -0.07);
  const split = hLine(350, 0.04);
  const row = hLine(780, 0.03);
  const c1 = vLine(364, -0.07);
  const c2 = vLine(726, -0.07);
  const cells = [
    { l: L, r: heroCut, t: T, b: row, hero: true, role: 'mid' },
    { l: heroCut, r: R, t: T, b: split, role: 'face' },
    { l: heroCut, r: R, t: split, b: row, role: 'face' },
    { l: L, r: c1, t: row, b: B, role: 'wide' },
    { l: c1, r: c2, t: row, b: B, role: 'detail' },
    { l: c2, r: R, t: row, b: B, role: 'sky' },
  ];
  return finishLayout({
    id: 'cast-mosaic',
    name: 'Cast Mosaic',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 1100, sunX: 540, sunY: 1000, sunR: 220 },
    text: {
      title: { x: 34, y: 612, w: 1012, h: 150, align: 'center', maxLines: 1 },
      subtitle: { anchor: 'br', dx: -10, dy: 26, size: 76, rot: -6 },
      tagline: { x: 50, y: 566, w: 520, h: 36, rot: -1.5, align: 'center' },
      band: { x: 540, y: 690, rx: 640, ry: 150 },
      quote: { x: 540, y: 1150, w: 540, align: 'center' },
      coming: { x: 1044, y: 1286, size: 34, align: 'right' },
      billing: { x: 540, y: 1328, w: 900, align: 'center' },
      seal: { x: 74, y: 74, r: 58 },
      barcode: { x: 70, y: 1286, w: 84, h: 50 },
      scrims: [{ x0: 0, y0: 1150, x1: 0, y1: 1350, from: 0, to: 0.86 }],
      glow: { x: 540, y: 690, r: 480 },
    },
  });
}

/** 1:1: the hero and two portraits above the title band, three portraits below. */
export function layoutCastMosaic1x1(W = 1080, H = 1080) {
  const g = 14;
  const { L, R, T, B } = frameLines(W, H, g);
  const row = hLine(566, 0.03);
  const v1 = vLine(476, -0.07);
  const v2 = vLine(782, -0.07);
  const w1 = vLine(360, -0.07);
  const w2 = vLine(722, -0.07);
  const cells = [
    { l: L, r: v1, t: T, b: row, hero: true, role: 'mid' },
    { l: v1, r: v2, t: T, b: row, role: 'face' },
    { l: v2, r: R, t: T, b: row, role: 'face' },
    { l: L, r: w1, t: row, b: B, role: 'wide' },
    { l: w1, r: w2, t: row, b: B, role: 'detail' },
    { l: w2, r: R, t: row, b: B, role: 'sky' },
  ];
  return finishLayout({
    id: 'cast-mosaic',
    name: 'Cast Mosaic',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 900, sunX: 540, sunY: 820, sunR: 200 },
    text: {
      title: { x: 30, y: 418, w: 1020, h: 140, align: 'center', maxLines: 1 },
      subtitle: { anchor: 'br', dx: -10, dy: 24, size: 70, rot: -6 },
      tagline: { x: 250, y: 378, w: 580, h: 34, rot: -1.5, align: 'center' },
      band: { x: 540, y: 488, rx: 640, ry: 140 },
      coming: { x: 1044, y: 1000, size: 30, align: 'right' },
      billing: { x: 470, y: 1062, w: 880, align: 'center' },
      seal: { x: 1006, y: 74, r: 56 },
      barcode: { x: 1010, y: 1040, w: 80, h: 46 },
      scrims: [{ x0: 0, y0: 960, x1: 0, y1: 1080, from: 0, to: 0.86 }],
      glow: { x: 540, y: 488, r: 460 },
    },
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Diagonal Strips: tall slanted character strips, the title over a code-drawn sunset.

/** 16:9: five slanted strips across the top, the title over the sunset between two corner portraits. */
export function layoutDiagonalStrips16x9(W = 1920, H = 1080) {
  const g = 14;
  const { L, R, T, B } = frameLines(W, H, g);
  const s = 0.3;
  const hB = hLine(684, -0.05);
  const xs = [vLine(420, s), vLine(790, s), vLine(1230, s), vLine(1580, s)];
  const bl = vLine(470, s);
  const br = vLine(1520, s);
  const cells = [
    { l: xs[1], r: xs[2], t: T, b: hB, hero: true, role: 'mid' },
    { l: xs[0], r: xs[1], t: T, b: hB, role: 'face' },
    { l: L, r: xs[0], t: T, b: hB, role: 'sky' },
    { l: xs[2], r: xs[3], t: T, b: hB, role: 'detail' },
    { l: xs[3], r: R, t: T, b: hB, role: 'sea' },
    { l: L, r: bl, t: hB, b: B, role: 'detail' },
    { l: br, r: R, t: hB, b: B, role: 'wide' },
  ];
  return finishLayout({
    id: 'diagonal-strips',
    name: 'Diagonal Strips',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 985, sunX: 960, sunY: 930, sunR: 280 },
    text: {
      title: { x: 520, y: 716, w: 880, h: 262, align: 'center' },
      subtitle: { anchor: 'br', dx: 40, dy: 36, size: 100, rot: -7 },
      tagline: { x: 600, y: 664, w: 720, h: 44, rot: -2.5, align: 'center' },
      billing: { x: 960, y: 1062, w: 860, align: 'center' },
      quote: { x: 1010, y: 520, w: 600, align: 'center' },
      seal: { x: 1490, y: 770, r: 74 },
      barcode: { x: 1834, y: 1008, w: 112, h: 66 },
      coming: { x: 1764, y: 1046, size: 44, align: 'right' },
      scrims: [
        { x0: 600, y0: 430, x1: 1400, y1: 684, from: 0, to: 0.7 },
        { x0: 1500, y0: 900, x1: 1920, y1: 1080, from: 0, to: 0.8 },
      ],
      glow: { x: 960, y: 860, r: 560 },
    },
  });
}

/** 4:5: the title over the sun at the top, tall slanted character strips below. */
export function layoutDiagonalStrips4x5(W = 1080, H = 1350) {
  const g = 12;
  const { L, R, B } = frameLines(W, H, g);
  const s = 0.16;
  const top = hLine(470, -0.07);
  const xs = [vLine(250, s), vLine(600, s), vLine(860, s)];
  const lsplit = hLine(900, -0.07);
  const rsplit = hLine(840, -0.07);
  const cells = [
    { l: xs[0], r: xs[1], t: top, b: B, hero: true, role: 'mid' },
    { l: xs[1], r: xs[2], t: top, b: B, role: 'face' },
    { l: L, r: xs[0], t: top, b: lsplit, role: 'sky' },
    { l: L, r: xs[0], t: lsplit, b: B, role: 'detail' },
    { l: xs[2], r: R, t: top, b: rsplit, role: 'sea' },
    { l: xs[2], r: R, t: rsplit, b: B, role: 'detail' },
  ];
  return finishLayout({
    id: 'diagonal-strips',
    name: 'Diagonal Strips',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 430, sunX: 540, sunY: 330, sunR: 230 },
    text: {
      title: { x: 40, y: 92, w: 1000, h: 318, align: 'center' },
      subtitle: { anchor: 'br', dx: -10, dy: 30, size: 100, rot: -7 },
      tagline: { x: 170, y: 34, w: 740, h: 42, rot: -1.5, align: 'center' },
      billing: { x: 540, y: 1324, w: 900, align: 'center' },
      quote: { x: 560, y: 1150, w: 520, align: 'center' },
      seal: { x: 98, y: 318, r: 60 },
      barcode: { x: 70, y: 1272, w: 84, h: 50 },
      coming: { x: 1044, y: 1282, size: 34, align: 'right' },
      scrims: [{ x0: 0, y0: 1060, x1: 0, y1: 1350, from: 0, to: 0.9 }],
      glow: { x: 540, y: 240, r: 520 },
    },
  });
}

/** 1:1: five slanted strips across the top two thirds, the title over the sunset below. */
export function layoutDiagonalStrips1x1(W = 1080, H = 1080) {
  const g = 12;
  const { L, R, T } = frameLines(W, H, g);
  const s = 0.24;
  const hB = hLine(680, -0.06);
  const xs = [vLine(230, s), vLine(450, s), vLine(740, s), vLine(910, s)];
  const cells = [
    { l: xs[1], r: xs[2], t: T, b: hB, hero: true, role: 'mid' },
    { l: xs[0], r: xs[1], t: T, b: hB, role: 'face' },
    { l: L, r: xs[0], t: T, b: hB, role: 'sky' },
    { l: xs[2], r: xs[3], t: T, b: hB, role: 'detail' },
    { l: xs[3], r: R, t: T, b: hB, role: 'sea' },
  ];
  return finishLayout({
    id: 'diagonal-strips',
    name: 'Diagonal Strips',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 970, sunX: 540, sunY: 915, sunR: 230 },
    text: {
      title: { x: 50, y: 744, w: 980, h: 220, align: 'center' },
      subtitle: { anchor: 'br', dx: 0, dy: 30, size: 82, rot: -7 },
      tagline: { x: 150, y: 692, w: 780, h: 40, rot: -2, align: 'center' },
      billing: { x: 40, y: 1058, w: 700, align: 'left' },
      quote: { x: 540, y: 560, w: 520, align: 'center' },
      seal: { x: 990, y: 600, r: 62 },
      barcode: { x: 1012, y: 1020, w: 86, h: 50 },
      coming: { x: 955, y: 1060, size: 28, align: 'right' },
      scrims: [{ x0: 0, y0: 480, x1: 0, y1: 690, from: 0, to: 0.7 }],
      glow: { x: 540, y: 860, r: 480 },
    },
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Six Grid: a tilted grid of six portraits around a sunset band carrying the title.

/** 16:9: a tilted 3 x 2 grid on the right, a tall title column over the sunset on the left. */
export function layoutSixGrid16x9(W = 1920, H = 1080) {
  const g = 14;
  const { R, T, B } = frameLines(W, H, g);
  const s = -0.08;
  const c0 = vLine(760, s);
  const c1 = vLine(1150, s);
  const c2 = vLine(1530, s);
  const mid = hLine(540, 0.05);
  const cells = [
    { l: c1, r: c2, t: T, b: mid, hero: true, role: 'face' },
    { l: c2, r: R, t: T, b: mid, role: 'face' },
    { l: c0, r: c1, t: T, b: mid, role: 'sky' },
    { l: c0, r: c1, t: mid, b: B, role: 'detail' },
    { l: c1, r: c2, t: mid, b: B, role: 'sea' },
    { l: c2, r: R, t: mid, b: B, role: 'wide' },
  ];
  return finishLayout({
    id: 'six-grid',
    name: 'Six Grid',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 840, sunX: 380, sunY: 640, sunR: 270 },
    text: {
      title: { x: 44, y: 300, w: 680, h: 420, align: 'center' },
      subtitle: { anchor: 'br', dx: 10, dy: 40, size: 104, rot: -7 },
      tagline: { x: 0, y: 220, w: 760, h: 50, rot: -2, align: 'center' },
      billing: { x: 380, y: 1052, w: 680, align: 'center' },
      quote: { x: 380, y: 72, w: 640, align: 'center' },
      seal: { x: 640, y: 905, r: 62 },
      barcode: { x: 1850, y: 1010, w: 104, h: 62 },
      coming: { x: 330, y: 976, size: 54, align: 'center' },
      scrims: [{ x0: 1500, y0: 900, x1: 1920, y1: 1080, from: 0, to: 0.75 }],
      glow: { x: 380, y: 520, r: 480 },
    },
  });
}

/** 4:5: three portraits above and three below a sunset band that carries the title. */
export function layoutSixGrid4x5(W = 1080, H = 1350) {
  const g = 12;
  const { L, R, T, B } = frameLines(W, H, g);
  const s = -0.12;
  const topEnd = hLine(486, 0.07);
  const botStart = hLine(872, 0.07);
  const a1 = vLine(300, s);
  const a2 = vLine(760, s);
  const b1 = vLine(360, s);
  const b2 = vLine(720, s);
  const cells = [
    { l: a1, r: a2, t: T, b: topEnd, hero: true, role: 'face' },
    { l: a2, r: R, t: T, b: topEnd, role: 'face' },
    { l: L, r: a1, t: T, b: topEnd, role: 'sky' },
    { l: L, r: b1, t: botStart, b: B, role: 'detail' },
    { l: b1, r: b2, t: botStart, b: B, role: 'wide' },
    { l: b2, r: R, t: botStart, b: B, role: 'sea' },
  ];
  return finishLayout({
    id: 'six-grid',
    name: 'Six Grid',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 806, sunX: 540, sunY: 716, sunR: 210 },
    text: {
      title: { x: 60, y: 548, w: 960, h: 246, align: 'center' },
      subtitle: { anchor: 'br', dx: -20, dy: 32, size: 88, rot: -7 },
      tagline: { x: 160, y: 500, w: 760, h: 42, rot: -2, align: 'center' },
      billing: { x: 540, y: 1326, w: 900, align: 'center' },
      quote: { x: 540, y: 1188, w: 520, align: 'center' },
      seal: { x: 1000, y: 410, r: 62 },
      barcode: { x: 70, y: 1276, w: 84, h: 50 },
      coming: { x: 1044, y: 1282, size: 34, align: 'right' },
      scrims: [{ x0: 0, y0: 1120, x1: 0, y1: 1350, from: 0, to: 0.9 }],
      glow: { x: 540, y: 660, r: 520 },
    },
  });
}

/** 1:1: three portraits above and three below a slanted sunset band with the title. */
export function layoutSixGrid1x1(W = 1080, H = 1080) {
  const g = 12;
  const { L, R, T, B } = frameLines(W, H, g);
  const s = -0.12;
  const topEnd = hLine(414, 0.06);
  const botStart = hLine(690, 0.06);
  const a1 = vLine(320, s);
  const a2 = vLine(740, s);
  const b1 = vLine(380, s);
  const b2 = vLine(720, s);
  const cells = [
    { l: a1, r: a2, t: T, b: topEnd, hero: true, role: 'face' },
    { l: a2, r: R, t: T, b: topEnd, role: 'face' },
    { l: L, r: a1, t: T, b: topEnd, role: 'sky' },
    { l: L, r: b1, t: botStart, b: B, role: 'detail' },
    { l: b1, r: b2, t: botStart, b: B, role: 'wide' },
    { l: b2, r: R, t: botStart, b: B, role: 'sea' },
  ];
  return finishLayout({
    id: 'six-grid',
    name: 'Six Grid',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 636, sunX: 540, sunY: 590, sunR: 170 },
    text: {
      title: { x: 36, y: 472, w: 1008, h: 156, align: 'center', maxLines: 1 },
      subtitle: { anchor: 'br', dx: -14, dy: -4, size: 76, rot: -6 },
      tagline: { x: 220, y: 428, w: 640, h: 36, rot: -1.5, align: 'center' },
      billing: { x: 40, y: 1060, w: 690, align: 'left' },
      seal: { x: 1014, y: 448, r: 52 },
      barcode: { x: 1014, y: 1024, w: 84, h: 48 },
      coming: { x: 958, y: 1062, size: 28, align: 'right' },
      scrims: [{ x0: 0, y0: 900, x1: 0, y1: 1080, from: 0, to: 0.9 }],
      glow: { x: 540, y: 540, r: 460 },
    },
  });
}

const LAYOUT_BUILDERS = {
  wide: [layoutCastMosaic16x9, layoutDiagonalStrips16x9, layoutSixGrid16x9],
  portrait: [layoutCastMosaic4x5, layoutDiagonalStrips4x5, layoutSixGrid4x5],
  square: [layoutCastMosaic1x1, layoutDiagonalStrips1x1, layoutSixGrid1x1],
};

export const LAYOUT_IDS = ['cast-mosaic', 'diagonal-strips', 'six-grid'];
export const LAYOUT_NAMES = { 'cast-mosaic': 'Cast Mosaic', 'diagonal-strips': 'Diagonal Strips', 'six-grid': 'Six Grid' };

const layoutCache = new Map();

/** The layout for a size key and layout id, composed for that ratio (built once, then cached). */
export function getLayout(sizeKey, layoutId) {
  const key = `${sizeKey}:${layoutId}`;
  if (!layoutCache.has(key)) {
    const size = COVER_SIZES[sizeKey];
    const index = Math.max(0, LAYOUT_IDS.indexOf(layoutId));
    layoutCache.set(key, LAYOUT_BUILDERS[sizeKey][index](size.w, size.h));
  }
  return layoutCache.get(key);
}
