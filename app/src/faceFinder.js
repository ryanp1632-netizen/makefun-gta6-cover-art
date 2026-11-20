// Face finder: a small, dependency-free saliency search tuned for portrait photos.
// It works on a downscaled copy (WORK_WIDTH px wide) and combines three cues per pixel:
//   * skin likelihood (YCbCr chroma + normalised rg chromaticity, tolerant of golden-hour and neon light),
//   * local detail (absolute Laplacian of luminance, blurred): faces carry eyes, brows and a mouth, while bokeh,
//     sky and smooth clothing do not,
//   * a prior that favours the upper-middle of the frame where portraits put the head.
// A sliding-window search over integral images scores face-shaped boxes (inner saliency against the surrounding ring,
// plus the priors) and returns the best one in source-pixel coordinates.

const WORK_WIDTH = 120;

/** Draw the source into a small canvas and return its pixels with luminance, skin and detail maps. */
export function buildSaliencyMaps(source, srcW, srcH) {
  const w = WORK_WIDTH;
  const h = Math.max(8, Math.round((srcH * w) / srcW));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const lum = new Float32Array(n);
  const skin = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[i] = y;
    skin[i] = skinLikelihood(r, g, b, y);
  }
  const detail = blurMap(blurMap(laplacianMagnitude(lum, w, h), w, h), w, h);
  normaliseByPercentile(detail, 0.96);
  return { w, h, lum, skin, detail, scale: srcW / w };
}

/** Skin likelihood in [0,1] that survives warm sunset casts and coloured neon spill on darker skin. */
export function skinLikelihood(r, g, b, y) {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const dcb = (cb - 112) / 16;
  const dcr = (cr - 150) / 15;
  const chroma = Math.exp(-0.5 * (dcb * dcb + dcr * dcr));
  const s = r + g + b + 1;
  const rn = r / s;
  const gn = g / s;
  const drn = (rn - 0.45) / 0.07;
  const dgn = (gn - 0.31) / 0.035;
  const chromaticity = Math.exp(-0.5 * (drn * drn + dgn * dgn));
  // Neon-lit skin: red channel still leads green, blue can be high (magenta spill).
  const neon = r > g * 1.15 && r > 50 && b < r * 1.25 && g < 170 ? 0.45 : 0;
  let gate = 1;
  if (y < 28) gate = y / 28;
  else if (y > 238) gate = Math.max(0, (255 - y) / 17);
  return Math.max(chroma, chromaticity, neon) * gate;
}

function laplacianMagnitude(lum, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      out[i] = Math.abs(4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w]);
    }
  }
  return out;
}

function blurMap(src, w, h) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let cnt = 0;
      for (let k = -2; k <= 2; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) { sum += src[y * w + xx]; cnt++; }
      }
      tmp[y * w + x] = sum / cnt;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let cnt = 0;
      for (let k = -2; k <= 2; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) { sum += tmp[yy * w + x]; cnt++; }
      }
      out[y * w + x] = sum / cnt;
    }
  }
  return out;
}

function normaliseByPercentile(map, p) {
  const sorted = Float32Array.from(map).sort();
  const ref = sorted[Math.floor(sorted.length * p)] || 1;
  for (let i = 0; i < map.length; i++) map[i] = Math.min(1, map[i] / ref);
}

function integralImage(map, w, h) {
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += map[y * w + x];
      ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row;
    }
  }
  return ii;
}

function boxSum(ii, w, x0, y0, x1, y1) {
  const W = w + 1;
  return ii[y1 * W + x1] - ii[y0 * W + x1] - ii[y1 * W + x0] + ii[y0 * W + x0];
}

/**
 * Find the most face-like box. Returns {x, y, w, h, confidence} in source pixels, where the box spans
 * roughly brow-line-with-forehead to chin and cheek to cheek.
 */
export function findFaceBox(source, srcW, srcH, maps = buildSaliencyMaps(source, srcW, srcH)) {
  const { w, h, skin, detail, scale } = maps;
  const n = w * h;
  const sal = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sal[i] = skin[i] * (0.3 + 0.7 * detail[i]) + 0.22 * detail[i] * (0.4 + 0.6 * skin[i]);
  }
  const iiSal = integralImage(sal, w, h);
  const iiSkin = integralImage(skin, w, h);
  const minSide = Math.min(w, h);
  let best = null;
  for (let fh = Math.round(minSide * 0.14); fh <= Math.round(minSide * 0.62); fh += 2) {
    const fw = Math.max(4, Math.round(fh * 0.78));
    const ringX = Math.round(fw * 0.45);
    const ringY = Math.round(fh * 0.3);
    const sizePrior = Math.exp(-0.5 * Math.pow(Math.log(fh / (h * 0.26)) / 0.45, 2));
    for (let y = 0; y + fh <= h; y += 1) {
      for (let x = 0; x + fw <= w; x += 1) {
        const inner = boxSum(iiSal, w, x, y, x + fw, y + fh) / (fw * fh);
        const rx0 = Math.max(0, x - ringX);
        const ry0 = Math.max(0, y - ringY);
        const rx1 = Math.min(w, x + fw + ringX);
        const ry1 = Math.min(h, y + fh + ringY);
        const outerArea = (rx1 - rx0) * (ry1 - ry0) - fw * fh;
        const outer = outerArea > 0 ? (boxSum(iiSal, w, rx0, ry0, rx1, ry1) - inner * fw * fh) / outerArea : 0;
        // Skin must cover a good share of the box (a face, not a single bright detail).
        const skinCover = boxSum(iiSkin, w, x, y, x + fw, y + fh) / (fw * fh);
        const cx = (x + fw / 2) / w;
        const cy = (y + fh / 2) / h;
        const posPrior = Math.exp(-0.5 * (Math.pow((cx - 0.5) / 0.26, 2) + Math.pow((cy - 0.34) / 0.2, 2)));
        const score =
          (inner - 0.55 * outer) * (0.55 + 0.45 * Math.min(1, skinCover * 1.6)) * (0.35 + 0.65 * posPrior) * (0.5 + 0.5 * sizePrior);
        if (!best || score > best.score) best = { x, y, fw, fh, score, inner, outer };
      }
    }
  }
  if (!best || best.score <= 0.01) {
    const fw = srcW * 0.3;
    return { x: srcW * 0.5 - fw / 2, y: srcH * 0.18, w: fw, h: fw * 1.28, confidence: 0 };
  }
  const fitted = fitFaceBoxToSkin(maps, { x: best.x, y: best.y, w: best.fw, h: best.fh });
  return {
    x: fitted.x * scale,
    y: fitted.y * scale,
    w: fitted.w * scale,
    h: fitted.h * scale,
    confidence: Math.min(1, best.score * 4),
  };
}

/**
 * Snap a face box (work-map pixels) to the skin region around it: grow a side while the strip just outside it is
 * still face skin (a close-up whose box caught only the cheeks), shrink a side while its edge strip is mostly hair or
 * background (a box that took in the hair). The result runs about hairline to chin and cheek to cheek, which keeps
 * head-size estimates honest for tight close-ups and loose waist-up shots alike.
 */
export function fitFaceBoxToSkin(maps, box) {
  const { w, h, skin, lum } = maps;
  let x0 = box.x;
  let y0 = box.y;
  let x1 = box.x + box.w;
  let y1 = box.y + box.h;
  const avg = (map, ax0, ay0, ax1, ay1) => {
    let s = 0;
    let n = 0;
    const xa = Math.max(0, Math.floor(ax0));
    const xb = Math.min(w, Math.ceil(ax1));
    for (let y = Math.max(0, Math.floor(ay0)); y < Math.min(h, Math.ceil(ay1)); y++) {
      for (let x = xa; x < xb; x++) { s += map[y * w + x]; n++; }
    }
    return n ? s / n : 0;
  };
  // Reference: skin level and brightness in the middle of the box (eyes to mouth).
  const cx0 = x0 + Math.round(box.w * 0.25);
  const cy0 = y0 + Math.round(box.h * 0.3);
  const cx1 = x1 - Math.round(box.w * 0.25);
  const cy1 = y1 - Math.round(box.h * 0.2);
  const ref = Math.max(0.2, avg(skin, cx0, cy0, cx1, cy1));
  const refLum = avg(lum, cx0, cy0, cx1, cy1);
  const mean = (ax0, ay0, ax1, ay1) => avg(skin, ax0, ay0, ax1, ay1);
  // Above the face, a strip counts only if it is also about as bright as the face (forehead, not a bright sky).
  const meanAbove = (ax0, ay0, ax1, ay1) => {
    const s = avg(skin, ax0, ay0, ax1, ay1);
    const l = avg(lum, ax0, ay0, ax1, ay1);
    return Math.abs(l - refLum) < refLum * 0.25 + 10 ? s : s * 0.5;
  };
  // Only a box whose middle is clearly skin may grow (sunglasses or shade in the middle mean the box is unreliable
  // for growing and is only trimmed).
  const grow = ref >= 0.45 ? Math.max(0.4, ref * 0.82) : Infinity;
  const keep = ref * 0.3;
  const maxW = Math.min(w, box.w * 1.6);
  const maxH = Math.min(h * 0.7, box.h * 1.6);
  const maxY1 = box.y + box.h * 1.18;
  const minW = Math.max(4, box.w * 0.62);
  const minH = Math.max(4, box.h * 0.7);
  for (let iter = 0; iter < 60; iter++) {
    let changed = false;
    const bw = x1 - x0;
    const bh = y1 - y0;
    // Grow toward skin only where the box edge itself still lies on skin (the box cuts through the face): sideways
    // and up within the caps, down only a little, since the neck is skin too.
    const yMid = y1 - bh * 0.25;
    if (x0 > 0 && bw < maxW && mean(x0, y0, x0 + 1, yMid) > grow && mean(x0 - 1, y0, x0, yMid) > grow) { x0--; changed = true; }
    if (x1 < w && bw < maxW && mean(x1 - 1, y0, x1, yMid) > grow && mean(x1, y0, x1 + 1, yMid) > grow) { x1++; changed = true; }
    const xa = x0 + bw * 0.2;
    const xb = x1 - bw * 0.2;
    if (y0 > 0 && bh < maxH && mean(xa, y0, xb, y0 + 1) > grow && meanAbove(xa, y0 - 1, xb, y0) > grow) { y0--; changed = true; }
    if (y1 < h && y1 < maxY1 && bh < maxH && mean(xa, y1 - 1, xb, y1) > grow && mean(xa, y1, xb, y1 + 1) > grow) { y1++; changed = true; }
    // Trim hair and background off the sides and the top.
    if (bw > minW && mean(x0, y0, x0 + 1, y1) < keep) { x0++; changed = true; }
    if (bw > minW && mean(x1 - 1, y0, x1, y1) < keep) { x1--; changed = true; }
    if (bh > minH && mean(x0, y0, x1, y0 + 1) < keep) { y0++; changed = true; }
    if (!changed) break;
  }
  x0 = Math.round(x0); x1 = Math.round(x1); y0 = Math.round(y0); y1 = Math.round(y1);
  // Keep a face-like shape: not wider than tall by much, not a thin sliver.
  let bw = x1 - x0;
  let bh = y1 - y0;
  if (bh < bw * 1.05) {
    const add = bw * 1.05 - bh;
    y1 = Math.min(h, y1 + add * 0.6);
    y0 = Math.max(0, y0 - add * 0.4);
    bh = y1 - y0;
  }
  if (bw < bh * 0.62) {
    const add = bh * 0.62 - bw;
    x0 = Math.max(0, x0 - add / 2);
    x1 = Math.min(w, x1 + add / 2);
    bw = x1 - x0;
  }
  return { x: x0, y: y0, w: bw, h: bh };
}

/**
 * Face-quality score used to pick the hero: rewards a well-exposed, contrasty, sharp and sizeable face.
 * Returns a number roughly in [0, 1].
 */
export function scoreFaceQuality(maps, face) {
  const { w, h, lum, detail, scale } = maps;
  const x0 = Math.max(0, Math.floor(face.x / scale));
  const y0 = Math.max(0, Math.floor(face.y / scale));
  const x1 = Math.min(w, Math.ceil((face.x + face.w) / scale));
  const y1 = Math.min(h, Math.ceil((face.y + face.h) / scale));
  let sum = 0;
  let sum2 = 0;
  let sharp = 0;
  let cnt = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = lum[y * w + x] / 255;
      sum += v;
      sum2 += v * v;
      sharp += detail[y * w + x];
      cnt++;
    }
  }
  if (!cnt) return 0;
  const mean = sum / cnt;
  const std = Math.sqrt(Math.max(0, sum2 / cnt - mean * mean));
  const brightness = Math.exp(-0.5 * Math.pow((mean - 0.58) / 0.18, 2));
  const contrast = Math.min(1, std / 0.22);
  const sharpness = Math.min(1, (sharp / cnt) / 0.6);
  const size = Math.min(1, (face.h / scale / h) / 0.3);
  // Enough source pixels on the face to stay crisp when the hero panel enlarges it.
  const resolution = Math.min(1, face.h / 180);
  return 0.32 * brightness + 0.2 * contrast + 0.16 * sharpness + 0.08 * size + 0.16 * resolution + 0.08 * (face.confidence ?? 0.5);
}
