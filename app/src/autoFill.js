// Auto-fill: spread the loaded photos over the panels so every panel holds a different person, ranked by face
// quality: the best face goes in the hero panel, the next-best in the cast panels, and the weakest is left out when
// there are more photos than panels. With fewer photos than panels the extra panels reuse photos with a different
// crop; with one photo the panels show distinct crops of it (face close-up, mid shot, background detail).

import { MAX_PANELS } from './layouts.js';

export function emptyPanelSlot() {
  return { photoId: null, zoom: 1, panX: 0, panY: 0, flip: false, variant: 'portrait' };
}

const SINGLE_PHOTO_PLAN = [
  { variant: 'portrait', flip: false },
  { variant: 'close', flip: false },
  { variant: 'wide', flip: true },
  { variant: 'detail', flip: false },
  { variant: 'close', flip: true },
  { variant: 'portrait', flip: true },
  { variant: 'detail', flip: true },
  { variant: 'wide', flip: false },
];

const REUSE_PLAN = [
  { variant: 'close', flip: true },
  { variant: 'wide', flip: false },
  { variant: 'close', flip: false },
  { variant: 'wide', flip: true },
];

/**
 * How well a photo can fill a large hero frame with a big, whole head: 1 when the head takes roughly 30–52% of
 * the photo's height (a head-and-shoulders or waist-up shot), less for a tiny face or a crop so tight that the head
 * could not stay whole once the photo covers a wide panel.
 */
export function heroFramingFit(photo) {
  if (!photo.face) return 0.5;
  const headShare = (photo.face.h * 1.8) / photo.h;
  if (headShare < 0.3) return Math.max(0.35, 1 - (0.3 - headShare) * 3);
  if (headShare > 0.52) return Math.max(0.35, 1 - (headShare - 0.52) * 3);
  return 1;
}

/** 0..1: how clearly a photo is a neon-night shot (magenta and cyan city light), from its measured neon share. */
export function neonAccentStrength(photo) {
  const t = Math.min(1, Math.max(0, ((photo.neon || 0) - 0.08) / 0.14));
  return t * t * (3 - 2 * t);
}

/** The cast slot a neon-night photo moves to: the lower-right cast panel in every layout, opposite the warm hero. */
export const NEON_ACCENT_SLOT = 5;

/**
 * Rank photos: the hero is the best face for the hero frame (face quality × framing fit); a strong neon-night photo
 * is passed over for the hero, which carries the poster's grade, and serves as a cool accent in a cast panel
 * instead. The others follow by face quality. The user's order breaks ties.
 */
export function rankPhotosForHero(photos) {
  if (!photos.length) return [];
  const indexed = photos.map((p, i) => ({ p, i }));
  const heroKey = (x) => x.p.quality * heroFramingFit(x.p) * (1 - 0.45 * neonAccentStrength(x.p));
  const hero = indexed.reduce((best, x) => (heroKey(x) > heroKey(best) + 1e-9 ? x : best), indexed[0]);
  const rest = indexed.filter((x) => x !== hero).sort((a, b) => b.p.quality - a.p.quality || a.i - b.i);
  return [hero, ...rest].map((x) => x.p);
}

/**
 * Warm/cool contrast: the strongest neon-night cast photo (if any made the cut) moves to NEON_ACCENT_SLOT, so its
 * magenta and cyan sit opposite the hero among the golden-hour panels instead of wherever its rank fell. The other
 * photos keep their face-quality order around it.
 */
export function placeNeonAccent(order) {
  if (order.length <= NEON_ACCENT_SLOT) return order;
  let best = -1;
  for (let i = 1; i < Math.min(order.length, 7); i++) {
    if (neonAccentStrength(order[i]) > 0.5 && (best < 0 || order[i].neon > order[best].neon)) best = i;
  }
  if (best < 0 || best === NEON_ACCENT_SLOT) return order;
  const out = order.slice();
  const [accent] = out.splice(best, 1);
  out.splice(NEON_ACCENT_SLOT, 0, accent);
  return out;
}

/** Build a fresh panels array (MAX_PANELS slots) from the photo list. */
export function autoFillPanels(photos) {
  const slots = Array.from({ length: MAX_PANELS }, emptyPanelSlot);
  if (!photos.length) return slots;
  if (photos.length === 1) {
    const only = photos[0];
    return slots.map((s, i) => ({ ...s, photoId: only.id, ...SINGLE_PHOTO_PLAN[i % SINGLE_PHOTO_PLAN.length] }));
  }
  // Best face in the hero panel, then the next-best faces in layout order, so with more photos than panels the
  // weakest photo is the one left out (it stays loaded, one click away in the photo strip).
  const order = placeNeonAccent(rankPhotosForHero(photos));
  return slots.map((s, i) => {
    if (i < order.length) return { ...s, photoId: order[i].id, variant: 'portrait' };
    const reuse = order[(i - order.length) % order.length];
    const plan = REUSE_PLAN[Math.floor((i - order.length) / order.length) % REUSE_PLAN.length];
    return { ...s, photoId: reuse.id, ...plan };
  });
}
