// Golden Mile Cover Studio — editor wiring: document state with undo/redo, photo intake (file picker, drag and drop,
// paste, sample cast), the live preview with per-panel selection/pan/zoom/swap, preset thumbnails, caption fields,
// mini previews of all three sizes and the PNG export buttons. A test hook is exposed as window.coverStudio.

import { waitForFonts, TITLE_FONTS, SCRIPT_FONTS } from './fonts.js';
import { loadPhotoFromFile, loadSampleCast, imageFilesFrom } from './photos.js';
import { SIZES, LAYOUTS, MAX_PANELS, getLayout, pointInPolygon } from './layouts.js';
import { GRADES } from './grades.js';
import { renderCover } from './renderCover.js';
import { autoFillPanels, emptyPanelSlot } from './autoFill.js';
import { createHistory } from './history.js';
import { exportCoverPng, exportAllSizes } from './exportPng.js';
import { drawLayoutThumbnail, drawGradeThumbnail, drawBrandMark } from './presetThumbs.js';
import { drawPanelSelection, panelBadgePoint } from './panelOverlay.js';
import { installTestHook } from './testHook.js';

export const DEFAULT_CAPTION = {
  title: 'Sundown Racket',
  titleFont: 'anton',
  subtitle: 'Paid in Sunsets',
  scriptFont: 'yellowtail',
  tagline: 'Everyone wants a cut of the sunset',
  quote: 'The hottest ride of the year',
  quoteSource: 'Golden Mile Gazette',
  billing: 'a GOLDEN MILE PICTURES production in association with PALM & PISTOL a R. VALENTINE film SUNDOWN RACKET music by THE NIGHT SHIFT ORCHESTRA edited by J. MORROW written by M. DELACROIX & T. OKAFOR directed by R. VALENTINE',
  seal: 'Best Cast',
  sealRing: 'Golden Mile Film Festival ★ Official Selection',
  release: 'Coming Soon',
  autoTags: true,
  tags: Array(MAX_PANELS).fill(''),
};

function defaultDoc() {
  return {
    size: '16x9',
    layout: 'castMosaic',
    grade: 'sunsetGold',
    photoIds: [],
    caption: structuredClone(DEFAULT_CAPTION),
    panels: Array.from({ length: MAX_PANELS }, emptyPanelSlot),
  };
}

const $ = (id) => document.getElementById(id);

export const state = {
  doc: defaultDoc(),
  photos: new Map(),
  selected: 0,
  report: null,
  history: null,
};

// ---------------------------------------------------------------- history

let commitTimer = 0;
function commit() {
  clearTimeout(commitTimer);
  state.history.commit(state.doc);
  syncUndoButtons();
}
function commitSoon() {
  clearTimeout(commitTimer);
  commitTimer = setTimeout(commit, 500);
}
function applyDoc(doc) {
  if (!doc) return;
  state.doc = doc;
  syncAllControls();
  render();
}
function undo() {
  clearTimeout(commitTimer);
  state.history.commit(state.doc);
  applyDoc(state.history.undo());
  syncUndoButtons();
}
function redo() {
  applyDoc(state.history.redo());
  syncUndoButtons();
}
function syncUndoButtons() {
  $('undoBtn').disabled = !state.history.canUndo();
  $('redoBtn').disabled = !state.history.canRedo();
}

// ---------------------------------------------------------------- rendering

let renderQueued = false;
let miniTimer = 0;
const previewCanvas = () => $('previewCanvas');
const overlayCanvas = () => $('overlayCanvas');

function previewBox() {
  const wrap = $('previewWrap');
  const size = SIZES[state.doc.size];
  const maxW = wrap.clientWidth - 16;
  const maxH = wrap.clientHeight - 16;
  const k = Math.min(maxW / size.w, maxH / size.h);
  return { cssW: Math.max(40, Math.floor(size.w * k)), cssH: Math.max(40, Math.floor(size.h * k)) };
}

export function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderNow();
  });
}

export function renderNow() {
  const size = SIZES[state.doc.size];
  const { cssW, cssH } = previewBox();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = previewCanvas();
  const bw = Math.round(cssW * dpr);
  const bh = Math.round((bw * size.h) / size.w);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  state.report = renderCover(canvas, state.doc, state.photos, state.doc.size);
  drawOverlay();
  $('emptyHint').hidden = state.doc.photoIds.length > 0;
  updateSteps();
  clearTimeout(miniTimer);
  miniTimer = setTimeout(renderMinis, 220);
}

function drawOverlay(drag = null) {
  const canvas = overlayCanvas();
  const pc = previewCanvas();
  const cssW = parseFloat(pc.style.width);
  const cssH = parseFloat(pc.style.height);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d');
  const layout = getLayout(state.doc.layout, state.doc.size);
  const k = (cssW * dpr) / layout.W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawPanelSelection(ctx, layout, state.selected, k, drag);
}

function renderMinis() {
  const targets = [['miniSquare', '1x1'], ['miniPortrait', '4x5'], ['miniWide', '16x9']];
  const height = 92;
  for (const [id, key] of targets) {
    const s = SIZES[key];
    const c = $(id);
    const w = Math.round((height * s.w) / s.h);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(height * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${height}px`;
    renderCover(c, state.doc, state.photos, key);
    c.parentElement.classList.toggle('active', key === state.doc.size);
  }
}

function updateSteps() {
  $('stepPhotos').classList.toggle('done', state.doc.photoIds.length > 0);
  $('stepCaption').classList.toggle('done', state.doc.photoIds.length > 0 && !!state.doc.caption.title.trim());
}

// ---------------------------------------------------------------- photos

function photoList() {
  return state.doc.photoIds.map((id) => state.photos.get(id)).filter(Boolean);
}

async function addPhotoFiles(files, targetPanel = null) {
  const images = imageFilesFrom(files);
  if (!images.length) return;
  toast(`Reading ${images.length} photo${images.length > 1 ? 's' : ''} on this device…`);
  const added = [];
  for (const file of images) {
    try {
      const photo = await loadPhotoFromFile(file, state.doc.photoIds.length + added.length);
      state.photos.set(photo.id, photo);
      added.push(photo);
    } catch (err) {
      console.warn('Skipped a file that could not be decoded', err);
    }
  }
  if (!added.length) return;
  state.doc.photoIds.push(...added.map((p) => p.id));
  if (targetPanel !== null) {
    state.doc.panels[targetPanel] = { ...emptyPanelSlot(), photoId: added[0].id };
    state.selected = targetPanel;
  } else {
    state.doc.panels = autoFillPanels(photoList());
  }
  afterPhotosChanged();
  toast(`${added.length} photo${added.length > 1 ? 's' : ''} added`);
}

export async function loadSamples() {
  $('samplesBtn').disabled = true;
  try {
    const cast = await loadSampleCast();
    for (const p of cast) state.photos.set(p.id, p);
    state.doc.photoIds = cast.map((p) => p.id);
    state.doc.panels = autoFillPanels(cast);
    state.selected = 0;
    afterPhotosChanged();
  } finally {
    $('samplesBtn').disabled = false;
  }
}

function removePhoto(id) {
  state.doc.photoIds = state.doc.photoIds.filter((x) => x !== id);
  const remaining = photoList();
  if (state.doc.panels.some((s) => s.photoId === id)) state.doc.panels = autoFillPanels(remaining);
  afterPhotosChanged();
}

function afterPhotosChanged() {
  renderPhotoList();
  renderPresetThumbs();
  syncTagInputs();
  commit();
  render();
}

function renderPhotoList() {
  const list = $('photoList');
  list.textContent = '';
  const heroId = state.doc.panels[0] && state.doc.panels[0].photoId;
  photoList().forEach((photo, i) => {
    const li = document.createElement('li');
    li.draggable = true;
    li.title = `${photo.tag} — click to put in the selected panel, or drag onto a panel`;
    li.dataset.photoId = photo.id;
    const img = document.createElement('img');
    img.src = photo.thumb;
    img.alt = photo.tag;
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(i + 1);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'remove';
    rm.textContent = '×';
    rm.title = 'Remove this photo';
    rm.addEventListener('click', (e) => {
      e.stopPropagation();
      removePhoto(photo.id);
    });
    li.append(img, num, rm);
    if (photo.id === heroId) {
      const hero = document.createElement('span');
      hero.className = 'hero-mark';
      hero.textContent = 'Hero';
      li.append(hero);
    }
    li.addEventListener('click', () => {
      setPanelPhoto(state.selected, photo.id);
    });
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', `photo:${photo.id}`);
      e.dataTransfer.effectAllowed = 'copy';
    });
    list.append(li);
  });
}

function setPanelPhoto(index, photoId) {
  state.doc.panels[index] = { ...emptyPanelSlot(), photoId };
  state.selected = index;
  commit();
  syncPanelToolbar();
  syncTagInputs();
  render();
}

// ---------------------------------------------------------------- presets

function renderPresetThumbs() {
  const lay = $('layoutPresets');
  lay.textContent = '';
  for (const def of Object.values(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `preset${def.key === state.doc.layout ? ' active' : ''}`;
    b.id = `layout-${def.key}`;
    b.title = def.note;
    const c = document.createElement('canvas');
    drawLayoutThumbnail(c, getLayout(def.key, state.doc.size), 74);
    b.append(c, document.createTextNode(def.label));
    b.addEventListener('click', () => setLayout(def.key));
    lay.append(b);
  }
  const gr = $('gradePresets');
  gr.textContent = '';
  const sample = photoList()[0] || null;
  for (const g of Object.values(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `preset${g.key === state.doc.grade ? ' active' : ''}`;
    b.id = `grade-${g.key}`;
    const c = document.createElement('canvas');
    drawGradeThumbnail(c, g, sample, 74, 46);
    b.append(c, document.createTextNode(g.label));
    b.addEventListener('click', () => setGrade(g.key));
    gr.append(b);
  }
}

export function setLayout(key) {
  if (!LAYOUTS[key]) return;
  state.doc.layout = key;
  state.selected = Math.min(state.selected, getLayout(key, state.doc.size).panels.length - 1);
  commit();
  renderPresetThumbs();
  syncPanelToolbar();
  render();
}

export function setGrade(key) {
  if (!GRADES[key]) return;
  state.doc.grade = key;
  commit();
  renderPresetThumbs();
  render();
}

export function setSize(key) {
  if (!SIZES[key]) return;
  state.doc.size = key;
  state.selected = Math.min(state.selected, getLayout(state.doc.layout, key).panels.length - 1);
  commit();
  syncSizeSwitch();
  renderPresetThumbs();
  syncPanelToolbar();
  render();
}

function syncSizeSwitch() {
  for (const b of document.querySelectorAll('#sizeSwitch button')) {
    const on = b.dataset.size === state.doc.size;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  }
}

// ---------------------------------------------------------------- panel controls

export function selectPanel(i) {
  const count = getLayout(state.doc.layout, state.doc.size).panels.length;
  state.selected = Math.max(0, Math.min(count - 1, i));
  syncPanelToolbar();
  drawOverlay();
}

function currentSlot() {
  return state.doc.panels[state.selected];
}

function syncPanelToolbar() {
  const slot = currentSlot();
  const photo = slot && slot.photoId ? state.photos.get(slot.photoId) : null;
  const layout = getLayout(state.doc.layout, state.doc.size);
  const heroNote = layout.panels[state.selected] && layout.panels[state.selected].hero ? ' · hero' : '';
  $('panelLabel').textContent = `Panel ${state.selected + 1}${heroNote}`;
  $('panelLabel').title = photo ? photo.tag : 'Empty panel';
  $('zoomSlider').value = String(slot ? slot.zoom : 1);
  const has = !!photo;
  for (const id of ['flipBtn', 'zoomSlider', 'resetPanelBtn']) $(id).disabled = !has;
  for (const id of ['prevPhotoBtn', 'nextPhotoBtn']) $(id).disabled = state.doc.photoIds.length === 0;
  $('autoFillBtn').disabled = state.doc.photoIds.length === 0;
}

function stepPanelPhoto(dir) {
  const ids = state.doc.photoIds;
  if (!ids.length) return;
  const slot = currentSlot();
  const at = ids.indexOf(slot.photoId);
  const next = ids[(at + dir + ids.length) % ids.length];
  state.doc.panels[state.selected] = { ...emptyPanelSlot(), photoId: next };
  commit();
  syncPanelToolbar();
  syncTagInputs();
  render();
}

function patchSlot(patch, { commitNow = true } = {}) {
  const slot = currentSlot();
  Object.assign(slot, patch);
  if (commitNow) commit();
  else commitSoon();
  render();
}

function swapPanels(a, b) {
  const p = state.doc.panels;
  [p[a], p[b]] = [p[b], p[a]];
  if (!state.doc.caption.autoTags) {
    const t = state.doc.caption.tags;
    [t[a], t[b]] = [t[b], t[a]];
  }
  state.selected = b;
  commit();
  syncPanelToolbar();
  syncTagInputs();
  render();
}

function designPoint(e) {
  const canvas = overlayCanvas();
  const rect = canvas.getBoundingClientRect();
  const layout = getLayout(state.doc.layout, state.doc.size);
  return {
    x: ((e.clientX - rect.left) / rect.width) * layout.W,
    y: ((e.clientY - rect.top) / rect.height) * layout.H,
    layout,
  };
}

function panelAt(x, y, layout) {
  for (let i = layout.panels.length - 1; i >= 0; i--) if (pointInPolygon(x, y, layout.panels[i].poly)) return i;
  return -1;
}

function badgeAt(x, y, layout) {
  const r = Math.min(layout.W, layout.H) * 0.03;
  for (let i = 0; i < layout.panels.length; i++) {
    const p = panelBadgePoint(layout.panels[i]);
    if (Math.hypot(p.x - x, p.y - y) <= r * 1.3) return i;
  }
  return -1;
}

function installPanelInteractions() {
  const canvas = overlayCanvas();
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const { x, y, layout } = designPoint(e);
    const badge = badgeAt(x, y, layout);
    if (badge >= 0) {
      drag = { kind: 'swap', from: badge, x, y };
      selectPanel(badge);
    } else {
      const i = panelAt(x, y, layout);
      if (i < 0) return;
      selectPanel(i);
      const slot = state.doc.panels[i];
      if (!slot.photoId) return;
      const panel = layout.panels[i];
      drag = { kind: 'pan', i, sx: x, sy: y, px: slot.panX, py: slot.panY, w: panel.bbox.w, h: panel.bbox.h, moved: false };
      canvas.classList.add('panning');
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { x, y } = designPoint(e);
    if (drag.kind === 'pan') {
      const slot = state.doc.panels[drag.i];
      slot.panX = drag.px + (x - drag.sx) / drag.w;
      slot.panY = drag.py + (y - drag.sy) / drag.h;
      drag.moved = true;
      render();
    } else {
      drag.x = x;
      drag.y = y;
      drawOverlay({ from: drag.from, x, y });
    }
  });
  const end = (e) => {
    if (!drag) return;
    if (drag.kind === 'pan' && drag.moved) commit();
    if (drag.kind === 'swap') {
      const { x, y, layout } = designPoint(e);
      const target = panelAt(x, y, layout);
      if (target >= 0 && target !== drag.from) swapPanels(drag.from, target);
      else drawOverlay();
    }
    drag = null;
    canvas.classList.remove('panning');
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    const { x, y, layout } = designPoint(e);
    const i = panelAt(x, y, layout);
    if (i < 0 || !state.doc.panels[i].photoId) return;
    e.preventDefault();
    if (i !== state.selected) selectPanel(i);
    const slot = state.doc.panels[i];
    slot.zoom = Math.max(0.6, Math.min(3, slot.zoom * Math.exp(-e.deltaY * 0.0012)));
    $('zoomSlider').value = String(slot.zoom);
    commitSoon();
    render();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => patchSlot({ zoom: 1, panX: 0, panY: 0 }));
}

function installDropAndPaste() {
  let depth = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    depth++;
    document.body.classList.add('dragging');
  });
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) document.body.classList.remove('dragging');
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    document.body.classList.remove('dragging');
    let target = null;
    if (e.target === overlayCanvas()) {
      const { x, y, layout } = designPoint(e);
      const i = panelAt(x, y, layout);
      if (i >= 0) target = i;
    }
    const text = e.dataTransfer.getData('text/plain');
    if (text && text.startsWith('photo:') && target !== null) {
      setPanelPhoto(target, text.slice(6));
      return;
    }
    addPhotoFiles(e.dataTransfer.files, target);
  });
  window.addEventListener('paste', (e) => {
    const files = imageFilesFrom(e.clipboardData && e.clipboardData.files);
    if (files.length) {
      e.preventDefault();
      addPhotoFiles(files);
    }
  });
}

// ---------------------------------------------------------------- caption fields

const CAPTION_FIELDS = [
  ['titleInput', 'title'], ['subtitleInput', 'subtitle'], ['taglineInput', 'tagline'], ['quoteInput', 'quote'],
  ['quoteSourceInput', 'quoteSource'], ['billingInput', 'billing'], ['sealInput', 'seal'], ['sealRingInput', 'sealRing'],
  ['releaseInput', 'release'],
];

function installCaptionFields() {
  const tf = $('titleFont');
  for (const [key, f] of Object.entries(TITLE_FONTS)) tf.add(new Option(f.label.split(' (')[0], key));
  const sf = $('scriptFont');
  for (const [key, f] of Object.entries(SCRIPT_FONTS)) sf.add(new Option(f.label.split(' (')[0], key));
  for (const [id, field] of CAPTION_FIELDS) {
    $(id).addEventListener('input', (e) => {
      state.doc.caption[field] = e.target.value;
      commitSoon();
      render();
    });
  }
  tf.addEventListener('change', () => {
    state.doc.caption.titleFont = tf.value;
    commit();
    render();
  });
  sf.addEventListener('change', () => {
    state.doc.caption.scriptFont = sf.value;
    commit();
    render();
  });
  const grid = $('tagInputs');
  for (let i = 0; i < MAX_PANELS; i++) {
    const label = document.createElement('label');
    const n = document.createElement('span');
    n.textContent = String(i + 1);
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `tag${i + 1}`;
    input.maxLength = 24;
    input.setAttribute('aria-label', `Name tag for panel ${i + 1}`);
    input.addEventListener('input', () => {
      state.doc.caption.tags[i] = input.value;
      commitSoon();
      render();
    });
    label.append(n, input);
    grid.append(label);
  }
  $('autoTagsToggle').addEventListener('change', (e) => {
    const cap = state.doc.caption;
    if (!e.target.checked) cap.tags = autoTagTexts();
    cap.autoTags = e.target.checked;
    commit();
    syncTagInputs();
    render();
  });
}

function autoTagTexts() {
  const seen = new Set();
  return state.doc.panels.map((slot) => {
    const photo = slot.photoId ? state.photos.get(slot.photoId) : null;
    if (!photo || seen.has(photo.id) || slot.variant === 'detail') return '';
    seen.add(photo.id);
    return photo.tag;
  });
}

function syncTagInputs() {
  const cap = state.doc.caption;
  const auto = autoTagTexts();
  const count = getLayout(state.doc.layout, state.doc.size).panels.length;
  for (let i = 0; i < MAX_PANELS; i++) {
    const input = $(`tag${i + 1}`);
    input.disabled = cap.autoTags;
    input.value = cap.autoTags ? auto[i] : cap.tags[i] || '';
    input.parentElement.style.opacity = i < count ? '1' : '0.4';
  }
  $('autoTagsToggle').checked = cap.autoTags;
}

function syncAllControls() {
  const cap = state.doc.caption;
  for (const [id, field] of CAPTION_FIELDS) $(id).value = cap[field] ?? '';
  $('titleFont').value = cap.titleFont;
  $('scriptFont').value = cap.scriptFont;
  syncSizeSwitch();
  renderPresetThumbs();
  renderPhotoList();
  syncTagInputs();
  syncPanelToolbar();
}

// ---------------------------------------------------------------- export

async function runExport(fn, label) {
  const buttons = document.querySelectorAll('#exportCard button');
  buttons.forEach((b) => (b.disabled = true));
  try {
    const result = await fn();
    const files = Array.isArray(result) ? result : [result];
    $('stepExport').classList.add('done');
    toast(`Saved ${files.map((f) => f.name).join(', ')}`);
  } catch (err) {
    console.error(err);
    toast(`Export failed: ${label}`);
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

function installExport() {
  for (const id of ['exportSquareBtn', 'exportPortraitBtn', 'exportWideBtn']) {
    const b = $(id);
    b.addEventListener('click', () => runExport(() => exportCoverPng(state.doc, state.photos, b.dataset.size), b.dataset.size));
  }
  $('exportAllBtn').addEventListener('click', () => runExport(() => exportAllSizes(state.doc, state.photos), 'all sizes'));
}

// ---------------------------------------------------------------- misc

let toastTimer = 0;
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function installControls() {
  $('fileInput').addEventListener('change', (e) => {
    addPhotoFiles(e.target.files);
    e.target.value = '';
  });
  $('samplesBtn').addEventListener('click', () => loadSamples());
  for (const b of document.querySelectorAll('#sizeSwitch button')) b.addEventListener('click', () => setSize(b.dataset.size));
  for (const f of document.querySelectorAll('#miniPreviews figure')) f.addEventListener('click', () => setSize(f.dataset.size));
  $('prevPhotoBtn').addEventListener('click', () => stepPanelPhoto(-1));
  $('nextPhotoBtn').addEventListener('click', () => stepPanelPhoto(1));
  $('flipBtn').addEventListener('click', () => patchSlot({ flip: !currentSlot().flip }));
  $('zoomSlider').addEventListener('input', (e) => patchSlot({ zoom: Number(e.target.value) }, { commitNow: false }));
  $('resetPanelBtn').addEventListener('click', () => patchSlot({ zoom: 1, panX: 0, panY: 0, flip: false }));
  $('autoFillBtn').addEventListener('click', () => {
    state.doc.panels = autoFillPanels(photoList());
    afterPhotosChanged();
    toast('Panels auto-filled: best face in the hero panel');
  });
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  window.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) {
      e.preventDefault();
      redo();
    }
  });
  window.addEventListener('resize', () => render());
}

async function boot() {
  await waitForFonts();
  state.history = createHistory(state.doc);
  drawBrandMark($('brandMark'));
  installCaptionFields();
  installControls();
  installPanelInteractions();
  installDropAndPaste();
  installExport();
  syncAllControls();
  syncUndoButtons();
  renderNow();
}

const ready = boot();
installTestHook({ ready, state, loadSamples, setSize, setLayout, setGrade, selectPanel, renderNow });
