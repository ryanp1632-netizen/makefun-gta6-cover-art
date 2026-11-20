// Auto-fill: spread the loaded photos over the panels so every panel holds a different person, with the best face
// (highest face-quality score) in the hero panel. With fewer photos than panels the extra panels reuse photos with a
// different crop; with one photo the panels show distinct crops of it (face close-up, mid shot, background detail).

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

/** Rank photos for the hero spot: face quality first, keeping the user's order as the tie-breaker. */
export function rankPhotosForHero(photos) {
  return photos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.quality - a.p.quality || a.i - b.i)
    .map((x) => x.p);
}

/** Build a fresh panels array (MAX_PANELS slots) from the photo list. */
export function autoFillPanels(photos) {
  const slots = Array.from({ length: MAX_PANELS }, emptyPanelSlot);
  if (!photos.length) return slots;
  if (photos.length === 1) {
    const only = photos[0];
    return slots.map((s, i) => ({ ...s, photoId: only.id, ...SINGLE_PHOTO_PLAN[i % SINGLE_PHOTO_PLAN.length] }));
  }
  const hero = rankPhotosForHero(photos)[0];
  const rest = photos.filter((p) => p !== hero);
  const order = [hero, ...rest];
  return slots.map((s, i) => {
    if (i < order.length) return { ...s, photoId: order[i].id, variant: 'portrait' };
    const reuse = order[(i - order.length) % order.length];
    const plan = REUSE_PLAN[Math.floor((i - order.length) / order.length) % REUSE_PLAN.length];
    return { ...s, photoId: reuse.id, ...plan };
  });
}
