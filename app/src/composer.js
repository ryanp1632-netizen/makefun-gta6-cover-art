// Composes a whole cover on a canvas: scenery backdrop, graded photo panels with frames and shadows, scrims,
// name tags, lens flare and all the lettering, then grain and vignette. The same function draws the live preview
// (at a reduced pixel scale) and the exported PNGs (at scale 1), so the export is exactly what the preview shows.

import { gradePanelCanvas, gradeVariant, applyVignette } from './grades.js';
import { cropToSourceRect } from './smartCrop.js';
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
} from './lettering.js';
import { drawFilmGrain, drawLensFlare, drawSceneBackdrop, drawTitleGlow } from './scenery.js';

const panelCache = new Map();
const PANEL_CACHE_LIMIT = 48;

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

/** Draws one panel: drop shadow, clipped graded photo, dark outer frame and a thin light inner frame. */
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

function drawPanelInnerFrame(ctx, panel, grade) {
  const inner = panel.poly.map((p, i, arr) => {
    // pull each corner a few pixels towards the centre
    const cx = arr.reduce((a, q) => a + q.x, 0) / arr.length;
    const cy = arr.reduce((a, q) => a + q.y, 0) / arr.length;
    const d = Math.hypot(cx - p.x, cy - p.y) || 1;
    return { x: p.x + ((cx - p.x) / d) * 8, y: p.y + ((cy - p.y) / d) * 8 };
  });
  ctx.save();
  tracePolygon(ctx, inner);
  ctx.lineWidth = panel.hero ? 2.2 : 1.6;
  ctx.strokeStyle = panel.hero ? grade.theme.accent : 'rgba(255,255,255,0.7)';
  ctx.globalAlpha = panel.hero ? 0.9 : 0.75;
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

/** Where a panel's name tag sits: inside the chosen corner of its polygon. */
export function nameTagSpot(panel, size) {
  const [tl, tr, br, bl] = panel.poly;
  const inset = size * 0.9;
  switch (panel.tag) {
    case 'br':
      return { x: br.x - inset, y: br.y - inset * 0.8, align: 'right' };
    case 'tl':
      return { x: tl.x + inset, y: tl.y + inset * 2.2, align: 'left' };
    case 'tr':
      return { x: tr.x - inset, y: tr.y + inset * 2.2, align: 'right' };
    default:
      return { x: bl.x + inset, y: bl.y - inset * 0.8, align: 'left' };
  }
}

/**
 * Renders the cover. `k` is output pixels per design pixel; the context must be sized W*k x H*k.
 * opts: { size, layout, grade, photosById, arrangement, caption, titleFont }
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
  const tagSize = Math.max(22, Math.min(36, Math.min(W, H) * 0.03));
  layout.panels.forEach((panel, i) => {
    const label = caption.tags?.[i];
    if (!label) return;
    const spot = nameTagSpot(panel, tagSize);
    drawNameTag(ctx, label, spot.x, spot.y, tagSize, theme, spot.align);
  });
  drawLensFlare(ctx, W, H, layout.scene.sunX, layout.scene.sunY - layout.scene.sunR * 0.35, layout.scene.sunR * 1.4, theme);
  drawTaglineRibbon(ctx, caption.tagline, text.tagline, theme);
  const fit = drawChromeTitle(ctx, caption.title, text.title, theme, titleFont);
  const last = fit.lines[fit.lines.length - 1];
  const st = text.subtitle;
  const subX = text.title.align === 'center' ? Math.min(text.title.x + text.title.w, last.x + last.width + st.dx) : last.x + last.width + st.dx;
  drawNeonScript(ctx, caption.subtitle, subX, last.baseline + st.dy, st.size, st.rot, theme, text.title.w * 0.8);
  drawReviewQuote(ctx, caption.quote, caption.quoteSource, text.quote, theme);
  drawBillingBlock(ctx, caption.billing, text.billing, theme);
  drawSealBadge(ctx, text.seal, caption.badge, theme);
  drawBarcode(ctx, text.barcode, caption.title);
  drawComingSoon(ctx, caption.coming, text.coming, theme);
  applyVignette(ctx, W, H, 0.28, theme.bg);
  ctx.restore();
  // grain at output resolution, not scaled
  drawFilmGrain(ctx, W * k, H * k, 0.07);
}
