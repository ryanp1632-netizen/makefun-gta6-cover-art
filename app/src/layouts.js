// Layout presets: for every output ratio, a set of poster compositions made of photo panels cut by slanted gutters,
// plus the zones where the lettering, the badge, the barcode and the code-drawn sunset scenery go.
// Panels are built from straight cut lines (nearly vertical "v" lines and nearly horizontal "h" lines), so
// neighbouring panels share an edge; each panel is then inset by half a gutter, which leaves even, slanted gaps.
// Panel 0 is always the hero and panel 1 the second face, so name tags (kept per panel number) follow the people.

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
    // inward normal for a clockwise polygon in screen coordinates (y down)
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

/** Turns cell definitions into finished panels: inset polygon, bounds, role and name-tag corner. */
function buildPanels(cells, W, H, gutter) {
  return cells.map((c, index) => {
    const raw = cellBetween(c.l, c.r, c.t, c.b, W, H);
    const poly = insetPolygon(raw, gutter / 2);
    return { index, poly, bounds: polygonBounds(poly), role: c.role, tag: c.tag ?? 'bl', hero: !!c.hero };
  });
}

function frameLines(W, H, gutter) {
  const m = gutter / 2;
  return { L: vLine(m), R: vLine(W - m), T: hLine(m), B: hLine(H - m) };
}

// ---------------------------------------------------------------------------------------------------------------
// 16:9 (1920 x 1080)

/** Hero on the right, a six-panel slanted mosaic top-left, the title over a sunset bottom-left. */
export function layoutHeroMosaic16x9(W = 1920, H = 1080) {
  const g = 14;
  const { L, R, T, B } = frameLines(W, H, g);
  const heroCut = vLine(1066, -0.11);
  const h0 = hLine(206, 0.035);
  const h1 = hLine(398, 0.035);
  const h2 = hLine(600, 0.035);
  const v1 = vLine(618, -0.11);
  const v2 = vLine(356, -0.11);
  const v3 = vLine(712, -0.11);
  const cells = [
    { l: heroCut, r: R, t: T, b: B, role: 'mid', hero: true, tag: 'tl' },
    { l: L, r: v1, t: T, b: h1, role: 'face', tag: 'br' },
    { l: v1, r: heroCut, t: T, b: h0, role: 'sky' },
    { l: v1, r: heroCut, t: h0, b: h1, role: 'detail' },
    { l: L, r: v2, t: h1, b: h2, role: 'detail' },
    { l: v2, r: v3, t: h1, b: h2, role: 'wide' },
    { l: v3, r: heroCut, t: h1, b: h2, role: 'sea' },
  ];
  return {
    id: 'hero-mosaic',
    name: 'Hero Mosaic',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: {
      horizon: 968,
      sunX: 560,
      sunY: 890,
      sunR: 270,
      palms: [
        { x: 1004, h: 360, lean: -0.14 },
        { x: 952, h: 250, lean: 0.08 },
      ],
    },
    text: {
      title: { x: 40, y: 664, w: 980, h: 360, align: 'left' },
      subtitle: { anchor: 'br', dx: 130, dy: -16, size: 98, rot: -7 },
      tagline: { x: -10, y: 610, w: 760, h: 46, rot: -2, align: 'left' },
      billing: { x: 1480, y: 1062, w: 720, align: 'center' },
      quote: { x: 1480, y: 790, w: 720, align: 'center' },
      seal: { x: 1800, y: 128, r: 96 },
      barcode: { x: 1838, y: 1002, w: 112, h: 66 },
      coming: { x: 1480, y: 1012, size: 58, align: 'center' },
      scrims: [{ x0: 1000, y0: 620, x1: 1920, y1: 1080, from: 0, to: 0.86 }],
      glow: { x: 520, y: 820, r: 560 },
    },
  };
}

/** Five strong diagonal strips across the top, title centred between two small corner panels. */
export function layoutDiagonalStrips16x9(W = 1920, H = 1080) {
  const g = 14;
  const { L, R, T, B } = frameLines(W, H, g);
  const s = 0.3;
  const hB = hLine(684, -0.05);
  const xs = [vLine(420, s), vLine(790, s), vLine(1230, s), vLine(1580, s)];
  const bl = vLine(470, s);
  const br = vLine(1520, s);
  const cells = [
    { l: xs[1], r: xs[2], t: T, b: hB, role: 'mid', hero: true, tag: 'tl' },
    { l: xs[0], r: xs[1], t: T, b: hB, role: 'face', tag: 'tl' },
    { l: L, r: xs[0], t: T, b: hB, role: 'sky' },
    { l: xs[2], r: xs[3], t: T, b: hB, role: 'detail' },
    { l: xs[3], r: R, t: T, b: hB, role: 'sea' },
    { l: L, r: bl, t: hB, b: B, role: 'detail' },
    { l: br, r: R, t: hB, b: B, role: 'wide' },
  ];
  return {
    id: 'diagonal-strips',
    name: 'Diagonal Strips',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 985, sunX: 960, sunY: 930, sunR: 280 },
    text: {
      title: { x: 520, y: 712, w: 880, h: 268, align: 'center' },
      subtitle: { anchor: 'br', dx: 40, dy: 36, size: 100, rot: -7 },
      tagline: { x: 600, y: 664, w: 720, h: 44, rot: -2.5, align: 'center' },
      billing: { x: 960, y: 1060, w: 860, align: 'center' },
      quote: { x: 1420, y: 64, w: 560, align: 'center' },
      seal: { x: 150, y: 940, r: 90 },
      barcode: { x: 1834, y: 1006, w: 112, h: 66 },
      coming: { x: 1764, y: 1042, size: 44, align: 'right' },
      scrims: [
        { x0: 1060, y0: 0, x1: 1920, y1: 230, from: 0.75, to: 0 },
        { x0: 1500, y0: 860, x1: 1920, y1: 1080, from: 0, to: 0.8 },
      ],
      glow: { x: 960, y: 860, r: 560 },
    },
  };
}

/** A tilted 3 x 2 grid on the right, a tall title column over the sunset on the left. */
export function layoutSixGrid16x9(W = 1920, H = 1080) {
  const g = 14;
  const { R, T, B } = frameLines(W, H, g);
  const s = -0.08;
  const c0 = vLine(760, s);
  const c1 = vLine(1150, s);
  const c2 = vLine(1530, s);
  const mid = hLine(540, 0.05);
  const cells = [
    { l: c1, r: c2, t: T, b: mid, role: 'face', hero: true, tag: 'bl' },
    { l: c2, r: R, t: T, b: mid, role: 'face', tag: 'bl' },
    { l: c0, r: c1, t: T, b: mid, role: 'sky' },
    { l: c0, r: c1, t: mid, b: B, role: 'detail' },
    { l: c1, r: c2, t: mid, b: B, role: 'sea' },
    { l: c2, r: R, t: mid, b: B, role: 'wide' },
  ];
  return {
    id: 'six-grid',
    name: 'Six Grid',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 840, sunX: 380, sunY: 640, sunR: 270 },
    text: {
      title: { x: 44, y: 300, w: 680, h: 420, align: 'center' },
      subtitle: { anchor: 'br', dx: 10, dy: 40, size: 104, rot: -7 },
      tagline: { x: 0, y: 220, w: 760, h: 50, rot: -2, align: 'center' },
      billing: { x: 380, y: 1050, w: 680, align: 'center' },
      quote: { x: 380, y: 70, w: 640, align: 'center' },
      seal: { x: 1846, y: 560, r: 64 },
      barcode: { x: 1834, y: 1006, w: 112, h: 66 },
      coming: { x: 380, y: 976, size: 54, align: 'center' },
      scrims: [{ x0: 1500, y0: 880, x1: 1920, y1: 1080, from: 0, to: 0.75 }],
      glow: { x: 380, y: 520, r: 480 },
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// 4:5 (1080 x 1350)

/** Tall hero on the left, a stacked right column and two small panels, title over the sunset below. */
export function layoutHeroMosaic4x5(W = 1080, H = 1350) {
  const g = 12;
  const { L, R, T } = frameLines(W, H, g);
  const heroCut = vLine(640, -0.1);
  const r1 = hLine(330, 0.06);
  const r2 = hLine(600, 0.06);
  const low = hLine(870, 0.06);
  const heroBottom = hLine(690, 0.06);
  const split = vLine(330, -0.1);
  const cells = [
    { l: L, r: heroCut, t: T, b: heroBottom, role: 'mid', hero: true, tag: 'tl' },
    { l: heroCut, r: R, t: T, b: r1, role: 'face', tag: 'bl' },
    { l: heroCut, r: R, t: r1, b: r2, role: 'sky' },
    { l: heroCut, r: R, t: r2, b: low, role: 'detail' },
    { l: L, r: split, t: heroBottom, b: low, role: 'detail' },
    { l: split, r: heroCut, t: heroBottom, b: low, role: 'sea' },
  ];
  return {
    id: 'hero-mosaic',
    name: 'Hero Mosaic',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 1215, sunX: 540, sunY: 1150, sunR: 240 },
    text: {
      title: { x: 50, y: 924, w: 980, h: 280, align: 'center' },
      subtitle: { anchor: 'br', dx: 0, dy: 36, size: 96, rot: -7 },
      tagline: { x: 140, y: 874, w: 800, h: 44, rot: -2, align: 'center' },
      billing: { x: 540, y: 1322, w: 760, align: 'center' },
      quote: { x: 320, y: 560, w: 560, align: 'center' },
      seal: { x: 990, y: 830, r: 78 },
      barcode: { x: 994, y: 1272, w: 88, h: 54 },
      coming: { x: 56, y: 1278, size: 34, align: 'left' },
      scrims: [{ x0: 0, y0: 430, x1: 650, y1: 690, from: 0, to: 0.75 }],
      glow: { x: 540, y: 1060, r: 520 },
    },
  };
}

/** Title over the sun at the top, tall slanted character strips below. */
export function layoutDiagonalStrips4x5(W = 1080, H = 1350) {
  const g = 12;
  const { L, R, B } = frameLines(W, H, g);
  const s = 0.16;
  const top = hLine(470, -0.07);
  const xs = [vLine(250, s), vLine(600, s), vLine(860, s)];
  const lsplit = hLine(900, -0.07);
  const rsplit = hLine(830, -0.07);
  const cells = [
    { l: xs[0], r: xs[1], t: top, b: B, role: 'mid', hero: true, tag: 'tl' },
    { l: xs[1], r: xs[2], t: top, b: B, role: 'face', tag: 'tl' },
    { l: L, r: xs[0], t: top, b: lsplit, role: 'sky' },
    { l: L, r: xs[0], t: lsplit, b: B, role: 'detail' },
    { l: xs[2], r: R, t: top, b: rsplit, role: 'sea' },
    { l: xs[2], r: R, t: rsplit, b: B, role: 'detail' },
  ];
  return {
    id: 'diagonal-strips',
    name: 'Diagonal Strips',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 430, sunX: 540, sunY: 330, sunR: 230 },
    text: {
      title: { x: 40, y: 82, w: 1000, h: 326, align: 'center' },
      subtitle: { anchor: 'br', dx: -10, dy: 30, size: 100, rot: -7 },
      tagline: { x: 170, y: 30, w: 740, h: 42, rot: -1.5, align: 'center' },
      billing: { x: 540, y: 1322, w: 900, align: 'center' },
      quote: { x: 540, y: 1112, w: 700, align: 'center' },
      seal: { x: 120, y: 560, r: 78 },
      barcode: { x: 92, y: 1262, w: 92, h: 54 },
      coming: { x: 1040, y: 1276, size: 36, align: 'right' },
      scrims: [{ x0: 0, y0: 960, x1: 0, y1: 1350, from: 0, to: 0.9 }],
      glow: { x: 540, y: 240, r: 520 },
    },
  };
}

/** Three panels above and three below a sunset band that carries the title. */
export function layoutSixGrid4x5(W = 1080, H = 1350) {
  const g = 12;
  const { L, R, T, B } = frameLines(W, H, g);
  const s = -0.12;
  const topEnd = hLine(480, 0.07);
  const botStart = hLine(866, 0.07);
  const a1 = vLine(300, s);
  const a2 = vLine(760, s);
  const b1 = vLine(360, s);
  const b2 = vLine(720, s);
  const cells = [
    { l: a1, r: a2, t: T, b: topEnd, role: 'face', hero: true, tag: 'bl' },
    { l: a2, r: R, t: T, b: topEnd, role: 'face', tag: 'br' },
    { l: L, r: a1, t: T, b: topEnd, role: 'sky' },
    { l: L, r: b1, t: botStart, b: B, role: 'detail', tag: 'tl' },
    { l: b1, r: b2, t: botStart, b: B, role: 'wide', tag: 'tl' },
    { l: b2, r: R, t: botStart, b: B, role: 'sea', tag: 'tl' },
  ];
  return {
    id: 'six-grid',
    name: 'Six Grid',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 800, sunX: 540, sunY: 710, sunR: 210 },
    text: {
      title: { x: 60, y: 540, w: 960, h: 250, align: 'center' },
      subtitle: { anchor: 'br', dx: -20, dy: 34, size: 88, rot: -7 },
      tagline: { x: 160, y: 494, w: 760, h: 42, rot: -2, align: 'center' },
      billing: { x: 540, y: 1322, w: 900, align: 'center' },
      quote: { x: 540, y: 1140, w: 700, align: 'center' },
      seal: { x: 960, y: 880, r: 72 },
      barcode: { x: 92, y: 1262, w: 92, h: 54 },
      coming: { x: 1040, y: 1276, size: 36, align: 'right' },
      scrims: [{ x0: 0, y0: 1000, x1: 0, y1: 1350, from: 0, to: 0.9 }],
      glow: { x: 540, y: 650, r: 520 },
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// 1:1 (1080 x 1080)

/** Hero on the left, five small panels on the right, the title band below. */
export function layoutHeroMosaic1x1(W = 1080, H = 1080) {
  const g = 12;
  const { L, R, T } = frameLines(W, H, g);
  const heroCut = vLine(590, -0.1);
  const r1 = hLine(250, 0.06);
  const r2 = hLine(460, 0.06);
  const low = hLine(680, 0.06);
  const c1 = vLine(840, -0.1);
  const c2 = vLine(830, -0.1);
  const cells = [
    { l: L, r: heroCut, t: T, b: low, role: 'mid', hero: true, tag: 'tl' },
    { l: heroCut, r: c1, t: T, b: r1, role: 'face', tag: 'bl' },
    { l: c1, r: R, t: T, b: r1, role: 'sky' },
    { l: heroCut, r: R, t: r1, b: r2, role: 'wide' },
    { l: heroCut, r: c2, t: r2, b: low, role: 'detail' },
    { l: c2, r: R, t: r2, b: low, role: 'sea' },
  ];
  return {
    id: 'hero-mosaic',
    name: 'Hero Mosaic',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 965, sunX: 540, sunY: 905, sunR: 220 },
    text: {
      title: { x: 50, y: 736, w: 980, h: 226, align: 'center' },
      subtitle: { anchor: 'br', dx: 0, dy: 30, size: 82, rot: -7 },
      tagline: { x: 150, y: 684, w: 780, h: 40, rot: -2, align: 'center' },
      billing: { x: 40, y: 1056, w: 700, align: 'left' },
      quote: { x: 300, y: 560, w: 520, align: 'center' },
      seal: { x: 980, y: 100, r: 70 },
      barcode: { x: 1012, y: 1018, w: 86, h: 50 },
      coming: { x: 955, y: 1058, size: 28, align: 'right' },
      scrims: [{ x0: 0, y0: 440, x1: 600, y1: 680, from: 0, to: 0.75 }],
      glow: { x: 540, y: 860, r: 480 },
    },
  };
}

/** Diagonal strips across the top two thirds, title band below. */
export function layoutDiagonalStrips1x1(W = 1080, H = 1080) {
  const g = 12;
  const { L, R, T } = frameLines(W, H, g);
  const s = 0.24;
  const hB = hLine(680, -0.06);
  const xs = [vLine(230, s), vLine(450, s), vLine(740, s), vLine(910, s)];
  const cells = [
    { l: xs[1], r: xs[2], t: T, b: hB, role: 'mid', hero: true, tag: 'bl' },
    { l: xs[0], r: xs[1], t: T, b: hB, role: 'face', tag: 'bl' },
    { l: L, r: xs[0], t: T, b: hB, role: 'sky' },
    { l: xs[2], r: xs[3], t: T, b: hB, role: 'detail' },
    { l: xs[3], r: R, t: T, b: hB, role: 'sea' },
  ];
  return {
    id: 'diagonal-strips',
    name: 'Diagonal Strips',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 970, sunX: 540, sunY: 915, sunR: 230 },
    text: {
      title: { x: 50, y: 744, w: 980, h: 220, align: 'center' },
      subtitle: { anchor: 'br', dx: 0, dy: 30, size: 82, rot: -7 },
      tagline: { x: 150, y: 692, w: 780, h: 40, rot: -2, align: 'center' },
      billing: { x: 40, y: 1056, w: 700, align: 'left' },
      quote: { x: 540, y: 52, w: 560, align: 'center' },
      seal: { x: 990, y: 560, r: 68 },
      barcode: { x: 1012, y: 1018, w: 86, h: 50 },
      coming: { x: 955, y: 1058, size: 28, align: 'right' },
      scrims: [{ x0: 0, y0: 0, x1: 0, y1: 200, from: 0.7, to: 0 }],
      glow: { x: 540, y: 860, r: 480 },
    },
  };
}

/** Three panels above and three below a slanted sunset band with the title. */
export function layoutSixGrid1x1(W = 1080, H = 1080) {
  const g = 12;
  const { L, R, T, B } = frameLines(W, H, g);
  const s = -0.12;
  const topEnd = hLine(384, 0.06);
  const botStart = hLine(728, 0.06);
  const a1 = vLine(320, s);
  const a2 = vLine(740, s);
  const b1 = vLine(380, s);
  const b2 = vLine(720, s);
  const cells = [
    { l: a1, r: a2, t: T, b: topEnd, role: 'face', hero: true, tag: 'bl' },
    { l: a2, r: R, t: T, b: topEnd, role: 'face', tag: 'br' },
    { l: L, r: a1, t: T, b: topEnd, role: 'sky' },
    { l: L, r: b1, t: botStart, b: B, role: 'detail', tag: 'tl' },
    { l: b1, r: b2, t: botStart, b: B, role: 'wide', tag: 'tl' },
    { l: b2, r: R, t: botStart, b: B, role: 'sea', tag: 'tl' },
  ];
  return {
    id: 'six-grid',
    name: 'Six Grid',
    gutter: g,
    panels: buildPanels(cells, W, H, g),
    scene: { horizon: 660, sunX: 540, sunY: 596, sunR: 180 },
    text: {
      title: { x: 60, y: 430, w: 960, h: 244, align: 'center' },
      subtitle: { anchor: 'br', dx: 0, dy: 26, size: 80, rot: -7 },
      tagline: { x: 190, y: 388, w: 700, h: 38, rot: -2, align: 'center' },
      billing: { x: 40, y: 1058, w: 700, align: 'left' },
      quote: { x: 540, y: 904, w: 640, align: 'center' },
      seal: { x: 110, y: 728, r: 64 },
      barcode: { x: 1012, y: 1018, w: 86, h: 50 },
      coming: { x: 955, y: 1060, size: 28, align: 'right' },
      scrims: [{ x0: 0, y0: 820, x1: 0, y1: 1080, from: 0, to: 0.9 }],
      glow: { x: 540, y: 540, r: 460 },
    },
  };
}

const LAYOUT_BUILDERS = {
  wide: [layoutHeroMosaic16x9, layoutDiagonalStrips16x9, layoutSixGrid16x9],
  portrait: [layoutHeroMosaic4x5, layoutDiagonalStrips4x5, layoutSixGrid4x5],
  square: [layoutHeroMosaic1x1, layoutDiagonalStrips1x1, layoutSixGrid1x1],
};

export const LAYOUT_IDS = ['hero-mosaic', 'diagonal-strips', 'six-grid'];
export const LAYOUT_NAMES = { 'hero-mosaic': 'Hero Mosaic', 'diagonal-strips': 'Diagonal Strips', 'six-grid': 'Six Grid' };

const layoutCache = new Map();

/** The layout for a size key and layout id, composed for that ratio. */
export function getLayout(sizeKey, layoutId) {
  const key = `${sizeKey}:${layoutId}`;
  if (!layoutCache.has(key)) {
    const size = COVER_SIZES[sizeKey];
    const builder = LAYOUT_BUILDERS[sizeKey].find((fn) => fn(size.w, size.h).id === layoutId) ?? LAYOUT_BUILDERS[sizeKey][0];
    layoutCache.set(key, builder(size.w, size.h));
  }
  return layoutCache.get(key);
}
