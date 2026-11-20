// Makes the entry's screenshots (Node 22+, standard library only): serves app/ on 127.0.0.1, launches headless
// Chrome with networking extras switched off, drives the app over the DevTools protocol through its
// window.coverStudio hook, and writes screenshots/:
//   1-cover.jpg    the app's own 1920x1080 PNG export, scaled to 1280x720
//   2-editor.jpg   the editor at 1280x800 with both samples loaded and a panel selected
//   3-portrait.jpg the app's 1080x1350 PNG export (another layout and grade), scaled to 1024x1280
//   4-square.jpg   the app's 1080x1080 PNG export (another layout and grade), as is
// Exported covers are only scaled (in the page, with a canvas) and JPEG-encoded to fit 256 KiB; never edited.
// Fails on any console error or uncaught exception in the page, and checks every file against the limits.
//
//   node tools/shoot.mjs [--debug-dir <dir>]   (--debug-dir also saves the full-size PNG exports there)

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const APP = join(ROOT, 'app');
const OUT = join(ROOT, 'screenshots');
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MAX_BYTES = 262144;
const argv = process.argv.slice(2);
const debugDir = argv.includes('--debug-dir') ? resolve(argv[argv.indexOf('--debug-dir') + 1]) : null;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };

function startStaticServer() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(join(APP, normalize(path)));
    if (!file.startsWith(APP + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'afterglow-shoot-'));
  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--disable-background-networking',
    '--disable-component-update',
    '--no-first-run',
    '--disable-sync',
    '--disable-default-apps',
    '--metrics-recording-only',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1280,800',
    'about:blank',
  ];
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !existsSync(portFile); i++) await new Promise((r) => setTimeout(r, 100));
  let port = '';
  for (let i = 0; i < 50 && !port; i++) {
    port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
    if (!port) await new Promise((r) => setTimeout(r, 100));
  }
  return { proc, profile, port };
}

/** A minimal DevTools protocol client over the global WebSocket. */
async function connectToPage(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = fail;
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id && pending.has(data.id)) {
      const { ok, fail } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) fail(new Error(`${data.error.message} ${data.error.data ?? ''}`));
      else ok(data.result);
    } else if (data.method) {
      for (const l of listeners) l(data);
    }
  };
  return {
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((ok, fail) => pending.set(id, { ok, fail }));
    },
    on(fn) {
      listeners.push(fn);
    },
    close() {
      ws.close();
    },
  };
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`page error: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  return r.result.value;
}

/** In the page: export a cover with the app's own function, scale it with a canvas and encode JPEG under the cap. */
function scaledCoverExpression(sizeKey, w, h) {
  return `(async () => {
    const png = await window.coverStudio.renderCoverDataURL(${JSON.stringify(sizeKey)});
    const img = new Image();
    img.src = png;
    await img.decode();
    let src = img;
    // halve in steps for a clean downscale
    while (src.width / 2 >= ${w}) {
      const c = document.createElement('canvas');
      c.width = Math.round(src.width / 2); c.height = Math.round(src.height / 2);
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
      src = c;
    }
    const out = document.createElement('canvas');
    out.width = ${w}; out.height = ${h};
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, ${w}, ${h});
    let q = 0.95, jpg;
    do { jpg = out.toDataURL('image/jpeg', q); q -= 0.03; } while (jpg.length * 0.75 > ${MAX_BYTES - 2048} && q > 0.4);
    return { png, jpg, pngW: img.width, pngH: img.height };
  })()`;
}

function writeDataUrl(path, dataUrl) {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(path, buf);
  return buf.length;
}

/** Reads width and height from a JPEG's SOF marker or a PNG's IHDR. */
function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

function checkScreenshots() {
  const files = readdirSync(OUT).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  const problems = [];
  if (files.length < 3 || files.length > 4) problems.push(`screenshots/ holds ${files.length} images, needs 3-4`);
  for (const f of files) {
    const buf = readFileSync(join(OUT, f));
    const dim = imageSize(buf);
    if (!/^[A-Za-z0-9._-]+$/.test(f)) problems.push(`${f}: bad name`);
    if (buf.length > MAX_BYTES) problems.push(`${f}: ${buf.length} bytes > ${MAX_BYTES}`);
    if (!dim) problems.push(`${f}: unreadable`);
    else {
      if (Math.max(dim.w, dim.h) > 1280) problems.push(`${f}: long side ${Math.max(dim.w, dim.h)} > 1280`);
      if (Math.min(dim.w, dim.h) < 480) problems.push(`${f}: short side ${Math.min(dim.w, dim.h)} < 480`);
    }
    console.log(`  ${f}  ${dim ? `${dim.w}x${dim.h}` : '?'}  ${buf.length} bytes`);
  }
  return problems;
}

const selfTestFailures = [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Drives the editor like a user, with real mouse events over the DevTools protocol, after the screenshots are
 * taken: drag to pan a panel, wheel to zoom, undo both, drag a number badge onto another panel to swap, type a
 * caption, and click "Export all 3" checking that three PNGs of the right sizes are downloaded.
 */
async function runInteractionSelfTest(cdp) {
  const fails = [];
  const check = (ok, what) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
    if (!ok) fails.push(`self-test: ${what}`);
  };
  console.log('interaction self-test:');
  const geometry = await evaluate(cdp, `(async () => {
    const L = await import('./src/layouts.js');
    const E = await import('./src/panelEditor.js');
    const lay = L.getLayout('wide', 'hero-mosaic');
    const r = document.getElementById('overlay').getBoundingClientRect();
    const k = r.width / 1920;
    const toScreen = (p) => ({ x: r.left + p.x * k, y: r.top + p.y * k });
    const centre = (poly) => ({ x: poly.reduce((a, p) => a + p.x, 0) / 4, y: poly.reduce((a, p) => a + p.y, 0) / 4 });
    return { p1: toScreen(centre(lay.panels[1].poly)), p2: toScreen(centre(lay.panels[2].poly)), b1: toScreen(E.badgeCenter(lay.panels[1], 1 / k)) };
  })()`);
  const entry = (i) => evaluate(cdp, `window.coverStudio.getState().arrangements['wide:hero-mosaic'][${i}]`);
  const mouse = (type, p, extra = {}) => cdp.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
  const drag = async (from, to) => {
    await mouse('mouseMoved', from, { buttons: 0, button: 'none' });
    await mouse('mousePressed', from);
    for (let i = 1; i <= 6; i++) await mouse('mouseMoved', { x: from.x + ((to.x - from.x) * i) / 6, y: from.y + ((to.y - from.y) * i) / 6 });
    await mouse('mouseReleased', to);
    await pause(150);
  };
  const before = await entry(1);
  await drag(geometry.p1, { x: geometry.p1.x - 60, y: geometry.p1.y - 12 });
  const panned = await entry(1);
  check(Math.abs(panned.cx - before.cx) > 0.005, 'drag pans the photo inside panel 2');
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: geometry.p1.x, y: geometry.p1.y, deltaX: 0, deltaY: -240 });
  await pause(150);
  const zoomed = await entry(1);
  check(zoomed.zoom > panned.zoom + 0.05, 'mouse wheel zooms panel 2');
  await evaluate(cdp, `document.getElementById('undoBtn').click(); document.getElementById('undoBtn').click();`);
  await pause(150);
  const undone = await entry(1);
  check(Math.abs(undone.cx - before.cx) < 1e-6 && Math.abs(undone.zoom - before.zoom) < 1e-6, 'undo restores pan and zoom');
  const sizeAfterUndo = await evaluate(cdp, `window.coverStudio.getState().sizeKey + ':' + window.coverStudio.getState().layoutId`);
  check(sizeAfterUndo === 'wide:hero-mosaic', 'two undos step back exactly two edits (still 16:9 hero mosaic)');
  const e2 = await entry(2);
  await drag(geometry.b1, geometry.p2);
  const s1 = await entry(1);
  const s2 = await entry(2);
  check(s1.photoId === e2.photoId && s1.cx === e2.cx && s2.cx === before.cx, 'dragging a number badge swaps two panels');
  await evaluate(cdp, `document.getElementById('undoBtn').click()`);
  await evaluate(cdp, `(() => { const t = document.getElementById('titleInput'); t.focus(); t.select(); })()`);
  await cdp.send('Input.insertText', { text: 'Neon Harbour' });
  await pause(150);
  const title = await evaluate(cdp, `window.coverStudio.getState().caption.title`);
  check(title === 'Neon Harbour', 'typing in the title field updates the cover caption');
  const downloads = mkdtempSync(join(tmpdir(), 'afterglow-dl-'));
  try {
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
    await evaluate(cdp, `document.getElementById('exportAll').click()`);
    let files = [];
    for (let i = 0; i < 100; i++) {
      files = readdirSync(downloads).filter((f) => f.endsWith('.png'));
      if (files.length >= 3) break;
      await pause(150);
    }
    await pause(400);
    files = readdirSync(downloads).filter((f) => f.endsWith('.png')).sort();
    const sizes = files.map((f) => {
      const d = imageSize(readFileSync(join(downloads, f)));
      return `${f}:${d?.w}x${d?.h}`;
    });
    const want = ['neon-harbour-1080x1080.png:1080x1080', 'neon-harbour-1080x1350.png:1080x1350', 'neon-harbour-1920x1080.png:1920x1080'];
    check(JSON.stringify(sizes) === JSON.stringify(want), `"Export all 3" downloads ${sizes.join(', ')}`);
  } finally {
    rmSync(downloads, { recursive: true, force: true });
  }
  return fails;
}

async function main() {
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const { proc, profile, port } = await launchChrome();
  const errors = [];
  let cdp;
  try {
    cdp = await connectToPage(port);
    cdp.on((ev) => {
      if (ev.method === 'Runtime.exceptionThrown') errors.push(ev.params.exceptionDetails.exception?.description ?? ev.params.exceptionDetails.text);
      if (ev.method === 'Runtime.consoleAPICalled' && ev.params.type === 'error') errors.push(ev.params.args.map((a) => a.value ?? a.description).join(' '));
      if (ev.method === 'Log.entryAdded' && ev.params.entry.level === 'error') errors.push(`${ev.params.entry.text} ${ev.params.entry.url ?? ''}`);
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: base });
    for (let i = 0; i < 100; i++) {
      if (await evaluate(cdp, `!!(window.coverStudio && document.body.classList.contains('is-ready'))`)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await evaluate(cdp, `window.coverStudio.ready`);
    // --one <sample> loads a single sample photo (to check that one photo fills every panel with distinct crops)
    const only = argv.includes('--one') ? [argv[argv.indexOf('--one') + 1]] : undefined;
    await evaluate(cdp, `window.coverStudio.loadSamples(${JSON.stringify(only)})`);
    if (argv.includes('--inspect')) {
      // development aid: print the value of an expression evaluated in the page after the samples load
      console.log(JSON.stringify(await evaluate(cdp, argv[argv.indexOf('--inspect') + 1]), null, 1));
      return;
    }
    if (argv.includes('--gallery') && debugDir) {
      // development aid: every layout at every ratio in one grade, as JPEGs in the debug folder
      mkdirSync(debugDir, { recursive: true });
      const grade = argv[argv.indexOf('--gallery') + 1];
      for (const size of ['wide', 'portrait', 'square']) {
        for (const layout of ['hero-mosaic', 'diagonal-strips', 'six-grid']) {
          await evaluate(cdp, `(async () => { const cs = window.coverStudio; cs.setLayout('${layout}'); cs.setGrade('${grade}'); cs.setSize('${size}'); await cs.settle(); })()`);
          const dims = { wide: [960, 540], portrait: [640, 800], square: [720, 720] }[size];
          const r = await evaluate(cdp, scaledCoverExpression(size, dims[0], dims[1]));
          writeDataUrl(join(debugDir, `g-${grade}-${size}-${layout}.jpg`), r.jpg);
        }
      }
      return;
    }
    mkdirSync(OUT, { recursive: true });
    if (debugDir) mkdirSync(debugDir, { recursive: true });
    for (const f of readdirSync(OUT)) if (/\.(jpe?g|png)$/i.test(f)) rmSync(join(OUT, f));

    const shots = [
      { name: '1-cover.jpg', size: 'wide', w: 1280, h: 720, layout: 'hero-mosaic', grade: 'sunset-gold' },
      { name: '3-portrait.jpg', size: 'portrait', w: 1024, h: 1280, layout: 'diagonal-strips', grade: 'neon-night' },
      { name: '4-square.jpg', size: 'square', w: 1080, h: 1080, layout: 'six-grid', grade: 'tropic-teal' },
    ];
    for (const s of shots) {
      await evaluate(cdp, `(async () => { const cs = window.coverStudio; cs.setLayout('${s.layout}'); cs.setGrade('${s.grade}'); cs.setSize('${s.size}'); await cs.settle(); })()`);
      const r = await evaluate(cdp, scaledCoverExpression(s.size, s.w, s.h));
      const bytes = writeDataUrl(join(OUT, s.name), r.jpg);
      if (debugDir) writeDataUrl(join(debugDir, s.name.replace(/\.jpg$/, '.png')), r.png);
      console.log(`exported ${r.pngW}x${r.pngH} PNG -> ${s.name} (${bytes} bytes)`);
    }

    // the editor: 16:9 hero mosaic in Sunset Gold, the angler's panel selected
    await evaluate(cdp, `(async () => { const cs = window.coverStudio; cs.setLayout('hero-mosaic'); cs.setGrade('sunset-gold'); cs.setSize('wide'); await cs.settle(); cs.selectPanel(1); await cs.settle(); })()`);
    let quality = 90;
    let shot;
    do {
      shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 } });
      quality -= 4;
    } while (Buffer.from(shot.data, 'base64').length > MAX_BYTES - 2048 && quality > 40);
    writeFileSync(join(OUT, '2-editor.jpg'), Buffer.from(shot.data, 'base64'));
    if (debugDir) writeFileSync(join(debugDir, '2-editor.jpg'), Buffer.from(shot.data, 'base64'));
    await new Promise((r) => setTimeout(r, 300));
    selfTestFailures.push(...(await runInteractionSelfTest(cdp)));
  } finally {
    cdp?.close();
    proc.kill();
    server.close();
    await new Promise((r) => setTimeout(r, 600));
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome may still hold the profile for a moment on Windows; it is a temp folder
    }
  }
  console.log('screenshots/:');
  const problems = checkScreenshots();
  if (errors.length) problems.push(...errors.map((e) => `console error: ${e}`));
  problems.push(...selfTestFailures);
  if (problems.length) {
    console.error('FAILED:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  console.log('OK: no console errors, all screenshots within limits');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
