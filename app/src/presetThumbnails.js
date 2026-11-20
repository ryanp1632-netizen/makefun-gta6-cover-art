// Small rendered thumbnails for the layout and grade pickers: layouts show their panel geometry filled with the
// loaded photos and a title bar; grades show a crop of the hero photo run through that grade.

import { cropToSourceRect } from './smartCrop.js';
import { gradePanelCanvas } from './grades.js';

/** Draws a layout's panels and title zone into a small canvas. */
export function drawLayoutThumbnail(canvas, layout, size, arrangement, photosById, grade) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width / size.w;
  const theme = grade.theme;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  theme.sky.forEach((c, i) => sky.addColorStop(i / (theme.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(s, 0, 0, s, 0, 0);
  layout.panels.forEach((panel, i) => {
    ctx.save();
    ctx.beginPath();
    panel.poly.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
    const entry = arrangement?.[i];
    const photo = entry ? photosById.get(entry.photoId) : null;
    if (photo) {
      const src = cropToSourceRect(photo.w, photo.h, entry, panel.bounds.w / panel.bounds.h);
      ctx.drawImage(photo.thumb, (src.x / photo.w) * photo.thumb.width, (src.y / photo.h) * photo.thumb.height, (src.w / photo.w) * photo.thumb.width, (src.h / photo.h) * photo.thumb.height, panel.bounds.x, panel.bounds.y, panel.bounds.w, panel.bounds.h);
    } else {
      ctx.fillStyle = i === 0 ? theme.sky[3] : theme.sky[2];
      ctx.fillRect(panel.bounds.x, panel.bounds.y, panel.bounds.w, panel.bounds.h);
    }
    ctx.restore();
  });
  const t = layout.text.title;
  ctx.fillStyle = theme.title[2];
  ctx.strokeStyle = theme.outline;
  ctx.lineWidth = 2 / s;
  const lines = 2;
  for (let i = 0; i < lines; i++) {
    const lh = (t.h / lines) * 0.62;
    const lw = t.w * (i === 0 ? 0.92 : 0.7);
    const x = t.align === 'center' ? t.x + (t.w - lw) / 2 : t.x;
    const y = t.y + (t.h / lines) * i + lh * 0.2;
    ctx.fillRect(x, y, lw, lh);
    ctx.strokeRect(x, y, lw, lh);
  }
}

/** Renders a graded swatch of a photo crop (or a plain gradient when no photo is loaded). */
export function drawGradeThumbnail(canvas, grade, photo) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (photo) {
    const crop = { cx: photo.analysis.face ? (photo.analysis.face.x + photo.analysis.face.w / 2) / photo.analysis.w : 0.5, cy: 0.42, zoom: 1.25 };
    const src = cropToSourceRect(photo.w, photo.h, crop, canvas.width / canvas.height);
    ctx.drawImage(photo.source, src.x, src.y, src.w, src.h, 0, 0, canvas.width, canvas.height);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#6aa9d8');
    g.addColorStop(0.55, '#f4c58a');
    g.addColorStop(0.56, '#2b8fa0');
    g.addColorStop(1, '#16404a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  gradePanelCanvas(canvas, { ...grade, leakCorner: 1 }, 0.5, 3);
}
