// Code-drawn scenery that ties the panels together: the sky gradient with cloud bands, a striped retro sun, the
// sea with glints, a skyline and palm silhouettes, a warm glow behind the title, a lens flare, and the final
// grain and vignette over the whole cover. Everything is plain Canvas 2D paths and gradients.

/** Small deterministic PRNG so the scenery is the same on every render and export. */
export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function alpha(hexColor, a) {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
  return hexColor + v;
}

/** Vertical sunset sky down to the horizon, then the sea gradient below it. */
export function drawSkyGradient(ctx, W, H, scene, theme) {
  const sky = ctx.createLinearGradient(0, 0, 0, scene.horizon);
  theme.sky.forEach((c, i) => sky.addColorStop(i / (theme.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, scene.horizon + 1);
  const sea = ctx.createLinearGradient(0, scene.horizon, 0, H);
  sea.addColorStop(0, theme.sea[0]);
  sea.addColorStop(1, theme.sea[1]);
  ctx.fillStyle = sea;
  ctx.fillRect(0, scene.horizon, W, H - scene.horizon);
}

/** Thin stretched cloud bands lit from below. */
export function drawCloudBands(ctx, W, scene, theme, rand) {
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const y = scene.horizon - scene.sunR * (0.5 + rand() * 1.9);
    const x = rand() * W;
    const w = W * (0.12 + rand() * 0.28);
    const h = 4 + rand() * 10;
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    const c = theme.sun[1 + Math.floor(rand() * 2)];
    g.addColorStop(0, alpha(c, 0));
    g.addColorStop(0.5, alpha(c, 0.35 + rand() * 0.25));
    g.addColorStop(1, alpha(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Tiny stars in the upper sky (strongest on the night grades). */
export function drawStars(ctx, W, scene, rand, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 140; i++) {
    const x = rand() * W;
    const y = rand() * scene.horizon * 0.7;
    ctx.globalAlpha = amount * (0.25 + rand() * 0.75) * (1 - y / scene.horizon);
    ctx.fillRect(x, y, 1.6 + rand() * 1.6, 1.6 + rand() * 1.6);
  }
  ctx.restore();
}

/** The big retro sun: glow, vertical gradient disc, horizontal cuts widening downwards, clipped at the horizon. */
export function drawRetroSun(ctx, scene, theme) {
  const { sunX: x, sunY: y, sunR: r, horizon } = scene;
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.6);
  glow.addColorStop(0, alpha(theme.sun[1], 0.55));
  glow.addColorStop(0.4, alpha(theme.sun[2], 0.22));
  glow.addColorStop(1, alpha(theme.sun[3], 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
  ctx.beginPath();
  ctx.rect(x - r - 2, y - r - 2, r * 2 + 4, horizon - (y - r) + 1);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  // cut the stripes out of the disc path with even-odd rectangles
  const cuts = 7;
  for (let i = 0; i < cuts; i++) {
    const t = i / cuts;
    const yy = y + r * (0.08 + t * 0.9);
    const th = r * (0.018 + t * 0.06);
    ctx.rect(x - r - 2, yy, r * 2 + 4, th);
  }
  const disc = ctx.createLinearGradient(0, y - r, 0, y + r);
  disc.addColorStop(0, theme.sun[0]);
  disc.addColorStop(0.35, theme.sun[1]);
  disc.addColorStop(0.7, theme.sun[2]);
  disc.addColorStop(1, theme.sun[3]);
  ctx.fillStyle = disc;
  ctx.fill('evenodd');
  ctx.restore();
}

/** Sea glints: short horizontal strokes under the sun, narrowing towards the viewer. */
export function drawSeaReflections(ctx, W, H, scene, theme, rand) {
  const { sunX, sunR, horizon } = scene;
  ctx.save();
  for (let i = 0; i < 60; i++) {
    const t = rand();
    const y = horizon + 3 + t * t * (H - horizon);
    const spread = sunR * (0.6 + t * 0.9);
    const x = sunX + (rand() - 0.5) * 2 * spread;
    const w = (10 + rand() * 60) * (1 - t * 0.4);
    ctx.globalAlpha = 0.25 + (1 - t) * 0.6 * rand();
    ctx.fillStyle = theme.seaGlint;
    ctx.fillRect(x - w / 2, y, w, 1.5 + t * 3);
  }
  ctx.restore();
}

/** A city skyline along the horizon with a few lit windows. */
export function drawSkylineSilhouette(ctx, x0, x1, horizon, maxH, theme, rand, layer = 'near') {
  ctx.save();
  const fill = ctx.createLinearGradient(0, horizon - maxH * 1.3, 0, horizon);
  if (layer === 'far') {
    fill.addColorStop(0, alpha(theme.sun[3], 0.35));
    fill.addColorStop(1, alpha(theme.skyline, 0.55));
  } else {
    fill.addColorStop(0, theme.skyline);
    fill.addColorStop(1, theme.silhouette);
  }
  ctx.fillStyle = fill;
  let x = x0;
  const windows = [];
  while (x < x1) {
    const bw = 18 + rand() * 46;
    const bh = maxH * (0.25 + rand() * 0.75) * (rand() < 0.15 ? 1.35 : 1);
    ctx.fillRect(x, horizon - bh, bw, bh + 1);
    if (rand() < 0.3) ctx.fillRect(x + bw * 0.45, horizon - bh - bh * 0.2, 2.5, bh * 0.2);
    if (rand() < 0.25) {
      ctx.beginPath();
      ctx.moveTo(x, horizon - bh);
      ctx.lineTo(x + bw / 2, horizon - bh - bw * 0.4);
      ctx.lineTo(x + bw, horizon - bh);
      ctx.fill();
    }
    for (let wy = horizon - bh + 8; wy < horizon - 6; wy += 9) {
      for (let wx = x + 5; wx < x + bw - 5; wx += 8) if (rand() < 0.18) windows.push([wx, wy]);
    }
    x += bw + rand() * 4;
  }
  ctx.fillStyle = theme.accent;
  for (const [wx, wy] of windows) {
    ctx.globalAlpha = (layer === 'far' ? 0.25 : 0.4) + rand() * 0.5;
    ctx.fillRect(wx, wy, 2.5, 3);
  }
  ctx.restore();
}

/** One palm frond: a drooping curved rib with zig-zag leaflets on both sides. */
function drawPalmFrond(ctx, x, y, angle, len, droop) {
  const pts = [];
  const n = 22;
  const side = Math.cos(angle) >= 0 ? 1 : -1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = x + Math.cos(angle) * len * t + side * len * 0.22 * t * t;
    const py = y + Math.sin(angle) * len * t + droop * len * 0.55 * t * t;
    pts.push({ x: px, y: py });
  }
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = pts[i];
    const q = pts[Math.min(n, i + 1)];
    const r0 = pts[Math.max(0, i - 1)];
    const dx = q.x - r0.x;
    const dy = q.y - r0.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d;
    const ny = dx / d;
    const wd = len * 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (i % 2 ? 1 : 0.35);
    const back = len * 0.03;
    left.push({ x: p.x + nx * wd - (dx / d) * back, y: p.y + ny * wd + Math.abs(wd) * 0.35 });
    right.push({ x: p.x - nx * wd - (dx / d) * back, y: p.y - ny * wd + Math.abs(wd) * 0.35 });
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of left) ctx.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
}

/** A palm tree silhouette: tapered curving trunk with ring notches and a crown of drooping fronds. */
export function drawPalmSilhouette(ctx, baseX, baseY, height, lean, color, rand, fronds = 9) {
  ctx.save();
  ctx.fillStyle = color;
  const topX = baseX + lean * height;
  const topY = baseY - height;
  const ctrlX = baseX + lean * height * 0.15;
  const ctrlY = baseY - height * 0.55;
  const left = [];
  const right = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * baseX + 2 * (1 - t) * t * ctrlX + t * t * topX;
    const y = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * ctrlY + t * t * topY;
    const w = height * (0.032 - 0.014 * t) * (i % 3 === 0 ? 1.12 : 1);
    left.push([x - w, y]);
    right.push([x + w, y]);
  }
  ctx.beginPath();
  left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
  const len = height * 0.42;
  for (let i = 0; i < fronds; i++) {
    const a = -Math.PI - 0.35 + (i / (fronds - 1)) * (Math.PI + 0.7) + (rand() - 0.5) * 0.25;
    const upness = Math.max(0, -Math.sin(a));
    const droop = 0.5 + upness * 0.9 + rand() * 0.4;
    drawPalmFrond(ctx, topX, topY, a, len * (0.75 + rand() * 0.4), droop);
  }
  // coconut cluster
  ctx.beginPath();
  ctx.arc(topX, topY + height * 0.02, height * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Soft colour glow behind the title area. */
export function drawTitleGlow(ctx, spot, theme) {
  ctx.save();
  const g = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.r);
  g.addColorStop(0, alpha(theme.sun[1], 0.4));
  g.addColorStop(0.5, alpha(theme.sun[2], 0.15));
  g.addColorStop(1, alpha(theme.sun[3], 0));
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.fillRect(spot.x - spot.r, spot.y - spot.r, spot.r * 2, spot.r * 2);
  ctx.restore();
}

/** Lens flare from the sun: an anamorphic streak and ghost discs towards the opposite corner. */
export function drawLensFlare(ctx, W, H, x, y, size, theme) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const streak = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  streak.addColorStop(0, alpha('#ffffff', 0.5));
  streak.addColorStop(0.4, alpha(theme.sun[1], 0.18));
  streak.addColorStop(1, alpha(theme.sun[1], 0));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size * 0.9, size * 0.05);
  ctx.fillStyle = streak;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const core = ctx.createRadialGradient(x, y, 0, x, y, size * 0.5);
  core.addColorStop(0, 'rgba(255,255,255,0.9)');
  core.addColorStop(0.2, alpha(theme.sun[1], 0.45));
  core.addColorStop(1, alpha(theme.sun[2], 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  // a few faint rays fanning out of the sun
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.32;
    const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * size * 1.6, y + Math.sin(a) * size * 1.6);
    g.addColorStop(0, alpha(theme.sun[0], 0.9));
    g.addColorStop(1, alpha(theme.sun[1], 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - 0.05) * size * 1.6, y + Math.sin(a - 0.05) * size * 1.6);
    ctx.lineTo(x + Math.cos(a + 0.05) * size * 1.6, y + Math.sin(a + 0.05) * size * 1.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  void W;
  void H;
}

/** Print-style halftone dots over the lower sky, growing towards the horizon. */
export function drawHalftoneSky(ctx, W, scene, theme) {
  const cell = 14;
  const top = scene.horizon - scene.sunR * 2.2;
  ctx.save();
  ctx.fillStyle = theme.sky[2];
  ctx.globalAlpha = 0.32;
  for (let y = Math.max(0, top); y < scene.horizon; y += cell) {
    const t = (y - top) / (scene.horizon - top);
    const r = cell * 0.48 * t * t;
    if (r < 0.6) continue;
    const shift = (Math.round(y / cell) % 2) * cell * 0.5;
    ctx.beginPath();
    for (let x = shift; x < W; x += cell) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
}

/** The whole backdrop behind the panels: sky, stars, clouds, sun, skyline, sea and palms. */
export function drawSceneBackdrop(ctx, W, H, scene, theme, opts = {}) {
  const rand = seededRandom(opts.seed ?? 1987);
  drawSkyGradient(ctx, W, H, scene, theme);
  drawStars(ctx, W, scene, rand, opts.stars ?? 0.3);
  drawCloudBands(ctx, W, scene, theme, rand);
  drawHalftoneSky(ctx, W, scene, theme);
  drawRetroSun(ctx, scene, theme);
  drawSkylineSilhouette(ctx, 0, W, scene.horizon, scene.sunR * 0.62, theme, rand, 'far');
  drawSkylineSilhouette(ctx, 0, W, scene.horizon, scene.sunR * 0.38, theme, rand, 'near');
  drawSeaReflections(ctx, W, H, scene, theme, rand);
  const palms = scene.palms ?? [
    { x: scene.sunX - scene.sunR * 1.75, h: scene.sunR * 1.5, lean: -0.12 },
    { x: scene.sunX - scene.sunR * 1.45, h: scene.sunR * 1.05, lean: 0.1 },
    { x: scene.sunX + scene.sunR * 1.6, h: scene.sunR * 1.35, lean: 0.14 },
    { x: scene.sunX + scene.sunR * 1.95, h: scene.sunR * 0.95, lean: -0.08 },
  ];
  for (const p of palms) drawPalmSilhouette(ctx, p.x, scene.horizon + 2, p.h, p.lean, theme.silhouette, rand);
}

let grainTile = null;

/** Film grain over the whole cover from a fixed noise tile (overlay blend). */
export function drawFilmGrain(ctx, W, H, amount) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 256;
    grainTile.height = 256;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(256, 256);
    const rand = seededRandom(42);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.round(rand() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
