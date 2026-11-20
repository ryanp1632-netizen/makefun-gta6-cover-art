// Golden Mile Cover Studio: the editor. Holds the state (photos, size, layout, grade, captions, per-panel crops),
// wires the three steps (1 add photos, 2 caption, 3 export PNG), the live preview with direct panel editing,
// undo/redo, and the window.coverStudio hook a headless browser uses to drive the app.

import { COVER_SIZES, LAYOUT_IDS, LAYOUT_NAMES, getLayout } from './layouts.js';
import { GRADES, getGrade } from './grades.js';
import { TITLE_FONTS } from './lettering.js';
import { nameTagsFor, renderCover } from './composer.js';
import { assignPhotosToPanels, cropForPanel } from './autoLayout.js';
import { imagesFromClipboard, loadPhotoFiles, loadSamplePhotos } from './photoLoader.js';
import { attachPanelEditor } from './panelEditor.js';
import { exportAllSizes, exportCoverPng, renderCoverCanvas } from './exportPng.js';
import { createHistory } from './history.js';
import { drawGradeThumbnail, drawLayoutThumbnail } from './presetThumbnails.js';

const DEFAULT_CAPTION = {
  title: 'Sundown Racket',
  subtitle: 'Paid in Sunsets',
  tagline: 'Everyone wants a cut of the sunset',
  quote: 'A neon-soaked joyride',
  quoteSource: 'The Boardwalk Gazette',
  billing: 'Golden Mile Pictures presents · The Boss · a Sundown Racket production · The Driver · The Fixer · The Rider · music by Midnight FM · filmed on the boardwalk',
  badge: 'Summer 2026 | Original ★ Collector’s Edition',
  coming: 'Coming soon',
  tags: ['', '', '', '', '', '', ''],
  autoTags: true,
};

const state = {
  photos: [],
  sizeKey: 'wide',
  layoutId: 'cast-mosaic',
  gradeId: 'sunset-gold',
  titleFont: 'anton',
  caption: structuredClone(DEFAULT_CAPTION),
  arrangements: {},
  selected: -1,
};

const history = createHistory();
const $ = (id) => document.getElementById(id);
const preview = $('preview');
const overlay = $('overlay');

// ---------------------------------------------------------------------------------------------------------------
// state helpers

function photosById() {
  return new Map(state.photos.map((p) => [p.id, p]));
}

/** The panel crops for a size and layout, auto-filled from the photos the first time they are needed. */
function arrangementFor(sizeKey = state.sizeKey, layoutId = state.layoutId) {
  const key = `${sizeKey}:${layoutId}`;
  const layout = getLayout(sizeKey, layoutId);
  let arr = state.arrangements[key];
  const ids = new Set(state.photos.map((p) => p.id));
  const stale = !arr || arr.length !== layout.panels.length || arr.some((e) => (e.photoId == null ? state.photos.length > 0 : !ids.has(e.photoId)));
  if (stale) {
    arr = assignPhotosToPanels(state.photos, layout);
    state.arrangements[key] = arr;
  }
  return arr;
}

/** Everything the composer needs to draw the cover at one size. */
function coverOptionsFor(sizeKey) {
  return {
    size: COVER_SIZES[sizeKey],
    layout: getLayout(sizeKey, state.layoutId),
    grade: getGrade(state.gradeId),
    photosById: photosById(),
    arrangement: arrangementFor(sizeKey),
    caption: state.caption,
    titleFont: state.titleFont,
    debug: debugOverlay,
  };
}

let debugOverlay = false;

function snapshot() {
  return {
    sizeKey: state.sizeKey,
    layoutId: state.layoutId,
    gradeId: state.gradeId,
    titleFont: state.titleFont,
    caption: state.caption,
    arrangements: state.arrangements,
  };
}

function restore(snap) {
  Object.assign(state, structuredClone(snap));
  state.selected = -1;
  syncControls();
  refreshAll();
}

function recordHistory() {
  history.record(snapshot());
  updateUndoButtons();
}

// ---------------------------------------------------------------------------------------------------------------
// rendering

let renderQueued = false;
let thumbsTimer = 0;

function scheduleRender({ thumbs = false } = {}) {
  if (!renderQueued) {
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderPreview();
    });
  }
  if (thumbs) {
    clearTimeout(thumbsTimer);
    thumbsTimer = setTimeout(renderSideThumbnails, 260);
  }
}

/** Sizes the preview to fit the stage at the current ratio and draws the cover into it. */
function renderPreview() {
  const size = COVER_SIZES[state.sizeKey];
  const wrap = $('previewWrap');
  const stage = $('stage');
  const others = ['.stage-bar', '#panelTools', '#sizeStrip'].reduce((h, sel) => h + stage.querySelector(sel).offsetHeight, 0);
  const availW = wrap.clientWidth;
  const availH = Math.max(160, stage.clientHeight - others - 3 * 8 - 8);
  const scale = Math.min(availW / size.w, availH / size.h);
  const cssW = Math.max(120, Math.floor(size.w * scale));
  const cssH = Math.max(80, Math.floor(size.h * scale));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const c of [preview, overlay]) {
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
  }
  const pw = Math.round(cssW * dpr);
  const ph = Math.round(cssH * dpr);
  if (preview.width !== pw || preview.height !== ph) {
    preview.width = pw;
    preview.height = ph;
  }
  const ctx = preview.getContext('2d');
  renderCover(ctx, coverOptionsFor(state.sizeKey), pw / size.w);
  editor.drawOverlay();
  updatePanelTools();
  const placeholders = autoTagPlaceholders();
  $('nameTags').querySelectorAll('input').forEach((inp, i) => (inp.placeholder = placeholders[i] ?? 'none'));
}

/** Mini renders of all three sizes under the preview, plus the layout and grade picker thumbnails. */
function renderSideThumbnails() {
  for (const key of Object.keys(COVER_SIZES)) {
    const c = document.querySelector(`#sizeStrip canvas[data-size="${key}"]`);
    if (!c) continue;
    const size = COVER_SIZES[key];
    const h = 160;
    c.height = h;
    c.width = Math.round((size.w / size.h) * h);
    renderCover(c.getContext('2d'), coverOptionsFor(key), c.width / size.w);
  }
  const size = COVER_SIZES[state.sizeKey];
  const byId = photosById();
  document.querySelectorAll('#layoutPresets canvas').forEach((c) => {
    const id = c.dataset.layout;
    c.height = Math.round((c.width * size.h) / size.w);
    drawLayoutThumbnail(c, getLayout(state.sizeKey, id), size, arrangementFor(state.sizeKey, id), byId, getGrade(state.gradeId));
  });
  const hero = coverOptionsFor(state.sizeKey);
  const heroPhoto = byId.get(hero.arrangement[0]?.photoId) ?? state.photos[0];
  document.querySelectorAll('#gradePresets canvas').forEach((c) => drawGradeThumbnail(c, getGrade(c.dataset.grade), heroPhoto));
}

function refreshAll() {
  buildNameTagInputs();
  scheduleRender({ thumbs: true });
}

// ---------------------------------------------------------------------------------------------------------------
// step 1: photos

async function addPhotos(photos) {
  if (!photos.length) return;
  recordHistory();
  state.photos.push(...photos);
  state.arrangements = {};
  state.selected = -1;
  renderPhotoStrip();
  setStatus(`${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} loaded — every panel framed on a face`);
  refreshAll();
}

function renderPhotoStrip() {
  const strip = $('photoStrip');
  strip.replaceChildren();
  state.photos.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'photo-thumb';
    item.title = `${p.name} — click to put it in the selected panel`;
    const img = document.createElement('canvas');
    img.width = p.thumb.width;
    img.height = p.thumb.height;
    img.getContext('2d').drawImage(p.thumb, 0, 0);
    const num = document.createElement('span');
    num.className = 'photo-num';
    num.textContent = String(i + 1);
    const del = document.createElement('button');
    del.className = 'photo-del';
    del.type = 'button';
    del.textContent = '×';
    del.title = 'Remove photo';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      recordHistory();
      state.photos = state.photos.filter((q) => q.id !== p.id);
      state.arrangements = {};
      renderPhotoStrip();
      refreshAll();
    });
    item.addEventListener('click', () => {
      if (state.selected < 0) return;
      setPanelPhoto(state.selected, p);
    });
    item.append(img, num, del);
    strip.append(item);
  });
  $('photoCount').textContent = state.photos.length ? `${state.photos.length} loaded` : 'none yet';
}

function setPanelPhoto(index, photo) {
  const layout = getLayout(state.sizeKey, state.layoutId);
  const arr = arrangementFor();
  recordHistory();
  arr[index] = cropForPanel(photo, layout.panels[index], 'portrait').crop;
  scheduleRender({ thumbs: true });
}

// ---------------------------------------------------------------------------------------------------------------
// panel editing

const editor = attachPanelEditor(overlay, {
  getView: () => ({
    size: COVER_SIZES[state.sizeKey],
    layout: getLayout(state.sizeKey, state.layoutId),
    arrangement: arrangementFor(),
    photosById: photosById(),
    selected: state.selected,
  }),
  select: (i) => {
    state.selected = i;
    scheduleRender();
  },
  beginEdit: (isWheel) => {
    // a burst of wheel steps is one undo step; every drag is its own
    if (isWheel) {
      const burst = Date.now() - lastWheelRecord < 800;
      lastWheelRecord = Date.now();
      if (burst) return;
    } else {
      lastWheelRecord = 0;
    }
    recordHistory();
  },
  changed: (done) => scheduleRender({ thumbs: !!done }),
  swap: (i, j) => swapPanels(i, j),
  dropFiles: async (i, files) => {
    const photos = await loadPhotoFiles(files);
    if (!photos.length) return;
    if (i < 0 || photos.length > 1) return addPhotos(photos);
    state.photos.push(photos[0]);
    renderPhotoStrip();
    state.selected = i;
    setPanelPhoto(i, photos[0]);
  },
});
let lastWheelRecord = 0;

function swapPanels(i, j) {
  const arr = arrangementFor();
  if (!arr[i] || !arr[j]) return;
  recordHistory();
  [arr[i], arr[j]] = [arr[j], arr[i]];
  state.selected = j;
  scheduleRender({ thumbs: true });
}

function selectedEntry() {
  const arr = arrangementFor();
  return state.selected >= 0 ? arr[state.selected] : null;
}

function updatePanelTools() {
  const entry = selectedEntry();
  const tools = $('panelTools');
  tools.classList.toggle('is-idle', !entry);
  $('panelLabel').textContent = entry ? `Panel ${state.selected + 1}` : 'Click a panel';
  const photo = entry ? photosById().get(entry.photoId) : null;
  $('panelPhotoName').textContent = photo ? photo.name : entry ? 'empty' : 'drag to pan · wheel to zoom · drag a number onto another panel to swap';
  const zoom = $('panelZoom');
  zoom.disabled = !photo;
  if (photo && document.activeElement !== zoom) zoom.value = String(entry.zoom);
  for (const id of ['panelPrev', 'panelNext', 'panelFlip', 'panelReset']) $(id).disabled = !entry || !state.photos.length;
}

function stepPanelPhoto(dir) {
  const entry = selectedEntry();
  if (!entry || !state.photos.length) return;
  const idx = state.photos.findIndex((p) => p.id === entry.photoId);
  const next = state.photos[(idx + dir + state.photos.length) % state.photos.length];
  setPanelPhoto(state.selected, next);
}

function wirePanelTools() {
  $('panelPrev').addEventListener('click', () => stepPanelPhoto(-1));
  $('panelNext').addEventListener('click', () => stepPanelPhoto(1));
  $('panelFlip').addEventListener('click', () => {
    const e = selectedEntry();
    if (!e) return;
    recordHistory();
    e.flip = !e.flip;
    scheduleRender({ thumbs: true });
  });
  $('panelReset').addEventListener('click', () => {
    const e = selectedEntry();
    const photo = e && photosById().get(e.photoId);
    if (photo) setPanelPhoto(state.selected, photo);
  });
  const zoom = $('panelZoom');
  zoom.addEventListener('pointerdown', () => recordHistory());
  zoom.addEventListener('input', () => {
    const e = selectedEntry();
    if (!e) return;
    e.zoom = Number(zoom.value);
    scheduleRender();
  });
  zoom.addEventListener('change', () => scheduleRender({ thumbs: true }));
  $('autoFill').addEventListener('click', () => {
    recordHistory();
    delete state.arrangements[`${state.sizeKey}:${state.layoutId}`];
    scheduleRender({ thumbs: true });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// presets and size

function buildPresetPickers() {
  const lp = $('layoutPresets');
  for (const id of LAYOUT_IDS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.dataset.layout = id;
    const c = document.createElement('canvas');
    c.width = 112;
    c.dataset.layout = id;
    const label = document.createElement('span');
    label.textContent = LAYOUT_NAMES[id];
    b.append(c, label);
    b.addEventListener('click', () => setLayout(id));
    lp.append(b);
  }
  const gp = $('gradePresets');
  for (const g of GRADES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.dataset.grade = g.id;
    const c = document.createElement('canvas');
    c.width = 76;
    c.height = 46;
    c.dataset.grade = g.id;
    const label = document.createElement('span');
    label.textContent = g.name;
    b.append(c, label);
    b.addEventListener('click', () => setGrade(g.id));
    gp.append(b);
  }
  document.querySelectorAll('#sizeSwitch button').forEach((b) => b.addEventListener('click', () => setSize(b.dataset.size)));
  document.querySelectorAll('#sizeStrip button').forEach((b) => b.addEventListener('click', () => setSize(b.dataset.size)));
}

function setLayout(id) {
  if (!LAYOUT_IDS.includes(id)) return;
  recordHistory();
  state.layoutId = id;
  state.selected = -1;
  syncControls();
  refreshAll();
}

function setGrade(id) {
  recordHistory();
  state.gradeId = getGrade(id).id;
  syncControls();
  scheduleRender({ thumbs: true });
}

function setSize(key) {
  if (!COVER_SIZES[key]) return;
  state.sizeKey = key;
  state.selected = -1;
  syncControls();
  refreshAll();
}

/** Puts the state into every control (after undo, presets or the test hook). */
function syncControls() {
  document.querySelectorAll('#layoutPresets .preset').forEach((b) => b.classList.toggle('is-active', b.dataset.layout === state.layoutId));
  document.querySelectorAll('#gradePresets .preset').forEach((b) => b.classList.toggle('is-active', b.dataset.grade === state.gradeId));
  document.querySelectorAll('#sizeSwitch button, #sizeStrip button').forEach((b) => b.classList.toggle('is-active', b.dataset.size === state.sizeKey));
  const size = COVER_SIZES[state.sizeKey];
  $('sizeLabel').textContent = `${size.w} × ${size.h} · ${LAYOUT_NAMES[state.layoutId]} · ${getGrade(state.gradeId).name}`;
  for (const [field, id] of CAPTION_FIELDS) if (document.activeElement !== $(id)) $(id).value = state.caption[field] ?? '';
  $('titleFont').value = state.titleFont;
  buildNameTagInputs();
}

// ---------------------------------------------------------------------------------------------------------------
// step 2: caption

const CAPTION_FIELDS = [
  ['title', 'titleInput'],
  ['subtitle', 'subtitleInput'],
  ['tagline', 'taglineInput'],
  ['quote', 'quoteInput'],
  ['quoteSource', 'quoteSourceInput'],
  ['billing', 'billingInput'],
  ['badge', 'badgeInput'],
  ['coming', 'comingInput'],
];

let typingTimer = 0;
function recordTyping() {
  if (!typingTimer) recordHistory();
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => (typingTimer = 0), 900);
}

function wireCaptionFields() {
  for (const [field, id] of CAPTION_FIELDS) {
    $(id).addEventListener('input', (e) => {
      recordTyping();
      state.caption[field] = e.target.value;
      scheduleRender({ thumbs: true });
    });
  }
  $('autoTags').addEventListener('change', (e) => {
    recordHistory();
    state.caption.autoTags = e.target.checked;
    refreshAll();
  });
  $('titleFont').addEventListener('change', (e) => {
    recordHistory();
    state.titleFont = TITLE_FONTS[e.target.value] ? e.target.value : 'anton';
    scheduleRender({ thumbs: true });
  });
}

/** The tag each panel shows when its field is empty (the photo's own tag), used as the field's placeholder. */
function autoTagPlaceholders() {
  const layout = getLayout(state.sizeKey, state.layoutId);
  const auto = nameTagsFor(layout, arrangementFor(), photosById(), { ...state.caption, tags: [] });
  return auto.map((t) => t || 'none');
}

function buildNameTagInputs() {
  const layout = getLayout(state.sizeKey, state.layoutId);
  const box = $('nameTags');
  $('autoTags').checked = state.caption.autoTags !== false;
  const placeholders = autoTagPlaceholders();
  if (box.dataset.count === String(layout.panels.length) && !box.contains(document.activeElement)) {
    box.querySelectorAll('input').forEach((inp, i) => {
      inp.value = state.caption.tags[i] ?? '';
      inp.placeholder = placeholders[i];
    });
    return;
  }
  if (box.contains(document.activeElement)) return;
  box.replaceChildren();
  box.dataset.count = String(layout.panels.length);
  layout.panels.forEach((_, i) => {
    const label = document.createElement('label');
    label.className = 'tag-field';
    const n = document.createElement('span');
    n.textContent = String(i + 1);
    const inp = document.createElement('input');
    inp.id = `tag${i + 1}`;
    inp.placeholder = placeholders[i];
    inp.title = 'Type a name tag for this panel (a single - hides it)';
    inp.value = state.caption.tags[i] ?? '';
    inp.addEventListener('input', () => {
      recordTyping();
      state.caption.tags[i] = inp.value;
      scheduleRender({ thumbs: true });
    });
    inp.addEventListener('focus', () => {
      state.selected = i;
      scheduleRender();
    });
    label.append(n, inp);
    box.append(label);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// step 3: export

function setStatus(text) {
  $('exportStatus').textContent = text;
}

function wireExport() {
  const run = async (fn, label) => {
    setStatus(`Rendering ${label}…`);
    try {
      const out = await fn();
      setStatus(`Saved ${Array.isArray(out) ? out.join(', ') : out}`);
    } catch (err) {
      setStatus(`Export failed: ${err.message}`);
    }
  };
  $('exportSquare').addEventListener('click', () => run(() => exportCoverPng('square', coverOptionsFor, state.caption.title), '1080×1080'));
  $('exportPortrait').addEventListener('click', () => run(() => exportCoverPng('portrait', coverOptionsFor, state.caption.title), '1080×1350'));
  $('exportWide').addEventListener('click', () => run(() => exportCoverPng('wide', coverOptionsFor, state.caption.title), '1920×1080'));
  $('exportAll').addEventListener('click', () => run(() => exportAllSizes(coverOptionsFor, state.caption.title), 'all 3 sizes'));
}

// ---------------------------------------------------------------------------------------------------------------
// page wiring

function updateUndoButtons() {
  $('undoBtn').disabled = !history.canUndo;
  $('redoBtn').disabled = !history.canRedo;
}

function undo() {
  const s = history.undo(snapshot());
  if (s) restore(s);
  updateUndoButtons();
}

function redo() {
  const s = history.redo(snapshot());
  if (s) restore(s);
  updateUndoButtons();
}

function wirePage() {
  $('fileInput').addEventListener('change', async (e) => {
    await addPhotos(await loadPhotoFiles(e.target.files));
    e.target.value = '';
  });
  $('trySamples').addEventListener('click', async () => addPhotos(await loadSamplePhotos()));
  const dz = $('dropZone');
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    dz.classList.add('is-over');
  });
  document.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) dz.classList.remove('is-over');
  });
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dz.classList.remove('is-over');
    await addPhotos(await loadPhotoFiles(e.dataTransfer.files));
  });
  document.addEventListener('paste', async (e) => {
    const files = imagesFromClipboard(e);
    if (files.length) await addPhotos(await loadPhotoFiles(files));
  });
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
      e.preventDefault();
      redo();
    }
  });
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  window.addEventListener('resize', () => scheduleRender());
}

async function waitForFonts() {
  const faces = ['100px "Anton"', '900 100px "Saira Condensed"', '100px "Bebas Neue"', '100px "Yellowtail"', '600 100px "Barlow Condensed"'];
  await Promise.all(faces.map((f) => document.fonts.load(f)));
  await document.fonts.ready;
}

// ---------------------------------------------------------------------------------------------------------------
// test hook for headless screenshots

function exposeTestHook(ready) {
  window.coverStudio = {
    ready,
    async loadSamples(names) {
      await ready;
      if (!state.photos.length) await addPhotos(await loadSamplePhotos(names));
      return state.photos.length;
    },
    setSize,
    setPreset: setLayout,
    setLayout,
    setGrade,
    setTitleFont(key) {
      state.titleFont = TITLE_FONTS[key] ? key : 'anton';
      syncControls();
      scheduleRender({ thumbs: true });
    },
    setCaption(fields) {
      Object.assign(state.caption, structuredClone(fields));
      syncControls();
      scheduleRender({ thumbs: true });
    },
    selectPanel(i) {
      state.selected = i;
      scheduleRender();
    },
    swapPanels,
    adjustPanel(i, patch, sizeKey = state.sizeKey) {
      const arr = arrangementFor(sizeKey);
      Object.assign(arr[i], patch);
      scheduleRender({ thumbs: true });
    },
    getState: () => JSON.parse(JSON.stringify(snapshot())),
    describePhotos: () =>
      state.photos.map((p) => ({ name: p.name, tag: p.tag, w: p.w, h: p.h, grid: [p.analysis.w, p.analysis.h], face: p.analysis.face, quality: p.analysis.quality })),
    photosForDebug: () => state.photos,
    setDebugOverlay(on) {
      debugOverlay = !!on;
      scheduleRender();
    },
    async renderCoverDataURL(sizeKey = state.sizeKey) {
      await ready;
      return renderCoverCanvas(sizeKey, coverOptionsFor).toDataURL('image/png');
    },
    async settle() {
      await new Promise((r) => setTimeout(r, 400));
      renderSideThumbnails();
      renderPreview();
      await new Promise((r) => requestAnimationFrame(() => r()));
    },
  };
}

async function start() {
  buildPresetPickers();
  wireCaptionFields();
  wirePanelTools();
  wireExport();
  wirePage();
  renderPhotoStrip();
  const ready = waitForFonts();
  exposeTestHook(ready);
  await ready;
  syncControls();
  updateUndoButtons();
  refreshAll();
  document.body.classList.add('is-ready');
}

start();
