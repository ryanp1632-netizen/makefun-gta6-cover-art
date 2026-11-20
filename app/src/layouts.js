// Layouts: each preset is recomposed (not cropped) for every output size. A layout returns slanted panel polygons
// clipped to the panel area under the review top bar, a face-safe zone per panel (where the whole head must land,
// clear of all lettering), and the anchor boxes for the top bar, title, script subtitle, tagline ribbon, seal,
// billing block, barcode and release line.

export const SIZES = {
  '16x9': { key: '16x9', w: 1920, h: 1080, label: '16:9', long: '1920 × 1080' },
  '4x5': { key: '4x5', w: 1080, h: 1350, label: '4:5', long: '1080 × 1350' },
  '1x1': { key: '1x1', w: 1080, h: 1080, label: '1:1', long: '1080 × 1080' },
};

export const LAYOUTS = {
  castMosaic: { key: 'castMosaic', label: 'Cast Mosaic', note: 'One big hero + 6 framed cast panels' },
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

/** Build a slanted panel between gutter lines eL..eR and rows yT..yB, clipped to the panel area. */
function slantedPanel(g, eL, eR, yT, yB, zoneY0, zoneY1, extra = {}) {
  const { H, area, gutter, lean } = g;
  const half = gutter / 2;
  const ty = yT + half;
  const by = yB - half;
  const raw = [
    [edgeX(eL, ty, lean, H) + half, ty],
    [edgeX(eR, ty, lean, H) - half, ty],
    [edgeX(eR, by, lean, H) - half, by],
    [edgeX(eL, by, lean, H) + half, by],
  ];
  const poly = clipPolygonToRect(raw, area.x0, area.y0, area.x1, area.y1);
  const zone = innerRect(poly, zoneY0, zoneY1, extra.zoneMargin ?? 14);
  return {
    poly, bbox: polygonBounds(poly), zone, hero: !!extra.hero, tagOrder: extra.tagOrder || ['bl', 'br', 'tl', 'tr'],
    fade: extra.fade || null,
  };
}

function row(g, edges, yT, yB, zoneY0, zoneY1, extra = {}) {
  const panels = [];
  for (let i = 0; i < edges.length - 1; i++) panels.push(slantedPanel(g, edges[i], edges[i + 1], yT, yB, zoneY0, zoneY1, extra));
  return panels;
}

/** Panel geometry: panels are clipped to `area` (inside the side frame, under the top bar, over the billing). */
function geometry(size, frame, gutter, lean, top, bottom) {
  return { W: size.w, H: size.h, gutter, lean, area: { x0: frame, y0: top, x1: size.w - frame, y1: bottom } };
}

// ---------------------------------------------------------------- Cast Mosaic (hero mosaic)

/**
 * 16:9 hero mosaic: one big hero panel (38% of the width, top bar to billing) left of centre, one column of two
 * cast panels to its left and two columns of two to its right. Every panel is close to the shape of a portrait
 * photo, so heads stay large and whole. The title crosses the middle on the row gutter; the neon script and the
 * tagline ribbon sit on the hero's lower half, where no face is.
 */
export function layoutHeroMosaic16x9() {
  const g = geometry(SIZES['16x9'], 16, 20, 0.09, 74, 954);
  const split = 590;
  const hero = slantedPanel(g, 412, 1160, -100, 1200, 84, 490, {
    hero: true, zoneMargin: 30, tagOrder: ['bl', 'br'],
    fade: { y0: 500, y1: 954, strength: 0.82, sun: { cx: 778, cy: 872, r: 168, alpha: 0.88 } },
  });
  const upper = { tagOrder: ['bl', 'br', 'tl', 'tr'], zoneMargin: 14 };
  const lower = { tagOrder: ['bl', 'br', 'tl', 'tr'], zoneMargin: 14 };
  const [leftTop] = row(g, [-400, 412], -100, split, 84, 490, upper);
  const [leftBot] = row(g, [-400, 412], split, 1200, 702, 950, lower);
  const rightTop = row(g, [1160, 1534, 2400], -100, split, 84, 490, upper);
  const rightBot = row(g, [1160, 1534, 2400], split, 1200, 702, 950, lower);
  return {
    panels: [hero, leftTop, rightTop[0], rightTop[1], leftBot, rightBot[0], rightBot[1]],
    topBar: { x: 0, y: 0, w: 1920, h: 66, pad: 30 },
    title: { cx: 960, cy: 592, w: 1560, h: 156 },
    titleGlow: { cx: 960, cy: 600, rx: 1120, ry: 170 },
    subtitle: { cx: 778, cy: 752, size: 98, angle: -6 },
    ribbon: { cx: 778, cy: 850, h: 44, maxW: 640 },
    seal: { cx: 1838, cy: 590, r: 76 },
    billing: { cx: 1010, y: 968, w: 1080, h: 82 },
    barcode: { x: 1716, y: 970, w: 172, h: 78 },
    release: { cx: 236, cy: 1012, size: 46 },
    shade: { y0: 900, y1: 1080, strength: 0.75 },
  };
}

/** 4:5 hero mosaic: a big hero between two tall cast panels, the title stack on a sunset band, four cast panels below. */
export function layoutHeroMosaic4x5() {
  const g = geometry(SIZES['4x5'], 14, 18, 0.07, 66, 1206);
  const top = row(g, [-300, 300, 780, 1400], -100, 640, 74, 570, { zoneMargin: 10, tagOrder: ['bl', 'br', 'tl', 'tr'] });
  top[1].hero = true;
  top[1].tagOrder = ['bl', 'br'];
  const bottom = row(g, [-300, 280, 540, 800, 1400], 806, 1300, 880, 1100, { zoneMargin: 8, tagOrder: ['bl', 'br', 'tl', 'tr'] });
  return {
    panels: [top[1], top[0], top[2], ...bottom],
    topBar: { x: 0, y: 0, w: 1080, h: 58, pad: 20 },
    title: { cx: 540, cy: 668, w: 1020, h: 128 },
    titleGlow: { cx: 540, cy: 690, rx: 720, ry: 190 },
    subtitle: { cx: 470, cy: 768, size: 70, angle: -5 },
    ribbon: { cx: 470, cy: 838, h: 32, maxW: 560 },
    seal: { cx: 960, cy: 790, r: 64 },
    sky: { y: 560, h: 300, horizon: 846, sunX: 820, sunR: 120, band: true, palms: [] },
    billing: { cx: 452, y: 1218, w: 820, h: 70 },
    barcode: { x: 912, y: 1222, w: 140, h: 62 },
    release: { cx: 452, cy: 1314, size: 32 },
    shade: { y0: 1150, y1: 1350, strength: 0.8 },
  };
}

/** 1:1 hero mosaic: the same plan as 4:5, pressed into a square. */
export function layoutHeroMosaic1x1() {
  const g = geometry(SIZES['1x1'], 14, 16, 0.07, 60, 958);
  const top = row(g, [-300, 296, 784, 1400], -100, 500, 68, 428, { zoneMargin: 10, tagOrder: ['bl', 'br', 'tl', 'tr'] });
  top[1].hero = true;
  top[1].tagOrder = ['bl', 'br'];
  const bottom = row(g, [-300, 280, 540, 800, 1400], 636, 1100, 690, 884, { zoneMargin: 8, tagOrder: ['bl', 'br', 'tl', 'tr'] });
  return {
    panels: [top[1], top[0], top[2], ...bottom],
    topBar: { x: 0, y: 0, w: 1080, h: 52, pad: 18 },
    title: { cx: 540, cy: 512, w: 1010, h: 110 },
    titleGlow: { cx: 540, cy: 530, rx: 700, ry: 160 },
    subtitle: { cx: 470, cy: 594, size: 56, angle: -5 },
    ribbon: { cx: 470, cy: 648, h: 26, maxW: 500 },
    seal: { cx: 968, cy: 612, r: 54 },
    sky: { y: 440, h: 230, horizon: 650, sunX: 820, sunR: 96, band: true, palms: [] },
    billing: { cx: 452, y: 966, w: 820, h: 58 },
    barcode: { x: 916, y: 968, w: 136, h: 56 },
    release: { cx: 452, cy: 1052, size: 26 },
    shade: { y0: 880, y1: 1080, strength: 0.8 },
  };
}

// ---------------------------------------------------------------- Diagonal Strips (strips over a sunset scene)

export function layoutDiagonalStrips16x9() {
  const g = geometry(SIZES['16x9'], 16, 20, 0.1, 74, 1080);
  const strips = row(g, [-400, 330, 640, 960, 1280, 1600, 2400], -100, 770, 84, 476, {
    zoneMargin: 12, tagOrder: ['tl', 'tr'], fade: { y0: 500, y1: 770, strength: 0.7 },
  });
  strips[2].hero = true;
  const order = [2, 3, 1, 4, 0, 5].map((i) => strips[i]);
  return {
    panels: order,
    topBar: { x: 0, y: 0, w: 1920, h: 66, pad: 30 },
    title: { cx: 960, cy: 612, w: 1560, h: 220 },
    titleGlow: { cx: 960, cy: 622, rx: 1100, ry: 220 },
    subtitle: { cx: 1250, cy: 728, size: 94, angle: -6 },
    ribbon: { cx: 960, cy: 816, h: 44, maxW: 760 },
    seal: { cx: 1660, cy: 880, r: 84 },
    billing: { cx: 960, y: 1000, w: 1000, h: 64 },
    barcode: { x: 1728, y: 1006, w: 160, h: 58 },
    release: { cx: 300, cy: 1032, size: 44 },
    sky: { y: 0, h: 1080, horizon: 905, sunX: 960, sunR: 150, palms: [[70, 1080, 420, 0.1], [1850, 1080, 460, -0.12], [1500, 1080, 300, 0.05]] },
    shade: { y0: 940, y1: 1080, strength: 0.6 },
  };
}

export function layoutDiagonalStrips4x5() {
  const g = geometry(SIZES['4x5'], 14, 18, 0.07, 66, 1350);
  const strips = row(g, [-300, 290, 560, 830, 1400], -100, 760, 76, 590, {
    zoneMargin: 10, tagOrder: ['tl', 'tr'], fade: { y0: 560, y1: 760, strength: 0.7 },
  });
  strips[1].hero = true;
  const order = [1, 2, 0, 3].map((i) => strips[i]);
  return {
    panels: order,
    topBar: { x: 0, y: 0, w: 1080, h: 58, pad: 20 },
    title: { cx: 540, cy: 760, w: 1010, h: 270 },
    titleGlow: { cx: 540, cy: 780, rx: 700, ry: 270 },
    subtitle: { cx: 590, cy: 938, size: 96, angle: -6 },
    ribbon: { cx: 540, cy: 1024, h: 42, maxW: 760 },
    seal: { cx: 930, cy: 1120, r: 84 },
    billing: { cx: 540, y: 1196, w: 900, h: 70 },
    barcode: { x: 40, y: 1284, w: 124, h: 50 },
    release: { cx: 540, cy: 1310, size: 34 },
    sky: { y: 0, h: 1350, horizon: 1150, sunX: 540, sunR: 170, palms: [[40, 1350, 520, 0.12], [1050, 1350, 480, -0.12]] },
    shade: { y0: 1170, y1: 1350, strength: 0.65 },
  };
}

export function layoutDiagonalStrips1x1() {
  const g = geometry(SIZES['1x1'], 14, 18, 0.07, 60, 1080);
  const strips = row(g, [-300, 290, 560, 830, 1400], -100, 660, 70, 446, {
    zoneMargin: 10, tagOrder: ['tl', 'tr'], fade: { y0: 450, y1: 660, strength: 0.7 },
  });
  strips[1].hero = true;
  const order = [1, 2, 0, 3].map((i) => strips[i]);
  return {
    panels: order,
    topBar: { x: 0, y: 0, w: 1080, h: 52, pad: 18 },
    title: { cx: 540, cy: 582, w: 1010, h: 190 },
    titleGlow: { cx: 540, cy: 590, rx: 700, ry: 220 },
    subtitle: { cx: 600, cy: 700, size: 74, angle: -6 },
    ribbon: { cx: 540, cy: 778, h: 32, maxW: 680 },
    seal: { cx: 900, cy: 868, r: 68 },
    billing: { cx: 540, y: 950, w: 900, h: 58 },
    barcode: { x: 0, y: 0, w: 0, h: 0 },
    release: { cx: 540, cy: 1046, size: 28 },
    sky: { y: 0, h: 1080, horizon: 905, sunX: 560, sunR: 130, palms: [[40, 1080, 380, 0.12], [1050, 1080, 360, -0.12]] },
    shade: { y0: 930, y1: 1080, strength: 0.6 },
  };
}

// ---------------------------------------------------------------- Six Grid (three over three, title between)

/** 16:9 six grid: three over three portrait panels on the right, the title stack over a sunset on the left. */
export function layoutSixGrid16x9() {
  const g = geometry(SIZES['16x9'], 16, 20, 0.08, 74, 954);
  const top = row(g, [780, 1158, 1534, 2400], -100, 514, 84, 496, { zoneMargin: 12, tagOrder: ['bl', 'br', 'tl'] });
  const bottom = row(g, [780, 1158, 1534, 2400], 514, 1200, 532, 944, { zoneMargin: 12, tagOrder: ['bl', 'br', 'tl'] });
  top[0].hero = true;
  return {
    panels: [top[0], top[1], top[2], bottom[0], bottom[1], bottom[2]],
    topBar: { x: 0, y: 0, w: 1920, h: 66, pad: 30 },
    title: { cx: 392, cy: 400, w: 700, h: 360 },
    titleGlow: { cx: 392, cy: 430, rx: 470, ry: 300 },
    subtitle: { cx: 400, cy: 640, size: 92, angle: -6 },
    ribbon: { cx: 392, cy: 738, h: 40, maxW: 660 },
    seal: { cx: 640, cy: 860, r: 76 },
    billing: { cx: 1260, y: 968, w: 900, h: 80 },
    barcode: { x: 1730, y: 972, w: 160, h: 72 },
    release: { cx: 300, cy: 1010, size: 42 },
    sky: { y: 66, h: 1014, horizon: 860, sunX: 380, sunR: 150, palms: [[40, 1080, 420, 0.1], [700, 1080, 300, -0.08]] },
    shade: { y0: 930, y1: 1080, strength: 0.7 },
  };
}

export function layoutSixGrid4x5() {
  const g = geometry(SIZES['4x5'], 14, 18, 0.08, 66, 1214);
  const top = row(g, [-300, 360, 720, 1400], -100, 578, 74, 506, { zoneMargin: 14, tagOrder: ['bl', 'br', 'tl'] });
  const bottom = row(g, [-300, 360, 720, 1400], 768, 1450, 806, 1204, { zoneMargin: 14, tagOrder: ['tl', 'tr'] });
  top[1].hero = true;
  return {
    panels: [top[1], top[0], top[2], bottom[1], bottom[0], bottom[2]],
    topBar: { x: 0, y: 0, w: 1080, h: 58, pad: 20 },
    title: { cx: 488, cy: 660, w: 880, h: 150 },
    titleGlow: { cx: 540, cy: 666, rx: 700, ry: 190 },
    subtitle: { cx: 690, cy: 744, size: 66, angle: -6 },
    ribbon: { cx: 470, cy: 560, h: 30, maxW: 600 },
    seal: { cx: 990, cy: 660, r: 64 },
    billing: { cx: 472, y: 1226, w: 820, h: 66 },
    barcode: { x: 920, y: 1230, w: 130, h: 58 },
    release: { cx: 540, cy: 1318, size: 30 },
    sky: { y: 540, h: 240, horizon: 750, sunX: 760, sunR: 110, band: true, palms: [] },
    shade: { y0: 1150, y1: 1350, strength: 0.8 },
  };
}

export function layoutSixGrid1x1() {
  const g = geometry(SIZES['1x1'], 14, 16, 0.08, 60, 960);
  const top = row(g, [-300, 360, 720, 1400], -100, 434, 68, 372, { zoneMargin: 16, tagOrder: ['bl', 'br', 'tl'] });
  const bottom = row(g, [-300, 360, 720, 1400], 602, 1200, 636, 952, { zoneMargin: 16, tagOrder: ['tl', 'tr'] });
  top[1].hero = true;
  return {
    panels: [top[1], top[0], top[2], bottom[1], bottom[0], bottom[2]],
    topBar: { x: 0, y: 0, w: 1080, h: 52, pad: 18 },
    title: { cx: 470, cy: 504, w: 860, h: 128 },
    titleGlow: { cx: 540, cy: 508, rx: 700, ry: 170 },
    subtitle: { cx: 660, cy: 580, size: 56, angle: -6 },
    ribbon: { cx: 440, cy: 414, h: 28, maxW: 560 },
    seal: { cx: 990, cy: 504, r: 58 },
    billing: { cx: 470, y: 970, w: 800, h: 56 },
    barcode: { x: 916, y: 972, w: 136, h: 52 },
    release: { cx: 540, cy: 1056, size: 24 },
    sky: { y: 420, h: 200, horizon: 590, sunX: 760, sunR: 92, band: true, palms: [] },
    shade: { y0: 900, y1: 1080, strength: 0.8 },
  };
}

const BUILDERS = {
  castMosaic: { '16x9': layoutHeroMosaic16x9, '4x5': layoutHeroMosaic4x5, '1x1': layoutHeroMosaic1x1 },
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
