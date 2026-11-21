// window.coverStudio: a small test hook so a headless browser can drive the editor and fetch exactly the PNGs the
// export buttons would save.

import { renderExportCanvas } from './exportPng.js';
import { SIZES } from './layouts.js';

export function installTestHook(api) {
  const { ready, state } = api;
  window.coverStudio = {
    ready,
    loadSamples: () => api.loadSamples(),
    setSize: (key) => api.setSize(key),
    setLayout: (key) => api.setLayout(key),
    setGrade: (key) => api.setGrade(key),
    selectPanel: (i) => api.selectPanel(i),
    renderNow: () => api.renderNow(),
    getState: () => JSON.parse(JSON.stringify(state.doc)),
    sizes: () => Object.keys(SIZES),

    /** The exported PNG for a size, as a data URL (the same canvas the export button encodes). */
    renderCoverDataURL(sizeKey) {
      return renderExportCanvas(state.doc, state.photos, sizeKey).canvas.toDataURL('image/png');
    },

    /** Face-safety report for a size: every face inside its panel and clear of lettering. */
    faceReport(sizeKey) {
      const { report } = renderExportCanvas(state.doc, state.photos, sizeKey);
      return report.panels.map((p) => ({
        panel: p.index + 1,
        photo: p.photoId ? state.photos.get(p.photoId).tag : null,
        face: p.face && { x: Math.round(p.face.x), y: Math.round(p.face.y), w: Math.round(p.face.w), h: Math.round(p.face.h) },
        faceInside: p.faceInside,
        coveredBy: p.coveredBy,
        hero: !!p.hero,
        headShare: Math.round(p.headShare * 1000) / 1000,
        tagTouches: p.tagTouches,
        neon: Math.round(p.neon * 1000) / 1000,
        neonMix: Math.round(p.neonMix * 1000) / 1000,
      }));
    },

    /** Every loaded photo with its detected face box drawn on, for checking the face finder. */
    faceDebugDataURL() {
      const photos = state.doc.photoIds.map((id) => state.photos.get(id));
      const cell = 240;
      const c = document.createElement('canvas');
      c.width = cell * 4;
      c.height = Math.ceil(photos.length / 4) * cell * 1.25;
      const ctx = c.getContext('2d');
      photos.forEach((p, i) => {
        const x = (i % 4) * cell;
        const y = Math.floor(i / 4) * cell * 1.25;
        const k = Math.min(cell / p.w, (cell * 1.25) / p.h);
        ctx.drawImage(p.canvas, x, y, p.w * k, p.h * k);
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + p.face.x * k, y + p.face.y * k, p.face.w * k, p.face.h * k);
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, 150, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.fillText(`${p.tag} q=${p.quality.toFixed(2)} h=${((p.face.h * 1.8) / p.h).toFixed(2)}`, x + 4, y + 15);
      });
      return c.toDataURL('image/jpeg', 0.85);
    },
  };
}
