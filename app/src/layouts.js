// Layouts: each preset is recomposed (not cropped) for every output size. A layout returns slanted panel polygons,
// a face-safe zone per panel (where the whole head must land, clear of all lettering), and the anchor boxes for the
// title, script subtitle, tagline ribbon, review quote, seal, billing block, barcode and release line.

export const SIZES = {
  '16x9': { key: '16x9', w: 1920, h: 1080, label: '16:9', long: '1920 × 1080' },
  '4x5': { key: '4x5', w: 1080, h: 1350, label: '4:5', long: '1080 × 1350' },
  '1x1': { key: '1x1', w: 1080, h: 1080, label: '1:1', long: '1080 × 1080' },
};

export const LAYOUTS = {
  castMosaic: { key: 'castMosaic', label: 'Cast Mosaic', note: 'Tall hero + 7 cast panels' },
  diagonalStrips: { key: 'diagonalStrips', label: 'Diagonal Strips', note: 'Slanted strips over a sunset' },
  sixGrid: { key: 'sixGrid', label: 'Six Grid', note: 'Two rows of three, title between' },
};

// ---------------------------------------------------------------- geometry helpers

/** x of a slanted gutter line through e (its x at mid-height) at height y. */
function edgeX(e, y, lean, H) {
  return e + lean * (H / 2 - y);
}

/** Sutherland–Hodgman clip of a convex polygon to an axis-aligned rectangle. */
export function clipPolygonToRect(poly, x0, y0, x1, y1) {
  const planes = [
    (p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1,
  ];
  const cut = [
    (a, b) => lerpAt(a, b, (x0 - a[0]) / (b[0] - a[0])),
    (a, b) => lerpAt(a, b, (x1 - a[0]) / (b[0] - a[0])),
    (a, b) => lerpAt(a, b, (y0 - a[1]) / (b[1] - a[1])),
    (a, b) => lerpAt(a, b, (y1 - a[1]) / (b[1] - a[1])),
  ];
  let out = poly;
  for (let k = 0; k < 4; k++) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i];
      const b = input[(i + 1) % input.length];
      const ina = planes[k](a);
      const inb = planes[k](b);
      if (ina) out.push(a);
      if (ina !== inb) out.push(cut[k](a, b));
    }
  }
  return out;
}

function lerpAt(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function polygonBounds(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Horizontal span [left, right] of a convex polygon at height y. */
function spanAt(poly, y) {
  let left = Infinity;
  let right = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) {
      const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
      left = Math.min(left, x);
      right = Math.max(right, x);
    } else if (a[1] === y) {
      left = Math.min(left, a[0]);
      right = Math.max(right, a[0]);
    }
  }
  return [left, right];
}

/** Largest axis-aligned rect inside the polygon between heights y0..y1, inset by margin. */
export function innerRect(poly, y0, y1, margin) {
  let left = -Infinity;
  let right = Infinity;
  for (let k = 0; k <= 8; k++) {
    const y = y0 + ((y1 - y0) * k) / 8;
    const [l, r] = spanAt(poly, y);
    left = Math.max(left, l);
    right = Math.min(right, r);
  }
  return { x: left + margin, y: y0, w: Math.max(10, right - left - 2 * margin), h: y1 - y0 };
}

export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Build a slanted panel between gutter lines eL..eR and rows yT..yB, clipped to the poster frame. */
function slantedPanel(g, eL, eR, yT, yB, zoneY0, zoneY1, extra = {}) {
  const { W, H, frame, gutter, lean } = g;
  const half = gutter / 2;
  const ty = yT + half;
  const by = yB - half;
  const raw = [
    [edgeX(eL, ty, lean, H) + half, ty],
    [edgeX(eR, ty, lean, H) - half, ty],
    [edgeX(eR, by, lean, H) - half, by],
    [edgeX(eL, by, lean, H) + half, by],
  ];
  const poly = clipPolygonToRect(raw, frame, frame, W - frame, H - frame);
  const zone = innerRect(poly, zoneY0, zoneY1, extra.zoneMargin ?? 14);
  return { poly, bbox: polygonBounds(poly), zone, hero: !!extra.hero, tagOrder: extra.tagOrder || ['bl', 'br', 'tl', 'tr'] };
}

function row(g, edges, yT, yB, zoneY0, zoneY1, extra = {}) {
  const panels = [];
  for (let i = 0; i < edges.length - 1; i++) panels.push(slantedPanel(g, edges[i], edges[i + 1], yT, yB, zoneY0, zoneY1, extra));
  return panels;
}

function geometry(size, frame, gutter, lean) {
  return { W: size.w, H: size.h, frame, gutter, lean };
}

// ---------------------------------------------------------------- Cast Mosaic

export function layoutCastMosaic16x9() {
  const g = geometry(SIZES['16x9'], 14, 16, 0.12);
  const hero = slantedPanel(g, -400, 620, -100, 1200, 30, 438, { hero: true, zoneMargin: 26, tagOrder: ['tl', 'tr'] });
  const top = row(g, [620, 950, 1280, 1610, 2400], -100, 528, 30, 446, { tagOrder: ['tl', 'tr', 'bl', 'br'] });
  const bottom = row(g, [620, 1060, 1500, 2400], 528, 1200, 730, 1000, { tagOrder: ['tr', 'tl', 'br', 'bl'] });
  return {
    panels: [hero, ...top, ...bottom],
    title: { cx: 1000, cy: 562, w: 1480, h: 232 },
    titleGlow: { cx: 1010, cy: 576, rx: 1060, ry: 210 },
    subtitle: { cx: 1350, cy: 664, size: 94, angle: -6 },
    ribbon: { cx: 300, cy: 905, h: 44, maxW: 540 },
    quote: { cx: 300, cy: 776, w: 520 },
    seal: { cx: 1806, cy: 562, r: 98 },
    billing: { cx: 1180, y: 1010, w: 1000, h: 58 },
    barcode: { x: 1712, y: 1000, w: 176, h: 64 },
    release: { cx: 300, cy: 1018, size: 54 },
    shade: { y0: 930, y1: 1080, strength: 0.8 },
  };
}

export function layoutCastMosaic4x5() {
  const g = geometry(SIZES['4x5'], 12, 14, 0.1);
  const hero = slantedPanel(g, -300, 560, -100, 590, 32, 472, { hero: true, zoneMargin: 18, tagOrder: ['tl', 'tr'] });
  const top = row(g, [560, 820, 1400], -100, 590, 40, 470, { zoneMargin: 12, tagOrder: ['tl', 'tr'] });
  const bottom = row(g, [-300, 270, 470, 670, 870, 1400], 790, 1450, 832, 1200, { zoneMargin: 10, tagOrder: ['tl', 'tr', 'bl', 'br'] });
  return {
    panels: [hero, ...top, ...bottom],
    title: { cx: 480, cy: 640, w: 880, h: 176 },
    titleGlow: { cx: 540, cy: 680, rx: 640, ry: 230 },
    subtitle: { cx: 640, cy: 736, size: 78, angle: -6 },
    ribbon: { cx: 250, cy: 794, h: 34, maxW: 440 },
    quote: null,
    seal: { cx: 992, cy: 642, r: 70 },
    sky: { y: 560, h: 260, horizon: 786, sunX: 760, sunR: 110, band: true, palms: [] },
    billing: { cx: 440, y: 1236, w: 800, h: 56 },
    barcode: { x: 900, y: 1232, w: 150, h: 56 },
    release: { cx: 540, cy: 1312, size: 30 },
    shade: { y0: 1080, y1: 1350, strength: 0.85 },
  };
}

export function layoutCastMosaic1x1() {
  const g = geometry(SIZES['1x1'], 12, 14, 0.1);
  const hero = slantedPanel(g, -300, 500, -100, 470, 30, 384, { hero: true, zoneMargin: 18, tagOrder: ['tl', 'tr'] });
  const top = row(g, [500, 790, 1400], -100, 470, 32, 384, { zoneMargin: 12, tagOrder: ['tl', 'tr'] });
  const bottom = row(g, [-300, 270, 470, 670, 870, 1400], 640, 1200, 676, 968, { zoneMargin: 10, tagOrder: ['tl', 'tr', 'bl', 'br'] });
  return {
    panels: [hero, ...top, ...bottom],
    title: { cx: 472, cy: 492, w: 880, h: 150 },
    titleGlow: { cx: 540, cy: 520, rx: 640, ry: 200 },
    subtitle: { cx: 640, cy: 584, size: 66, angle: -6 },
    ribbon: { cx: 240, cy: 630, h: 30, maxW: 420 },
    quote: null,
    seal: { cx: 990, cy: 494, r: 62 },
    sky: { y: 440, h: 230, horizon: 640, sunX: 760, sunR: 92, band: true, palms: [] },
    billing: { cx: 450, y: 984, w: 820, h: 50 },
    barcode: { x: 912, y: 982, w: 140, h: 50 },
    release: { cx: 540, cy: 1052, size: 26 },
    shade: { y0: 840, y1: 1080, strength: 0.85 },
  };
}

// ---------------------------------------------------------------- Diagonal Strips (strips over a sunset scene)

export function layoutDiagonalStrips16x9() {
  const g = geometry(SIZES['16x9'], 14, 18, 0.1);
  const strips = row(g, [-400, 330, 640, 960, 1280, 1600, 2400], -100, 770, 34, 470, { zoneMargin: 12, tagOrder: ['tl', 'tr'] });
  strips[2].hero = true;
  const order = [2, 3, 1, 4, 0, 5].map((i) => strips[i]);
  return {
    panels: order,
    title: { cx: 960, cy: 606, w: 1560, h: 230 },
    titleGlow: { cx: 960, cy: 616, rx: 1100, ry: 220 },
    subtitle: { cx: 1250, cy: 724, size: 94, angle: -6 },
    ribbon: { cx: 960, cy: 812, h: 44, maxW: 760 },
    quote: { cx: 300, cy: 890, w: 440 },
    seal: { cx: 1650, cy: 894, r: 88 },
    billing: { cx: 960, y: 1004, w: 1000, h: 60 },
    barcode: { x: 1728, y: 1008, w: 160, h: 56 },
    release: { cx: 300, cy: 1036, size: 44 },
    sky: { y: 0, h: 1080, horizon: 905, sunX: 960, sunR: 150, palms: [[70, 1080, 420, 0.1], [1850, 1080, 460, -0.12], [1500, 1080, 300, 0.05]] },
    shade: { y0: 940, y1: 1080, strength: 0.6 },
  };
}

export function layoutDiagonalStrips4x5() {
  const g = geometry(SIZES['4x5'], 12, 16, 0.07);
  const strips = row(g, [-300, 290, 560, 830, 1400], -100, 740, 44, 560, { zoneMargin: 10, tagOrder: ['tl', 'tr'] });
  strips[1].hero = true;
  const order = [1, 2, 0, 3].map((i) => strips[i]);
  return {
    panels: order,
    title: { cx: 540, cy: 748, w: 1010, h: 290 },
    titleGlow: { cx: 540, cy: 770, rx: 700, ry: 270 },
    subtitle: { cx: 610, cy: 930, size: 92, angle: -6 },
    ribbon: { cx: 540, cy: 1014, h: 40, maxW: 760 },
    quote: { cx: 520, cy: 1124, w: 500 },
    seal: { cx: 935, cy: 1126, r: 80 },
    billing: { cx: 540, y: 1234, w: 900, h: 58 },
    barcode: { x: 40, y: 1290, w: 120, h: 46 },
    release: { cx: 540, cy: 1318, size: 32 },
    sky: { y: 0, h: 1350, horizon: 1150, sunX: 540, sunR: 170, palms: [[40, 1350, 520, 0.12], [1050, 1350, 480, -0.12]] },
    shade: { y0: 1180, y1: 1350, strength: 0.65 },
  };
}

export function layoutDiagonalStrips1x1() {
  const g = geometry(SIZES['1x1'], 12, 16, 0.07);
  const strips = row(g, [-300, 290, 560, 830, 1400], -100, 650, 30, 424, { zoneMargin: 10, tagOrder: ['tl', 'tr'] });
  strips[1].hero = true;
  const order = [1, 2, 0, 3].map((i) => strips[i]);
  return {
    panels: order,
    title: { cx: 540, cy: 566, w: 1010, h: 210 },
    titleGlow: { cx: 540, cy: 570, rx: 700, ry: 220 },
    subtitle: { cx: 620, cy: 684, size: 72, angle: -6 },
    ribbon: { cx: 540, cy: 758, h: 32, maxW: 680 },
    quote: { cx: 270, cy: 862, w: 380 },
    seal: { cx: 860, cy: 866, r: 70 },
    billing: { cx: 540, y: 968, w: 900, h: 50 },
    barcode: { x: 0, y: 0, w: 0, h: 0 },
    release: { cx: 540, cy: 1048, size: 28 },
    sky: { y: 0, h: 1080, horizon: 905, sunX: 560, sunR: 130, palms: [[40, 1080, 380, 0.12], [1050, 1080, 360, -0.12]] },
    shade: { y0: 930, y1: 1080, strength: 0.6 },
  };
}

// ---------------------------------------------------------------- Six Grid (three over three, title between)

export function layoutSixGrid16x9() {
  const g = geometry(SIZES['16x9'], 14, 16, 0.1);
  const top = row(g, [-400, 660, 1280, 2400], -100, 520, 30, 452, { zoneMargin: 40, tagOrder: ['bl', 'br', 'tl'] });
  const bottom = row(g, [-400, 640, 1260, 2400], 620, 1200, 738, 1000, { zoneMargin: 40, tagOrder: ['tl', 'tr', 'bl'] });
  top[1].hero = true;
  return {
    panels: [top[1], top[0], top[2], bottom[1], bottom[0], bottom[2]],
    title: { cx: 900, cy: 590, w: 1380, h: 176 },
    titleGlow: { cx: 960, cy: 596, rx: 1100, ry: 180 },
    subtitle: { cx: 1320, cy: 672, size: 80, angle: -6 },
    ribbon: { cx: 900, cy: 500, h: 36, maxW: 700 },
    quote: null,
    seal: { cx: 1790, cy: 592, r: 86 },
    billing: { cx: 960, y: 1010, w: 1100, h: 58 },
    barcode: { x: 1724, y: 1010, w: 164, h: 56 },
    release: { cx: 230, cy: 1040, size: 40 },
    sky: { y: 500, h: 210, horizon: 680, sunX: 960, sunR: 120, band: true, palms: [] },
    shade: { y0: 930, y1: 1080, strength: 0.7 },
  };
}

export function layoutSixGrid4x5() {
  const g = geometry(SIZES['4x5'], 12, 14, 0.08);
  const top = row(g, [-300, 360, 720, 1400], -100, 568, 34, 500, { zoneMargin: 14, tagOrder: ['bl', 'br', 'tl'] });
  const bottom = row(g, [-300, 360, 720, 1400], 762, 1450, 800, 1215, { zoneMargin: 14, tagOrder: ['tl', 'tr'] });
  top[1].hero = true;
  return {
    panels: [top[1], top[0], top[2], bottom[1], bottom[0], bottom[2]],
    title: { cx: 488, cy: 652, w: 880, h: 160 },
    titleGlow: { cx: 540, cy: 660, rx: 700, ry: 190 },
    subtitle: { cx: 690, cy: 740, size: 68, angle: -6 },
    ribbon: { cx: 470, cy: 552, h: 30, maxW: 600 },
    quote: null,
    seal: { cx: 990, cy: 654, r: 66 },
    billing: { cx: 480, y: 1246, w: 820, h: 52 },
    barcode: { x: 920, y: 1246, w: 130, h: 54 },
    release: { cx: 540, cy: 1322, size: 28 },
    sky: { y: 540, h: 240, horizon: 750, sunX: 760, sunR: 110, band: true, palms: [] },
    shade: { y0: 1160, y1: 1350, strength: 0.8 },
  };
}

export function layoutSixGrid1x1() {
  const g = geometry(SIZES['1x1'], 12, 14, 0.08);
  const top = row(g, [-300, 360, 720, 1400], -100, 424, 26, 366, { zoneMargin: 16, tagOrder: ['bl', 'br', 'tl'] });
  const bottom = row(g, [-300, 360, 720, 1400], 598, 1200, 634, 958, { zoneMargin: 16, tagOrder: ['tl', 'tr'] });
  top[1].hero = true;
  return {
    panels: [top[1], top[0], top[2], bottom[1], bottom[0], bottom[2]],
    title: { cx: 470, cy: 496, w: 860, h: 136 },
    titleGlow: { cx: 540, cy: 500, rx: 700, ry: 170 },
    subtitle: { cx: 660, cy: 576, size: 58, angle: -6 },
    ribbon: { cx: 440, cy: 404, h: 28, maxW: 560 },
    quote: null,
    seal: { cx: 990, cy: 498, r: 60 },
    billing: { cx: 470, y: 976, w: 800, h: 46 },
    barcode: { x: 916, y: 978, w: 136, h: 48 },
    release: { cx: 540, cy: 1056, size: 24 },
    sky: { y: 420, h: 200, horizon: 590, sunX: 760, sunR: 92, band: true, palms: [] },
    shade: { y0: 900, y1: 1080, strength: 0.8 },
  };
}

const BUILDERS = {
  castMosaic: { '16x9': layoutCastMosaic16x9, '4x5': layoutCastMosaic4x5, '1x1': layoutCastMosaic1x1 },
  diagonalStrips: { '16x9': layoutDiagonalStrips16x9, '4x5': layoutDiagonalStrips4x5, '1x1': layoutDiagonalStrips1x1 },
  sixGrid: { '16x9': layoutSixGrid16x9, '4x5': layoutSixGrid4x5, '1x1': layoutSixGrid1x1 },
};

const cache = new Map();

/** The composed layout for a preset and output size (memoised; treat as read-only). */
export function getLayout(layoutKey, sizeKey) {
  const key = `${layoutKey}:${sizeKey}`;
  if (!cache.has(key)) {
    const size = SIZES[sizeKey] || SIZES['16x9'];
    const build = (BUILDERS[layoutKey] || BUILDERS.castMosaic)[size.key];
    cache.set(key, { ...build(), W: size.w, H: size.h, sizeKey: size.key, layoutKey });
  }
  return cache.get(key);
}

export const MAX_PANELS = 8;
