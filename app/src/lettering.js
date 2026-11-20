// All poster lettering, drawn by hand on Canvas 2D: the giant chrome-sunset title (gradient fill, thick dark outline,
// light rim, offset 3D extrude, horizontal stripe cuts, gloss and sparkles, auto-fit to its box), the neon script
// subtitle, tagline ribbon, name tags, review quote with stars and laurels, round seal badge, barcode, billing block
// and release line. Every function works in design pixels and returns the rectangle it covered.

import { fontString, UI_FONT } from './fonts.js';
import { drawSparkle } from './decor.js';

/** Device pixels per design pixel for the current transform (shadowBlur ignores transforms). */
function devScale(ctx) {
  const t = ctx.getTransform();
  return Math.hypot(t.a, t.b) || 1;
}

function makeLayer(wDesign, hDesign, scale) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(wDesign * scale));
  c.height = Math.max(1, Math.ceil(hDesign * scale));
  const g = c.getContext('2d');
  g.setTransform(scale, 0, 0, scale, 0, 0);
  return { c, g };
}

/** Split a title into one or two balanced lines. */
function lineOptions(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const options = [[words.join(' ')]];
  if (words.length > 1) {
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const diff = Math.abs(a.length - b.length);
      if (!best || diff < best.diff) best = { diff, lines: [a, b] };
    }
    options.push(best.lines);
  }
  return options;
}

/** Choose the line split and font size that make the title as big as its box allows. */
export function fitTitle(ctx, text, box, family) {
  ctx.save();
  ctx.font = fontString(100, family);
  ctx.letterSpacing = '3px';
  const cap = ctx.measureText('H').actualBoundingBoxAscent || 72;
  let best = null;
  for (const lines of lineOptions(text)) {
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const gap = cap * 0.2;
    const extra = 0.16; // outline + extrude room, as a share of size
    const sizeW = (box.w / (widest / 100 + extra * 1.2)) ;
    const sizeH = box.h / ((lines.length * cap + (lines.length - 1) * gap) / 100 + extra);
    const size = Math.min(sizeW, sizeH);
    if (!best || size > best.size * 1.04) best = { lines, size, capRatio: cap / 100, gapRatio: gap / 100 };
  }
  ctx.restore();
  return best;
}

/**
 * The giant title. box = {cx, cy, w, h}; pal = grade lettering palette.
 * Returns {rect, sparkles} in design px.
 */
export function drawChromeTitle(ctx, text, box, family, pal) {
  const upper = (text || ' ').toUpperCase().trim() || ' ';
  const fit = fitTitle(ctx, upper, box, family);
  const size = fit.size;
  const cap = fit.capRatio * size;
  const gap = fit.gapRatio * size;
  const outline = size * 0.12;
  const depth = size * 0.125;
  const ex = 0.42;
  const ey = 1;
  const pad = outline + depth * 1.3 + size * 0.1;
  const blockH = fit.lines.length * cap + (fit.lines.length - 1) * gap;
  const scale = devScale(ctx);
  ctx.save();
  ctx.font = fontString(size, family);
  ctx.letterSpacing = `${(size * 0.03).toFixed(2)}px`;
  const widths = fit.lines.map((l) => ctx.measureText(l).width);
  ctx.restore();
  const blockW = Math.max(...widths);
  const lw = blockW + pad * 2;
  const lh = blockH + pad * 2;
  const originX = box.cx - lw / 2;
  const originY = box.cy - lh / 2;
  const baselines = fit.lines.map((_, i) => pad + cap + i * (cap + gap));

  const setFont = (g) => {
    g.font = fontString(size, family);
    g.letterSpacing = `${(size * 0.03).toFixed(2)}px`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'round';
    g.miterLimit = 2;
  };
  const eachLine = (fn) => fit.lines.forEach((line, i) => fn(line, lw / 2, baselines[i], i));

  // Layer L: extrude + outline + rim.
  const L = makeLayer(lw, lh, scale);
  setFont(L.g);
  const steps = Math.max(6, Math.ceil(depth / 1.2));
  const far = hexToRgb(pal.extrudeFar);
  const near = hexToRgb(pal.extrudeNear);
  for (let k = steps; k >= 1; k--) {
    const t = k / steps;
    const col = mixRgb(near, far, t);
    L.g.fillStyle = col;
    L.g.strokeStyle = col;
    L.g.lineWidth = outline * 2;
    const dx = ex * depth * t;
    const dy = ey * depth * t;
    eachLine((line, x, y) => {
      L.g.strokeText(line, x + dx, y + dy);
      L.g.fillText(line, x + dx, y + dy);
    });
  }
  L.g.strokeStyle = pal.outline;
  L.g.lineWidth = outline * 2;
  eachLine((line, x, y) => L.g.strokeText(line, x, y));
  L.g.strokeStyle = pal.rim;
  L.g.lineWidth = outline * 0.62;
  eachLine((line, x, y) => L.g.strokeText(line, x, y));

  // Layer F: the gradient face of the letters with stripe cuts and gloss.
  const F = makeLayer(lw, lh, scale);
  setFont(F.g);
  eachLine((line, x, y) => {
    const grad = F.g.createLinearGradient(0, y - cap, 0, y);
    const stops = [0, 0.3, 0.56, 0.8, 1];
    pal.fill.forEach((c, i) => grad.addColorStop(stops[i], c));
    F.g.fillStyle = grad;
    F.g.fillText(line, x, y);
  });
  F.g.globalCompositeOperation = 'source-atop';
  eachLine((line, x, y) => {
    // Stripe cuts across the lower part of each line, thickening toward the baseline.
    F.g.fillStyle = pal.stripe;
    const cuts = [[0.6, 0.028], [0.72, 0.042], [0.84, 0.058]];
    for (const [at, th] of cuts) F.g.fillRect(0, y - cap + cap * at, lw, cap * th);
    // Gloss on the upper half.
    const gloss = F.g.createLinearGradient(0, y - cap, 0, y - cap * 0.45);
    gloss.addColorStop(0, 'rgba(255,255,255,0.7)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    F.g.fillStyle = gloss;
    F.g.fillRect(0, y - cap - outline, lw, cap * 0.55 + outline);
    // Chrome horizon line.
    F.g.fillStyle = 'rgba(255,255,255,0.55)';
    F.g.fillRect(0, y - cap * 0.5, lw, Math.max(1 / scale, cap * 0.012));
    // Darker foot for weight.
    const foot = F.g.createLinearGradient(0, y - cap * 0.2, 0, y);
    foot.addColorStop(0, 'rgba(60,0,40,0)');
    foot.addColorStop(1, 'rgba(60,0,40,0.28)');
    F.g.fillStyle = foot;
    F.g.fillRect(0, y - cap * 0.2, lw, cap * 0.2 + 2);
  });
  L.g.save();
  L.g.setTransform(1, 0, 0, 1, 0, 0);
  L.g.drawImage(F.c, 0, 0);
  L.g.restore();

  // Composite onto the poster with a deep soft shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(10,0,18,0.85)';
  ctx.shadowBlur = size * 0.22 * scale;
  ctx.shadowOffsetY = size * 0.05 * scale;
  ctx.drawImage(L.c, originX, originY, lw, lh);
  ctx.restore();

  const left = box.cx - blockW / 2;
  const firstTop = originY + pad;
  const sparkles = [
    { x: left + size * 0.12, y: firstTop + cap * 0.06, r: size * 0.32 },
    { x: left + blockW - size * 0.18, y: originY + baselines[baselines.length - 1] - cap * 0.92, r: size * 0.22 },
  ];
  return {
    rect: { x: left - outline, y: firstTop - outline, w: blockW + outline * 2, h: blockH + outline * 2 + depth },
    sparkles,
    size,
  };
}

export function drawTitleSparkles(ctx, sparkles) {
  for (const s of sparkles) drawSparkle(ctx, s.x, s.y, s.r);
}

/** Neon script subtitle: dark halo for separation, coloured glow tube, white-hot core. */
export function drawNeonScript(ctx, text, cx, cy, size, angleDeg, family, pal) {
  const scale = devScale(ctx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.font = fontString(size, family);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const w = ctx.measureText(text).width;
  ctx.strokeStyle = 'rgba(12,0,22,0.6)';
  ctx.lineWidth = size * 0.2;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.2 * scale;
  ctx.strokeText(text, 0, 0);
  ctx.shadowColor = pal.script;
  ctx.shadowBlur = size * 0.5 * scale;
  ctx.strokeStyle = pal.script;
  ctx.lineWidth = size * 0.1;
  ctx.strokeText(text, 0, 0);
  ctx.strokeText(text, 0, 0);
  ctx.shadowBlur = size * 0.16 * scale;
  ctx.lineWidth = size * 0.055;
  ctx.strokeText(text, 0, 0);
  ctx.shadowBlur = size * 0.1 * scale;
  ctx.fillStyle = pal.scriptCore;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  // Report the slanted script as four boxes along its baseline (tighter than one rotated bounding box).
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const parts = [];
  const seg = w / 4;
  for (let k = 0; k < 4; k++) {
    const along = -w / 2 + (k + 0.5) * seg;
    const px = cx + along * cos;
    const py = cy + along * sin;
    const bw = seg * Math.abs(cos) + size * Math.abs(sin);
    const bh = seg * Math.abs(sin) + size * 1.08 * Math.abs(cos);
    parts.push({ x: px - bw / 2, y: py - bh / 2, w: bw, h: bh });
  }
  return parts;
}

/** Tagline ribbon: a slanted band with folded tails and spaced caps. */
export function drawTaglineRibbon(ctx, text, cx, cy, h, maxW, pal) {
  const label = (text || '').toUpperCase();
  if (!label.trim()) return null;
  let fs = h * 0.56;
  ctx.save();
  ctx.font = fontString(fs, UI_FONT);
  ctx.letterSpacing = `${(fs * 0.14).toFixed(2)}px`;
  let tw = ctx.measureText(label).width;
  if (tw > maxW - h * 1.4) {
    fs *= (maxW - h * 1.4) / tw;
    ctx.font = fontString(fs, UI_FONT);
    ctx.letterSpacing = `${(fs * 0.14).toFixed(2)}px`;
    tw = ctx.measureText(label).width;
  }
  const w = tw + h * 1.4;
  const skew = h * 0.28;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const top = cy - h / 2;
  const bot = cy + h / 2;
  const scale = devScale(ctx);
  // Folded tails behind the band.
  ctx.fillStyle = shade(pal.ribbon[0], -0.45);
  for (const side of [-1, 1]) {
    const ex = side < 0 ? x0 : x1;
    ctx.beginPath();
    ctx.moveTo(ex - side * h * 0.2, top + h * 0.3);
    ctx.lineTo(ex + side * h * 0.75, top + h * 0.3);
    ctx.lineTo(ex + side * h * 0.5, cy + h * 0.55);
    ctx.lineTo(ex + side * h * 0.75, bot + h * 0.3);
    ctx.lineTo(ex - side * h * 0.2, bot + h * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = h * 0.4 * scale;
  ctx.shadowOffsetY = h * 0.08 * scale;
  const grad = ctx.createLinearGradient(x0, 0, x1, 0);
  grad.addColorStop(0, pal.ribbon[0]);
  grad.addColorStop(1, pal.ribbon[1]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x0 + skew, top);
  ctx.lineTo(x1 + skew, top);
  ctx.lineTo(x1 - skew, bot);
  ctx.lineTo(x0 - skew, bot);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x0 + skew * 0.9, top + h * 0.08, w - skew * 0.4, Math.max(1, h * 0.05));
  ctx.fillStyle = pal.ribbonText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = h * 0.1 * scale;
  ctx.fillText(label, cx + fs * 0.07, cy + h * 0.04);
  ctx.restore();
  return { x: x0 - h * 0.8, y: top, w: w + h * 1.6, h: h * 1.3 };
}

/** Name tag size for placement. */
export function measureNameTag(ctx, text, size) {
  ctx.save();
  ctx.font = fontString(size, UI_FONT);
  ctx.letterSpacing = `${(size * 0.1).toFixed(2)}px`;
  const tw = ctx.measureText(String(text || '').toUpperCase()).width;
  ctx.restore();
  return { w: tw + size * 1.3, h: size * 1.45 };
}

/** A slanted name tag: dark plate, bright accent bar, spaced caps. (x, y) is its top-left. */
export function drawNameTag(ctx, text, x, y, size, pal) {
  const label = String(text || '').toUpperCase();
  if (!label.trim()) return null;
  const { w, h } = measureNameTag(ctx, label, size);
  const skew = h * 0.22;
  const scale = devScale(ctx);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.5 * scale;
  ctx.shadowOffsetY = size * 0.1 * scale;
  ctx.fillStyle = withAlpha(pal.tagBg, 0.9);
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w + skew, y);
  ctx.lineTo(x + w - skew, y + h);
  ctx.lineTo(x - skew, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = pal.tagAccent;
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + skew + size * 0.28, y);
  ctx.lineTo(x - skew + size * 0.28, y + h);
  ctx.lineTo(x - skew, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = withAlpha(pal.tagAccent, 0.9);
  ctx.fillRect(x + size * 0.5, y + h - Math.max(1, size * 0.08), w - size * 0.6, Math.max(1, size * 0.08));
  ctx.font = fontString(size, UI_FONT);
  ctx.letterSpacing = `${(size * 0.1).toFixed(2)}px`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + size * 0.62, y + h * 0.52);
  ctx.restore();
  return { x: x - skew, y, w: w + skew * 2, h };
}

/** Five-point star path. */
function starPath(ctx, cx, cy, r, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

export function drawStars(ctx, cx, cy, r, count, color) {
  const gap = r * 2.4;
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = r * 0.6 * devScale(ctx);
  for (let i = 0; i < count; i++) {
    starPath(ctx, cx + (i - (count - 1) / 2) * gap, cy, r);
    ctx.fill();
  }
  ctx.restore();
}

/** An almond-shaped leaf from the origin along +x. */
function leafPath(ctx, len, width) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -width, len, 0);
  ctx.quadraticCurveTo(len * 0.45, width, 0, 0);
  ctx.closePath();
}

/**
 * One laurel branch centred on (cx, cy) and `height` tall: a curved stem bulging outward with paired almond leaves
 * that shrink toward the tip. side = -1 draws the left branch "(", side = 1 the mirrored right branch ")".
 */
export function drawLaurel(ctx, cx, cy, height, side, color) {
  const h = height;
  const B = [h * 0.16, h * 0.5];
  const C = [-h * 0.38, h * 0.2];
  const T = [-h * 0.02, -h * 0.5];
  const at = (t) => [
    (1 - t) * (1 - t) * B[0] + 2 * (1 - t) * t * C[0] + t * t * T[0],
    (1 - t) * (1 - t) * B[1] + 2 * (1 - t) * t * C[1] + t * t * T[1],
  ];
  const tangent = (t) => {
    const dx = 2 * (1 - t) * (C[0] - B[0]) + 2 * t * (T[0] - C[0]);
    const dy = 2 * (1 - t) * (C[1] - B[1]) + 2 * t * (T[1] - C[1]);
    return Math.atan2(dy, dx);
  };
  ctx.save();
  ctx.translate(cx, cy);
  if (side > 0) ctx.scale(-1, 1);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = h * 0.06 * devScale(ctx);
  ctx.lineWidth = h * 0.022;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(B[0], B[1]);
  ctx.quadraticCurveTo(C[0], C[1], T[0], T[1]);
  ctx.stroke();
  const pairs = 7;
  for (let i = 0; i < pairs; i++) {
    const t = 0.1 + (i / pairs) * 0.84;
    const [px, py] = at(t);
    const a = tangent(t);
    const len = h * (0.2 - t * 0.08);
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + s * 0.62);
      leafPath(ctx, len, len * 0.3);
      ctx.fill();
      ctx.restore();
    }
  }
  const [tx, ty] = at(1);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(tangent(1));
  leafPath(ctx, h * 0.13, h * 0.04);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Review quote with five stars, laurels on both sides and the source underneath. */
export function drawReviewQuote(ctx, quote, source, cx, cy, w, pal) {
  if (!quote && !source) return null;
  const qSize = w * 0.075;
  ctx.save();
  ctx.font = fontString(qSize, UI_FONT);
  ctx.letterSpacing = `${(qSize * 0.06).toFixed(2)}px`;
  const lines = wrapText(ctx, `“${String(quote || '').toUpperCase()}”`, w * 0.66);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), w * 0.4);
  ctx.restore();
  const starR = w * 0.032;
  const blockH = starR * 2.6 + lines.length * qSize * 1.08 + qSize * 0.9;
  let y = cy - blockH / 2;
  const gold = pal.seal[0];
  // Soft dark backing so the quote reads over any photo.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, (blockH * 0.95) / (w * 0.62));
  const back = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.62);
  back.addColorStop(0, 'rgba(10,2,18,0.62)');
  back.addColorStop(0.6, 'rgba(10,2,18,0.4)');
  back.addColorStop(1, 'rgba(10,2,18,0)');
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawStars(ctx, cx, y + starR, starR, 5, gold);
  y += starR * 2.7;
  ctx.save();
  ctx.font = fontString(qSize, UI_FONT);
  ctx.letterSpacing = `${(qSize * 0.06).toFixed(2)}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = qSize * 0.4 * devScale(ctx);
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += qSize * 1.08;
  }
  const sSize = qSize * 0.62;
  ctx.font = fontString(sSize, UI_FONT);
  ctx.letterSpacing = `${(sSize * 0.22).toFixed(2)}px`;
  ctx.fillStyle = gold;
  ctx.fillText(`— ${String(source || '').toUpperCase()} —`, cx, y + qSize * 0.12);
  ctx.restore();
  const lh = blockH * 1.15;
  const off = textW / 2 + lh * 0.3;
  drawLaurel(ctx, cx - off, cy + lh * 0.02, lh, -1, gold);
  drawLaurel(ctx, cx + off, cy + lh * 0.02, lh, 1, gold);
  return { x: cx - off - lh * 0.45, y: cy - lh / 2, w: off * 2 + lh * 0.9, h: lh };
}

function wrapText(ctx, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

/** Round seal: starburst rim, double ring, ring text and a bold centre. */
export function drawSealBadge(ctx, cx, cy, r, ringText, centerText, pal, titleFamily) {
  const scale = devScale(ctx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.16);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = r * 0.35 * scale;
  ctx.shadowOffsetY = r * 0.06 * scale;
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, pal.seal[0]);
  grad.addColorStop(1, pal.seal[1]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  const points = 30;
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points;
    const rr = i % 2 ? r * 0.92 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = pal.sealInk;
  ctx.lineWidth = r * 0.035;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = r * 0.02;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
  ctx.stroke();
  // Ring text.
  const ring = ` ${String(ringText || '').toUpperCase()} ★`;
  const fs = r * 0.15;
  ctx.font = fontString(fs, UI_FONT);
  ctx.fillStyle = pal.sealInk;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = Array.from(ring);
  const total = chars.reduce((s, ch) => s + ctx.measureText(ch).width, 0);
  const circumference = 2 * Math.PI * r * 0.71;
  const spacing = Math.max(1, circumference / Math.max(1, total));
  let angle = -Math.PI / 2;
  for (const ch of chars) {
    const cw = ctx.measureText(ch).width * spacing;
    const a = angle + cw / 2 / (r * 0.71);
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -r * 0.71);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += cw / (r * 0.71);
  }
  // Centre: small stars + bold two-line text.
  const words = String(centerText || '').toUpperCase().split(/\s+/).filter(Boolean);
  const half = Math.ceil(words.length / 2);
  const lines = words.length > 1 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : words;
  let cs = r * 0.3;
  ctx.font = fontString(cs, titleFamily);
  const widest = Math.max(1, ...lines.map((l) => ctx.measureText(l).width));
  cs = Math.min(cs, (r * 1.02 * cs) / widest);
  ctx.font = fontString(cs, titleFamily);
  const lh = cs * 0.98;
  const y0 = -((lines.length - 1) * lh) / 2 + cs * 0.12;
  lines.forEach((l, i) => ctx.fillText(l, 0, y0 + i * lh));
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.16);
  ctx.fillStyle = pal.sealInk;
  for (const sx of [-1, 0, 1]) {
    starPath(ctx, sx * r * 0.16, -r * 0.44, r * 0.06);
    ctx.fill();
  }
  ctx.restore();
  return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A deterministic barcode (from the title) on a white plate with digits underneath. */
export function drawBarcode(ctx, x, y, w, h, seedText) {
  if (!w || !h) return null;
  let seed = hashString(String(seedText || 'golden mile'));
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  ctx.save();
  ctx.fillStyle = '#fbf7ee';
  ctx.fillRect(x, y, w, h);
  const pad = h * 0.1;
  const barH = h * 0.62;
  let bx = x + pad;
  ctx.fillStyle = '#111111';
  const unit = (w - pad * 2) / 95;
  for (const g of [0, 46, 92]) ctx.fillRect(x + pad + g * unit, y + pad, unit, barH + h * 0.1);
  while (bx < x + w - pad - unit * 2) {
    const bw = unit * (1 + Math.floor(next() * 3));
    if (next() > 0.45) ctx.fillRect(bx, y + pad, bw, barH);
    bx += bw + unit;
  }
  ctx.font = fontString(h * 0.2, UI_FONT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const digits = String(seed).padStart(10, '7').slice(0, 10);
  ctx.letterSpacing = `${(h * 0.04).toFixed(2)}px`;
  ctx.fillText(`0 ${digits.slice(0, 5)} ${digits.slice(5)} 8`, x + w / 2, y + h - h * 0.02);
  ctx.restore();
  return { x, y, w, h };
}

/**
 * The billing block: tall condensed credits. Words typed in lower case print small (connectors such as
 * "directed by"), words in capitals print large — the classic film-poster rhythm.
 */
export function drawBillingBlock(ctx, text, cx, y, w, h, color) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const tokens = raw.split(/\s+/).map((t) => ({ t: t.toUpperCase(), small: t === t.toLowerCase() && /[a-z]/.test(t) }));
  const squeeze = 0.6;
  let lines;
  let size = h / 2.1;
  ctx.save();
  for (let attempt = 0; attempt < 12; attempt++) {
    lines = layoutBilling(ctx, tokens, size, w / squeeze);
    if (lines.length * size * 1.05 <= h) break;
    size *= 0.9;
  }
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.2 * devScale(ctx);
  let ly = y + size * 0.9;
  for (const line of lines) {
    ctx.save();
    ctx.translate(cx, ly);
    ctx.scale(squeeze, 1);
    let lx = -line.width / 2;
    for (const tok of line.tokens) {
      const fs = tok.small ? size * 0.55 : size;
      ctx.font = fontString(fs, UI_FONT);
      ctx.letterSpacing = `${(fs * 0.04).toFixed(2)}px`;
      ctx.fillText(tok.t, lx, tok.small ? -size * 0.04 : 0);
      lx += ctx.measureText(tok.t).width + size * 0.3;
    }
    ctx.restore();
    ly += size * 1.05;
  }
  ctx.restore();
  return { x: cx - w / 2, y, w, h: lines.length * size * 1.05 };
}

function layoutBilling(ctx, tokens, size, maxW) {
  const lines = [];
  let cur = { tokens: [], width: 0 };
  for (const tok of tokens) {
    const fs = tok.small ? size * 0.55 : size;
    ctx.font = fontString(fs, UI_FONT);
    ctx.letterSpacing = `${(fs * 0.04).toFixed(2)}px`;
    const tw = ctx.measureText(tok.t).width;
    const add = (cur.tokens.length ? size * 0.3 : 0) + tw;
    if (cur.width + add > maxW && cur.tokens.length) {
      lines.push(cur);
      cur = { tokens: [], width: 0 };
      cur.tokens.push(tok);
      cur.width = tw;
    } else {
      cur.tokens.push(tok);
      cur.width += add;
    }
  }
  if (cur.tokens.length) lines.push(cur);
  return lines;
}

/** Release line ("COMING SOON"): widely spaced caps between two thin rules. */
export function drawReleaseLine(ctx, text, cx, cy, size, pal) {
  const label = String(text || '').toUpperCase();
  if (!label.trim()) return null;
  ctx.save();
  ctx.font = fontString(size, UI_FONT);
  ctx.letterSpacing = `${(size * 0.32).toFixed(2)}px`;
  const tw = ctx.measureText(label).width;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grad = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
  grad.addColorStop(0, pal.fill[1]);
  grad.addColorStop(1, pal.fill[3]);
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = size * 0.3 * devScale(ctx);
  ctx.fillStyle = grad;
  ctx.fillText(label, cx + size * 0.16, cy);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = pal.fill[2];
  const rule = size * 1.4;
  ctx.fillRect(cx - tw / 2 - rule - size * 0.3, cy - 1, rule, Math.max(1.5, size * 0.06));
  ctx.fillRect(cx + tw / 2 + size * 0.3, cy - 1, rule, Math.max(1.5, size * 0.06));
  ctx.restore();
  return { x: cx - tw / 2 - rule - size * 0.3, y: cy - size / 2, w: tw + rule * 2 + size * 0.6, h: size };
}

// ---------------------------------------------------------------- colour helpers

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mixRgb(a, b, t) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

export function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function shade(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
