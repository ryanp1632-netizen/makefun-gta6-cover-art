// Small rendered thumbnails for the layout and colour-grade presets, plus the header's brand mark.

import { gradeCanvas } from './grades.js';
import { drawSunsetSky, drawPalmSilhouette, drawStripedSun } from './decor.js';

/** Schematic of a layout at the current size: panels, sky band and title bar. */
export function drawLayoutThumbnail(canvas, layout, width) {
  const height = Math.round((width * layout.H) / layout.W);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.aspectRatio = `${layout.W} / ${layout.H}`;
  const ctx = canvas.getContext('2d');
  const k = canvas.width / layout.W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#14071c';
  ctx.fillRect(0, 0, layout.W, layout.H);
  if (layout.sky) {
    const g = ctx.createLinearGradient(0, layout.sky.y, 0, layout.sky.horizon);
    g.addColorStop(0, '#5b1260');
    g.addColorStop(1, '#ff9a3c');
    ctx.fillStyle = g;
    ctx.fillRect(0, layout.sky.y, layout.W, layout.sky.horizon - layout.sky.y);
  }
  layout.panels.forEach((p, i) => {
    const g = ctx.createLinearGradient(0, p.bbox.y, 0, p.bbox.y + p.bbox.h);
    g.addColorStop(0, p.hero ? '#ffcf5a' : i % 2 ? '#c2477a' : '#e0703c');
    g.addColorStop(1, p.hero ? '#ff7a3a' : i % 2 ? '#5a1a5c' : '#7a2450');
    ctx.fillStyle = g;
    ctx.beginPath();
    p.poly.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,220,0.75)';
    const cx = p.zone.x + p.zone.w / 2;
    const cy = p.zone.y + p.zone.h * 0.3;
    const r = Math.min(p.zone.w, p.zone.h) * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 2.6, r * 1.9, r * 1.3, 0, Math.PI, 0);
    ctx.fill();
  });
  const t = layout.title;
  const g = ctx.createLinearGradient(0, t.cy - t.h * 0.3, 0, t.cy + t.h * 0.3);
  g.addColorStop(0, '#fff6a8');
  g.addColorStop(0.5, '#ffb02e');
  g.addColorStop(1, '#ff3d7f');
  ctx.fillStyle = 'rgba(10,0,20,0.85)';
  ctx.fillRect(t.cx - t.w * 0.45 - 12, t.cy - t.h * 0.3 - 12, t.w * 0.9 + 24, t.h * 0.6 + 24);
  ctx.fillStyle = g;
  ctx.fillRect(t.cx - t.w * 0.45, t.cy - t.h * 0.3, t.w * 0.9, t.h * 0.6);
}

/** A graded swatch: the first photo's face (or a code-drawn sunset) run through the grade. */
export function drawGradeThumbnail(canvas, grade, photo, width, height) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (photo) {
    const f = photo.face;
    const side = Math.max(f.w, f.h) * 2.1;
    const sw = side * (w / h);
    const sx = Math.max(0, Math.min(photo.w - sw, f.x + f.w / 2 - sw / 2));
    const sy = Math.max(0, Math.min(photo.h - side, f.y - f.h * 0.4));
    ctx.drawImage(photo.canvas, sx, sy, sw, side, 0, 0, w, h);
  } else {
    drawSunsetSky(ctx, { x: 0, y: 0, w, h }, h * 0.7, w * 0.6, h * 0.3, 'gold');
    drawPalmSilhouette(ctx, w * 0.2, h, h * 0.9, 0.12, '#14071c');
  }
  gradeCanvas(ctx, grade, w, h, w / 1080);
  const pal = grade.letter;
  const g = ctx.createLinearGradient(0, h * 0.74, 0, h * 0.96);
  g.addColorStop(0, pal.fill[1]);
  g.addColorStop(1, pal.fill[3]);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  ctx.fillStyle = g;
  ctx.font = `${Math.round(h * 0.24)}px "GM Anton", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('SUNDOWN', w / 2, h * 0.95);
}

/** Header brand mark: a striped sun with a palm in a round badge. */
export function drawBrandMark(canvas) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  ctx.save();
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#3a0f4a');
  g.addColorStop(1, '#ff5a7a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  drawStripedSun(ctx, s / 2, s * 0.62, s * 0.3);
  drawPalmSilhouette(ctx, s * 0.28, s, s * 0.8, 0.15, '#1a0820');
  ctx.restore();
}
