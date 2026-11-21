// renderCover: composes one poster onto a canvas of any pixel size. Order of work:
//   dark sunset backdrop (+ sky, sun, skyline, palms) -> panels (soft drop shadow, smart-cropped, auto-exposed and
//   face-sharpened photo) -> whole-poster colour grade (pixels with skin protection, neon panels kept cool, shared
//   film grain, bloom, light leaks) -> warm-white keyline frames -> title glow and bottom shade -> lettering (review top bar, billing, barcode,
//   release line, seal, ribbon, title, neon script, name tags, sparkles, flare).
// It returns a report with every panel's polygon, face rect and name-tag rect, plus all lettering rects, which the
// editor uses for hit-testing and the test hook uses to prove no lettering covers a face.

import { getLayout, pointInPolygon, innerRect } from './layouts.js';
import { GRADES, applyGradeByKey, autoExposePanel, measurePanelNeon, neonPanelGradeMix } from './grades.js';
import { sharpenFaceArea } from './photoFinish.js';
import { frameHeadAndShoulders, drawFramedPhoto } from './smartCrop.js';
import {
  drawSunsetSky, drawPalmSilhouette, drawSkyline, drawTitleGlow, drawLensFlare, drawEmptyPanelArt, drawPosterBackdrop,
  drawStripedSun, SKY_MOOD_FOR_GRADE, SKY_PALETTES_FOR_SUN,
} from './decor.js';
import {
  drawChromeTitle, drawTitleSparkles, drawNeonScript, drawTaglineRibbon, drawNameTag, measureNameTag, drawReviewTopBar,
  drawSealBadge, drawBarcode, drawBillingBlock, drawReleaseLine, withAlpha,
} from './lettering.js';
import { TITLE_FONTS, SCRIPT_FONTS } from './fonts.js';

const panelCache = new Map();
const PANEL_CACHE_LIMIT = 96;

function panelCacheKey(photo, slot, panel, scale) {
  const b = panel.bbox;
  const z = panel.zone;
  return [photo.id, slot.zoom, slot.panX, slot.panY, slot.flip, slot.variant, panel.hero, b.w, b.h, z.x - b.x, z.y - b.y, z.w, z.h, scale.toFixed(4)].join('|');
}

/** Render one panel's framed, auto-exposed photo at device resolution. */
export function renderPanelImage(panel, photo, slot, scale) {
  const key = panelCacheKey(photo, slot, panel, scale);
  const hit = panelCache.get(key);
  if (hit) return hit;
  const { bbox } = panel;
  const zone = { x: panel.zone.x - bbox.x, y: panel.zone.y - bbox.y, w: panel.zone.w, h: panel.zone.h };
  const frame = frameHeadAndShoulders(photo, bbox.w, bbox.h, zone, {
    zoom: slot.zoom, panX: slot.panX, panY: slot.panY, flip: slot.flip, variant: slot.variant, hero: panel.hero,
  });
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(bbox.w * scale));
  c.height = Math.max(1, Math.ceil(bbox.h * scale));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.setTransform(scale, 0, 0, scale, 0, 0);
  drawFramedPhoto(g, photo, frame, bbox.w, bbox.h);
  const img = g.getImageData(0, 0, c.width, c.height);
  const f = frame.face;
  const faceDev = f ? { x: f.x * scale, y: f.y * scale, w: f.w * scale, h: f.h * scale } : null;
  autoExposePanel(img, faceDev);
  sharpenFaceArea(img, faceDev, 0.75);
  g.putImageData(img, 0, 0);
  const result = { canvas: c, frame, neon: measurePanelNeon(img) };
  panelCache.set(key, result);
  if (panelCache.size > PANEL_CACHE_LIMIT) panelCache.delete(panelCache.keys().next().value);
  return result;
}

function tracePolygon(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** The soft drop shadow a framed still casts on the poster ground. */
export function drawPanelShadow(ctx, poly, W, scale, bg) {
  const k = W / 1920;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.82)';
  ctx.shadowBlur = 34 * k * scale;
  ctx.shadowOffsetX = 5 * k * scale;
  ctx.shadowOffsetY = 12 * k * scale;
  ctx.fillStyle = bg;
  tracePolygon(ctx, poly);
  ctx.fill();
  ctx.restore();
}

/**
 * Fade a panel's lower part into the poster's dusk colour, where the title stack sits on it; with fade.sun, a
 * striped sunset rises from the panel's bottom edge behind the script.
 */
export function drawPanelFade(ctx, panel, bg, mood) {
  const { y0, y1, strength, sun } = panel.fade;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, withAlpha(bg, 0));
  g.addColorStop(0.45, withAlpha(bg, strength * 0.6));
  g.addColorStop(1, withAlpha(bg, strength));
  ctx.fillStyle = g;
  ctx.fillRect(panel.bbox.x, y0, panel.bbox.w, y1 - y0);
  if (sun) {
    ctx.save();
    ctx.globalAlpha = sun.alpha ?? 0.9;
    drawStripedSun(ctx, sun.cx, sun.cy, sun.r, SKY_PALETTES_FOR_SUN[mood]);
    ctx.restore();
    const haze = ctx.createLinearGradient(0, sun.cy - sun.r * 0.2, 0, y1);
    haze.addColorStop(0, withAlpha(bg, 0));
    haze.addColorStop(1, withAlpha(bg, 0.55));
    ctx.fillStyle = haze;
    ctx.fillRect(panel.bbox.x, sun.cy - sun.r * 0.2, panel.bbox.w, y1 - sun.cy + sun.r * 0.2);
  }
}

/**
 * The neon-keep mask for the grade: one byte per device pixel, set inside every panel whose own photo is strongly
 * neon-night (magenta and cyan city light), so a golden grade does not flatten that panel to beige. Returns null
 * when no panel qualifies.
 */
export function buildNeonKeepMask(panelMixes, pw, ph, scale) {
  if (!panelMixes.some((p) => p.mix > 0.01)) return null;
  const c = document.createElement('canvas');
  c.width = pw;
  c.height = ph;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.setTransform(scale, 0, 0, scale, 0, 0);
  for (const { poly, mix } of panelMixes) {
    if (mix <= 0.01) continue;
    g.fillStyle = `rgba(0,0,0,${mix.toFixed(3)})`;
    tracePolygon(g, poly);
    g.fill();
  }
  const d = g.getImageData(0, 0, pw, ph).data;
  const keep = new Uint8Array(pw * ph);
  for (let i = 0, j = 3; i < keep.length; i++, j += 4) keep[i] = d[j];
  return keep;
}

/**
 * A thin warm-white keyline around a panel, with a faint dark matte just inside it, so each photo reads as a
 * deliberately framed still. Drawn after the grade so the line stays crisp.
 */
export function drawPanelKeyline(ctx, poly, color, W, hero) {
  const lw = Math.max(2, W / 680) * (hero ? 1.25 : 1);
  ctx.save();
  tracePolygon(ctx, poly);
  ctx.clip();
  ctx.strokeStyle = 'rgba(10,0,20,0.42)';
  ctx.lineWidth = lw * 4.2;
  ctx.lineJoin = 'miter';
  tracePolygon(ctx, poly);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.96;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'miter';
  tracePolygon(ctx, poly);
  ctx.stroke();
  ctx.restore();
}

export function rectsOverlap(a, b, pad = 0) {
  return a && b && a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Find a spot for a name tag inside its panel that covers neither the face nor any lettering. */
export function placeNameTag(ctx, text, panel, faceRect, avoid, baseSize, W, H) {
  const b = panel.bbox;
  // Keep clear of the jaw and beard too: the tag treats the face as reaching a little further down.
  const faceAbs = faceRect ? { ...faceRect, h: faceRect.h * 1.22 } : null;
  // Shrink the tag to fit narrow panels.
  const narrowest = innerRect(panel.poly, b.y + b.h * 0.1, b.y + b.h * 0.9, 0).w;
  let size = baseSize;
  let { w, h } = measureNameTag(ctx, text, size);
  const room = narrowest - size * 1.6;
  if (w > room) {
    size = Math.max(baseSize * 0.55, (size * room) / w);
    ({ w, h } = measureNameTag(ctx, text, size));
  }
  const m = size * 0.7;
  const yTop = b.y + m;
  const yBot = b.y + b.h - h - m;
  const spanFor = (y) => innerRect(panel.poly, y, y + h, m + h * 0.25);
  // Preferred spots first (just under or over the head, then the layout's corners), then a scan of the panel.
  const candidates = [];
  const both = (y) => {
    if (y < b.y + m * 0.5 || y + h > b.y + b.h - m * 0.5) return;
    const s = spanFor(y);
    candidates.push({ x: s.x, y }, { x: s.x + s.w - w, y });
  };
  if (faceAbs) {
    both(faceAbs.y + faceAbs.h + size * 0.35);
    both(faceAbs.y - h - size * 0.35);
  }
  for (const corner of panel.tagOrder) {
    const y = corner[0] === 't' ? yTop : yBot;
    const s = spanFor(y);
    candidates.push({ x: corner[1] === 'l' ? s.x : s.x + s.w - w, y });
  }
  for (let y = yTop; y <= yBot; y += h * 0.5) both(y);
  let best = null;
  for (const c of candidates) {
    const rect = { x: c.x - h * 0.22, y: c.y, w: w + h * 0.44, h };
    const inside = rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= W && rect.y + rect.h <= H;
    const s = spanFor(c.y);
    const fits = c.x >= s.x - 1 && c.x + w <= s.x + s.w + 1;
    let cost = (inside ? 0 : 1e6) + (fits ? 0 : 5e5);
    if (faceRect) {
      const onFace = overlapArea(rect, { x: faceRect.x - 6, y: faceRect.y - 6, w: faceRect.w + 12, h: faceRect.h + 12 });
      if (onFace > 0) cost += onFace * 50 + 4e5;
    }
    if (faceAbs) cost += overlapArea(rect, faceAbs) * 4;
    for (const r of avoid) {
      if (!r) continue;
      const a = overlapArea(rect, r);
      if (a > 0) cost += a * 10 + (r.hard ? 2e5 : 0);
    }
    if (!best || cost < best.cost) best = { ...c, rect, cost, size };
    if (cost === 0) break;
  }
  return best;
}

/** Lettering kinds a name tag must keep a clear margin from (it may never sit under or touch them). */
const TAG_CLEAR_KINDS = new Set(['title', 'subtitle', 'ribbon', 'seal']);

/**
 * Place a name tag so it never sits under or touches the title band, neon script, tagline ribbon or seal: those
 * rects are grown by a clearance margin (about one tag height) and any touch costs far more than a free spot.
 */
export function placeNameTagClearOfTitle(ctx, text, panel, faceRect, lettering, baseSize, W, H) {
  const clear = baseSize * 1.1;
  const near = baseSize * 0.35;
  const avoid = lettering.map((r) => {
    const pad = TAG_CLEAR_KINDS.has(r.kind) ? clear : near;
    return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2, hard: TAG_CLEAR_KINDS.has(r.kind) || r.kind === 'tag' };
  });
  return placeNameTag(ctx, text, panel, faceRect, avoid, baseSize, W, H);
}

/**
 * Render a cover. doc ={layout, grade, caption, panels[]}; photos = Map(id -> photo record).
 * The canvas size decides the output resolution; the layout is chosen by sizeKey.
 */
export function renderCover(canvas, doc, photos, sizeKey) {
  const layout = getLayout(doc.layout, sizeKey);
  const { W, H } = layout;
  const pw = canvas.width;
  const ph = canvas.height;
  const scale = pw / W;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const grade = GRADES[doc.grade] || GRADES.sunsetGold;
  const pal = grade.letter;
  const mood = SKY_MOOD_FOR_GRADE[grade.key] || 'gold';
  const cap = doc.caption;
  const titleFamily = (TITLE_FONTS[cap.titleFont] || TITLE_FONTS.anton).family;
  const scriptFamily = (SCRIPT_FONTS[cap.scriptFont] || SCRIPT_FONTS.yellowtail).family;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.clearRect(0, 0, pw, ph);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // 1. Backdrop: a dark sunset ground, plus the layout's sunset scene where it has one.
  drawPosterBackdrop(ctx, W, H, mood, layout.title.cy);
  if (layout.sky) {
    const sky = layout.sky;
    drawSunsetSky(ctx, { x: 0, y: sky.y, w: W, h: sky.h }, sky.horizon, sky.sunX, sky.sunR, mood);
    const silhouette = withAlpha(pal.bg, 0.96);
    drawSkyline(ctx, W * 0.05, W * 0.42, sky.horizon + 2, sky.sunR * 0.9, withAlpha(pal.bg, 0.85), 'rgba(255,214,140,0.7)', 11);
    drawSkyline(ctx, W * 0.6, W * 0.96, sky.horizon + 2, sky.sunR * 0.75, withAlpha(pal.bg, 0.85), 'rgba(255,214,140,0.7)', 23);
    for (const [px, py, ph2, lean] of sky.palms || []) drawPalmSilhouette(ctx, px, py, ph2, lean, silhouette);
  }

  // 2. Panels.
  const report = { sizeKey: layout.sizeKey, layoutKey: layout.layoutKey, W, H, panels: [], textRects: [] };
  layout.panels.forEach((panel, i) => {
    const slot = doc.panels[i] || {};
    const photo = slot.photoId ? photos.get(slot.photoId) : null;
    drawPanelShadow(ctx, panel.poly, W, scale, pal.bg);
    ctx.save();
    tracePolygon(ctx, panel.poly);
    ctx.clip();
    let faceAbs = null;
    let neon = 0;
    if (photo) {
      const { canvas: img, frame, neon: share } = renderPanelImage(panel, photo, slot, scale);
      neon = share;
      ctx.drawImage(img, panel.bbox.x, panel.bbox.y, img.width / scale, img.height / scale);
      if (frame.face) faceAbs = { x: frame.face.x + panel.bbox.x, y: frame.face.y + panel.bbox.y, w: frame.face.w, h: frame.face.h };
    } else {
      drawEmptyPanelArt(ctx, panel.bbox, mood, withAlpha(pal.bg, 0.9));
    }
    // Inner edge light for depth.
    const edge = ctx.createLinearGradient(0, panel.bbox.y, 0, panel.bbox.y + panel.bbox.h);
    edge.addColorStop(0, 'rgba(255,240,220,0.10)');
    edge.addColorStop(0.2, 'rgba(255,240,220,0)');
    edge.addColorStop(0.75, 'rgba(10,0,20,0)');
    edge.addColorStop(1, 'rgba(10,0,20,0.32)');
    ctx.fillStyle = edge;
    ctx.fillRect(panel.bbox.x, panel.bbox.y, panel.bbox.w, panel.bbox.h);
    if (panel.fade) drawPanelFade(ctx, panel, pal.bg, mood);
    ctx.restore();
    report.panels.push({
      index: i, poly: panel.poly, bbox: panel.bbox, zone: panel.zone, hero: panel.hero, photoId: photo ? photo.id : null,
      face: faceAbs, faceInside: faceAbs ? rectInsidePolygon(faceAbs, panel.poly) : true,
      neon, neonMix: neonPanelGradeMix(neon, grade.key),
    });
  });

  // 3. One colour story across the poster; strongly neon panels keep their magenta and cyan under a golden grade.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const keep = buildNeonKeepMask(report.panels.map((p) => ({ poly: p.poly, mix: p.neonMix })), pw, ph, scale);
  applyGradeByKey(grade.key, ctx, pw, ph, scale, keep);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  for (const panel of layout.panels) drawPanelKeyline(ctx, panel.poly, pal.frame, W, panel.hero);

  // 4. Title glow and bottom shade.
  if (layout.shade) {
    const s = layout.shade;
    const g = ctx.createLinearGradient(0, s.y0, 0, s.y1);
    g.addColorStop(0, 'rgba(8,2,16,0)');
    g.addColorStop(0.55, `rgba(8,2,16,${s.strength * 0.7})`);
    g.addColorStop(1, `rgba(8,2,16,${s.strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, s.y0, W, s.y1 - s.y0);
  }
  drawTitleGlow(ctx, layout.titleGlow, pal.glow);

  // 5. Lettering.
  const rects = report.textRects;
  const push = (kind, r) => r && rects.push({ kind, ...r });
  if (layout.billing) push('billing', drawBillingBlock(ctx, cap.billing, layout.billing.cx, layout.billing.y, layout.billing.w, layout.billing.h, '#f6ecdc'));
  if (layout.barcode && layout.barcode.w) push('barcode', drawBarcode(ctx, layout.barcode.x, layout.barcode.y, layout.barcode.w, layout.barcode.h, cap.title));
  if (layout.topBar) push('topbar', drawReviewTopBar(ctx, cap.quote, cap.quoteSource, cap.edition, layout.topBar, pal));
  if (layout.release) push('release', drawReleaseLine(ctx, cap.release, layout.release.cx, layout.release.cy, layout.release.size, pal));
  if (layout.ribbon) push('ribbon', drawTaglineRibbon(ctx, cap.tagline, layout.ribbon.cx, layout.ribbon.cy, layout.ribbon.h, layout.ribbon.maxW, pal));
  const title = drawChromeTitle(ctx, cap.title, layout.title, titleFamily, pal);
  push('title', title.rect);
  if (layout.seal) push('seal', drawSealBadge(ctx, layout.seal.cx, layout.seal.cy, layout.seal.r, cap.sealRing, cap.seal, pal, titleFamily));
  if (cap.subtitle) {
    const st = layout.subtitle;
    for (const part of drawNeonScript(ctx, cap.subtitle, st.cx, st.cy, st.size, st.angle, scriptFamily, pal)) push('subtitle', part);
  }

  // Name tags, each in its panel's free area.
  const tagSize = Math.round(Math.min(W, H) * 0.024);
  const seen = new Set();
  layout.panels.forEach((panel, i) => {
    const info = report.panels[i];
    const slot = doc.panels[i] || {};
    let text = '';
    if (cap.autoTags) {
      const photo = slot.photoId ? photos.get(slot.photoId) : null;
      if (photo && !seen.has(photo.id) && slot.variant !== 'detail') text = photo.tag;
      if (photo) seen.add(photo.id);
    } else {
      text = (cap.tags && cap.tags[i]) || '';
    }
    if (!text) return;
    const spot = placeNameTagClearOfTitle(ctx, text, panel, info.face, rects, tagSize, W, H);
    if (!spot) return;
    const r = drawNameTag(ctx, text, spot.x, spot.y, spot.size, pal);
    if (r) {
      info.tag = r;
      rects.push({ kind: 'tag', panel: i, ...r });
    }
  });

  drawTitleSparkles(ctx, title.sparkles);
  const s0 = title.sparkles[0];
  drawLensFlare(ctx, s0.x, s0.y, title.size * 0.9, W, H, pal.glow);
  ctx.restore();

  // Face safety report: no lettering over any face.
  // Finish checks: each name tag keeps a margin from the title band, script, ribbon and seal; heads are measured
  // against their panel height.
  const tagMargin = tagSize * 0.25;
  for (const p of report.panels) {
    p.coveredBy = p.face ? rects.filter((r) => rectsOverlap(r, p.face, -2)).map((r) => r.kind) : [];
    p.tagTouches = p.tag ? rects.filter((r) => TAG_CLEAR_KINDS.has(r.kind) && rectsOverlap(r, p.tag, tagMargin)).map((r) => r.kind) : [];
    p.headShare = p.face ? p.face.h / p.bbox.h : 0;
  }
  return report;
}

function rectInsidePolygon(r, poly) {
  const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]];
  return pts.every(([x, y]) => pointInPolygon(x, y, poly));
}

/** Render a cover at its exact export size into a fresh canvas. */
export function renderCoverAtSize(doc, photos, sizeKey, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const report = renderCover(canvas, doc, photos, sizeKey);
  return { canvas, report };
}
