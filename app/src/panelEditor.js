// Direct manipulation on the live preview: click a panel to select it, drag to pan its photo, mouse wheel to
// zoom, drag a panel's number badge onto another panel to swap them, drop image files onto a panel to fill it.
// Draws the selection (outline, corner handles, numbered badges) on an overlay canvas that is never exported.

import { pointInPolygon } from './layouts.js';
import { cropToSourceRect } from './smartCrop.js';

const BADGE_R = 13;

function centroid(poly) {
  return { x: poly.reduce((a, p) => a + p.x, 0) / poly.length, y: poly.reduce((a, p) => a + p.y, 0) / poly.length };
}

/** Badge position of a panel in design pixels: a tab just inside the middle of its top edge. */
export function badgeCenter(panel, designPerScreen) {
  const [tl, tr] = panel.poly;
  const top = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };
  const c = centroid(panel.poly);
  const d = Math.hypot(c.x - top.x, c.y - top.y) || 1;
  const off = (BADGE_R + 8) * designPerScreen;
  return { x: top.x + ((c.x - top.x) / d) * off, y: top.y + ((c.y - top.y) / d) * off };
}

/** Index of the topmost panel under a design-space point, or -1. */
export function hitTestPanel(layout, x, y) {
  for (let i = layout.panels.length - 1; i >= 0; i--) if (pointInPolygon(layout.panels[i].poly, x, y)) return i;
  return -1;
}

/** Pans a panel's crop by a design-space delta. */
export function panCrop(entry, photo, panel, dx, dy) {
  const aspect = panel.bounds.w / panel.bounds.h;
  const src = cropToSourceRect(photo.w, photo.h, entry, aspect);
  const sx = (dx * src.w) / panel.bounds.w;
  const sy = (dy * src.h) / panel.bounds.h;
  const halfW = src.w / 2 / photo.w;
  const halfH = src.h / 2 / photo.h;
  const cx = (src.x + src.w / 2) / photo.w - (entry.flip ? -sx : sx) / photo.w;
  const cy = (src.y + src.h / 2) / photo.h - sy / photo.h;
  entry.cx = Math.min(1 - halfW, Math.max(halfW, cx));
  entry.cy = Math.min(1 - halfH, Math.max(halfH, cy));
}

/** Zooms a panel's crop, keeping its centre. */
export function zoomCrop(entry, factor) {
  entry.zoom = Math.min(6, Math.max(1, entry.zoom * factor));
}

/**
 * Wires the overlay canvas. `host` supplies getView() -> { size, layout, arrangement, photosById, selected },
 * select(i), beginEdit(), changed(), swap(i, j) and dropFiles(i, files).
 */
export function attachPanelEditor(overlay, host) {
  let drag = null;
  let hover = -1;
  let pointer = null;

  const toDesign = (e) => {
    const { size } = host.getView();
    const r = overlay.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * size.w, y: ((e.clientY - r.top) / r.height) * size.h };
  };
  const designPerScreen = () => host.getView().size.w / overlay.getBoundingClientRect().width;

  function badgeAt(p) {
    const { layout } = host.getView();
    const dps = designPerScreen();
    for (let i = 0; i < layout.panels.length; i++) {
      const b = badgeCenter(layout.panels[i], dps);
      if (Math.hypot(p.x - b.x, p.y - b.y) <= (BADGE_R + 4) * dps) return i;
    }
    return -1;
  }

  overlay.addEventListener('pointerdown', (e) => {
    const p = toDesign(e);
    const view = host.getView();
    const badge = badgeAt(p);
    if (badge >= 0) {
      host.select(badge);
      drag = { mode: 'swap', from: badge, last: p };
    } else {
      const i = hitTestPanel(view.layout, p.x, p.y);
      host.select(i);
      if (i < 0) return;
      const entry = view.arrangement[i];
      if (entry.photoId == null) return;
      host.beginEdit();
      drag = { mode: 'pan', index: i, last: p };
    }
    overlay.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  overlay.addEventListener('pointermove', (e) => {
    const p = toDesign(e);
    pointer = p;
    const view = host.getView();
    if (!drag) {
      const h = hitTestPanel(view.layout, p.x, p.y);
      overlay.style.cursor = badgeAt(p) >= 0 ? 'grab' : h >= 0 ? 'move' : 'default';
      if (h !== hover) {
        hover = h;
        drawOverlay();
      }
      return;
    }
    if (drag.mode === 'pan') {
      const entry = view.arrangement[drag.index];
      const photo = view.photosById.get(entry.photoId);
      if (photo) panCrop(entry, photo, view.layout.panels[drag.index], p.x - drag.last.x, p.y - drag.last.y);
      drag.last = p;
      host.changed();
    } else {
      hover = hitTestPanel(view.layout, p.x, p.y);
      overlay.style.cursor = 'grabbing';
      drawOverlay();
    }
  });

  const endDrag = (e) => {
    if (!drag) return;
    if (drag.mode === 'swap') {
      const target = hitTestPanel(host.getView().layout, toDesign(e).x, toDesign(e).y);
      if (target >= 0 && target !== drag.from) host.swap(drag.from, target);
    } else {
      host.changed(true);
    }
    drag = null;
    drawOverlay();
  };
  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', () => {
    drag = null;
    drawOverlay();
  });
  overlay.addEventListener('pointerleave', () => {
    if (!drag) {
      hover = -1;
      drawOverlay();
    }
  });

  overlay.addEventListener(
    'wheel',
    (e) => {
      const view = host.getView();
      const p = toDesign(e);
      const i = hitTestPanel(view.layout, p.x, p.y);
      if (i < 0 || view.arrangement[i].photoId == null) return;
      e.preventDefault();
      if (view.selected !== i) host.select(i);
      host.beginEdit(true);
      zoomCrop(view.arrangement[i], Math.exp(-e.deltaY * 0.0015));
      host.changed();
    },
    { passive: false },
  );

  overlay.addEventListener('dragover', (e) => {
    e.preventDefault();
    const p = toDesign(e);
    const h = hitTestPanel(host.getView().layout, p.x, p.y);
    if (h !== hover) {
      hover = h;
      drawOverlay();
    }
  });
  overlay.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const p = toDesign(e);
    const i = hitTestPanel(host.getView().layout, p.x, p.y);
    host.dropFiles(i, e.dataTransfer.files);
  });

  /** Draws hover and selection outlines, corner handles and numbered badges in screen pixels. */
  function drawOverlay() {
    const view = host.getView();
    const { layout, size, selected } = view;
    const r = overlay.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(r.width * dpr);
    const ph = Math.round(r.height * dpr);
    if (overlay.width !== pw || overlay.height !== ph) {
      overlay.width = pw;
      overlay.height = ph;
    }
    const ctx = overlay.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    const s = pw / size.w;
    const dps = size.w / r.width;
    const path = (poly) => {
      ctx.beginPath();
      poly.forEach((p, i) => (i ? ctx.lineTo(p.x * s, p.y * s) : ctx.moveTo(p.x * s, p.y * s)));
      ctx.closePath();
    };
    layout.panels.forEach((panel, i) => {
      if (i === hover && i !== selected) {
        path(panel.poly);
        ctx.lineWidth = 2 * dpr;
        ctx.strokeStyle = drag?.mode === 'swap' ? '#ffd23f' : 'rgba(255,255,255,0.7)';
        ctx.setLineDash(drag?.mode === 'swap' ? [] : [6 * dpr, 5 * dpr]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
    if (selected >= 0 && layout.panels[selected]) {
      const panel = layout.panels[selected];
      path(panel.poly);
      ctx.lineWidth = 6 * dpr;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.stroke();
      ctx.lineWidth = 3 * dpr;
      ctx.strokeStyle = '#2ff3ff';
      ctx.stroke();
      ctx.setLineDash([7 * dpr, 6 * dpr]);
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of panel.poly) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0b0618';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.rect(p.x * s - 6 * dpr, p.y * s - 6 * dpr, 12 * dpr, 12 * dpr);
        ctx.fill();
        ctx.stroke();
      }
      // pan / zoom hint chip at the panel centre
      const c = centroid(panel.poly);
      const label = 'DRAG TO PAN · WHEEL TO ZOOM';
      ctx.font = `600 ${11 * dpr}px "Barlow Condensed", sans-serif`;
      const tw = ctx.measureText(label).width + 16 * dpr;
      ctx.fillStyle = 'rgba(8,4,20,0.78)';
      ctx.beginPath();
      ctx.roundRect(c.x * s - tw / 2, c.y * s + 18 * dpr, tw, 20 * dpr, 10 * dpr);
      ctx.fill();
      ctx.fillStyle = '#2ff3ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, c.x * s, c.y * s + 28 * dpr);
    }
    layout.panels.forEach((panel, i) => {
      const b = badgeCenter(panel, dps);
      const sel = i === selected;
      ctx.beginPath();
      ctx.arc(b.x * s, b.y * s, BADGE_R * dpr * (sel ? 1.15 : 1), 0, Math.PI * 2);
      ctx.fillStyle = sel ? '#2ff3ff' : 'rgba(10,6,24,0.72)';
      ctx.fill();
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = sel ? '#0b0618' : 'rgba(255,255,255,0.8)';
      ctx.stroke();
      ctx.fillStyle = sel ? '#0b0618' : '#ffffff';
      ctx.font = `600 ${14 * dpr}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), b.x * s, b.y * s + 1 * dpr);
    });
    if (drag?.mode === 'swap' && pointer) {
      ctx.beginPath();
      ctx.arc(pointer.x * s, pointer.y * s, BADGE_R * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.fillStyle = '#0b0618';
      ctx.fillText(String(drag.from + 1), pointer.x * s, pointer.y * s + 1 * dpr);
    }
  }

  return { drawOverlay };
}
