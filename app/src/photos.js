// Photo intake: everything is read locally (File -> createImageBitmap, or a sample path inside app/), drawn into a
// canvas capped at MAX_SIDE, then analysed once for its face box and face-quality score. Nothing is uploaded.

import { buildSaliencyMaps, findFaceBox, scoreFaceQuality } from './faceFinder.js';
import { measurePanelNeon } from './grades.js';

const MAX_SIDE = 1800;
let nextPhotoId = 1;

/** The 8-person demo cast: six AI-generated portraits plus the two kit photos. */
export const SAMPLE_CAST = [
  { path: 'samples/cast/boss.jpg', tag: 'The Boss' },
  { path: 'samples/boulevard.jpg', tag: 'The Driver' },
  { path: 'samples/cast/rider.jpg', tag: 'The Rider' },
  { path: 'samples/cast/fixer.jpg', tag: 'The Fixer' },
  { path: 'samples/cast/mechanic.jpg', tag: 'The Mechanic' },
  { path: 'samples/cast/lookout.jpg', tag: 'The Lookout' },
  { path: 'samples/cast/courier.jpg', tag: 'The Courier' },
  { path: 'samples/pier.jpg', tag: 'The Captain' },
];

const ROLE_NAMES = [
  'The Driver', 'The Boss', 'The Rider', 'The Fixer', 'The Lookout', 'The Courier', 'The Mechanic', 'The Captain',
  'The Wheelman', 'The Dealer', 'The Insider', 'The Muscle',
];

/** Turn a file name into a name tag, or fall back to a crew role when it looks like a camera name. */
export function nameTagFromFileName(fileName, index) {
  const base = String(fileName || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_\-.]+/g, ' ').trim();
  const looksLikeCamera = /^(img|dsc|pxl|photo|image|screenshot|whatsapp|signal|mvimg|dcim|vid)\b/i.test(base) || /\d{3,}/.test(base);
  if (!base || looksLikeCamera || !/[a-z]{3,}/i.test(base) || base.length > 22) return ROLE_NAMES[index % ROLE_NAMES.length];
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function drawToCanvas(source, w, h) {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, cw, ch);
  return canvas;
}

function makeThumbnail(canvas, face) {
  const size = 96;
  const t = document.createElement('canvas');
  t.width = size;
  t.height = size;
  const ctx = t.getContext('2d');
  const side = Math.min(canvas.width, canvas.height, Math.max(face.w, face.h) * 2.2);
  const cx = face.x + face.w / 2;
  const cy = face.y + face.h * 0.55;
  const sx = Math.max(0, Math.min(canvas.width - side, cx - side / 2));
  const sy = Math.max(0, Math.min(canvas.height - side, cy - side / 2));
  ctx.drawImage(canvas, sx, sy, side, side, 0, 0, size, size);
  return t.toDataURL('image/jpeg', 0.82);
}

/** How neon-night a whole photo is (see measurePanelNeon), measured on a small copy. */
function measurePhotoNeon(canvas) {
  const k = Math.min(1, 200 / Math.max(canvas.width, canvas.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(canvas.width * k));
  c.height = Math.max(1, Math.round(canvas.height * k));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(canvas, 0, 0, c.width, c.height);
  return measurePanelNeon(g.getImageData(0, 0, c.width, c.height));
}

/** Analyse a drawn photo: face box, face quality, neon-night share and a face-centred thumbnail. */
export function analysePhoto(canvas) {
  const maps = buildSaliencyMaps(canvas, canvas.width, canvas.height);
  const face = findFaceBox(canvas, canvas.width, canvas.height, maps);
  const quality = scoreFaceQuality(maps, face);
  return { face, quality, neon: measurePhotoNeon(canvas), thumb: makeThumbnail(canvas, face) };
}

function makePhotoRecord(canvas, name, tag, sample) {
  const analysis = analysePhoto(canvas);
  return { id: `p${nextPhotoId++}`, name, tag, sample, canvas, w: canvas.width, h: canvas.height, ...analysis };
}

/** Read a user's image File locally (never uploaded) and analyse it. */
export async function loadPhotoFromFile(file, index) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await loadImageElement(URL.createObjectURL(file));
  }
  const canvas = drawToCanvas(bitmap, bitmap.width, bitmap.height);
  if (bitmap.close) bitmap.close();
  return makePhotoRecord(canvas, file.name || 'photo', nameTagFromFileName(file.name, index), false);
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not read image ${src}`));
    img.src = src;
  });
}

/** Load one of the bundled sample photos from a relative path inside app/. */
export async function loadSamplePhoto(entry) {
  const img = await loadImageElement(entry.path);
  if (img.decode) await img.decode();
  const canvas = drawToCanvas(img, img.naturalWidth, img.naturalHeight);
  return makePhotoRecord(canvas, entry.path.split('/').pop(), entry.tag, true);
}

export async function loadSampleCast() {
  const photos = [];
  for (const entry of SAMPLE_CAST) photos.push(await loadSamplePhoto(entry));
  return photos;
}

/** Pick image files out of a DataTransfer or clipboard event. */
export function imageFilesFrom(list) {
  return Array.from(list || []).filter((f) => f && /^image\//.test(f.type));
}
