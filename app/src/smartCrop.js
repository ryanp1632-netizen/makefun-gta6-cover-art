// Smart crops: a small saliency analysis of each photo on a downscaled copy (skin tone, edges, saturation, warm sky,
// blue water, saturated reds) with integral images, used to find the face and to pick a distinct crop box for each
// panel role: a face close-up, a mid shot, a wide shot, the sky (palms against the sun), the sea, or a detail such as
// a car or a fishing reel. All of it runs locally on pixels already in memory.

const ANALYSIS_LONG_SIDE = 160;
const MAPS = ['skin', 'edge', 'sat', 'warm', 'blue', 'red', 'lum'];

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

/** Mean of a map inside an integer rectangle, read from its integral image. */
function meanIn(integral, w, x, y, rw, rh) {
  const W1 = w + 1;
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.max(x0 + 1, Math.round(x + rw));
  const y1 = Math.max(y0 + 1, Math.round(y + rh));
  const s = integral[y1 * W1 + x1] - integral[y0 * W1 + x1] - integral[y1 * W1 + x0] + integral[y0 * W1 + x0];
  return s / ((x1 - x0) * (y1 - y0));
}

/** True when an RGB colour falls in a broad human skin-tone range (YCbCr rule). */
export function isSkinTone(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const mx = Math.max(r, g, b);
  const sat = mx > 0 ? (mx - Math.min(r, g, b)) / mx : 0;
  return y > 55 && y < 215 && sat > 0.2 && sat < 0.62 && cr > 138 && cr < 172 && cb > 92 && cb < 124 && r > g && g > b && r - b > 30;
}

/** Gray-world channel gains (partially applied) so a golden-hour or blue cast does not read as skin or as sky. */
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
  return [Math.pow(m / Math.max(1, r), 0.75), Math.pow(m / Math.max(1, g), 0.75), Math.pow(m / Math.max(1, b), 0.75)];
}

/** Builds the saliency maps and integral images for one photo source (an image, bitmap or canvas). */
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
    maps.sat[i] = sat;
    maps.skin[i] = isSkinTone(Math.min(255, r * gains[0]), Math.min(255, g * gains[1]), Math.min(255, b * gains[2])) ? 1 : 0;
    maps.warm[i] = lum > 0.5 && r > b + 40 && g > b ? Math.min(1, (lum - 0.5) * 2 + 0.3) : 0;
    maps.blue[i] = b > r + 25 && (g > r || b > 150) && sat > 0.25 ? Math.min(1, sat * 1.4) : 0;
    maps.red[i] = r > 110 && r > g * 1.7 && r > b * 1.5 ? Math.min(1, (r - g) / 140) : 0;
    lumSum += lum;
    lumSq += lum * lum;
  }
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
  const analysis = { w, h, scale, integrals, contrast, face: null };
  analysis.face = findSubjectBox(analysis);
  analysis.heroScore = analysis.face.confidence * 0.7 + contrast * 1.2 + meanIn(integrals.warm, w, 0, 0, w, h) * 0.6;
  return analysis;
}

/**
 * Finds the most face-like compact skin region: dense skin in the centre, little skin in the ring around it (hair,
 * hat, sky), some edge detail (eyes, sunglasses, beard), with a preference for the upper part of the frame.
 * Falls back to the most salient region when no face is found. Coordinates are in analysis pixels.
 */
export function findSubjectBox(a) {
  const { w, h, integrals } = a;
  const minDim = Math.min(w, h);
  let best = null;
  for (let s = Math.round(minDim * 0.13); s <= Math.round(minDim * 0.42); s += 2) {
    const step = Math.max(1, Math.round(s / 6));
    for (let y = 0; y + s <= h; y += step) {
      for (let x = 0; x + s <= w; x += step) {
        const inner = meanIn(integrals.skin, w, x, y, s, s);
        if (inner < 0.25) continue;
        const ring = s * 0.45;
        const outerSkin = meanIn(integrals.skin, w, x - ring, y - ring, s + 2 * ring, s + 2 * ring);
        const edges = meanIn(integrals.edge, w, x, y, s, s);
        const cy = (y + s / 2) / h;
        const upper = 1.25 - 0.85 * cy;
        const centre = 1 - 0.7 * Math.abs((x + s / 2) / w - 0.5);
        const score = (inner - 0.55 * outerSkin) * (0.45 + edges * 2.2) * upper * centre * Math.pow(s / minDim, 0.5);
        if (!best || score > best.score) best = { x, y, w: s, h: s, score };
      }
    }
  }
  if (best && best.score > 0.04) {
    return { x: best.x, y: best.y, w: best.w, h: best.h, confidence: Math.min(1, best.score * 4) };
  }
  // no face: take the most detailed, colourful square as the subject
  let sal = null;
  const s = Math.round(minDim * 0.4);
  for (let y = 0; y + s <= h; y += 2) {
    for (let x = 0; x + s <= w; x += 2) {
      const score = meanIn(integrals.edge, w, x, y, s, s) + meanIn(integrals.sat, w, x, y, s, s) * 0.5;
      if (!sal || score > sal.score) sal = { x, y, w: s, h: s, score };
    }
  }
  return { x: sal.x, y: sal.y, w: sal.w, h: sal.h, confidence: 0 };
}

function intersectionArea(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ix * iy;
}

/** Share of box b (e.g. the face) that falls inside window a. */
function coverageOf(a, b) {
  return intersectionArea(a, b) / (b.w * b.h);
}

/** Intersection over union: how much two crops show the same thing at the same scale. */
function iou(a, b) {
  const inter = intersectionArea(a, b);
  return inter / (a.w * a.h + b.w * b.h - inter);
}

function clampWindow(win, w, h) {
  const ww = Math.min(win.w, w);
  const hh = Math.min(win.h, h);
  return { x: Math.min(Math.max(0, win.x), w - ww), y: Math.min(Math.max(0, win.y), h - hh), w: ww, h: hh };
}

/** The largest window of aspect `aspect` (w / h) that fits inside a w x h image. */
function coverFitSize(aspect, w, h) {
  return w / h > aspect ? { w: h * aspect, h } : { w, h: w / aspect };
}

/** A window of the given aspect placed so the face sits at (fx, fy) of it, `heightInFaces` faces tall. */
function windowAroundFace(a, aspect, heightInFaces, fx, fy, minFrac = 0) {
  const face = a.face;
  const fit = coverFitSize(aspect, a.w, a.h);
  let hh = Math.min(fit.h, Math.max(face.h * heightInFaces, fit.h * minFrac));
  let ww = hh * aspect;
  if (ww > fit.w) {
    ww = fit.w;
    hh = ww / aspect;
  }
  // never so tight that the face itself is cut
  if (ww < face.w * 1.25) {
    ww = Math.min(fit.w, face.w * 1.25);
    hh = ww / aspect;
  }
  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2;
  return clampWindow({ x: cx - ww * fx, y: cy - hh * fy, w: ww, h: hh }, a.w, a.h);
}

const ROLE_SCORES = {
  sky: (m) => m.warm * 1.6 + m.blue * 0.5 + m.edge * 0.8 - m.skin * 3 - m.red * 0.5,
  sea: (m) => m.blue * 1.7 + m.edge * 0.6 + m.sat * 0.2 - m.skin * 3,
  detail: (m) => m.edge * 2.6 + Math.min(m.red, 0.3) * 0.8 + m.sat * 0.2 - m.skin * 0.2,
  wide: (m) => m.edge * 1.4 + m.warm * 0.6 + m.sat * 0.2 - m.red * 1.2 - m.skin * 1.2,
};

/**
 * Picks a crop window (analysis pixels) of the given aspect for one panel role, avoiding the face (for background
 * roles) and windows already used on the same photo so that one photo yields several distinct-looking panels.
 * `minFrac` is the smallest window (as a share of the full-fit height) that still looks sharp in the panel.
 */
export function findCropWindow(a, role, aspect, used, minFrac = 0, avoidLooks = []) {
  const withLook = (win, score) => ({ ...win, score, look: windowLook(a, win) });
  if (role === 'face' && a.face.confidence > 0) {
    const tall = aspect < 0.8;
    return withLook(windowAroundFace(a, aspect, tall ? 3.4 : 2.4, 0.5, tall ? 0.3 : 0.44, minFrac), 1);
  }
  if (role === 'mid' && a.face.confidence > 0) {
    return withLook(windowAroundFace(a, aspect, 6, 0.5, 0.26, minFrac), 1);
  }
  const fit = coverFitSize(aspect, a.w, a.h);
  if (role === 'mid' || role === 'face') {
    return withLook(windowAroundFace(a, aspect, 2.6, 0.5, 0.45, minFrac), 0.5);
  }
  const scoreOf = ROLE_SCORES[role] ?? ROLE_SCORES.wide;
  const base = role === 'wide' ? [0.85, 0.72, 0.6] : role === 'detail' ? [0.55, 0.45, 0.36] : [0.75, 0.6, 0.48];
  const fractions = [...new Set(base.map((f) => Math.min(1, Math.max(f, minFrac))))];
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
        // dark, flat windows (clothes, shadows) make muddy panels
        score -= Math.max(0, 0.36 - m.lum) * 2.5 + Math.max(0, 0.08 - m.edge) * 3;
        // scenes live in the upper part of most people photos; the bottom is usually clothes or ground
        if (role === 'wide' || role === 'sky' || role === 'sea') score -= Math.max(0, (y + hh / 2) / a.h - 0.55) * (role === 'sea' ? 2.2 : 0.9);
        if (a.face.confidence > 0) score -= coverageOf(win, a.face) * (role === 'wide' ? 1 : 1.6);
        for (const u of used) score -= iou(win, u) * 1.3;
        if (avoidLooks.length) {
          const look = lookOf(m);
          score -= 0.6 * Math.max(...avoidLooks.map((l) => lookSimilarity(look, l)));
        }
        if (!best || score > best.score) best = { ...win, score };
      }
    }
  }
  return { ...best, look: windowLook(a, best) };
}

/** A small content signature of a window: warm light, blue water/sky, reds, skin, detail and brightness. */
function lookOf(m) {
  return [m.warm, m.blue, m.red, m.skin, m.edge * 2, m.lum];
}

/** The content signature of a window, read from the integral images. */
export function windowLook(a, win) {
  const m = {};
  for (const k of MAPS) m[k] = meanIn(a.integrals[k], a.w, win.x, win.y, win.w, win.h);
  return lookOf(m);
}

/** 1 for crops that look alike (e.g. two stretches of open sea), towards 0 for different-looking ones. */
export function lookSimilarity(p, q) {
  let d = 0;
  for (let i = 0; i < p.length; i++) d += Math.abs(p[i] - q[i]);
  return Math.exp(-d * 3);
}

/** Converts a crop window (analysis pixels) into a panel crop state: centre (0..1) and zoom over cover-fit. */
export function windowToCrop(a, win, aspect) {
  const fit = coverFitSize(aspect, a.w, a.h);
  return {
    cx: (win.x + win.w / 2) / a.w,
    cy: (win.y + win.h / 2) / a.h,
    zoom: Math.max(1, fit.h / win.h),
  };
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
