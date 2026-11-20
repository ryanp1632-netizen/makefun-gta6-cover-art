// Face finder for Golden Mile Cover Studio: locates the face (and from it the whole head) in a photo so every panel
// can frame a person head-and-shoulders without cutting the top of the head or the chin. It works on the small
// saliency maps made by smartCrop.js (a soft skin-tone likelihood and a local-contrast map, read through integral
// images) and adds a portrait prior that favours the upper third and the middle of the frame. Runs locally only.

/** Mean of a map inside a rectangle, read from its integral image (rectangle clamped to the map). */
export function meanIn(integral, w, x, y, rw, rh) {
  const W1 = w + 1;
  const H = integral.length / W1 - 1;
  const x0 = Math.min(w - 1, Math.max(0, Math.round(x)));
  const y0 = Math.min(H - 1, Math.max(0, Math.round(y)));
  const x1 = Math.min(w, Math.max(x0 + 1, Math.round(x + rw)));
  const y1 = Math.min(H, Math.max(y0 + 1, Math.round(y + rh)));
  const s = integral[y1 * W1 + x1] - integral[y0 * W1 + x1] - integral[y1 * W1 + x0] + integral[y0 * W1 + x0];
  return s / ((x1 - x0) * (y1 - y0));
}

/**
 * Soft skin-tone likelihood (0..1) of a colour: a Gaussian around the human skin cluster in the CbCr plane, so warm
 * golden-hour skin, pale skin under pink neon and darker skin tones all score, while sky, sea, foliage and grey
 * concrete do not.
 */
export function skinLikelihood(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  if (y < 24 || y > 245) return 0;
  if (r < b - 6 || r < g * 0.92) return 0;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const dcr = (cr - 150) / 13;
  // pink and magenta light push skin towards blue, so the cluster is wider on that side
  const dcb = (cb - 108) / (cb > 108 ? 21 : 14);
  const p = Math.exp(-0.5 * (dcr * dcr + dcb * dcb));
  const mx = Math.max(r, g, b);
  const sat = mx > 0 ? (mx - Math.min(r, g, b)) / mx : 0;
  // greys and fully saturated oranges are rarely skin
  const satOk = sat < 0.08 ? sat / 0.08 : sat > 0.75 ? Math.max(0, 1 - (sat - 0.75) * 5) : 1;
  return p * satOk;
}

/** A soft portrait prior: people photos put the face near the middle, in the upper third of the frame. */
function portraitPrior(cx, cy) {
  const dx = (cx - 0.5) / 0.26;
  const dy = (cy - 0.33) / 0.22;
  return Math.exp(-0.5 * (dx * dx + dy * dy));
}

/**
 * Mirror symmetry of a square window's brightness (0..1): faces seen from the front are close to symmetric left to
 * right, hair, shoulders and backgrounds are usually not. Compared on a 6 x 6 grid of cell means.
 */
function mirrorSymmetry(lum, w, x, y, s) {
  const n = 6;
  const c = s / n;
  let diff = 0;
  let spread = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n / 2; i++) {
      const left = meanIn(lum, w, x + i * c, y + j * c, c, c);
      const right = meanIn(lum, w, x + (n - 1 - i) * c, y + j * c, c, c);
      diff += Math.abs(left - right);
      spread += left + right;
    }
  }
  const cells = n * (n / 2);
  const rel = diff / cells / Math.max(0.08, spread / (cells * 2));
  return Math.max(0, 1 - rel * 2.2);
}

/**
 * Finds the face as the best scoring square window: dense skin inside, less skin just above it (hair, hat) and at
 * its sides, some local contrast in its inner part (eyes, brows, mouth, beard) without rewarding busy texture,
 * left-right symmetry, the portrait prior, and a preference for larger faces (so an eye alone never wins).
 * The winner is refined to the centroid of skin around it.
 * Returns { x, y, w, h, confidence } in analysis pixels; confidence 0 means "no face, a best guess".
 */
export function findFaceBox(a) {
  const { w, h, integrals } = a;
  const skin = integrals.skin;
  const edge = integrals.edge;
  const minDim = Math.min(w, h);
  let best = null;
  for (let s = Math.max(8, Math.round(minDim * 0.15)); s <= Math.round(minDim * 0.55); s += 2) {
    const step = Math.max(1, Math.round(s / 8));
    for (let y = 0; y + s <= h; y += step) {
      for (let x = 0; x + s <= w; x += step) {
        // cheeks and nose: the part of a face that is skin whatever the hair, glasses or beard
        const inner = meanIn(skin, w, x + s * 0.25, y + s * 0.3, s * 0.5, s * 0.45);
        if (inner < 0.2) continue;
        const above = y > 2 ? meanIn(skin, w, x + s * 0.1, y - s * 0.35, s * 0.8, s * 0.35) : 0;
        // the top corners of a face window are hair or background
        const corners = (meanIn(skin, w, x, y, s * 0.22, s * 0.22) + meanIn(skin, w, x + s * 0.78, y, s * 0.22, s * 0.22)) / 2;
        const detail = Math.min(0.28, meanIn(edge, w, x + s * 0.18, y + s * 0.22, s * 0.64, s * 0.62));
        const prior = portraitPrior((x + s / 2) / w, (y + s / 2) / h);
        const skinTerm = inner - 0.3 * above - 0.35 * corners;
        if (skinTerm <= 0) continue;
        const sym = mirrorSymmetry(integrals.lum, w, x, y, s);
        const score = skinTerm * (0.5 + detail * 2 + sym * 1.2) * (0.35 + prior) * Math.pow(s / minDim, 0.55);
        if (!best || score > best.score) best = { x, y, s, score, inner, prior };
      }
    }
  }
  if (!best || best.score < 0.006) {
    // no face found: assume a centred portrait so crops still keep the probable head whole
    const s = minDim * 0.3;
    return { x: w * 0.5 - s / 2, y: h * 0.3 - s / 2, w: s, h: s, confidence: 0 };
  }
  return { ...refineFaceBox(a, best.x, best.y, best.s), confidence: Math.min(1, best.score * 8) };
}

/** Re-centres a face square on the skin mass around it (weighted centroid in a slightly larger window). */
function refineFaceBox(a, x, y, s) {
  const { w, integrals } = a;
  const cell = Math.max(1, Math.round(s / 8));
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (let yy = y; yy < y + s; yy += cell) {
    for (let xx = x; xx < x + s; xx += cell) {
      const v = meanIn(integrals.skin, w, xx, yy, cell, cell);
      if (v < 0.25) continue;
      sw += v;
      sx += v * (xx + cell / 2);
      sy += v * (yy + cell / 2);
    }
  }
  if (sw <= 0) return { x, y, w: s, h: s };
  const cx = x + s / 2 + (sx / sw - (x + s / 2)) * 0.4;
  const cy = y + s / 2 + (sy / sw - (y + s / 2)) * 0.25;
  return { x: cx - s / 2, y: cy - s / 2, w: s, h: s };
}

/**
 * The whole head from a face box, with generous margins: hair or a hat above, the chin and a little neck below,
 * ears and hair at the sides. Crops keep this box whole so they never cut the top of the head or the chin.
 */
export function headBoxOf(face) {
  return {
    x: face.x - face.w * 0.22,
    y: face.y - face.h * 0.58,
    w: face.w * 1.44,
    h: face.h * 1.74,
  };
}

/**
 * How good a photo is for a portrait panel (the best one becomes the hero): a confident, large face with crisp
 * contrast inside it (lit features rather than a hazy backlit silhouette) scores highest.
 */
export function portraitQuality(a) {
  const f = a.face;
  const size = Math.min(1, (f.w * f.h) / (a.w * a.h) / 0.06);
  const m = meanIn(a.integrals.lum, a.w, f.x, f.y, f.w, f.h);
  const m2 = meanIn(a.integrals.lum2, a.w, f.x, f.y, f.w, f.h);
  const faceContrast = Math.sqrt(Math.max(0, m2 - m * m));
  const detail = meanIn(a.integrals.edge, a.w, f.x, f.y, f.w, f.h);
  return f.confidence * 0.5 + size * 0.2 + Math.min(0.3, faceContrast) * 2 + Math.min(0.3, detail) * 1.2;
}
