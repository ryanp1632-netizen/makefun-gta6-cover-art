// Colour grades, done on real pixel data: gradient-map dusk conversion, saturation, an S-shaped tone curve,
// split toning (warm highlights, magenta or teal shadows), halftone dots in the shadows and film grain, then canvas
// passes for bloom, light leaks and vignette. Each grade also carries the theme (sky, sun, title gradient, neon
// colour) so the scenery and the lettering tell the same colour story as the photos.

const hex = (s) => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];

export const GRADES = [
  {
    id: 'sunset-gold',
    name: 'Sunset Gold',
    exposure: 1.0,
    contrast: 0.52,
    sat: 1.28,
    lift: 0.01,
    shadowTint: [0.1, -0.06, 0.14],
    highlightTint: [0.09, 0.03, -0.1],
    map: { mix: 0.2, stops: ['#16052e', '#6a1660', '#e04a3a', '#ffa43a', '#ffe9b0'] },
    bloom: { threshold: 0.7, strength: 0.28, radius: 0.03 },
    leak: { strength: 0.2, colors: ['#ff8a2a', '#ff2f7a'] },
    vignette: 0.55,
    grain: 0.05,
    halftone: { strength: 0.22, cell: 6 },
    theme: {
      sky: ['#1b0a3c', '#4c1670', '#b52b78', '#ff5e4d', '#ff9c3a', '#ffd76b'],
      sun: ['#fff6c2', '#ffd04a', '#ff8a2a', '#ff3f81'],
      sea: ['#4a1a62', '#1c0830'],
      seaGlint: '#ffb35a',
      silhouette: '#170520',
      skyline: '#3a0f4a',
      title: ['#fffbe0', '#ffe55c', '#ffb21f', '#ff6a2b', '#ff2f86'],
      outline: '#14051f',
      extrude: ['#6b1350', '#22052d'],
      stripe: '#2a0631',
      neon: '#ff3fbf',
      neonCore: '#fff2fb',
      accent: '#ffd23f',
      ribbon: ['#ff2d7a', '#8a1fd1'],
      tagBg: '#12061c',
      bg: '#12061f',
    },
  },
  {
    id: 'neon-night',
    name: 'Neon Night',
    exposure: 1.0,
    contrast: 0.4,
    sat: 1.3,
    lift: 0.02,
    shadowTint: [0.02, -0.02, 0.16],
    highlightTint: [0.12, -0.02, 0.08],
    map: { mix: 0.55, stops: ['#06031e', '#271068', '#9c1784', '#ff4fb6', '#c4f7ff'] },
    cyanWater: 0.85,
    bloom: { threshold: 0.5, strength: 0.85, radius: 0.04 },
    leak: { strength: 0.5, colors: ['#21d4ff', '#ff2fb8'] },
    vignette: 0.55,
    grain: 0.06,
    halftone: { strength: 0.16, cell: 7 },
    theme: {
      sky: ['#03021a', '#0d0942', '#2c0d6a', '#6e1386', '#d11f8f', '#ff4f9a'],
      sun: ['#ffe3f6', '#ff7ad1', '#ff2f9e', '#7b2cff'],
      sea: ['#1a0b4a', '#050220'],
      seaGlint: '#4ff0ff',
      silhouette: '#040216',
      skyline: '#1a0b45',
      title: ['#f2feff', '#8ff6ff', '#2fc9ff', '#c14cff', '#ff2fa8'],
      outline: '#070318',
      extrude: ['#3a0f7a', '#0a0322'],
      stripe: '#0d0530',
      neon: '#ff2fc8',
      neonCore: '#fff0fc',
      accent: '#2ff3ff',
      ribbon: ['#ff2fa8', '#2a6bff'],
      tagBg: '#07031a',
      bg: '#06031a',
    },
  },
  {
    id: 'tropic-teal',
    name: 'Tropic Teal',
    exposure: 1.03,
    contrast: 0.3,
    sat: 1.28,
    lift: 0.03,
    shadowTint: [-0.1, 0.05, 0.07],
    highlightTint: [0.11, 0.05, -0.06],
    map: { mix: 0.12, stops: ['#002a33', '#0b6b74', '#e0705a', '#ffc27a', '#fff3d8'] },
    bloom: { threshold: 0.62, strength: 0.45, radius: 0.03 },
    leak: { strength: 0.38, colors: ['#ffb03b', '#ff5a7a'] },
    vignette: 0.38,
    grain: 0.05,
    halftone: { strength: 0.16, cell: 7 },
    theme: {
      sky: ['#04263a', '#0a5566', '#1b8f93', '#ff9d6b', '#ffc77a', '#ffe9b0'],
      sun: ['#fffbe0', '#ffe27a', '#ffa23d', '#ff5a6e'],
      sea: ['#0b5260', '#02202a'],
      seaGlint: '#ffe0a0',
      silhouette: '#03181f',
      skyline: '#0b3a46',
      title: ['#fffde6', '#ffe65c', '#ffb83a', '#ff7a3a', '#ff3e6e'],
      outline: '#03141c',
      extrude: ['#0d5560', '#021219'],
      stripe: '#05222b',
      neon: '#ff4fa3',
      neonCore: '#fff1f8',
      accent: '#26e6d2',
      ribbon: ['#ff4f7a', '#0aa3a8'],
      tagBg: '#041820',
      bg: '#03161d',
    },
  },
  {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    exposure: 0.96,
    contrast: 0.48,
    sat: 1.25,
    lift: 0.0,
    shadowTint: [0.05, -0.08, 0.16],
    highlightTint: [0.12, -0.02, 0.02],
    map: { mix: 0.4, stops: ['#04011a', '#250870', '#7a1fd0', '#ff4fae', '#ffe2ef'] },
    bloom: { threshold: 0.6, strength: 0.55, radius: 0.035 },
    leak: { strength: 0.32, colors: ['#b44bff', '#ff4fb8'] },
    vignette: 0.5,
    grain: 0.06,
    halftone: { strength: 0.18, cell: 7 },
    theme: {
      sky: ['#07011c', '#1f0757', '#4d14a6', '#9a2bd6', '#e44fd0', '#ff9ad9'],
      sun: ['#fff0ff', '#ff9ae6', '#d14bff', '#6a2bff'],
      sea: ['#2a0a6a', '#08021f'],
      seaGlint: '#ff9ae6',
      silhouette: '#08021a',
      skyline: '#250a5a',
      title: ['#ffffff', '#ffe08a', '#ffb347', '#ff5fb0', '#b44bff'],
      outline: '#0b0322',
      extrude: ['#4a1199', '#0e0330'],
      stripe: '#14053a',
      neon: '#c46bff',
      neonCore: '#fbf0ff',
      accent: '#ffde59',
      ribbon: ['#b44bff', '#ff3fa0'],
      tagBg: '#0b0322',
      bg: '#08021c',
    },
  },
  {
    id: 'retro-print',
    name: 'Retro Print',
    exposure: 1.02,
    contrast: 0.26,
    sat: 0.95,
    lift: 0.08,
    shadowTint: [0.09, -0.02, 0.06],
    highlightTint: [0.08, 0.05, -0.08],
    map: { mix: 0.22, stops: ['#2a0f2a', '#8c2f4a', '#e0623f', '#f5b04f', '#fbeac2'] },
    bloom: { threshold: 0.7, strength: 0.3, radius: 0.03 },
    leak: { strength: 0.3, colors: ['#ff9f43', '#ff4f6a'] },
    vignette: 0.35,
    grain: 0.09,
    halftone: { strength: 0.5, cell: 8 },
    theme: {
      sky: ['#24103a', '#5a1f5a', '#a8345a', '#e2604a', '#f5a24b', '#f7d993'],
      sun: ['#fff6d8', '#ffd84a', '#ff9f2e', '#e84a3a'],
      sea: ['#5a1f4a', '#22081f'],
      seaGlint: '#ffd27a',
      silhouette: '#1f0818',
      skyline: '#4a1838',
      title: ['#fff6d8', '#ffd84a', '#ff9f2e', '#e84a3a', '#c21d5a'],
      outline: '#1d0716',
      extrude: ['#7a1d3a', '#2a0718'],
      stripe: '#2a0a1c',
      neon: '#ff4f7a',
      neonCore: '#fff3f0',
      accent: '#ffd84a',
      ribbon: ['#e84a3a', '#7a1d6a'],
      tagBg: '#1d0716',
      bg: '#1d0716',
    },
  },
];

export function getGrade(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

/**
 * A per-panel variation of a grade: alternate panels lean a little warmer or cooler and brighter or darker so the
 * mosaic looks rich while the whole cover keeps one colour story.
 */
export function gradeVariant(grade, index) {
  const k = [0, 1, -1, 0.6, -0.6, 0.3, -0.3][index % 7];
  return {
    ...grade,
    exposure: grade.exposure * (1 + 0.03 * k),
    highlightTint: [grade.highlightTint[0] + 0.03 * k, grade.highlightTint[1] - 0.012 * Math.abs(k), grade.highlightTint[2] + 0.03 * Math.max(0, k)],
    shadowTint: [grade.shadowTint[0], grade.shadowTint[1] + 0.02 * Math.min(0, k), grade.shadowTint[2] - 0.02 * k],
    leakCorner: index % 4,
  };
}

/** 256-entry lookup table of a gradient through evenly spaced colour stops. */
function gradientMapLut(stops) {
  const cols = stops.map(hex);
  const lut = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (cols.length - 1);
    const j = Math.min(cols.length - 2, Math.floor(t));
    const f = t - j;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = cols[j][c] * (1 - f) + cols[j + 1][c] * f;
  }
  return lut;
}

/** 256-entry tone curve: exposure, lifted blacks and an S-curve for contrast. */
function toneCurveLut(exposure, contrast, lift) {
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    let v = Math.min(1, (i / 255) * exposure);
    const s = v * v * (3 - 2 * v);
    v = v + (s - v) * contrast * 2;
    v = lift + v * (1 - lift);
    lut[i] = Math.min(1, Math.max(0, v));
  }
  return lut;
}

/** Cheap deterministic per-pixel noise in -0.5..0.5. */
function grainNoise(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) & 1023) / 1023) - 0.5;
}

/**
 * Applies the pixel part of a grade in place: gradient map, cyan water, saturation, tone curve, split toning,
 * halftone dots in the shadows and film grain. `pixelScale` is output pixels per design pixel (for dot size).
 */
export function applyGradeToPixels(imageData, grade, pixelScale = 1, seed = 7) {
  const { data, width, height } = imageData;
  const curve = toneCurveLut(grade.exposure, grade.contrast, grade.lift);
  const map = grade.map ? gradientMapLut(grade.map.stops) : null;
  const mapMix = grade.map ? grade.map.mix : 0;
  const [sr, sg, sb] = grade.shadowTint;
  const [hr, hg, hb] = grade.highlightTint;
  const sat = grade.sat;
  const cyan = grade.cyanWater ?? 0;
  const ht = grade.halftone;
  const cell = Math.max(3, ht.cell * pixelScale);
  const htStrength = ht.strength;
  const grain = grade.grain;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;
      let l = 0.299 * r + 0.587 * g + 0.114 * b;
      // how much this pixel is water or blue sky, judged on the original colour
      const water = cyan > 0 && b > r * 1.08 && b > 0.22 ? Math.min(1, (b - r) * 2.8) * cyan : 0;
      if (map) {
        const m = Math.min(255, Math.round(l * 255)) * 3;
        r += (map[m] - r) * mapMix;
        g += (map[m + 1] - g) * mapMix;
        b += (map[m + 2] - b) * mapMix;
      }
      if (water > 0) {
        // electric cyan water against the magenta dusk
        const lw = 0.25 + l * 0.9;
        r += (0.02 * lw - r) * water;
        g += (Math.min(1, 0.78 * lw) - g) * water;
        b += (Math.min(1, 1.0 * lw) - b) * water;
      }
      l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
      r = curve[Math.max(0, Math.min(255, Math.round(r * 255)))];
      g = curve[Math.max(0, Math.min(255, Math.round(g * 255)))];
      b = curve[Math.max(0, Math.min(255, Math.round(b * 255)))];
      l = 0.299 * r + 0.587 * g + 0.114 * b;
      const ws = (1 - l) * (1 - l);
      const wh = l * l;
      r += sr * ws + hr * wh;
      g += sg * ws + hg * wh;
      b += sb * ws + hb * wh;
      if (htStrength > 0 && l < 0.42) {
        const u = (x + y) * 0.7071 / cell;
        const v = (x - y) * 0.7071 / cell;
        const fu = u - Math.floor(u) - 0.5;
        const fv = v - Math.floor(v) - 0.5;
        const d = Math.sqrt(fu * fu + fv * fv);
        const radius = 0.6 * Math.sqrt(Math.min(1, (0.42 - l) / 0.42));
        const edge = Math.min(1, Math.max(0, (radius - d) * 8));
        const k = 1 - edge * htStrength;
        r *= k;
        g *= k;
        b *= k;
      }
      if (grain > 0) {
        const n = grainNoise(x, y, seed) * grain * (0.6 + 0.8 * (1 - Math.abs(l - 0.5) * 2));
        r += n;
        g += n;
        b += n;
      }
      data[i] = r * 255;
      data[i + 1] = g * 255;
      data[i + 2] = b * 255;
    }
  }
  return imageData;
}

/** Bloom: bright parts, blurred on a quarter-size copy, added back with a screen blend. */
export function applyBloom(canvas, grade) {
  const { threshold, strength, radius } = grade.bloom;
  const w = canvas.width;
  const h = canvas.height;
  const sw = Math.max(4, Math.round(w / 4));
  const sh = Math.max(4, Math.round(h / 4));
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(canvas, 0, 0, sw, sh);
  const img = sctx.getImageData(0, 0, sw, sh);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const k = Math.max(0, (l - threshold) / (1 - threshold));
    d[i] *= k;
    d[i + 1] *= k;
    d[i + 2] *= k;
  }
  sctx.putImageData(img, 0, 0);
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(1, strength);
  ctx.filter = `blur(${Math.max(2, Math.round(Math.max(w, h) * radius))}px)`;
  ctx.drawImage(small, 0, 0, w, h);
  ctx.filter = 'none';
  ctx.globalAlpha = Math.min(1, strength * 0.6);
  ctx.filter = `blur(${Math.max(1, Math.round(Math.max(w, h) * radius * 0.3))}px)`;
  ctx.drawImage(small, 0, 0, w, h);
  ctx.restore();
}

/** A warm light leak bleeding in from one corner of a panel. */
export function applyLightLeak(ctx, w, h, grade, corner = 0) {
  const { strength, colors } = grade.leak;
  const cx = corner % 2 === 0 ? 0 : w;
  const cy = corner < 2 ? 0 : h;
  const r = Math.max(w, h) * 0.6;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g1.addColorStop(0, colors[0]);
  g1.addColorStop(0.3, colors[1] + '66');
  g1.addColorStop(1, colors[1] + '00');
  ctx.globalAlpha = strength;
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);
  // a thin diagonal streak, like light leaking past a film gate
  const sx = w * (corner % 2 === 0 ? 0.15 : 0.85);
  const streak = ctx.createLinearGradient(sx - w * 0.2, 0, sx + w * 0.2, h);
  streak.addColorStop(0, colors[0] + '00');
  streak.addColorStop(0.5, colors[0] + '55');
  streak.addColorStop(1, colors[0] + '00');
  ctx.globalAlpha = strength * 0.6;
  ctx.fillStyle = streak;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Darkened, slightly purple edges. */
export function applyVignette(ctx, w, h, strength, tint = '#0a0218') {
  ctx.save();
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
  g.addColorStop(0, tint + '00');
  g.addColorStop(1, tint);
  ctx.globalAlpha = strength;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Runs the whole grade on a panel canvas that already holds the cropped photo. */
export function gradePanelCanvas(canvas, grade, pixelScale, seed) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyGradeToPixels(img, grade, pixelScale, seed);
  ctx.putImageData(img, 0, 0);
  applyBloom(canvas, grade);
  applyLightLeak(ctx, canvas.width, canvas.height, grade, grade.leakCorner ?? 0);
  applyVignette(ctx, canvas.width, canvas.height, grade.vignette, grade.theme.bg);
}
