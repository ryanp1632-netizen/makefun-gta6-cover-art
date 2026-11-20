// Auto layout: fills every panel of a layout from the loaded photos. The most face-like, contrasty photo takes the
// hero panel; every other panel goes to the photo whose best crop for that panel's role (face, sky, sea, detail...)
// scores highest, balanced so every photo appears, and each crop avoids what its photo already shows elsewhere and
// anything that would look like a panel already on the cover (no two stretches of the same sea).

import { findCropWindow, windowToCrop } from './smartCrop.js';

/** Photos sorted for the hero slot: face confidence, contrast and warm light. */
export function rankPhotosForHero(photos) {
  return [...photos].sort((a, b) => b.analysis.heroScore - a.analysis.heroScore);
}

/** The smallest crop (share of the full-fit height) that keeps a panel sharp: limits upscaling of small photos. */
function minCropFraction(photo, panel) {
  const aspect = panel.bounds.w / panel.bounds.h;
  const fitH = photo.w / photo.h > aspect ? photo.h : photo.w / aspect;
  return Math.min(1, (panel.bounds.h * (panel.hero ? 0.8 : 0.55)) / fitH);
}

/** One smart crop for one panel from one photo, avoiding the given windows and looks. */
export function smartCropForPanel(photo, panel, used = [], looks = []) {
  const aspect = panel.bounds.w / panel.bounds.h;
  const win = findCropWindow(photo.analysis, panel.role, aspect, used, minCropFraction(photo, panel), looks);
  return { win, crop: { photoId: photo.id, ...windowToCrop(photo.analysis, win, aspect), flip: false } };
}

/** The role a photo plays in a panel: a face already on the cover turns into a scene instead of repeating. */
function effectiveRole(role, usage, photoCount) {
  const faceShown = usage.roles.has('face') || usage.roles.has('mid');
  if ((role === 'face' || role === 'mid') && faceShown) {
    if (photoCount > 1) return usage.roles.has('wide') ? 'detail' : 'wide';
    return usage.roles.has('face') && usage.roles.has('mid') ? 'detail' : usage.roles.has('face') ? 'mid' : 'face';
  }
  return role;
}

/** Builds the arrangement (one crop entry per panel) for a layout from a list of photos. */
export function assignPhotosToPanels(photos, layout) {
  const panels = layout.panels;
  if (!photos.length) return panels.map(() => ({ photoId: null, cx: 0.5, cy: 0.5, zoom: 1, flip: false }));
  const ranked = rankPhotosForHero(photos);
  const usage = new Map(photos.map((p) => [p.id, { count: 0, windows: [], roles: new Set() }]));
  const looks = [];
  const result = new Array(panels.length);
  // hero first, then the most specific roles (faces, sky, sea) before the generic ones, larger panels first
  const priority = { face: 0, mid: 1, sky: 2, sea: 3, wide: 4, detail: 5 };
  const order = [...panels].sort(
    (a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0) || (priority[a.role] ?? 9) - (priority[b.role] ?? 9) || b.bounds.w * b.bounds.h - a.bounds.w * a.bounds.h,
  );
  for (const panel of order) {
    let pick = null;
    const candidates = panel.hero ? [ranked[0]] : ranked;
    for (const photo of candidates) {
      const u = usage.get(photo.id);
      const role = effectiveRole(panel.role, u, photos.length);
      const { win, crop } = smartCropForPanel(photo, { ...panel, role }, u.windows, role === 'face' || role === 'mid' ? [] : looks);
      let score = win.score - 0.35 * u.count + (u.count === 0 ? 0.6 : 0);
      if (role !== panel.role) score -= 0.5;
      if (!pick || score > pick.score) pick = { score, photo, role, win, crop };
    }
    const u = usage.get(pick.photo.id);
    u.roles.add(pick.role);
    u.count++;
    // portraits never block a scene (the face itself is kept out of scene crops anyway);
    // scenes are compared with scenes, by position on their photo and by look across the cover
    if (pick.role !== 'face' && pick.role !== 'mid') {
      u.windows.push(pick.win);
      looks.push(pick.win.look);
    }
    result[panel.index] = pick.crop;
  }
  return result;
}
