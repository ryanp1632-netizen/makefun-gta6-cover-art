// Auto layout for Golden Mile Cover Studio: fills every panel of a layout from the loaded photos. The best face
// (confident, large, contrasty) takes the hero panel; every other panel gets a different person, chosen by how well
// that photo's head fits the panel's free area. With fewer photos than panels the photos come back in other
// framings (close-up, waist-up mirrored, background crops such as palms against the sky or the sea), so even a
// single photo gives a cover of distinct-looking panels.

import { frameHeadInFocus, sceneCropForPanel } from './smartCrop.js';

/** Photos sorted for the hero slot: best portrait quality first. */
export function rankPhotosForHero(photos) {
  return [...photos].sort((a, b) => b.analysis.quality - a.analysis.quality);
}

const PORTRAIT_STYLES = new Set(['portrait', 'closeup', 'mid']);

/** One crop for one panel from one photo in a framing style; scene styles avoid windows already used. */
export function cropForPanel(photo, panel, style = 'portrait', usedWindows = [], flip = false) {
  if (PORTRAIT_STYLES.has(style)) {
    const framed = frameHeadInFocus(photo, panel, style);
    framed.crop.flip = flip;
    return { crop: framed.crop, fit: framed.fit, win: null };
  }
  const scene = sceneCropForPanel(photo, panel, style, usedWindows, flip);
  return { crop: scene.crop, fit: 1, win: scene.win };
}

/** The framings used when a photo appears again, in order. */
const REUSE_STYLES = ['closeup', 'wide', 'mid', 'sky', 'detail', 'sea'];

const focusArea = (p) => (p.focus ? p.focus.w * p.focus.h : p.bounds.w * p.bounds.h);

/** Builds the arrangement (one crop entry per panel) for a layout from a list of photos. */
export function assignPhotosToPanels(photos, layout) {
  const panels = layout.panels;
  if (!photos.length) return panels.map(() => ({ photoId: null, cx: 0.5, cy: 0.5, zoom: 1, flip: false }));
  const ranked = rankPhotosForHero(photos);
  const order = [...panels].sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0) || focusArea(b) - focusArea(a));
  const result = new Array(panels.length);
  const pool = new Set(ranked);
  // pass 1: a different person in every panel while photos last
  for (const panel of order) {
    if (!pool.size) break;
    let pick = null;
    for (const photo of pool) {
      const c = cropForPanel(photo, panel, 'portrait');
      const q = photo.analysis.quality;
      const score = c.fit * 2 + q * (panel.hero ? 3 : 0.8) + (photo.analysis.face.confidence > 0 ? 0.3 : 0);
      if (!pick || score > pick.score) pick = { score, photo, crop: c.crop };
    }
    pool.delete(pick.photo);
    result[panel.index] = pick.crop;
  }
  // pass 2: photos come back in other framings, the best faces first
  const windows = new Map(photos.map((p) => [p.id, []]));
  let k = 0;
  for (const panel of order) {
    if (result[panel.index]) continue;
    const photo = ranked[k % ranked.length];
    const style = REUSE_STYLES[Math.floor(k / ranked.length) % REUSE_STYLES.length];
    const flip = (Math.floor(k / ranked.length) + (style === 'mid' ? 1 : 0)) % 2 === 1;
    const c = cropForPanel(photo, panel, style, windows.get(photo.id), flip);
    if (c.win) windows.get(photo.id).push(c.win);
    result[panel.index] = c.crop;
    k++;
  }
  return result;
}
