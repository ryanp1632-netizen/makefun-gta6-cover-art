// Smart crops for Golden Mile Cover Studio. Each photo gets a small saliency analysis on a downscaled copy (soft
// skin-tone likelihood, local contrast, saturation, warm sky, blue water, saturated reds, brightness) kept as
// integral images. With a person in the photo, frameHeadInFocus() places the crop box so the whole head and the
// shoulders land inside the panel's free area (the part no lettering covers), never cutting the top of the head or
// the chin. Without a face, or to vary a photo used in several panels, findSceneWindow() picks distinct background
// crops (palms against the sun, the sea, a detail). Everything runs locally on pixels already in memory.

import { findFaceBox, headBoxOf, meanIn, portraitQuality, skinLikelihood } from './faceFinder.js';

const ANALYSIS_LONG_SIDE = 160;
const MAPS = ['skin', 'edge', 'sat', 'warm', 'blue', 'red', 'lum', 'lum2'];

/** Summed-area table of a w x h float map, (w + 1) x (h + 1) entries. */
function buildIntegral(map, w, h) {
  const W1 = w + 1;
  const sat = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += map[y * w + x];
      sat[(y + 1) * W1 + x + 1] = sat[y * W1 + x + 1] + row;
    }
  }
  return sat;
}

/** Gray-world channel gains (partly applied) so a golden-hour or neon cast does not hide skin or fake it. */
function castCorrectionGains(px, n) {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < n; i++) {
    r += px[i * 4];
    g += px[i * 4 + 1];
    b += px[i * 4 + 2];
  }
  const m = (r + g + b) / 3;
  return [Math.pow(m / Math.max(1, r), 0.6), Math.pow(m / Math.max(1, g), 0.6), Math.pow(m / Math.max(1, b), 0.6)];
}

/** Builds the saliency maps, integral images, face box and portrait quality for one photo source. */
export function analyzePhoto(source, width, height) {
  const scale = ANALYSIS_LONG_SIDE / Math.max(width, height);
  const w = Math.max(8, Math.round(width * scale));
  const h = Math.max(8, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const maps = Object.fromEntries(MAPS.map((k) => [k, new Float32Array(n)]));
  const gains = castCorrectionGains(px, n);
  let lumSum = 0;
  let lumSq = 0;
  for (let i = 0; i < n; i++) {
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const sat = mx > 0 ? (mx - mn) / mx : 0;
    maps.lum[i] = lum;
    maps.lum2[i] = lum * lum;
    maps.sat[i] = sat;
    const corrected = skinLikelihood(Math.min(255, r * gains[0]), Math.min(255, g * gains[1]), Math.min(255, b * gains[2]));
    maps.skin[i] = Math.max(corrected, skinLikelihood(r, g, b) * 0.8);
    maps.warm[i] = lum > 0.5 && r > b + 40 && g > b ? Math.min(1, (lum - 0.5) * 2 + 0.3) : 0;
    maps.blue[i] = b > r + 25 && (g > r || b > 150) && sat > 0.25 ? Math.min(1, sat * 1.4) : 0;
    maps.red[i] = r > 110 && r > g * 1.7 && r > b * 1.5 ? Math.min(1, (r - g) / 140) : 0;
    lumSum += lum;
    lumSq += lum * lum;
  }
  // local contrast: luminance gradient magnitude
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = maps.lum[i + 1] - maps.lum[i - 1];
      const gy = maps.lum[i + w] - maps.lum[i - w];
      maps.edge[i] = Math.min(1, Math.hypot(gx, gy) * 3);
    }
  }
  const integrals = Object.fromEntries(MAPS.map((k) => [k, buildIntegral(maps[k], w, h)]));
  const mean = lumSum / n;
  const contrast = Math.sqrt(Math.max(0, lumSq / n - mean * mean));
  const analysis = { w, h, scale, integrals, contrast, face: null, skinMap: maps.skin };
  analysis.face = findFaceBox(analysis);
  analysis.quality = portraitQuality(analysis);
  return analysis;
}

/** The largest window of aspect `aspect` (w / h) that fits inside a w x h image. */
export function coverFitSize(aspect, w, h) {
  return w / h > aspect ? { w: h * aspect, h } : { w, h: w / aspect };
}

/** The head box of a photo in photo pixels (clipped to the photo). */
export function headBoxInPhoto(photo) {
  const a = photo.analysis;
  const hb = headBoxOf(a.face);
  const x0 = Math.max(0, hb.x / a.scale);
  const y0 = Math.max(0, hb.y / a.scale);
  const x1 = Math.min(photo.w, (hb.x + hb.w) / a.scale);
  const y1 = Math.min(photo.h, (hb.y + hb.h) / a.scale);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** Converts a crop window (photo pixels, panel aspect) into a panel crop state: centre (0..1), zoom over cover-fit. */
export function windowToCrop(photoW, photoH, win, aspect) {
  const fit = coverFitSize(aspect, photoW, photoH);
  return { cx: (win.x + win.w / 2) / photoW, cy: (win.y + win.h / 2) / photoH, zoom: Math.max(1, fit.h / win.h) };
}

/** The source rectangle (photo pixels) that a crop state shows in a panel of the given aspect. */
export function cropToSourceRect(photoW, photoH, crop, aspect) {
  const fit = coverFitSize(aspect, photoW, photoH);
  const zoom = Math.max(1, crop.zoom);
  const w = fit.w / zoom;
  const h = fit.h / zoom;
  const x = Math.min(Math.max(0, crop.cx * photoW - w / 2), photoW - w);
  const y = Math.min(Math.max(0, crop.cy * photoH - h / 2), photoH - h);
  return { x, y, w, h };
}

/** Where a photo's head lands on the cover (design pixels) for a panel's crop entry, honouring the flip. */
export function headRectInPanel(photo, entry, panel) {
  const b = panel.bounds;
  const src = cropToSourceRect(photo.w, photo.h, entry, b.w / b.h);
  const head = headBoxInPhoto(photo);
  const k = b.w / src.w;
  let x = b.x + (head.x - src.x) * k;
  if (entry.flip) x = b.x + b.w - (head.x + head.w - src.x) * k;
  return { x, y: b.y + (head.y - src.y) * k, w: head.w * k, h: head.h * k };
}

/** Share of rectangle `inner` that lies inside rectangle `outer`. */
export function shareInside(inner, outer) {
  const ix = Math.max(0, Math.min(inner.x + inner.w, outer.x + outer.w) - Math.max(inner.x, outer.x));
  const iy = Math.max(0, Math.min(inner.y + inner.h, outer.y + outer.h) - Math.max(inner.y, outer.y));
  return (ix * iy) / Math.max(1, inner.w * inner.h);
}

/** How tightly each framing style shows the head: the share of the free area's height the head box fills. */
const HEAD_SHARE = { portrait: 0.6, closeup: 0.86, mid: 0.4 };

/** One framing attempt at scale s (photo pixels per design pixel): the window, its crop and where the head lands. */
function framingAtScale(photo, panel, head, s, style) {
  const b = panel.bounds;
  const focus = panel.focus ?? b;
  const ww = b.w * s;
  const wh = b.h * s;
  const headH = head.h / s;
  const headTop = focus.y + Math.max(focus.h * 0.05, (focus.h - headH) * (style === 'closeup' ? 0.5 : 0.26));
  const focusCx = focus.x + focus.w / 2;
  const x = Math.min(Math.max(0, head.x + head.w / 2 - (focusCx - b.x) * s), photo.w - ww);
  const y = Math.min(Math.max(0, head.y - (headTop - b.y) * s), photo.h - wh);
  const win = { x, y, w: ww, h: wh };
  const crop = { photoId: photo.id, ...windowToCrop(photo.w, photo.h, win, b.w / b.h), flip: false };
  const onCover = headRectInPanel(photo, crop, panel);
  return { crop, win, onCover, fit: shareInside(onCover, focus) };
}

/**
 * Frames a person in a panel: picks the crop window so the head box (hair to chin) lies inside the panel's free
 * area (`panel.focus`, design pixels, the part no lettering covers), centred across it, with headroom above and the
 * shoulders below, ideally filling the style's share of the free area's height. Scales from a sensible maximum
 * upscale to the whole photo are tried, because a photo with little headroom can only put the head lower in a
 * panel by zooming in. Returns the crop entry and `fit`, how much of the head is inside the free area (1 = all).
 */
export function frameHeadInFocus(photo, panel, style = 'portrait') {
  const b = panel.bounds;
  const focus = panel.focus ?? b;
  const head = headBoxInPhoto(photo);
  const share = HEAD_SHARE[style] ?? HEAD_SHARE.portrait;
  // in a tall, narrow free area the head is sized by its width, not its height, so it stays near the top
  const sIdeal = Math.max(head.h / (share * Math.min(focus.h, focus.w * 1.3)), head.w / (0.72 * focus.w));
  const sMax = Math.min(photo.w / b.w, photo.h / b.h);
  const sMin = Math.min(sMax, 1 / 2.4);
  let best = null;
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const s = sMin * Math.pow(sMax / sMin, i / steps);
    const f = framingAtScale(photo, panel, head, s, style);
    // whole head inside the free area first, then closeness to the ideal framing
    const score = f.fit * 8 - Math.abs(Math.log(s / Math.min(sMax, Math.max(sMin, sIdeal))));
    if (!best || score > best.score) best = { ...f, score };
  }
  return { crop: best.crop, fit: best.fit, win: best.win, headOnCover: best.onCover };
}

const ROLE_SCORES = {
  sky: (m) => m.warm * 1.6 + m.blue * 0.5 + m.edge * 0.8 - m.skin * 3 - m.red * 0.5,
  sea: (m) => m.blue * 1.7 + m.edge * 0.6 + m.sat * 0.2 - m.skin * 3,
  detail: (m) => m.edge * 2.6 + Math.min(m.red, 0.3) * 0.8 + m.sat * 0.2 - m.skin * 0.2,
  wide: (m) => m.edge * 1.4 + m.warm * 0.6 + m.sat * 0.2 - m.red * 1.2 - m.skin * 1.2,
};

function intersectionArea(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ix * iy;
}

function iou(a, b) {
  const inter = intersectionArea(a, b);
  return inter / (a.w * a.h + b.w * b.h - inter);
}

/**
 * A background crop (analysis pixels) of the given aspect for a scene role (sky, sea, detail, wide), kept off the
 * face and away from windows already used on the same photo, so one photo can fill several distinct panels.
 */
export function findSceneWindow(a, role, aspect, used = []) {
  const fit = coverFitSize(aspect, a.w, a.h);
  const scoreOf = ROLE_SCORES[role] ?? ROLE_SCORES.wide;
  const fractions = role === 'wide' ? [0.9, 0.75, 0.62] : role === 'detail' ? [0.6, 0.5, 0.42] : [0.78, 0.64, 0.52];
  const face = a.face;
  let best = null;
  for (const f of fractions) {
    const hh = fit.h * f;
    const ww = hh * aspect;
    const step = Math.max(1, Math.round(Math.min(ww, hh) / 10));
    for (let y = 0; y + hh <= a.h + 0.01; y += step) {
      for (let x = 0; x + ww <= a.w + 0.01; x += step) {
        const m = {};
        for (const k of MAPS) m[k] = meanIn(a.integrals[k], a.w, x, y, ww, hh);
        const win = { x, y, w: ww, h: hh };
        let score = scoreOf(m);
        score -= Math.max(0, 0.34 - m.lum) * 2.5 + Math.max(0, 0.08 - m.edge) * 3;
        if (face.confidence > 0) score -= (intersectionArea(win, face) / (face.w * face.h)) * 1.4;
        for (const u of used) score -= iou(win, u) * 1.4;
        if (!best || score > best.score) best = { ...win, score };
      }
    }
  }
  return best;
}

/** A scene crop entry for a panel (no face), from findSceneWindow, plus the window used (analysis pixels). */
export function sceneCropForPanel(photo, panel, role, used = [], flip = false) {
  const a = photo.analysis;
  const aspect = panel.bounds.w / panel.bounds.h;
  const win = findSceneWindow(a, role, aspect, used);
  const photoWin = { x: win.x / a.scale, y: win.y / a.scale, w: win.w / a.scale, h: win.h / a.scale };
  return { crop: { photoId: photo.id, ...windowToCrop(photo.w, photo.h, photoWin, aspect), flip }, win };
}
