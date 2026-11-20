// PNG export: every size is rendered offscreen at its exact pixel size (never scaled from the preview) and saved
// with canvas.toBlob. "Export all" writes the three files in one click.

import { renderCoverAtSize } from './renderCover.js';
import { SIZES } from './layouts.js';

export const EXPORT_ORDER = ['1x1', '4x5', '16x9'];

export function coverFileName(title, sizeKey) {
  const slug = String(title || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cover';
  const s = SIZES[sizeKey];
  return `${slug}-${s.w}x${s.h}.png`;
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png');
  });
}

export function downloadBlob(blob, fileName) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

/** Render one size at full resolution and return the canvas plus its layout report. */
export function renderExportCanvas(doc, photos, sizeKey) {
  const s = SIZES[sizeKey];
  return renderCoverAtSize(doc, photos, sizeKey, s.w, s.h);
}

export async function exportCoverPng(doc, photos, sizeKey) {
  const { canvas } = renderExportCanvas(doc, photos, sizeKey);
  const blob = await canvasToPngBlob(canvas);
  const name = coverFileName(doc.caption.title, sizeKey);
  downloadBlob(blob, name);
  return { name, bytes: blob.size };
}

export async function exportAllSizes(doc, photos) {
  const results = [];
  for (const key of EXPORT_ORDER) {
    results.push(await exportCoverPng(doc, photos, key));
    await new Promise((r) => setTimeout(r, 250));
  }
  return results;
}
