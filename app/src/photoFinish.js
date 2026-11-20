// Photo finishing, so photos from different cameras look like one shoot:
//   * sharpenFaceArea — a gentle unsharp mask on each panel's face area (feathered ellipse), which brings back
//     eyes, lashes and skin texture that resizing softens;
//   * skinToneWeight — how skin-like a pixel is; the colour grade uses it to keep skin warm and natural (never grey,
//     green or magenta) in every look;
//   * addFilmGrain — one fine, luminance-weighted grain over the whole poster, shared by every panel.

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Separable box blur of one channel-interleaved RGBA region (radius r) into a Float32 RGB buffer. */
function boxBlurRGB(src, w, h, r) {
  const tmp = new Float32Array(w * h * 3);
  const out = new Float32Array(w * h * 3);
  const span = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[(y * w + Math.min(w - 1, Math.max(0, k))) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 3 + c] = acc / span;
        const add = Math.min(w - 1, x + r + 1);
        const sub = Math.max(0, x - r);
        acc += src[(y * w + add) * 4 + c] - src[(y * w + sub) * 4 + c];
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[(Math.min(h - 1, Math.max(0, k)) * w + x) * 3 + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 3 + c] = acc / span;
        const add = Math.min(h - 1, y + r + 1);
        const sub = Math.max(0, y - r);
        acc += tmp[(add * w + x) * 3 + c] - tmp[(sub * w + x) * 3 + c];
      }
    }
  }
  return out;
}

/**
 * Unsharp mask on the face area of a panel's pixels (in place). face = head rect in image pixels; amount ~0.5–0.9.
 * The effect fades out over a soft ellipse around the head so there is no visible edge.
 */
export function sharpenFaceArea(imageData, face, amount = 0.7) {
  if (!face) return;
  const { data, width, height } = imageData;
  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2;
  const rx = face.w * 0.85;
  const ry = face.h * 0.75;
  const x0 = Math.max(0, Math.floor(cx - rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const x1 = Math.min(width, Math.ceil(cx + rx));
  const y1 = Math.min(height, Math.ceil(cy + ry));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 8 || h < 8) return;
  const region = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) region.set(data.subarray(((y0 + y) * width + x0) * 4, ((y0 + y) * width + x1) * 4), y * w * 4);
  // Radius follows the face size: about 1/180 of the head height, at least one pixel.
  const r = Math.max(1, Math.round(face.h / 180));
  const blur = boxBlurRGB(region, w, h, r);
  for (let y = 0; y < h; y++) {
    const dy = (y0 + y + 0.5 - cy) / ry;
    for (let x = 0; x < w; x++) {
      const dx = (x0 + x + 0.5 - cx) / rx;
      const d = dx * dx + dy * dy;
      if (d >= 1) continue;
      const m = amount * (d < 0.55 ? 1 : (1 - d) / 0.45);
      const i = ((y0 + y) * width + x0 + x) * 4;
      const j = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) {
        const v = region[(y * w + x) * 4 + c];
        const detail = v - blur[j + c];
        // Small threshold keeps flat skin from turning noisy.
        const t = Math.abs(detail) < 2 ? 0 : detail;
        data[i + c] = clamp255(v + t * m);
      }
    }
  }
}

/** Skin-likeness of an RGB pixel in [0, 1] (YCbCr chroma window with soft edges, gated on luminance). */
export function skinToneWeight(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  if (y < 40 || y > 245) return 0;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const dcb = (cb - 110) / 14;
  const dcr = (cr - 150) / 12;
  const d = dcb * dcb + dcr * dcr;
  if (d > 4) return 0;
  const lumGate = y < 70 ? (y - 40) / 30 : 1;
  return Math.exp(-0.5 * d) * lumGate;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fine film grain over the whole poster (in place): strongest in the mid-tones, faint in deep shadows and
 * highlights, the same seeded pattern on every render so exports are repeatable.
 */
export function addFilmGrain(imageData, amount) {
  if (!(amount > 0)) return;
  const { data } = imageData;
  const rand = mulberry32(1337);
  const k = amount * 255;
  for (let i = 0; i < data.length; i += 4) {
    const l = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    const wgt = 0.35 + 2.6 * l * (1 - l);
    const n = (rand() + rand() - 1) * k * wgt;
    data[i] = clamp255(data[i] + n);
    data[i + 1] = clamp255(data[i + 1] + n);
    data[i + 2] = clamp255(data[i + 2] + n);
  }
}
