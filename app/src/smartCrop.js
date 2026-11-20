// Smart crop: decides how a photo sits inside a panel. Every panel has a "face zone" (the part of the panel that no
// lettering covers); the crop scales and places the photo so the whole head — hair to chin — lands inside that zone
// with headroom, never cut at the top of the head or the chin and never pushed to a panel edge. The user's pan, zoom
// and flip are applied on top of the automatic framing.

export const CROP_VARIANTS = ['portrait', 'close', 'wide', 'detail'];

const FACE_SHARE = { hero: 0.5, portrait: 0.44, close: 0.62, wide: 0.28 };
const HAIR_ABOVE = 0.5; // head top sits this many face-heights above the face box
const CHIN_BELOW = 0.3; // the face box often stops at the mouth; keep the chin and jaw inside the zone
const MIN_COVER_SHARE = 0.7; // never shrink below 70% of the covering scale (keeps edge extension small)

function mirroredFace(photo, flip) {
  const f = photo.face;
  return flip ? { ...f, x: photo.w - f.x - f.w } : f;
}

function pickInRange(desired, lo, hi) {
  return Math.min(hi, Math.max(lo, desired));
}

/** Resolve a value that keeps coverage [covLo, covHi] and face safety [safeLo, safeHi], preferring both. */
function resolveAxis(desired, covLo, covHi, safeLo, safeHi) {
  const lo = Math.max(covLo, safeLo);
  const hi = Math.min(covHi, safeHi);
  if (lo <= hi) return pickInRange(desired, lo, hi);
  // Cannot have both: keep the face safe (the renderer back-fills uncovered panel edges with a soft blur).
  return pickInRange(pickInRange(desired, covLo, covHi), safeLo, safeHi);
}

/**
 * Frame a photo's head and shoulders inside a panel.
 * @param photo  {w, h, face}
 * @param pw, ph panel bounding-box size (design px)
 * @param zone   {x, y, w, h} face-safe zone inside the panel box
 * @param adjust {zoom, panX, panY, flip, variant, hero}
 * @returns {s, ox, oy, flip, face (panel-local head rect or null), covers}
 */
export function frameHeadAndShoulders(photo, pw, ph, zone, adjust = {}) {
  const variant = adjust.variant || (adjust.hero ? 'hero' : 'portrait');
  if (variant === 'detail') return frameDetailCrop(photo, pw, ph, adjust);
  const flip = !!adjust.flip;
  const face = mirroredFace(photo, flip);
  const share = FACE_SHARE[variant] ?? FACE_SHARE.portrait;
  const headH = face.h * (1 + HAIR_ABOVE + CHIN_BELOW);
  const headW = face.w * 1.45;

  // Largest scale that keeps the whole head in the zone, the "nice" scale for this variant, and the scale at which
  // the photo covers the panel. Coverage wins only while the head still fits; beyond that the head wins and the
  // panel's uncovered edge is filled by extending the photo's own edge pixels (see drawFramedPhoto).
  const sFit = Math.min((zone.w * 0.92) / headW, (zone.h * 0.97) / headH);
  const sNice = Math.min((share * zone.h) / face.h, sFit);
  const sCover = Math.max(pw / photo.w, ph / photo.h);
  // The head rect is a generous estimate (hair and chin margins), so coverage may push it 5% past the zone.
  let s = Math.max(sNice, Math.min(sCover, sFit * 1.05));
  s = Math.max(s, sCover * MIN_COVER_SHARE);
  const zoom = adjust.zoom || 1;
  s *= zoom;

  const headTop = face.y - HAIR_ABOVE * face.h;
  const faceCx = face.x + face.w / 2;
  const headroom = Math.max(zone.h * 0.035, (zone.h - headH * s) * 0.16);
  let ox = zone.x + zone.w / 2 - faceCx * s;
  let oy = zone.y + headroom - headTop * s;

  const userMoved = Math.abs(adjust.panX || 0) > 1e-4 || Math.abs(adjust.panY || 0) > 1e-4 || Math.abs(zoom - 1) > 1e-3;
  ox += (adjust.panX || 0) * pw;
  oy += (adjust.panY || 0) * ph;

  const covXLo = pw - s * photo.w;
  const covYLo = ph - s * photo.h;
  if (userMoved) {
    ox = covXLo <= 0 ? pickInRange(ox, covXLo, 0) : ox;
    oy = covYLo <= 0 ? pickInRange(oy, covYLo, 0) : oy;
  } else {
    const hl = face.x + face.w / 2 - headW / 2;
    const safeXLo = zone.x - hl * s;
    const safeXHi = zone.x + zone.w - (hl + headW) * s;
    const safeYLo = zone.y - headTop * s;
    const safeYHi = zone.y + zone.h - (headTop + headH) * s;
    // If the head is a touch larger than the zone (at most 5%), any spot that overflows it by no more than that
    // overflow counts as safe, so coverage can still be kept.
    const safeRange = (lo, hi) => (lo <= hi ? [lo, hi] : [hi, lo]);
    ox = resolveAxis(ox, Math.min(covXLo, 0), 0, ...safeRange(safeXLo, safeXHi));
    oy = resolveAxis(oy, Math.min(covYLo, 0), 0, ...safeRange(safeYLo, safeYHi));
  }

  const headRect = {
    x: ox + (faceCx - headW / 2) * s,
    y: oy + headTop * s,
    w: headW * s,
    h: headH * s,
  };
  const covers = ox <= 0.5 && oy <= 0.5 && ox + photo.w * s >= pw - 0.5 && oy + photo.h * s >= ph - 0.5;
  return { s, ox, oy, flip, face: headRect, covers, variant };
}

/** A face-free detail crop (hands, car, background) used when one photo fills several panels. */
export function frameDetailCrop(photo, pw, ph, adjust = {}) {
  const flip = !!adjust.flip;
  const face = mirroredFace(photo, flip);
  const sCover = Math.max(pw / photo.w, ph / photo.h);
  const s = sCover * 1.55 * (adjust.zoom || 1);
  const faceCx = face.x + face.w / 2;
  const tx = faceCx < photo.w / 2 ? photo.w * 0.78 : photo.w * 0.22;
  const ty = Math.min(photo.h * 0.8, face.y + face.h * 3);
  let ox = pw / 2 - tx * s + (adjust.panX || 0) * pw;
  let oy = ph / 2 - ty * s + (adjust.panY || 0) * ph;
  ox = pickInRange(ox, pw - s * photo.w, 0);
  oy = pickInRange(oy, ph - s * photo.h, 0);
  return { s, ox, oy, flip, face: null, covers: true, variant: 'detail' };
}

/** Draw a framed photo into a panel-local context (origin at the panel box's top-left). */
export function drawFramedPhoto(ctx, photo, frame, pw, ph) {
  ctx.save();
  if (frame.flip) {
    ctx.translate(frame.ox + frame.s * photo.w, frame.oy);
    ctx.scale(-frame.s, frame.s);
  } else {
    ctx.translate(frame.ox, frame.oy);
    ctx.scale(frame.s, frame.s);
  }
  ctx.imageSmoothingQuality = 'high';
  if (frame.covers) {
    ctx.drawImage(photo.canvas, 0, 0);
  } else {
    const gaps = extendPhotoEdges(ctx, photo, frame, pw, ph);
    ctx.drawImage(featheredPhoto(photo, gaps), 0, 0);
  }
  ctx.restore();
}

/** A copy of the photo whose edges on the gap sides fade out, so it melts into the edge extension. */
function featheredPhoto(photo, gaps) {
  const c = document.createElement('canvas');
  c.width = photo.w;
  c.height = photo.h;
  const g = c.getContext('2d');
  g.drawImage(photo.canvas, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  const f = Math.round(Math.min(photo.w, photo.h) * 0.035);
  const fade = (x0, y0, x1, y1, rx, ry, rw, rh) => {
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, 'rgba(0,0,0,0.7)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(rx, ry, rw, rh);
  };
  if (gaps.left) fade(0, 0, f, 0, 0, 0, f, photo.h);
  if (gaps.right) fade(photo.w, 0, photo.w - f, 0, photo.w - f, 0, f, photo.h);
  if (gaps.top) fade(0, 0, 0, f, 0, 0, photo.w, f);
  if (gaps.bottom) fade(0, photo.h, 0, photo.h - f, 0, photo.h - f, photo.w, f);
  return c;
}

/**
 * Fill the parts of a panel the photo does not reach by stretching the photo's outermost rows/columns outward
 * (softly blurred), drawn in photo space so the extension lines up with the photo exactly.
 */
function extendPhotoEdges(ctx, photo, frame, pw, ph) {
  const { s, ox, oy, flip } = frame;
  const w = photo.w;
  const h = photo.h;
  const ua = flip ? (ox + s * w - pw) / s : -ox / s;
  const ub = flip ? (ox + s * w) / s : (pw - ox) / s;
  const va = -oy / s;
  const vb = (ph - oy) / s;
  const strip = Math.max(2, Math.round(Math.min(w, h) * 0.012));
  const src = photo.canvas;
  const t = ctx.getTransform();
  const devPerPhoto = Math.hypot(t.a, t.b);
  ctx.save();
  ctx.filter = `blur(${Math.max(3, Math.round(devPerPhoto * strip * 2.5))}px)`;
  const m = 6;
  // Reach a little under the photo so its feathered edge blends over the extension.
  const under = Math.round(Math.min(w, h) * 0.07);
  const gaps = { left: ua < 0, right: ub > w, top: va < 0, bottom: vb > h };
  if (gaps.left) ctx.drawImage(src, 0, 0, strip, h, ua - m, va - m, -ua + m + under, vb - va + 2 * m);
  if (gaps.right) ctx.drawImage(src, w - strip, 0, strip, h, w - under, va - m, ub - w + m + under, vb - va + 2 * m);
  if (gaps.top) ctx.drawImage(src, 0, 0, w, strip, 0, va - m, w, -va + m + under);
  if (gaps.bottom) ctx.drawImage(src, 0, h - strip, w, strip, 0, h - under, w, vb - h + m + under);
  // Over the smear, mirror the photo's own border band into the gap: skies, walls and bokeh continue naturally.
  ctx.filter = `blur(${Math.max(1, Math.round(devPerPhoto * 2))}px)`;
  const mirror = (gx, gy, sx, sy, sw, sh, tx, ty, kx, ky) => {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(kx, ky);
    ctx.drawImage(src, sx, sy, sw, sh, gx, gy, sw, sh);
    ctx.restore();
  };
  // Only small gaps are mirrored, and never with a band that reaches the face (a mirrored hat or ear would show
  // as a ghost); larger gaps keep the soft smear, which the layouts tuck under lettering.
  const f = photo.face; // photo space is the unflipped source; the flip lives in the transform
  const smallV = h * 0.08;
  const smallH = w * 0.08;
  const gTop = -va + m;
  const gBot = vb - h + m;
  const gLeft = -ua + m;
  const gRight = ub - w + m;
  if (gaps.top && gTop <= smallV && gTop < f.y - f.h * 0.1) mirror(0, 0, 0, 0, w, gTop, 0, 0, 1, -1);
  if (gaps.bottom && gBot <= smallV && h - gBot > f.y + f.h * 1.6) mirror(0, h - gBot, 0, h - gBot, w, gBot, 0, 2 * h, 1, -1);
  if (gaps.left && gLeft <= smallH && gLeft < f.x - f.w * 0.3) mirror(0, 0, 0, 0, gLeft, h, 0, 0, -1, 1);
  if (gaps.right && gRight <= smallH && w - gRight > f.x + f.w * 1.3) mirror(w - gRight, 0, w - gRight, 0, gRight, h, 2 * w, 0, -1, 1);
  ctx.restore();
  return gaps;
}
