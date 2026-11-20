// Golden Mile Cover Studio PNG export: renders the cover offscreen at the exact output size (1080x1080, 1080x1350 or 1920x1080) with the
// same composer as the preview, and downloads it with canvas.toBlob. "Export all 3" downloads all three sizes.

import { COVER_SIZES } from './layouts.js';
import { renderCover } from './composer.js';

/** A file-name-safe slug of the cover title. */
export function slugifyTitle(title) {
  const s = (title || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'cover';
}

/** Renders a full-size cover canvas for a size key, using the options the editor provides for that size. */
export function renderCoverCanvas(sizeKey, coverOptionsFor) {
  const size = COVER_SIZES[sizeKey];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  renderCover(ctx, coverOptionsFor(sizeKey), 1);
  return canvas;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Exports one size as a PNG download named after the title, e.g. sundown-racket-1920x1080.png. */
export async function exportCoverPng(sizeKey, coverOptionsFor, title) {
  const size = COVER_SIZES[sizeKey];
  const canvas = renderCoverCanvas(sizeKey, coverOptionsFor);
  const blob = await canvasToPngBlob(canvas);
  const name = `${slugifyTitle(title)}-${size.w}x${size.h}.png`;
  downloadBlob(blob, name);
  return name;
}

/** Exports all three sizes in one click. */
export async function exportAllSizes(coverOptionsFor, title) {
  const names = [];
  for (const key of ['square', 'portrait', 'wide']) {
    names.push(await exportCoverPng(key, coverOptionsFor, title));
    await new Promise((r) => setTimeout(r, 250));
  }
  return names;
}
