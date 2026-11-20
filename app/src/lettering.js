// Poster lettering drawn with Canvas 2D: the chunky sunset-gradient title with a thick outline, a 3D extrude,
// stripe cuts, gloss and sparkles; the neon script subtitle; the tagline ribbon; name tags; the review quote with
// stars and laurels; the billing block; the round seal; the barcode and the release line.
// All sizes are in design pixels (the cover's own pixel grid); the caller's transform scales them.

export const TITLE_FONTS = {
  anton: { family: 'Anton', weight: '400', spacing: 0.012 },
  saira: { family: 'Saira Condensed', weight: '900', spacing: 0.0 },
};

const BEBAS = 'Bebas Neue';
const BARLOW = 'Barlow Condensed';
const SCRIPT = 'Yellowtail';

function fontString(size, family, weight = '400') {
  return `${weight} ${size}px "${family}"`;
}

/** Output pixels per design pixel of the current transform (for blur radii, which ignore the transform). */
function pixelScaleOf(ctx) {
  const t = ctx.getTransform();
  return Math.hypot(t.a, t.b) || 1;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Splits a title into one to three lines: explicit breaks ("/" or newline) first, else balanced word groups. */
export function splitTitleLines(title) {
  const clean = (title || ' ').toUpperCase().trim() || ' ';
  if (/[\n/|]/.test(clean)) return clean.split(/[\n/|]/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const words = clean.split(/\s+/);
  if (words.length === 1 || clean.length <= 8) return [clean];
  if (words.length === 2) return words;
  // balance into two lines by character count
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const cost = Math.abs(a.length - b.length);
    if (!best || cost < best.cost) best = { cost, lines: [a, b] };
  }
  return best.lines;
}

/** A four-point specular sparkle with a soft core. */
export function drawSparkle(ctx, x, y, r, color = '#ffffff') {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.9);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  for (const [len, w, rot] of [[r, r * 0.09, 0], [r * 0.55, r * 0.07, Math.PI / 4]]) {
    ctx.save();
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * w, Math.sin(a + Math.PI / 4) * w);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Lays out the title lines so each fills the box width (a justified stack), within the box height. */
export function fitTitleLines(ctx, lines, box, fontKey = 'anton') {
  const font = TITLE_FONTS[fontKey] ?? TITLE_FONTS.anton;
  const outline = 0.13;
  const depth = 0.1;
  const metrics = lines.map((text) => {
    ctx.font = fontString(100, font.family, font.weight);
    ctx.letterSpacing = `${100 * font.spacing}px`;
    const m = ctx.measureText(text);
    ctx.letterSpacing = '0px';
    return { text, w100: m.width, cap100: m.actualBoundingBoxAscent, desc100: Math.max(0, m.actualBoundingBoxDescent) };
  });
  let sizes = metrics.map((m) => box.w / (m.w100 / 100 + outline + depth * 0.45));
  const capLimit = (box.h * (lines.length === 1 ? 0.8 : 0.62)) / (metrics[0].cap100 / 100);
  sizes = sizes.map((s) => Math.min(s, capLimit));
  const minSize = Math.min(...sizes);
  sizes = sizes.map((s) => Math.min(s, minSize * 1.32));
  const gapOf = (s) => s * 0.07;
  const heightOf = (ss) => ss.reduce((acc, s, i) => acc + (metrics[i].cap100 / 100) * s + (i ? gapOf(s) : 0), 0) + ss[ss.length - 1] * (depth + outline / 2);
  const total = heightOf(sizes);
  if (total > box.h) sizes = sizes.map((s) => (s * box.h) / total);
  const used = heightOf(sizes);
  let y = box.y + (box.h - used) / 2 + sizes[0] * (outline / 2);
  const placed = metrics.map((m, i) => {
    const size = sizes[i];
    const cap = (m.cap100 / 100) * size;
    if (i) y += gapOf(size);
    const width = (m.w100 / 100) * size;
    let x = box.x + (size * outline) / 2;
    if (box.align === 'center') x = box.x + (box.w - width) / 2;
    if (box.align === 'right') x = box.x + box.w - width - (size * outline) / 2 - size * depth * 0.45;
    const line = { text: m.text, size, x, top: y, baseline: y + cap, cap, width };
    y += cap;
    return line;
  });
  return { lines: placed, font, outline, depth };
}

/** Draws one title line's face (gradient, stripe cuts, gloss, bevel) into its own canvas context. */
function drawTitleFace(fctx, line, font, theme) {
  const { text, size, x, top, baseline, cap } = line;
  fctx.font = fontString(size, font.family, font.weight);
  fctx.letterSpacing = `${size * font.spacing}px`;
  fctx.textBaseline = 'alphabetic';
  const grad = fctx.createLinearGradient(0, top, 0, baseline);
  const t = theme.title;
  grad.addColorStop(0, t[0]);
  grad.addColorStop(0.22, t[1]);
  grad.addColorStop(0.5, t[2]);
  grad.addColorStop(0.505, t[3]);
  grad.addColorStop(1, t[4]);
  fctx.fillStyle = grad;
  fctx.fillText(text, x, baseline);
  fctx.globalCompositeOperation = 'source-atop';
  // horizontal stripe cuts in the lower part, thicker towards the bottom, like a retro sun
  fctx.fillStyle = theme.stripe;
  const stripes = 4;
  for (let i = 0; i < stripes; i++) {
    const yy = top + cap * (0.62 + i * 0.095);
    const th = size * (0.011 + i * 0.007);
    fctx.fillRect(x - size, yy, line.width + size * 2, th);
  }
  // gloss on the upper half
  const gloss = fctx.createLinearGradient(0, top, 0, top + cap * 0.5);
  gloss.addColorStop(0, 'rgba(255,255,255,0.65)');
  gloss.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  fctx.fillStyle = gloss;
  fctx.fillRect(x - size, top - size * 0.1, line.width + size * 2, cap * 0.5 + size * 0.1);
  // a bright chrome horizon line at the gradient break
  fctx.fillStyle = 'rgba(255,255,255,0.55)';
  fctx.fillRect(x - size, top + cap * 0.5 - size * 0.006, line.width + size * 2, size * 0.012);
  // bevel: light inner rim top-left, dark inner rim bottom-right
  const o = size * 0.014;
  fctx.lineJoin = 'round';
  fctx.lineWidth = size * 0.035;
  fctx.strokeStyle = 'rgba(255,255,255,0.75)';
  fctx.strokeText(text, x + o, baseline + o);
  fctx.strokeStyle = 'rgba(40,0,40,0.45)';
  fctx.strokeText(text, x - o, baseline - o);
  fctx.globalCompositeOperation = 'source-over';
  fctx.letterSpacing = '0px';
}

/**
 * The giant title: justified lines, thick dark outline, a stepped 3D extrude down and to the right, the gradient
 * face with stripe cuts and gloss, a coloured glow and a drop shadow behind, sparkles on top.
 * Returns the placed lines so the script subtitle can hang off the last one.
 */
export function drawChromeTitle(ctx, title, box, theme, fontKey = 'anton') {
  const lines = splitTitleLines(title);
  const fit = fitTitleLines(ctx, lines, box, fontKey);
  const { font } = fit;
  const k = pixelScaleOf(ctx);
  const maxSize = Math.max(...fit.lines.map((l) => l.size));
  const margin = maxSize * 0.5;
  const ox = box.x - margin;
  const oy = box.y - margin;
  const bw = box.w + margin * 2;
  const bh = box.h + margin * 2;
  const block = makeCanvas(bw * k, bh * k);
  const bctx = block.getContext('2d');
  bctx.scale(k, k);
  bctx.translate(-ox, -oy);
  const face = makeCanvas(bw * k, bh * k);
  const fctx = face.getContext('2d');
  for (const line of fit.lines) {
    const { text, size, x, baseline } = line;
    bctx.font = fontString(size, font.family, font.weight);
    bctx.letterSpacing = `${size * font.spacing}px`;
    bctx.lineJoin = 'round';
    bctx.miterLimit = 2;
    const outlineW = size * fit.outline;
    const depth = size * fit.depth;
    const steps = Math.min(64, Math.max(6, Math.ceil(depth * k)));
    const [nearC, farC] = theme.extrude;
    for (let s = steps; s >= 1; s--) {
      const f = s / steps;
      const dx = depth * f * 0.42;
      const dy = depth * f;
      bctx.fillStyle = f > 0.92 ? theme.outline : mixHex(nearC, farC, f);
      bctx.strokeStyle = bctx.fillStyle;
      bctx.lineWidth = outlineW;
      bctx.strokeText(text, x + dx, baseline + dy);
      bctx.fillText(text, x + dx, baseline + dy);
    }
    // a light catch along the extrude's top edges
    bctx.strokeStyle = 'rgba(255,255,255,0.18)';
    bctx.lineWidth = outlineW + size * 0.012;
    bctx.strokeText(text, x + depth * 0.06, baseline + depth * 0.14);
    bctx.strokeStyle = theme.outline;
    bctx.lineWidth = outlineW;
    bctx.strokeText(text, x, baseline);
    bctx.fillStyle = theme.outline;
    bctx.fillText(text, x, baseline);
    bctx.letterSpacing = '0px';
    // the face, on its own canvas so stripes and gloss stay inside the letters
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, face.width, face.height);
    fctx.scale(k, k);
    fctx.translate(-ox, -oy);
    drawTitleFace(fctx, line, font, theme);
    bctx.save();
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.drawImage(face, 0, 0);
    bctx.restore();
  }
  // sticker edge: the whole block (letters and extrude) grown by a light rim, then by a dark outer edge
  const rimmed = makeCanvas(block.width, block.height);
  const rctx = rimmed.getContext('2d');
  const grow = (radius, color) => {
    const layer = makeCanvas(block.width, block.height);
    const lctx = layer.getContext('2d');
    const r = radius * k;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      lctx.drawImage(block, Math.cos(a) * r, Math.sin(a) * r);
    }
    lctx.globalCompositeOperation = 'source-in';
    lctx.fillStyle = color;
    lctx.fillRect(0, 0, layer.width, layer.height);
    rctx.drawImage(layer, 0, 0);
  };
  grow(maxSize * 0.055, theme.outline);
  grow(maxSize * 0.03, theme.neonCore);
  rctx.drawImage(block, 0, 0);
  // composite: coloured glow, tight drop shadow, then the block itself
  ctx.save();
  ctx.shadowColor = theme.neon;
  ctx.shadowBlur = maxSize * 0.45 * k;
  ctx.globalAlpha = 0.85;
  ctx.drawImage(rimmed, ox, oy, bw, bh);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = maxSize * 0.12 * k;
  ctx.shadowOffsetY = maxSize * 0.05 * k;
  ctx.drawImage(rimmed, ox, oy, bw, bh);
  ctx.restore();
  ctx.drawImage(rimmed, ox, oy, bw, bh);
  // sparkles on the first and last lines
  const first = fit.lines[0];
  const last = fit.lines[fit.lines.length - 1];
  drawSparkle(ctx, first.x + first.size * 0.1, first.top + first.cap * 0.12, first.size * 0.32);
  drawSparkle(ctx, last.x + last.width - last.size * 0.12, last.top + last.cap * 0.1, last.size * 0.24);
  if (fit.lines.length > 1) drawSparkle(ctx, first.x + first.width * 0.62, first.top + first.cap * 0.06, first.size * 0.16);
  return fit;
}

/** Mixes two #rrggbb colours. */
export function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

/** Neon script in a tube: dark backing, wide coloured glow, hot inner tube, white-hot core and a swash underline. */
export function drawNeonScript(ctx, text, x, y, size, rotDeg, theme, maxWidth = Infinity, align = 'right') {
  if (!text) return;
  const k = pixelScaleOf(ctx);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotDeg * Math.PI) / 180);
  let s = size;
  ctx.font = fontString(s, SCRIPT);
  const w0 = ctx.measureText(text).width;
  if (w0 > maxWidth) {
    s = (size * maxWidth) / w0;
    ctx.font = fontString(s, SCRIPT);
  }
  const w = ctx.measureText(text).width;
  const x0 = align === 'right' ? -w : align === 'center' ? -w / 2 : 0;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // swash underline from under the first letters out past the end
  const swash = () => {
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.08, s * 0.2);
    ctx.bezierCurveTo(x0 + w * 0.4, s * 0.34, x0 + w * 0.8, s * 0.2, x0 + w + s * 0.35, -s * 0.12);
  };
  ctx.strokeStyle = 'rgba(8,2,20,0.6)';
  ctx.lineWidth = s * 0.16;
  ctx.shadowColor = 'rgba(8,2,20,0.8)';
  ctx.shadowBlur = s * 0.25 * k;
  ctx.strokeText(text, x0, 0);
  swash();
  ctx.lineWidth = s * 0.1;
  ctx.stroke();
  ctx.shadowColor = theme.neon;
  for (const [blur, lw, alpha] of [[0.7, 0.09, 0.9], [0.3, 0.07, 1]]) {
    ctx.shadowBlur = s * blur * k;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = theme.neon;
    ctx.lineWidth = s * lw;
    ctx.strokeText(text, x0, 0);
    swash();
    ctx.lineWidth = s * lw * 0.7;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = s * 0.12 * k;
  ctx.strokeStyle = mixHex(theme.neon.length === 7 ? theme.neon : '#ff3fbf', '#ffffff', 0.45);
  ctx.lineWidth = s * 0.045;
  ctx.strokeText(text, x0, 0);
  swash();
  ctx.lineWidth = s * 0.032;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = theme.neonCore;
  ctx.fillText(text, x0, 0);
  swash();
  ctx.strokeStyle = theme.neonCore;
  ctx.lineWidth = s * 0.014;
  ctx.stroke();
  ctx.restore();
}

/** A slanted ribbon with folded tails carrying the tagline in spaced capitals. */
export function drawTaglineRibbon(ctx, text, rect, theme) {
  if (!text) return;
  const { x, y, w, h, rot = 0 } = rect;
  const k = pixelScaleOf(ctx);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((rot * Math.PI) / 180);
  let size = h * 0.66;
  ctx.font = fontString(size, BEBAS);
  ctx.letterSpacing = `${size * 0.16}px`;
  let tw = ctx.measureText(text.toUpperCase()).width;
  const maxText = w - h * 1.6;
  if (tw > maxText) {
    size *= maxText / tw;
    ctx.font = fontString(size, BEBAS);
    ctx.letterSpacing = `${size * 0.16}px`;
    tw = ctx.measureText(text.toUpperCase()).width;
  }
  const bw = Math.min(w, tw + h * 1.6);
  const skew = h * 0.35;
  const left = -bw / 2;
  const right = bw / 2;
  // tails
  ctx.fillStyle = theme.ribbon[1];
  for (const side of [-1, 1]) {
    const ex = side < 0 ? left : right;
    ctx.beginPath();
    ctx.moveTo(ex - side * h * 0.2, -h * 0.25);
    ctx.lineTo(ex + side * h * 0.9, -h * 0.25);
    ctx.lineTo(ex + side * h * 0.6, h * 0.25);
    ctx.lineTo(ex + side * h * 0.9, h * 0.75);
    ctx.lineTo(ex - side * h * 0.2, h * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = h * 0.4 * k;
  ctx.shadowOffsetY = h * 0.08 * k;
  const grad = ctx.createLinearGradient(left, 0, right, 0);
  grad.addColorStop(0, theme.ribbon[0]);
  grad.addColorStop(1, theme.ribbon[1]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(left + skew, -h / 2);
  ctx.lineTo(right + skew, -h / 2);
  ctx.lineTo(right - skew, h / 2);
  ctx.lineTo(left - skew, h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = h * 0.07;
  ctx.strokeStyle = theme.outline;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = h * 0.03;
  ctx.beginPath();
  ctx.moveTo(left + skew * 0.8, -h / 2 + h * 0.14);
  ctx.lineTo(right + skew * 0.8, -h / 2 + h * 0.14);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = h * 0.05 * k;
  ctx.fillText(text.toUpperCase(), size * 0.08, h * 0.04);
  ctx.restore();
}

/** A name tag plate for a panel: dark slanted plate, accent bar, spaced capitals. */
export function drawNameTag(ctx, text, x, y, size, theme, align = 'left') {
  if (!text) return;
  const k = pixelScaleOf(ctx);
  ctx.save();
  ctx.font = fontString(size, BEBAS);
  ctx.letterSpacing = `${size * 0.12}px`;
  const label = text.toUpperCase();
  const tw = ctx.measureText(label).width;
  const pad = size * 0.5;
  const h = size * 1.18;
  const w = tw + pad * 2 + size * 0.3;
  const x0 = align === 'right' ? x - w : x;
  const sk = h * 0.28;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.5 * k;
  ctx.shadowOffsetY = size * 0.1 * k;
  ctx.fillStyle = theme.tagBg;
  ctx.beginPath();
  ctx.moveTo(x0 + sk, y - h);
  ctx.lineTo(x0 + w + sk, y - h);
  ctx.lineTo(x0 + w, y);
  ctx.lineTo(x0, y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(x0 + sk, y - h);
  ctx.lineTo(x0 + sk + size * 0.28, y - h);
  ctx.lineTo(x0 + size * 0.28, y);
  ctx.lineTo(x0, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = theme.neon;
  ctx.fillRect(x0 + size * 0.2, y - size * 0.08, w - size * 0.2, size * 0.08);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, x0 + size * 0.3 + pad + sk * 0.4, y - h * 0.24);
  ctx.restore();
}

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** One pointed laurel leaf from (0, 0) along +x. */
function leafPath(ctx, len, width) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -width, len, 0);
  ctx.quadraticCurveTo(len * 0.45, width * 0.6, 0, 0);
  ctx.closePath();
}

/**
 * A laurel branch: a curved stem rising from below the quote, with pointed leaves in pairs along it.
 * `side` is -1 for the left branch (curving up the left) and 1 for the right one.
 */
function drawLaurelBranch(ctx, x, y, h, side, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = h * 0.035;
  ctx.lineCap = 'round';
  // stem: an arc bulging outward (to +x after the mirror), from bottom to top
  const pts = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: h * 0.26 * Math.sin(Math.PI * (0.08 + t * 0.84)), y: h * 0.5 - t * h });
  }
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  for (let i = 1; i <= n; i++) {
    const p = pts[i];
    const q = pts[i - 1];
    const dir = Math.atan2(p.y - q.y, p.x - q.x);
    const size = h * (0.2 - i * 0.008);
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(dir + s * 0.75);
      leafPath(ctx, size, size * 0.32);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.save();
  ctx.translate(pts[n].x, pts[n].y);
  ctx.rotate(Math.atan2(pts[n].y - pts[n - 1].y, pts[n].x - pts[n - 1].x));
  leafPath(ctx, h * 0.18, h * 0.06);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Five stars, the quote in tall capitals and its source, framed by laurels. */
export function drawReviewQuote(ctx, quote, source, spot, theme) {
  if (!quote) return;
  const { x, y, w, align = 'center' } = spot;
  const k = pixelScaleOf(ctx);
  ctx.save();
  let size = Math.min(w * 0.085, 56);
  const text = `“${quote.toUpperCase()}”`;
  ctx.font = fontString(size, BEBAS);
  ctx.letterSpacing = `${size * 0.04}px`;
  let tw = ctx.measureText(text).width;
  if (tw > w * 0.78) {
    size *= (w * 0.78) / tw;
    ctx.font = fontString(size, BEBAS);
    ctx.letterSpacing = `${size * 0.04}px`;
    tw = ctx.measureText(text).width;
  }
  const cx = align === 'center' ? x : align === 'left' ? x + tw / 2 : x - tw / 2;
  const starR = size * 0.32;
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = size * 0.35 * k;
  for (let i = 0; i < 5; i++) {
    const sx = cx + (i - 2) * starR * 2.5;
    starPath(ctx, sx, y, starR);
    ctx.fillStyle = theme.accent;
    ctx.fill();
    ctx.lineWidth = size * 0.04;
    ctx.strokeStyle = theme.outline;
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, y + starR + size * 0.95);
  if (source) {
    const ss = size * 0.36;
    ctx.font = fontString(ss, BARLOW, '600');
    ctx.letterSpacing = `${ss * 0.3}px`;
    ctx.fillStyle = theme.accent;
    ctx.fillText(`— ${source.toUpperCase()} —`, cx, y + starR + size * 0.95 + ss * 1.6);
  }
  ctx.shadowBlur = size * 0.2 * k;
  const lh = Math.max(size * 2.3, 60);
  const midY = y + (starR + size * 0.95) * 0.55;
  drawLaurelBranch(ctx, cx - tw / 2 - lh * 0.12, midY, lh, -1, theme.accent);
  drawLaurelBranch(ctx, cx + tw / 2 + lh * 0.12, midY, lh, 1, theme.accent);
  ctx.restore();
}

/** The billing block: tall, squeezed capitals in two weights, like the credits at the foot of a film poster. */
export function drawBillingBlock(ctx, text, spot, theme) {
  if (!text) return;
  const { x, y, w, align = 'center' } = spot;
  ctx.save();
  const parts = text.toUpperCase().split(/\s*[·|]\s*/).filter(Boolean);
  const size = Math.max(14, Math.min(26, w * 0.028));
  const squeeze = 0.62;
  ctx.textBaseline = 'alphabetic';
  // measure segments: alternate small "lead-in" words and bigger names
  const segs = parts.map((p, i) => {
    const s = i % 2 === 0 ? size : size * 0.78;
    ctx.font = fontString(s, BARLOW, '600');
    ctx.letterSpacing = `${s * 0.04}px`;
    return { p, s, w: ctx.measureText(p).width * squeeze };
  });
  const gap = size * 0.9;
  const total = segs.reduce((a, sg) => a + sg.w, 0) + gap * (segs.length - 1);
  const fitScale = Math.min(1, w / total);
  let cx = align === 'center' ? x - (total * fitScale) / 2 : align === 'right' ? x - total * fitScale : x;
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6 * pixelScaleOf(ctx);
  for (const sg of segs) {
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(squeeze * fitScale, 1);
    ctx.font = fontString(sg.s, BARLOW, '600');
    ctx.letterSpacing = `${sg.s * 0.04}px`;
    ctx.fillText(sg.p, 0, 0);
    ctx.restore();
    cx += (sg.w + gap) * fitScale;
  }
  // a hairline rule under the credits
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const rx = align === 'center' ? x - (total * fitScale) / 2 : align === 'right' ? x - total * fitScale : x;
  ctx.fillRect(rx, y + size * 0.35, total * fitScale, Math.max(1, size * 0.05));
  ctx.restore();
}

/** Characters set along a circle, centred at angle `mid` (radians, 0 = up). */
function drawTextOnCircle(ctx, text, cx, cy, r, mid, size, color) {
  ctx.save();
  ctx.font = fontString(size, BEBAS);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const widths = [...text].map((ch) => ctx.measureText(ch).width + size * 0.08);
  const totalAngle = widths.reduce((a, b) => a + b, 0) / r;
  let a = mid - totalAngle / 2;
  [...text].forEach((ch, i) => {
    const step = widths[i] / r;
    a += step / 2;
    ctx.save();
    ctx.translate(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
    ctx.rotate(a);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += step / 2;
  });
  ctx.restore();
}

/** A round starburst seal with ring lettering and a big centre line. */
export function drawSealBadge(ctx, spot, text, theme) {
  if (!text) return;
  const { x, y, r } = spot;
  const k = pixelScaleOf(ctx);
  const [centre, ring] = text.split('|').map((s) => s.trim());
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = r * 0.3 * k;
  ctx.shadowOffsetY = r * 0.06 * k;
  ctx.beginPath();
  const points = 28;
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points;
    const rr = i % 2 === 0 ? r : r * 0.9;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, theme.title[1]);
  g.addColorStop(0.5, theme.title[2]);
  g.addColorStop(1, theme.title[4]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = r * 0.04;
  ctx.strokeStyle = theme.outline;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = theme.outline;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
  ctx.lineWidth = r * 0.025;
  ctx.strokeStyle = theme.accent;
  ctx.stroke();
  const ringText = (ring || 'ORIGINAL ★ SUMMER EDITION').toUpperCase();
  drawTextOnCircle(ctx, ringText, 0, 0, r * 0.68, 0, r * 0.15, theme.accent);
  drawTextOnCircle(ctx, '★ ★ ★', 0, 0, r * 0.68, Math.PI, r * 0.13, theme.accent);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = (centre || 'NEW').toUpperCase().split(/\s+/);
  const lineSize = words.length > 1 ? r * 0.3 : r * 0.46;
  ctx.font = fontString(lineSize, 'Anton');
  words.slice(0, 2).forEach((wd, i, arr) => {
    let s = lineSize;
    const ww = ctx.measureText(wd).width;
    if (ww > r * 0.95) s = (lineSize * r * 0.95) / ww;
    ctx.font = fontString(s, 'Anton');
    ctx.fillStyle = i === 0 ? '#ffffff' : theme.accent;
    ctx.fillText(wd, 0, (i - (arr.length - 1) / 2) * lineSize * 1.05);
  });
  ctx.restore();
}

/** A barcode in a white box, bars from a hash of the title so it changes with the caption. */
export function drawBarcode(ctx, spot, seedText) {
  const { x, y, w, h } = spot;
  let seed = 2166136261;
  for (const ch of seedText || 'cover') seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
  };
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8 * pixelScaleOf(ctx);
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#111111';
  const pad = w * 0.08;
  const barTop = y - h / 2 + h * 0.1;
  const barH = h * 0.62;
  let bx = x - w / 2 + pad;
  const end = x + w / 2 - pad;
  const unit = (w - pad * 2) / 95;
  let digits = '';
  let i = 0;
  while (bx < end - unit) {
    const guard = i < 3 || Math.abs(bx - x) < unit * 2;
    const bw = unit * (guard ? 1 : 1 + Math.floor(rand() * 3));
    if (i % 2 === 0) ctx.fillRect(bx, barTop, bw, barH + (guard ? h * 0.1 : 0));
    bx += bw;
    i++;
  }
  for (let d = 0; d < 12; d++) digits += Math.floor(rand() * 10);
  ctx.font = fontString(h * 0.17, BARLOW, '600');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${digits[0]} ${digits.slice(1, 6)} ${digits.slice(6, 11)} ${digits[11]}`, x, y + h / 2 - h * 0.06);
  ctx.restore();
}

/** The release line, spaced capitals with thin rules either side. */
export function drawComingSoon(ctx, text, spot, theme) {
  if (!text) return;
  const { x, y, size, align = 'right' } = spot;
  const k = pixelScaleOf(ctx);
  ctx.save();
  ctx.font = fontString(size, BEBAS);
  ctx.letterSpacing = `${size * 0.14}px`;
  const label = text.toUpperCase();
  const tw = ctx.measureText(label).width;
  const x0 = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = theme.neon;
  ctx.shadowBlur = size * 0.5 * k;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x0, y);
  ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(x0, 0, x0 + tw, 0);
  g.addColorStop(0, theme.title[1]);
  g.addColorStop(1, theme.title[4]);
  ctx.fillStyle = g;
  ctx.fillRect(x0, y + size * 0.14, tw - size * 0.14, size * 0.07);
  ctx.restore();
}
