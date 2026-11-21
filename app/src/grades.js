// Colour grading on pixel data. Two stages:
//   1. autoExposePanel — per panel, before grading: levels stretch + face-weighted gamma + dehaze, so a dark or hazy
//      photo never looks muddy and faces stay bright (renderCover then sharpens the face area).
//   2. applyColourGrade — over the whole poster: tone curve (lift/gamma/gain), contrast S-curve, saturation, split
//      toning (shadows / highlights), vignette, halftone dots, film grain; then bloom and light leaks on the canvas.
// The five named grades are thin wrappers so each look can be read on its own. Skin-like pixels keep their own warm
// hue under every grade (see photoFinish.js), and one shared film grain goes over the whole poster. A panel whose own
// photo is strongly neon-night (measurePanelNeon) mixes toward a night look under the warm grades
// (neonPanelGradeMix), so its magenta and cyan survive as a cool accent instead of being flattened to gold.

import { skinToneWeight, addFilmGrain } from './photoFinish.js';

export const GRADES = {
  sunsetGold: {
    key: 'sunsetGold', label: 'Sunset Gold',
    lift: [0.02, 0.0, 0.045], gamma: [0.95, 1.02, 1.12], gain: [1.07, 1.0, 0.9],
    contrast: 0.4, saturation: 1.24, vibrance: 0.25,
    shadowTint: [0.62, 0.12, 0.6], highlightTint: [1.0, 0.72, 0.32], toneAmount: 0.2,
    vignette: 0.46, grain: 0.035, halftone: 0,
    bloom: { threshold: 0.76, amount: 0.3, radius: 0.016, tint: [1.0, 0.7, 0.4] },
    leaks: [
      { x: 1.02, y: -0.05, r: 0.42, color: [255, 150, 40], alpha: 0.26 },
      { x: -0.05, y: 1.05, r: 0.45, color: [255, 40, 130], alpha: 0.28 },
    ],
    letter: {
      fill: ['#fff9b0', '#ffd23a', '#ff8a1f', '#ff3d6e', '#e0127e'],
      outline: '#1d0a2e', rim: '#fff3d6', extrudeNear: '#7a1150', extrudeFar: '#16051c',
      stripe: '#5a0f3f', script: '#ff3fa4', scriptCore: '#fff4fb',
      ribbon: ['#ff2d87', '#ff8a1f'], ribbonText: '#fffaf0', tagBg: '#16081f', tagAccent: '#ffcc33',
      seal: ['#ffe07a', '#f2a01a'], sealInk: '#2a0b24', glow: [255, 120, 60], frame: '#fff1d2', bg: '#14071c',
    },
  },
  neonNight: {
    key: 'neonNight', label: 'Neon Night',
    lift: [0.02, 0.01, 0.06], gamma: [1.0, 1.06, 0.96], gain: [1.03, 0.97, 1.08],
    contrast: 0.36, saturation: 1.3, vibrance: 0.3,
    shadowTint: [0.1, 0.35, 0.75], highlightTint: [1.0, 0.4, 0.84], toneAmount: 0.24,
    vignette: 0.5, grain: 0.04, halftone: 0,
    bloom: { threshold: 0.7, amount: 0.42, radius: 0.02, tint: [1.0, 0.4, 0.9] },
    leaks: [
      { x: 1.05, y: 0.1, r: 0.45, color: [255, 40, 200], alpha: 0.32 },
      { x: -0.05, y: 0.95, r: 0.5, color: [20, 220, 255], alpha: 0.32 },
    ],
    letter: {
      fill: ['#ffffff', '#9ff7ff', '#38d6ff', '#c84dff', '#ff2fb3'],
      outline: '#08051f', rim: '#e9fbff', extrudeNear: '#3a0f7a', extrudeFar: '#05031a',
      stripe: '#2a0b5c', script: '#ff2fd0', scriptCore: '#fff2fe',
      ribbon: ['#00c8ff', '#b14dff'], ribbonText: '#ffffff', tagBg: '#070418', tagAccent: '#38f0ff',
      seal: ['#9ff7ff', '#39a9ff'], sealInk: '#0a0730', glow: [200, 60, 255], frame: '#e6f8ff', bg: '#05041a',
    },
  },
  tropicTeal: {
    key: 'tropicTeal', label: 'Tropic Teal',
    lift: [0.02, 0.06, 0.07], gamma: [0.94, 0.96, 1.0], gain: [1.05, 1.02, 0.96],
    contrast: 0.2, saturation: 1.16, vibrance: 0.25,
    shadowTint: [0.0, 0.52, 0.56], highlightTint: [1.0, 0.78, 0.55], toneAmount: 0.28,
    vignette: 0.36, grain: 0.03, halftone: 0,
    bloom: { threshold: 0.72, amount: 0.45, radius: 0.016, tint: [1.0, 0.85, 0.6] },
    leaks: [
      { x: 1.02, y: -0.04, r: 0.5, color: [255, 190, 90], alpha: 0.45 },
      { x: -0.04, y: 1.04, r: 0.45, color: [0, 230, 200], alpha: 0.3 },
    ],
    letter: {
      fill: ['#fffbe0', '#ffe066', '#ffb03a', '#ff6a4d', '#ff3a6e'],
      outline: '#032a33', rim: '#fff8e8', extrudeNear: '#0a6470', extrudeFar: '#021a20',
      stripe: '#0b4b55', script: '#22f2d8', scriptCore: '#f2fffd',
      ribbon: ['#00b3a7', '#00d4c0'], ribbonText: '#ffffff', tagBg: '#03262d', tagAccent: '#ffd23f',
      seal: ['#fff0a0', '#ffb43a'], sealInk: '#05333b', glow: [0, 200, 190], frame: '#fff6e0', bg: '#04232a',
    },
  },
  ultraviolet: {
    key: 'ultraviolet', label: 'Ultraviolet',
    lift: [0.04, 0.0, 0.09], gamma: [0.98, 1.06, 0.94], gain: [1.02, 0.94, 1.08],
    contrast: 0.32, saturation: 1.16, vibrance: 0.2,
    shadowTint: [0.36, 0.06, 0.8], highlightTint: [1.0, 0.6, 0.95], toneAmount: 0.3,
    vignette: 0.48, grain: 0.04, halftone: 0,
    bloom: { threshold: 0.66, amount: 0.6, radius: 0.02, tint: [0.9, 0.5, 1.0] },
    leaks: [
      { x: 1.0, y: 0.0, r: 0.55, color: [200, 80, 255], alpha: 0.45 },
      { x: 0.0, y: 1.0, r: 0.5, color: [255, 60, 150], alpha: 0.35 },
    ],
    letter: {
      fill: ['#fff0ff', '#f7a8ff', '#d36bff', '#8f4bff', '#ff3d9e'],
      outline: '#12042b', rim: '#fbe8ff', extrudeNear: '#4b0f86', extrudeFar: '#0c0220',
      stripe: '#3b0b6b', script: '#ff5ad1', scriptCore: '#fff5ff',
      ribbon: ['#8f4bff', '#ff3d9e'], ribbonText: '#ffffff', tagBg: '#12052a', tagAccent: '#ff7ae0',
      seal: ['#f7c6ff', '#c06bff'], sealInk: '#1d0640', glow: [170, 60, 255], frame: '#f6e8ff', bg: '#0d0322',
    },
  },
  retroPrint: {
    key: 'retroPrint', label: 'Retro Print',
    lift: [0.1, 0.07, 0.05], gamma: [0.96, 1.0, 1.08], gain: [1.0, 0.95, 0.84],
    contrast: 0.26, saturation: 0.92, vibrance: 0,
    shadowTint: [0.45, 0.15, 0.12], highlightTint: [1.0, 0.88, 0.66], toneAmount: 0.26,
    vignette: 0.4, grain: 0.07, halftone: 0.34,
    bloom: { threshold: 0.8, amount: 0.25, radius: 0.012, tint: [1.0, 0.85, 0.6] },
    leaks: [{ x: 1.03, y: 0.02, r: 0.5, color: [255, 120, 40], alpha: 0.35 }],
    letter: {
      fill: ['#fff6dc', '#ffd36e', '#ff9b3d', '#e8452c', '#c21f2f'],
      outline: '#1f0f08', rim: '#fff2d8', extrudeNear: '#6e1d14', extrudeFar: '#1a0905',
      stripe: '#5e1a12', script: '#ff6a3d', scriptCore: '#fff6ea',
      ribbon: ['#d6362a', '#f08a2a'], ribbonText: '#fff8ea', tagBg: '#1f0f08', tagAccent: '#f5c04a',
      seal: ['#ffe9a8', '#e8a33a'], sealInk: '#2a1208', glow: [255, 140, 60], frame: '#fff1d8', bg: '#1a0d08',
    },
  },
};

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

// ---------------------------------------------------------------- per-panel auto exposure

/**
 * Auto-expose a panel's pixels in place: stretch levels between robust black/white points, then pick a gamma that
 * brings the face (or panel centre) to a bright, clear mid-tone, and add a gentle dehaze curve when contrast is low.
 */
export function autoExposePanel(imageData, faceRect) {
  const { data, width, height } = imageData;
  const hist = new Uint32Array(256);
  const faceHist = new Uint32Array(256);
  const fx0 = faceRect ? Math.max(0, Math.floor(faceRect.x + faceRect.w * 0.2)) : Math.floor(width * 0.3);
  const fx1 = faceRect ? Math.min(width, Math.ceil(faceRect.x + faceRect.w * 0.8)) : Math.ceil(width * 0.7);
  const fy0 = faceRect ? Math.max(0, Math.floor(faceRect.y + faceRect.h * 0.35)) : Math.floor(height * 0.2);
  const fy1 = faceRect ? Math.min(height, Math.ceil(faceRect.y + faceRect.h * 0.9)) : Math.ceil(height * 0.6);
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 40000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const l = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
      hist[l]++;
      if (x >= fx0 && x < fx1 && y >= fy0 && y < fy1) faceHist[l]++;
    }
  }
  const pct = (h, p) => {
    let total = 0;
    for (let i = 0; i < 256; i++) total += h[i];
    if (!total) return -1;
    let acc = 0;
    for (let i = 0; i < 256; i++) { acc += h[i]; if (acc >= total * p) return i; }
    return 255;
  };
  const meanOf = (h) => {
    let total = 0;
    let sum = 0;
    for (let i = 0; i < 256; i++) { total += h[i]; sum += h[i] * i; }
    return total ? sum / total : 128;
  };
  const black = Math.min(42, Math.max(0, pct(hist, 0.006)));
  const white = Math.max(196, pct(hist, 0.996));
  const range = Math.max(1, white - black);
  const faceMean = (meanOf(faceHist.some((v) => v) ? faceHist : hist) - black) / range;
  const target = 0.6;
  let gamma = Math.log(target) / Math.log(Math.min(0.95, Math.max(0.05, faceMean)));
  gamma = Math.min(1.25, Math.max(0.52, gamma));
  const spread = (pct(hist, 0.95) - pct(hist, 0.05)) / 255;
  const dehaze = spread < 0.55 ? (0.55 - spread) * 0.9 : 0;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    let t = Math.min(1, Math.max(0, (v - black) / range));
    t = Math.pow(t, gamma);
    if (dehaze > 0) t = t + dehaze * (t - 0.5) * (1 - Math.abs(2 * t - 1));
    lut[v] = clamp255(t * 255);
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
  return { black, white, gamma, dehaze };
}

// ---------------------------------------------------------------- whole-poster grade

function buildToneLut(grade, channel) {
  const lut = new Float32Array(256);
  const lift = grade.lift[channel];
  const gamma = grade.gamma[channel];
  const gain = grade.gain[channel];
  const k = grade.contrast;
  for (let v = 0; v < 256; v++) {
    let t = v / 255;
    t = Math.pow(t, gamma);
    t = lift + t * (gain - lift);
    // S-curve around 0.5 for contrast.
    t = t + k * (t - 0.5) * (1 - Math.abs(2 * t - 1)) * 1.6;
    lut[v] = Math.min(1, Math.max(0, t)) * 255;
  }
  return lut;
}

// ---------------------------------------------------------------- neon panels keep their night colours

/**
 * How strongly neon-night a photo or panel is, in [0, 1]: the share of saturated, lit magenta, violet or cyan
 * pixels (skin excluded), counted only in a dark (night) frame that has some magenta in it. A golden-hour photo or a
 * bright turquoise sea scores near 0; a street at night lit by pink and cyan signs scores high.
 */
export function measurePanelNeon(imageData) {
  const { data, width, height } = imageData;
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 30000)));
  let neon = 0;
  let magenta = 0;
  let total = 0;
  let lumSum = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      total++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      lumSum += 0.299 * r + 0.587 * g + 0.114 * b;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      if (mx < 70 || mx - mn < mx * 0.38) continue;
      if (skinToneWeight(r, g, b) > 0.3) continue;
      // Hue in degrees.
      const d = mx - mn;
      let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
      if (h >= 165 && h <= 215) neon++;
      else if (h >= 255 && h <= 345) { neon++; magenta++; }
    }
  }
  if (!total) return 0;
  const meanLum = lumSum / total / 255;
  // Panels are measured after auto-exposure has lifted them, so "night" allows mid-tones; a sunlit sea fails it.
  const night = Math.min(1, Math.max(0, (0.62 - meanLum) / 0.12));
  const pink = Math.min(1, magenta / total / 0.03);
  return (neon / total) * night * pink;
}

/**
 * How much of a panel keeps a neon-friendly grade instead of the poster's main one (0..0.7). Only clearly neon
 * panels qualify, so golden-hour photos still take the main grade in full and the poster keeps one colour story.
 */
export function neonPanelGradeMix(neonShare, gradeKey) {
  if (gradeKey !== 'sunsetGold' && gradeKey !== 'tropicTeal' && gradeKey !== 'retroPrint') return 0;
  const t = Math.min(1, Math.max(0, (neonShare - 0.1) / 0.16));
  return 0.7 * t * t * (3 - 2 * t);
}

/** The look a neon panel is mixed toward: night contrast and colour that keeps magenta and cyan alive. */
export const NEON_KEEP_GRADE = {
  key: 'neonKeep',
  lift: [0.01, 0.0, 0.03], gamma: [1.0, 1.02, 0.97], gain: [1.04, 0.99, 1.04],
  contrast: 0.38, saturation: 1.22, vibrance: 0.22,
  shadowTint: [0.2, 0.25, 0.7], highlightTint: [1.0, 0.55, 0.85], toneAmount: 0.16,
};

/** Grade pixels in place. `scale` is output px per design px (keeps grain and dots consistent across sizes). */
export function applyColourGrade(imageData, grade, scale = 1, keep = null) {
  const { data, width, height } = imageData;
  const lr = buildToneLut(grade, 0);
  const lg = buildToneLut(grade, 1);
  const lb = buildToneLut(grade, 2);
  const alt = NEON_KEEP_GRADE;
  const ar = keep ? buildToneLut(alt, 0) : null;
  const ag = keep ? buildToneLut(alt, 1) : null;
  const ab = keep ? buildToneLut(alt, 2) : null;
  const sat = grade.saturation;
  const vib = grade.vibrance || 0;
  const [sr, sg, sb] = grade.shadowTint;
  const [hr, hg, hb] = grade.highlightTint;
  const amt = grade.toneAmount;
  const vig = grade.vignette;
  const half = grade.halftone;
  const skinKeep = grade.skinKeep ?? 0.6;
  const cx = width / 2;
  const cy = height / 2;
  const maxD = Math.sqrt(cx * cx + cy * cy);
  const period = Math.max(3, 7 * scale);
  const cosA = Math.cos(0.26);
  const sinA = Math.sin(0.26);
  for (let y = 0; y < height; y++) {
    const dy = (y - cy) / maxD;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r0 = data[i];
      const g0 = data[i + 1];
      const b0 = data[i + 2];
      let r = lr[r0];
      let g = lg[g0];
      let b = lb[b0];
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // Saturation with vibrance (muted colours gain more).
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const curSat = mx > 0 ? (mx - mn) / mx : 0;
      const s = sat + vib * (1 - curSat);
      const L = l * 255;
      r = L + (r - L) * s;
      g = L + (g - L) * s;
      b = L + (b - L) * s;
      // Split toning: soft-light style pull toward the tint colours.
      const ws = (1 - l) * (1 - l) * amt;
      const wh = l * l * amt;
      r += (sr * 255 - 128) * ws + (hr * 255 - 128) * wh;
      g += (sg * 255 - 128) * ws + (hg * 255 - 128) * wh;
      b += (sb * 255 - 128) * ws + (hb * 255 - 128) * wh;
      // Neon panels: mix toward a night look that keeps their magenta and cyan instead of flattening them to gold.
      const kk = keep ? keep[y * width + x] : 0;
      if (kk > 0) {
        const m = kk / 255;
        let r2 = ar[r0];
        let g2 = ag[g0];
        let b2 = ab[b0];
        const l2 = (0.299 * r2 + 0.587 * g2 + 0.114 * b2) / 255;
        const mx2 = Math.max(r2, g2, b2);
        const s2 = alt.saturation + alt.vibrance * (1 - (mx2 > 0 ? (mx2 - Math.min(r2, g2, b2)) / mx2 : 0));
        const L2 = l2 * 255;
        r2 = L2 + (r2 - L2) * s2;
        g2 = L2 + (g2 - L2) * s2;
        b2 = L2 + (b2 - L2) * s2;
        const ws2 = (1 - l2) * (1 - l2) * alt.toneAmount;
        const wh2 = l2 * l2 * alt.toneAmount;
        r2 += (alt.shadowTint[0] * 255 - 128) * ws2 + (alt.highlightTint[0] * 255 - 128) * wh2;
        g2 += (alt.shadowTint[1] * 255 - 128) * ws2 + (alt.highlightTint[1] * 255 - 128) * wh2;
        b2 += (alt.shadowTint[2] * 255 - 128) * ws2 + (alt.highlightTint[2] * 255 - 128) * wh2;
        r += (r2 - r) * m;
        g += (g2 - g) * m;
        b += (b2 - b) * m;
      }
      // Skin protection: on skin-like pixels, keep the graded brightness but bring back the photo's own warm hue,
      // so no grade turns faces grey, green or magenta.
      const sw = skinToneWeight(r0, g0, b0) * skinKeep;
      if (sw > 0.01) {
        const l0 = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
        const lg2 = Math.max(l0 * 0.92, 0.299 * r + 0.587 * g + 0.114 * b);
        const pr = lg2 + (r0 - l0) * 1.12 + 6;
        const pg = lg2 + (g0 - l0) * 1.12 + 1;
        const pb = lg2 + (b0 - l0) * 1.12 - 5;
        r += (pr - r) * sw;
        g += (pg - g) * sw;
        b += (pb - b) * sw;
      }
      // Vignette.
      const dx = (x - cx) / maxD;
      const d2 = dx * dx * 0.8 + dy * dy * 1.2;
      const v = 1 - vig * Math.min(1, d2 * 1.15) * Math.min(1, d2 * 1.15);
      r *= v;
      g *= v;
      b *= v;
      // Halftone dots (print look): darken outside a dot whose radius grows with darkness.
      if (half > 0) {
        const u = (x * cosA + y * sinA) / period;
        const w = (-x * sinA + y * cosA) / period;
        const fu = u - Math.floor(u) - 0.5;
        const fw = w - Math.floor(w) - 0.5;
        const dist = Math.sqrt(fu * fu + fw * fw);
        const radius = 0.62 * Math.sqrt(Math.max(0, 1 - l));
        if (dist < radius) {
          r *= 1 - half;
          g *= 1 - half * 1.05;
          b *= 1 - half * 1.1;
        }
      }
      data[i] = clamp255(r);
      data[i + 1] = clamp255(g);
      data[i + 2] = clamp255(b);
    }
  }
}

/** Bloom: threshold a quarter-size copy, blur it and screen it back over the poster. */
export function applyBloom(ctx, grade, pw, ph) {
  const b = grade.bloom;
  if (!b || b.amount <= 0) return;
  const sw = Math.max(8, Math.round(pw / 4));
  const sh = Math.max(8, Math.round(ph / 4));
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const img = sctx.getImageData(0, 0, sw, sh);
  const d = img.data;
  const t = b.threshold * 255;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const k = Math.max(0, (l - t) / (255 - t));
    d[i] = clamp255(d[i] * k * b.tint[0] * 1.3);
    d[i + 1] = clamp255(d[i + 1] * k * b.tint[1] * 1.3);
    d[i + 2] = clamp255(d[i + 2] * k * b.tint[2] * 1.3);
  }
  sctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = b.amount;
  ctx.filter = `blur(${Math.max(2, Math.round(b.radius * Math.max(pw, ph)))}px)`;
  ctx.drawImage(small, 0, 0, pw, ph);
  ctx.restore();
}

/** Light leaks: big soft coloured blooms screened in from the corners. */
export function applyLightLeaks(ctx, grade, pw, ph) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  const m = Math.max(pw, ph);
  for (const leak of grade.leaks || []) {
    const x = leak.x * pw;
    const y = leak.y * ph;
    const r = leak.r * m;
    const [cr, cg, cb] = leak.color;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},${leak.alpha})`);
    grad.addColorStop(0.45, `rgba(${cr},${cg},${cb},${leak.alpha * 0.35})`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, pw, ph);
  }
  ctx.restore();
}

/**
 * Grade the whole canvas with one look (pixel pass + bloom + light leaks). `keep` (optional, one byte per device
 * pixel) marks neon panels that mix toward NEON_KEEP_GRADE.
 */
export function gradeCanvas(ctx, grade, pw, ph, scale, keep = null) {
  const img = ctx.getImageData(0, 0, pw, ph);
  applyColourGrade(img, grade, scale, keep);
  addFilmGrain(img, grade.grain * Math.min(1, Math.max(0.35, scale)));
  ctx.putImageData(img, 0, 0);
  applyBloom(ctx, grade, pw, ph);
  applyLightLeaks(ctx, grade, pw, ph);
}

export const applySunsetGoldGrade = (ctx, pw, ph, scale, keep) => gradeCanvas(ctx, GRADES.sunsetGold, pw, ph, scale, keep);
export const applyNeonNightGrade = (ctx, pw, ph, scale, keep) => gradeCanvas(ctx, GRADES.neonNight, pw, ph, scale, keep);
export const applyTropicTealGrade = (ctx, pw, ph, scale, keep) => gradeCanvas(ctx, GRADES.tropicTeal, pw, ph, scale, keep);
export const applyUltravioletGrade = (ctx, pw, ph, scale, keep) => gradeCanvas(ctx, GRADES.ultraviolet, pw, ph, scale, keep);
export const applyRetroPrintGrade = (ctx, pw, ph, scale, keep) => gradeCanvas(ctx, GRADES.retroPrint, pw, ph, scale, keep);

const GRADE_FUNCTIONS = {
  sunsetGold: applySunsetGoldGrade,
  neonNight: applyNeonNightGrade,
  tropicTeal: applyTropicTealGrade,
  ultraviolet: applyUltravioletGrade,
  retroPrint: applyRetroPrintGrade,
};

export function applyGradeByKey(key, ctx, pw, ph, scale, keep = null) {
  (GRADE_FUNCTIONS[key] || applySunsetGoldGrade)(ctx, pw, ph, scale, keep);
}
