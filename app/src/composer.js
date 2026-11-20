// Golden Mile Cover Studio composer: draws a whole cover on a canvas. Scenery backdrop, graded photo panels with
// frames and shadows, scrims, the dark title band, name tags placed clear of every face, lens flare and all the
// lettering, then vignette and grain. The same function draws the live preview (at a reduced pixel scale) and the
// exported PNGs (at scale 1), so the export is exactly what the preview shows.

import { gradePanelCanvas, gradeVariant, applyVignette } from './grades.js';
import { cropToSourceRect, headRectInPanel } from './smartCrop.js';
import { insetPolygon, pointInPolygon, polygonXRangeAt, rectsOverlap } from './layouts.js';
import {
  drawBarcode,
  drawBillingBlock,
  drawChromeTitle,
  drawComingSoon,
  drawNameTag,
  drawNeonScript,
  drawReviewQuote,
  drawSealBadge,
  drawTaglineRibbon,
  measureNameTag,
} from './lettering.js';
import { drawFilmGrain, drawLensFlare, drawSceneBackdrop, drawTitleBand, drawTitleGlow } from './scenery.js';

const panelCache = new Map();
const PANEL_CACHE_LIMIT = 56;

function tracePolygon(ctx, poly) {
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

/** The cropped, flipped and graded photo for one panel at the given pixel scale, cached by its inputs. */
export function renderPanelImage(photo, entry, panel, grade, k) {
  const pw = Math.max(2, Math.ceil(panel.bounds.w * k));
  const ph = Math.max(2, Math.ceil(panel.bounds.h * k));
  const key = [photo.id, entry.cx.toFixed(4), entry.cy.toFixed(4), entry.zoom.toFixed(4), entry.flip ? 1 : 0, pw, ph, grade.id, panel.index].join('|');
  if (panelCache.has(key)) {
    const hit = panelCache.get(key);
    panelCache.delete(key);
    panelCache.set(key, hit);
    return hit;
  }
  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const src = cropToSourceRect(photo.w, photo.h, entry, panel.bounds.w / panel.bounds.h);
  ctx.imageSmoothingQuality = 'high';
  if (entry.flip) {
    ctx.translate(pw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(photo.source, src.x, src.y, src.w, src.h, 0, 0, pw, ph);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  gradePanelCanvas(canvas, gradeVariant(grade, panel.index), k, 11 + panel.index * 97);
  panelCache.set(key, canvas);
  while (panelCache.size > PANEL_CACHE_LIMIT) panelCache.delete(panelCache.keys().next().value);
  return canvas;
}

/** An empty panel waiting for a photo. */
function drawEmptyPanel(ctx, panel, theme) {
  const b = panel.bounds;
  const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  g.addColorStop(0, theme.sky[1]);
  g.addColorStop(1, theme.sky[3]);
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `${Math.min(b.h * 0.18, 44)}px "Bebas Neue"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`+ PHOTO ${panel.index + 1}`, b.x + b.w / 2, b.y + b.h / 2);
}

/** Draws one panel: drop shadow, clipped graded photo and a dark outer frame. */
function drawPanel(ctx, panel, entry, photo, grade, k) {
  const theme = grade.theme;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 26 * k;
  ctx.shadowOffsetX = 5 * k;
  ctx.shadowOffsetY = 10 * k;
  ctx.fillStyle = theme.bg;
  tracePolygon(ctx, panel.poly);
  ctx.fill();
  ctx.restore();
  ctx.save();
  tracePolygon(ctx, panel.poly);
  ctx.clip();
  if (photo) {
    const img = renderPanelImage(photo, entry, panel, grade, k);
    ctx.drawImage(img, panel.bounds.x, panel.bounds.y, img.width / k, img.height / k);
  } else {
    drawEmptyPanel(ctx, panel, theme);
  }
  ctx.restore();
  ctx.save();
  ctx.lineJoin = 'miter';
  tracePolygon(ctx, panel.poly);
  ctx.lineWidth = 4;
  ctx.strokeStyle = theme.outline;
  ctx.stroke();
  ctx.restore();
}

/** A thin light frame just inside each panel (an accent-coloured one on the hero). */
function drawPanelInnerFrame(ctx, panel, grade) {
  const inner = insetPolygon(panel.poly, 7);
  ctx.save();
  tracePolygon(ctx, inner);
  ctx.lineWidth = panel.hero ? 2.4 : 1.6;
  ctx.strokeStyle = panel.hero ? grade.theme.accent : 'rgba(255,255,255,0.7)';
  ctx.globalAlpha = panel.hero ? 0.95 : 0.75;
  ctx.stroke();
  ctx.restore();
}

function drawScrim(ctx, W, s, theme) {
  const x1 = s.x1 || W;
  const g = ctx.createLinearGradient(0, s.y0, 0, s.y1);
  const a0 = Math.round(s.from * 255).toString(16).padStart(2, '0');
  const a1 = Math.round(s.to * 255).toString(16).padStart(2, '0');
  g.addColorStop(0, theme.bg + a0);
  g.addColorStop(1, theme.bg + a1);
  ctx.fillStyle = g;
  ctx.fillRect(s.x0, s.y0, x1 - s.x0, s.y1 - s.y0);
}

/**
 * Where a panel's name tag goes: a corner of the panel's free area (bottom corners first, the side away from the
 * face preferred) where the plate stays inside the panel, off every lettering zone and off the head.
 * Returns { x, y } of the plate's bottom-left corner in design pixels.
 */
export function placeNameTag(panel, head, tagW, tagH, clear) {
  const f = panel.focus ?? panel.bounds;
  const inner = insetPolygon(panel.poly, 10);
  const m = 16;
  // the head box ends just below the chin; a tag may touch that last strip, never the face or hair
  const headPad = head ? { x: head.x - 8, y: head.y - 8, w: head.w + 16, h: head.h * 0.92 + 8 } : null;
  const headCx = head ? head.x + head.w / 2 : f.x + f.w / 2;
  const candidates = [];
  // corners of the free area, the panel's own edges at the same heights (for narrow free areas), and spots a
  // little below the free area where the lettering leaves a corner of the panel open
  const rows = [
    [f.y + f.h - m, 3],
    [f.y + f.h * 0.72, 1.5],
    [f.y + m + tagH, 1],
  ];
  for (let k = 1; k <= 5; k++) rows.push([f.y + f.h - m + k * tagH * 0.5, 2.8 - k * 0.1]);
  for (const [y, pref] of rows) {
    candidates.push({ x: f.x + m, y, pref }, { x: f.x + f.w - m - tagW, y, pref });
    const span = polygonXRangeAt(inner, y - tagH);
    const span2 = polygonXRangeAt(inner, y);
    if (span && span2) {
      const lo = Math.max(span[0], span2[0]) + 6;
      const hi = Math.min(span[1], span2[1]) - 6 - tagH * 0.3;
      candidates.push({ x: lo, y, pref: pref - 0.3 }, { x: hi - tagW, y, pref: pref - 0.3 });
    }
  }
  let best = null;
  for (const c of candidates) {
    const rect = { x: c.x, y: c.y - tagH, w: tagW, h: tagH };
    const corners = [
      [rect.x, rect.y],
      [rect.x + rect.w + tagH * 0.3, rect.y],
      [rect.x + rect.w, rect.y + rect.h],
      [rect.x, rect.y + rect.h],
    ];
    const inside = corners.every(([x, y]) => pointInPolygon(inner, x, y));
    const blocked = clear.some((r) => rectsOverlap(rect, r));
    const onHead = headPad && rectsOverlap(rect, headPad);
    const away = Math.abs(rect.x + rect.w / 2 - headCx) / Math.max(1, f.w);
    // hidden under lettering is worst, outside the panel next, over hair or a face edge least bad
    const score = (inside ? 0 : -10) + (blocked ? -14 : 0) + (onHead ? -6 : 0) + c.pref + away;
    if (!best || score > best.score) best = { x: c.x, y: c.y, score, fits: inside && !blocked, ok: inside && !blocked && !onHead };
  }
  return best;
}

const TAG_STEPS = [1, 0.88, 0.77, 0.67];

/**
 * Places a name tag: full size off the face if possible, else a little smaller; failing that, the largest size that
 * at least stays inside the panel and off the lettering.
 */
function fitNameTag(ctx, panel, head, label, size, clear, W) {
  const tries = TAG_STEPS.map((k) => {
    const m = measureNameTag(ctx, label, size * k);
    return { ...placeNameTag(panel, head, m.w, m.h, clear), size: size * k, w: m.w + m.h * 0.3 };
  });
  const pick = tries.find((t) => t.ok) ?? tries.find((t) => t.fits);
  if (pick) return pick;
  // a panel too narrow for the plate: the smallest one, kept on the cover and overhanging towards the middle
  const last = tries[tries.length - 1];
  return { ...last, x: Math.max(14, Math.min(last.x, W - 14 - last.w)) };
}

/** The text of each panel's name tag: a typed tag wins; otherwise the photo's own tag, once per person. */
export function nameTagsFor(layout, arrangement, photosById, caption) {
  const seen = new Set();
  return layout.panels.map((panel, i) => {
    const typed = (caption.tags?.[i] ?? '').trim();
    if (typed) return typed === '-' ? '' : typed;
    if (caption.autoTags === false) return '';
    const entry = arrangement[i];
    const photo = entry && entry.photoId != null ? photosById.get(entry.photoId) : null;
    if (!photo || !photo.tag || seen.has(photo.id)) return '';
    seen.add(photo.id);
    return photo.tag;
  });
}

/** Development aid: the lettering zones (red), each panel's free area (green) and every head (yellow). */
function drawLayoutDebug(ctx, layout, arrangement, photosById) {
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,40,40,0.9)';
  for (const r of layout.clear) ctx.strokeRect(r.x, r.y, r.w, r.h);
  layout.panels.forEach((panel, i) => {
    ctx.strokeStyle = 'rgba(40,255,90,0.95)';
    const f = panel.focus;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    const entry = arrangement[i];
    const photo = entry && photosById.get(entry.photoId);
    if (photo) {
      const h = headRectInPanel(photo, entry, panel);
      ctx.strokeStyle = 'rgba(255,230,0,0.95)';
      ctx.strokeRect(h.x, h.y, h.w, h.h);
    }
  });
  ctx.restore();
}

/**
 * Renders the cover. `k` is output pixels per design pixel; the context must be sized W*k x H*k.
 * opts: { size, layout, grade, photosById, arrangement, caption, titleFont, debug }
 */
export function renderCover(ctx, opts, k = 1) {
  const { size, layout, grade, photosById, arrangement, caption, titleFont } = opts;
  const W = size.w;
  const H = size.h;
  const theme = grade.theme;
  const text = layout.text;
  ctx.save();
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  drawSceneBackdrop(ctx, W, H, layout.scene, theme, { stars: grade.id === 'neon-night' || grade.id === 'ultraviolet' ? 0.8 : 0.25 });
  drawTitleGlow(ctx, text.glow, theme);
  layout.panels.forEach((panel, i) => {
    const entry = arrangement[i];
    const photo = entry && entry.photoId != null ? photosById.get(entry.photoId) : null;
    drawPanel(ctx, panel, entry, photo, grade, k);
  });
  for (const s of text.scrims) drawScrim(ctx, W, s, theme);
  layout.panels.forEach((panel) => drawPanelInnerFrame(ctx, panel, grade));
  if (text.band) drawTitleBand(ctx, text.band, theme);
  const tags = nameTagsFor(layout, arrangement, photosById, caption);
  const tagSize = Math.max(22, Math.min(34, Math.min(W, H) * 0.029));
  layout.panels.forEach((panel, i) => {
    const label = tags[i];
    if (!label) return;
    const entry = arrangement[i];
    const photo = entry && entry.photoId != null ? photosById.get(entry.photoId) : null;
    const head = photo ? headRectInPanel(photo, entry, panel) : null;
    const spot = fitNameTag(ctx, panel, head, label, tagSize, layout.clear, W);
    drawNameTag(ctx, label, spot.x, spot.y, spot.size, theme, 'left');
  });
  drawLensFlare(ctx, W, H, layout.scene.sunX, layout.scene.sunY - layout.scene.sunR * 0.35, layout.scene.sunR * 1.4, theme, !text.band);
  drawTaglineRibbon(ctx, caption.tagline, text.tagline, theme);
  const fit = drawChromeTitle(ctx, caption.title, text.title, theme, titleFont);
  const last = fit.lines[fit.lines.length - 1];
  const st = text.subtitle;
  const subX = Math.min(text.title.x + text.title.w + Math.max(0, st.dx), last.x + last.width + st.dx);
  drawNeonScript(ctx, caption.subtitle, subX, last.baseline + st.dy, st.size, st.rot, theme, text.title.w * 0.72);
  if (text.quote) drawReviewQuote(ctx, caption.quote, caption.quoteSource, text.quote, theme);
  if (text.billing) drawBillingBlock(ctx, caption.billing, text.billing, theme);
  if (text.seal) drawSealBadge(ctx, text.seal, caption.badge, theme);
  if (text.barcode) drawBarcode(ctx, text.barcode, caption.title);
  if (text.coming) drawComingSoon(ctx, caption.coming, text.coming, theme);
  applyVignette(ctx, W, H, 0.26, theme.bg);
  if (opts.debug) drawLayoutDebug(ctx, layout, arrangement, photosById);
  ctx.restore();
  // grain at output resolution, not scaled
  drawFilmGrain(ctx, W * k, H * k, 0.07);
}
