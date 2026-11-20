// Golden Mile Cover Studio photo loading: the file picker, drag and drop, paste, or the bundled samples, decoded
// locally with createImageBitmap. Very large photos are downsized, each gets a thumbnail, the smart-crop analysis
// (face box, saliency maps) and a name tag for its panel. Nothing is uploaded anywhere.

import { analyzePhoto } from './smartCrop.js';

const MAX_SIDE = 2400;
let nextPhotoId = 1;
let nextAutoTag = 0;

/** Name tags handed to the user's own photos in the order they are added (each can be retyped per panel). */
export const AUTO_TAGS = ['The Boss', 'The Wheelman', 'The Fixer', 'The Muscle', 'The Lookout', 'The Hustler', 'The Courier', 'The Rookie', 'The Shark', 'The Mechanic'];

/**
 * The sample photos: the two kit photos and the six-person demo cast (fictional people made with an image model,
 * see samples/PHOTOS.md), each with its name tag.
 */
export const SAMPLE_PHOTOS = [
  { file: 'samples/cast/boss.jpg', tag: 'The Boss' },
  { file: 'samples/boulevard.jpg', tag: 'The Driver' },
  { file: 'samples/cast/rider.jpg', tag: 'The Rider' },
  { file: 'samples/cast/fixer.jpg', tag: 'The Fixer' },
  { file: 'samples/cast/mechanic.jpg', tag: 'The Mechanic' },
  { file: 'samples/cast/lookout.jpg', tag: 'The Lookout' },
  { file: 'samples/cast/courier.jpg', tag: 'The Courier' },
  { file: 'samples/pier.jpg', tag: 'The Angler' },
];

/** Wraps a decoded image as a photo: source canvas or bitmap, size, thumbnail, saliency analysis and name tag. */
export function makePhoto(bitmap, name, tag) {
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
  const photoTag = tag ?? AUTO_TAGS[nextAutoTag++ % AUTO_TAGS.length];
  return { id: nextPhotoId++, name, tag: photoTag, source, w, h, thumb, analysis: analyzePhoto(source, w, h) };
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

/** The bundled sample photos (all eight, or those whose file names contain one of `names`), read from app/. */
export async function loadSamplePhotos(names) {
  const list = names ? SAMPLE_PHOTOS.filter((s) => names.some((n) => s.file.includes(n))) : SAMPLE_PHOTOS;
  const photos = [];
  for (const s of list) {
    const res = await fetch(s.file);
    const blob = await res.blob();
    photos.push(makePhoto(await createImageBitmap(blob), s.file.split('/').pop(), s.tag));
  }
  return photos;
}

/** Image files from a paste event. */
export function imagesFromClipboard(event) {
  const items = [...(event.clipboardData?.items ?? [])];
  return items.filter((it) => it.kind === 'file' && it.type.startsWith('image/')).map((it) => it.getAsFile());
}
