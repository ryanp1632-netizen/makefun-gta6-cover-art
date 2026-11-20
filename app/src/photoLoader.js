// Loads photos locally (file picker, drag and drop, paste, or the bundled samples) with createImageBitmap,
// downsizes very large ones, makes a thumbnail and runs the smart-crop analysis. Nothing is uploaded anywhere.

import { analyzePhoto } from './smartCrop.js';

const MAX_SIDE = 2400;
let nextPhotoId = 1;

/** Wraps a decoded image as a photo: source canvas or bitmap, size, thumbnail and saliency analysis. */
export function makePhoto(bitmap, name) {
  let source = bitmap;
  let w = bitmap.width;
  let h = bitmap.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  if (scale < 1) {
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    source = c;
  }
  const thumb = document.createElement('canvas');
  const ts = 144 / Math.max(w, h);
  thumb.width = Math.round(w * ts);
  thumb.height = Math.round(h * ts);
  thumb.getContext('2d').drawImage(source, 0, 0, thumb.width, thumb.height);
  return { id: nextPhotoId++, name, source, w, h, thumb, analysis: analyzePhoto(source, w, h) };
}

/** Decodes one image file (or blob) into a photo. */
export async function loadPhotoFromFile(file) {
  const bitmap = await createImageBitmap(file);
  return makePhoto(bitmap, file.name || 'photo');
}

/** Decodes every image among a list of files, skipping anything that is not an image. */
export async function loadPhotoFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  const photos = [];
  for (const f of images) {
    try {
      photos.push(await loadPhotoFromFile(f));
    } catch (err) {
      console.warn('Could not read', f.name, err);
    }
  }
  return photos;
}

/** The two bundled sample photos, read from the app's own folder. */
export async function loadSamplePhotos(names = ['boulevard', 'pier']) {
  const photos = [];
  for (const n of names) {
    const res = await fetch(`samples/${n}.jpg`);
    const blob = await res.blob();
    photos.push(makePhoto(await createImageBitmap(blob), `${n}.jpg`));
  }
  return photos;
}

/** Image files from a paste event. */
export function imagesFromClipboard(event) {
  const items = [...(event.clipboardData?.items ?? [])];
  return items.filter((it) => it.kind === 'file' && it.type.startsWith('image/')).map((it) => it.getAsFile());
}
