// Screenshot maker for Golden Mile Cover Studio (Node 22, standard library only, global WebSocket).
// It serves app/ on a local port, launches headless Chrome with a throwaway profile, drives the editor through the
// DevTools protocol and writes screenshots/:
//   1-cover.jpg    the 1920x1080 Cast Mosaic (hero mosaic) cover in Sunset Gold, scaled to 1280x720
//   2-editor.jpg   the editor at 1280x800 with the demo cast loaded and a panel selected
//   3-portrait.jpg a 1080x1350 Diagonal Strips cover in Neon Night, scaled to 1024x1280
//   4-square.jpg   a 1080x1080 Six Grid cover in Tropic Teal, as is
// Covers come from the app's own export renderer (PNG data URL) and are only scaled down and JPEG-encoded in the
// page. Console errors, exceptions or a face covered by lettering fail the run.
//
//   node tools/shoot.mjs                 write all four screenshots
//   node tools/shoot.mjs --faces F.jpg   write a face-finder debug sheet
//   node tools/shoot.mjs --matrix DIR    write every layout x size x grade-of-choice cover (half size) for review

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, statSync, createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const APP = join(ROOT, 'app');
const SHOTS = join(ROOT, 'screenshots');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MAX_BYTES = 262144;
const DEBUG_PORT = 9300 + Math.floor(Math.random() * 500);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.md': 'text/plain; charset=utf-8' };

function startServer() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(join(APP, path));
    if (!file.startsWith(APP + sep)) return res.writeHead(403).end();
    try {
      if (!statSync(file).isFile()) throw new Error('not a file');
    } catch {
      return res.writeHead(404).end('not found');
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDebugger() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(150);
  }
  throw new Error('Chrome did not open its debugging port');
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { ok, fail } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) fail(new Error(`${msg.error.message} ${msg.error.data || ''}`));
        else ok(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    };
  }
  open() {
    return new Promise((ok, fail) => {
      this.ws.onopen = ok;
      this.ws.onerror = fail;
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, fail) => this.pending.set(id, { ok, fail }));
  }
  on(fn) {
    this.listeners.push(fn);
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`Page error: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  }
}

/** Page-side: export PNG for a size, scale to target, encode JPEG under the byte cap. */
function coverJpegExpression(sizeKey, outW, outH) {
  return `(async () => {
    const png = window.coverStudio.renderCoverDataURL(${JSON.stringify(sizeKey)});
    const img = new Image();
    img.src = png;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = ${outW};
    c.height = ${outH};
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, ${outW}, ${outH});
    for (let q = 0.93; q > 0.4; q -= 0.03) {
      const url = c.toDataURL('image/jpeg', q);
      if ((url.length - 23) * 0.75 < ${MAX_BYTES - 2048}) return { url, q, pngW: img.naturalWidth, pngH: img.naturalHeight };
    }
    throw new Error('could not fit the byte cap');
  })()`;
}

function writeDataUrl(file, url) {
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  writeFileSync(file, buf);
  return buf.length;
}

async function main() {
  const args = process.argv.slice(2);
  const server = await startServer();
  const port = server.address().port;
  const profile = mkdtempSync(join(tmpdir(), 'gm-shoot-'));
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
    '--disable-background-networking', '--disable-component-update', '--no-first-run', '--disable-sync',
    '--disable-default-apps', '--metrics-recording-only', '--hide-scrollbars', '--window-size=1280,800', 'about:blank',
  ], { stdio: 'ignore' });
  const errors = [];
  let cdp;
  try {
    cdp = new Cdp(await waitForDebugger());
    await cdp.open();
    cdp.on((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
        errors.push(`console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
      }
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(`log: ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
    for (let i = 0; i < 100 && !(await cdp.eval('!!window.coverStudio')); i++) await sleep(100);
    await cdp.eval('window.coverStudio.ready.then(() => true)');
    const t0 = Date.now();
    await cdp.eval('window.coverStudio.loadSamples().then(() => true)');
    console.log(`samples loaded in ${Date.now() - t0} ms`);

    if (args[0] === '--faces') {
      const url = await cdp.eval('window.coverStudio.faceDebugDataURL()');
      writeDataUrl(args[1], url);
      console.log(`wrote ${args[1]}`);
      return;
    }

    if (args[0] === '--interact') {
      await runInteractionChecks(cdp, args[1]);
      return;
    }

    if (args[0] === '--matrix') {
      const dir = resolve(args[1]);
      mkdirSync(dir, { recursive: true });
      const grade = args[2] || 'sunsetGold';
      await cdp.eval(`window.coverStudio.setGrade(${JSON.stringify(grade)})`);
      for (const layout of ['castMosaic', 'diagonalStrips', 'sixGrid']) {
        await cdp.eval(`window.coverStudio.setLayout(${JSON.stringify(layout)})`);
        for (const [size, w, h] of [['16x9', 1280, 720], ['4x5', 864, 1080], ['1x1', 900, 900]]) {
          const r = await cdp.eval(coverJpegExpression(size, w, h));
          writeDataUrl(join(dir, `${layout}-${size}.jpg`), r.url);
          checkFaces(await cdp.eval(`window.coverStudio.faceReport(${JSON.stringify(size)})`), `${layout} ${size}`);
        }
      }
      console.log(`wrote matrix to ${dir}`);
      return;
    }

    mkdirSync(SHOTS, { recursive: true });
    const report = [];
    const cover = async (file, layout, grade, size, w, h) => {
      await cdp.eval(`(window.coverStudio.setLayout(${JSON.stringify(layout)}), window.coverStudio.setGrade(${JSON.stringify(grade)}), true)`);
      checkFaces(await cdp.eval(`window.coverStudio.faceReport(${JSON.stringify(size)})`), `${layout} ${size}`);
      const r = await cdp.eval(coverJpegExpression(size, w, h));
      const bytes = writeDataUrl(join(SHOTS, file), r.url);
      report.push(`${file}: ${w}x${h} from the ${r.pngW}x${r.pngH} PNG export, JPEG q=${r.q.toFixed(2)}, ${bytes} bytes`);
    };
    await cover('1-cover.jpg', 'castMosaic', 'sunsetGold', '16x9', 1280, 720);
    await cover('3-portrait.jpg', 'diagonalStrips', 'neonNight', '4x5', 1024, 1280);
    await cover('4-square.jpg', 'sixGrid', 'tropicTeal', '1x1', 1080, 1080);

    // Editor: the 16:9 Cast Mosaic in Sunset Gold with panel 2 selected.
    await cdp.eval(`(window.coverStudio.setLayout('castMosaic'), window.coverStudio.setGrade('sunsetGold'), window.coverStudio.setSize('16x9'), true)`);
    await cdp.eval(`(window.coverStudio.selectPanel(2), window.coverStudio.renderNow(), true)`);
    await sleep(900);
    await cdp.eval(`(window.coverStudio.selectPanel(2), true)`);
    await sleep(200);
    let shot;
    for (let q = 92; q > 40; q -= 4) {
      shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: q, clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 } });
      if (Buffer.from(shot.data, 'base64').length < MAX_BYTES - 2048) {
        report.push(`2-editor.jpg: 1280x800 editor screenshot, JPEG q=${q}, ${writeDataUrl(join(SHOTS, '2-editor.jpg'), `data:,${shot.data}`)} bytes`);
        break;
      }
    }
    console.log(report.join('\n'));
  } finally {
    if (errors.length) {
      console.error(`Console errors:\n${errors.join('\n')}`);
      process.exitCode = 1;
    }
    try { cdp && cdp.ws.close(); } catch {}
    chrome.kill();
    server.close();
    await sleep(600);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

/** Drive the editor like a user: upload one photo, pan, zoom, swap, flip, undo/redo, type, export. */
async function runInteractionChecks(cdp, outFile) {
  const expect = (cond, what) => {
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);
    if (!cond) process.exitCode = 1;
  };
  const state = () => cdp.eval('window.coverStudio.getState()');
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});

  // One photo through the real file input: every panel gets a distinct crop of it.
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#fileInput' });
  await cdp.send('DOM.setFileInputFiles', { nodeId, files: [join(APP, 'samples', 'pier.jpg')] });
  for (let i = 0; i < 50 && (await state()).photoIds.length < 9; i++) await sleep(100);
  let s = await state();
  expect(s.photoIds.length === 9, 'file input added a 9th photo');
  // Remove the 8 samples so only the uploaded photo remains.
  for (let k = 0; k < 8; k++) await cdp.eval(`document.querySelector('#photoList li .remove').click()`);
  await sleep(300);
  s = await state();
  const ids = new Set(s.panels.map((p) => p.photoId));
  const variants = new Set(s.panels.map((p) => `${p.variant}:${p.flip}`));
  expect(s.photoIds.length === 1 && ids.size === 1, 'one photo left, filling every panel');
  expect(variants.size >= 6, `single photo shows distinct crops (${[...variants].join(', ')})`);
  if (outFile) {
    const url = await cdp.eval(`window.coverStudio.renderCoverDataURL('16x9')`);
    writeDataUrl(outFile, url);
    console.log(`wrote single-photo cover ${outFile}`);
  }
  await cdp.eval(`window.coverStudio.loadSamples().then(() => true)`);
  await sleep(400);

  // Geometry of the overlay canvas in CSS pixels.
  const box = await cdp.eval(`(() => { const r = document.getElementById('overlayCanvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const at = (fx, fy) => ({ x: box.x + box.w * fx, y: box.y + box.h * fy });
  const mouse = (type, p, extra = {}) => cdp.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });

  // Pan inside panel 3 (top row, first cast panel right of the hero).
  const p3 = at(0.7, 0.25);
  await mouse('mousePressed', p3);
  await mouse('mouseMoved', { x: p3.x + 30, y: p3.y + 20 });
  await mouse('mouseReleased', { x: p3.x + 30, y: p3.y + 20 });
  await sleep(200);
  s = await state();
  const sel = s.panels.findIndex((p) => Math.abs(p.panX) > 0.01);
  expect(sel >= 0, `dragging a panel pans its photo (panel ${sel + 1})`);

  // Wheel zoom on the same panel.
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p3.x, y: p3.y, deltaX: 0, deltaY: -240 });
  await sleep(200);
  s = await state();
  expect(s.panels[sel].zoom > 1.05, `wheel zooms the panel (zoom ${s.panels[sel].zoom.toFixed(2)})`);

  // Undo twice restores the auto crop, redo brings the zoom back.
  await cdp.eval(`document.getElementById('undoBtn').click()`);
  await sleep(700);
  await cdp.eval(`document.getElementById('undoBtn').click()`);
  await sleep(200);
  s = await state();
  expect(Math.abs(s.panels[sel].panX) < 1e-6 && Math.abs(s.panels[sel].zoom - 1) < 1e-6, 'undo restores the smart crop');
  await cdp.eval(`document.getElementById('redoBtn').click()`);
  await sleep(200);
  s = await state();
  expect(Math.abs(s.panels[sel].panX) > 0.01, 'redo re-applies the pan');

  // Swap: drag panel 2's number badge onto panel 4.
  const before = await state();
  const W = 1920, H = 1080;
  const layoutPanels = await cdp.eval(`(async () => { const m = await import('./src/layouts.js'); const o = await import('./src/panelOverlay.js'); const l = m.getLayout('castMosaic', '16x9'); return l.panels.map((p) => o.panelBadgePoint(p)); })()`);
  const from = { x: box.x + (layoutPanels[1].x / W) * box.w, y: box.y + (layoutPanels[1].y / H) * box.h };
  const to = at(0.9, 0.25);
  await mouse('mousePressed', from);
  await mouse('mouseMoved', { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
  await mouse('mouseMoved', to);
  await mouse('mouseReleased', to);
  await sleep(200);
  s = await state();
  expect(s.panels[1].photoId === before.panels[3].photoId && s.panels[3].photoId === before.panels[1].photoId, 'dragging a number swaps two panels');

  // Flip and the photo stepper on the selected panel.
  await cdp.eval(`document.getElementById('flipBtn').click()`);
  await cdp.eval(`document.getElementById('nextPhotoBtn').click()`);
  await sleep(150);
  s = await state();
  expect(s.panels[3].photoId !== before.panels[1].photoId, 'next-photo button changes the selected panel');

  // Caption typing updates the document live.
  await cdp.eval(`(() => { const el = document.getElementById('titleInput'); el.value = 'Night Shift Money'; el.dispatchEvent(new Event('input')); return true; })()`);
  await sleep(150);
  s = await state();
  expect(s.caption.title === 'Night Shift Money', 'title field edits the caption');
  await cdp.eval(`(() => { const el = document.getElementById('autoTagsToggle'); el.click(); return true; })()`);
  await cdp.eval(`(() => { const el = document.getElementById('tag1'); el.value = 'Big Earl'; el.dispatchEvent(new Event('input')); return true; })()`);
  await sleep(150);
  s = await state();
  expect(!s.caption.autoTags && s.caption.tags[0] === 'Big Earl', 'manual name tags are editable');

  // Every size switch and export button runs without errors.
  for (const size of ['1x1', '4x5', '16x9']) {
    await cdp.eval(`document.querySelector('#sizeSwitch [data-size="${size}"]').click()`);
    await sleep(250);
  }
  await cdp.eval(`document.getElementById('exportAllBtn').click()`);
  let toast = '';
  for (let i = 0; i < 100 && !/^Saved/.test(toast); i++) {
    await sleep(100);
    toast = await cdp.eval(`document.getElementById('toast').textContent`);
  }
  expect(/night-shift-money-1080x1080\.png.*night-shift-money-1080x1350\.png.*night-shift-money-1920x1080\.png/.test(toast), `export all writes three PNGs (${toast})`);
}

function checkFaces(panels, label) {
  const bad = panels.filter((p) => p.face && (!p.faceInside || p.coveredBy.length));
  if (bad.length) {
    console.error(`${label}: face problems ${JSON.stringify(bad)}`);
    process.exitCode = 1;
  } else {
    console.log(`${label}: ${panels.filter((p) => p.face).length} faces whole, inside their panels and clear of lettering`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
