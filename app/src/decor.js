// Code-drawn decoration for the parts of a poster that show background: sunset sky with a striped sun, sea glints,
// palm and skyline silhouettes, lens flares, sparkles and the dark glow that lifts the title off the photos.

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Sunset sky with sun, sea and horizon glow, filling rect {x, y, w, h}; horizon is an absolute y. */
export function drawSunsetSky(ctx, rect, horizon, sunX, sunR, mood = 'gold') {
  const { x, y, w, h } = rect;
  const top = y;
  const bottom = y + h;
  const palette = SKY_PALETTES[mood] || SKY_PALETTES.gold;
  const sky = ctx.createLinearGradient(0, top, 0, horizon);
  palette.sky.forEach((c, i) => sky.addColorStop(i / (palette.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(x, top, w, horizon - top);
  // Sun with retro stripe cuts.
  drawStripedSun(ctx, sunX, horizon - sunR * 0.35, sunR, palette);
  // Sea.
  const sea = ctx.createLinearGradient(0, horizon, 0, bottom);
  palette.sea.forEach((c, i) => sea.addColorStop(i / (palette.sea.length - 1), c));
  ctx.fillStyle = sea;
  ctx.fillRect(x, horizon, w, bottom - horizon);
  // Sun glints on the water.
  const rnd = seeded(77);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const t = rnd();
    const gy = horizon + 6 + Math.pow(t, 1.6) * (bottom - horizon - 10);
    const spread = sunR * (0.5 + t * 1.6);
    const gw = (10 + rnd() * 50) * (0.5 + t);
    const gx = sunX + (rnd() - 0.5) * spread * 2;
    ctx.fillStyle = `rgba(255, ${190 + Math.round(rnd() * 50)}, 140, ${0.35 - t * 0.2})`;
    ctx.fillRect(gx - gw / 2, gy, gw, 2 + t * 3);
  }
  ctx.restore();
  // Horizon glow.
  const glow = ctx.createRadialGradient(sunX, horizon, 0, sunX, horizon, Math.max(w, h) * 0.6);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = glow;
  ctx.fillRect(x, top, w, h);
  ctx.restore();
}

const SKY_PALETTES = {
  gold: {
    sky: ['#24083a', '#5b1260', '#b2246e', '#f2584a', '#ff9a3c', '#ffd56b'],
    sea: ['#ff8e4a', '#b5385e', '#3a1048', '#14061f'],
    sun: ['#fffbd0', '#ffe066', '#ff9d2e', '#ff4f6a'],
    glow: 'rgba(255,150,70,0.55)',
  },
  neon: {
    sky: ['#05031a', '#1a0a4a', '#4b0f86', '#b0179a', '#ff3d8b', '#ff9c6b'],
    sea: ['#ff4fa0', '#6a1a8c', '#160a3c', '#05031a'],
    sun: ['#fff0fb', '#ff9ce6', '#ff3db8', '#8f2bff'],
    glow: 'rgba(255,60,180,0.5)',
  },
  teal: {
    sky: ['#03222b', '#0a5260', '#2a8c8a', '#f08a5d', '#ffb86b', '#ffe39a'],
    sea: ['#ffb070', '#2a8c8a', '#0a3d48', '#03181e'],
    sun: ['#fffbe0', '#ffe48a', '#ffb04a', '#ff6a4d'],
    glow: 'rgba(255,170,90,0.5)',
  },
  violet: {
    sky: ['#0b0220', '#2a0a5c', '#6a1aa8', '#c23aa8', '#ff6a9e', '#ffb0c8'],
    sea: ['#ff7ab8', '#7a2aa8', '#220a4a', '#0b0220'],
    sun: ['#fff4ff', '#ffc2f0', '#ff6ad0', '#a83aff'],
    glow: 'rgba(220,90,255,0.5)',
  },
  print: {
    sky: ['#2a120a', '#6e2a16', '#c2482a', '#ec7a3a', '#f6b25a', '#f8dc96'],
    sea: ['#f08a3a', '#a33a24', '#4a180e', '#1a0905'],
    sun: ['#fff6dc', '#ffd36e', '#ff9b3d', '#e8452c'],
    glow: 'rgba(255,150,70,0.45)',
  },
};

export const SKY_MOOD_FOR_GRADE = {
  sunsetGold: 'gold', neonNight: 'neon', tropicTeal: 'teal', ultraviolet: 'violet', retroPrint: 'print',
};

/** A big sun with horizontal stripe cuts in its lower half. */
export function drawStripedSun(ctx, cx, cy, r, palette = SKY_PALETTES.gold) {
  const c = document.createElement('canvas');
  const size = Math.ceil(r * 2 + 4);
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, size);
  palette.sun.forEach((col, i) => grad.addColorStop(i / (palette.sun.length - 1), col));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 7; k++) {
    const t = k / 7;
    const yy = size / 2 + r * (0.12 + t * 0.85);
    const hh = r * (0.025 + t * 0.06);
    g.fillRect(0, yy, size, hh);
  }
  ctx.save();
  ctx.shadowColor = palette.sun[1];
  ctx.shadowBlur = r * 0.6;
  ctx.drawImage(c, cx - size / 2, cy - size / 2);
  ctx.restore();
}

/** A palm tree silhouette: tapered curved trunk and jagged fronds. */
export function drawPalmSilhouette(ctx, baseX, baseY, height, lean, color) {
  const topX = baseX + lean * height;
  const topY = baseY - height;
  const ctrlX = baseX + lean * height * 0.2;
  const ctrlY = baseY - height * 0.55;
  ctx.save();
  ctx.fillStyle = color;
  // Trunk as a tapered ribbon along a quadratic curve.
  const steps = 24;
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * baseX + 2 * (1 - t) * t * ctrlX + t * t * topX;
    const y = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * ctrlY + t * t * topY;
    const wdt = height * (0.035 - t * 0.02);
    left.push([x - wdt, y]);
    right.push([x + wdt, y]);
  }
  ctx.beginPath();
  left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  right.reverse().forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fill();
  // Fronds.
  const fronds = [-2.9, -2.45, -2.0, -1.45, -1.0, -0.55, -0.15, 0.3];
  for (const a0 of fronds) {
    const len = height * (0.42 + 0.12 * Math.cos(a0 * 3));
    const a = a0 + lean * 0.4;
    drawFrond(ctx, topX, topY, a, len);
  }
  ctx.beginPath();
  ctx.arc(topX, topY, height * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** One palm frond: an arching spine that droops under gravity, with slim leaflets hanging from both sides. */
function drawFrond(ctx, x, y, angle, len) {
  const n = 22;
  const spine = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    spine.push([x + Math.cos(angle) * len * t, y + Math.sin(angle) * len * t + len * 0.55 * t * t]);
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = len * 0.022;
  ctx.beginPath();
  spine.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
  for (let i = 2; i <= n; i++) {
    const [px, py] = spine[i];
    const [qx, qy] = spine[i - 1];
    const dir = Math.atan2(py - qy, px - qx);
    const t = i / n;
    const leaf = len * 0.3 * Math.sin(Math.PI * Math.min(1, t * 1.05)) + len * 0.04;
    for (const side of [-1, 1]) {
      // Leaflets sweep back and hang down.
      const a = dir + side * 1.05 + 0.35;
      const ex = px + Math.cos(a) * leaf;
      const ey = py + Math.sin(a) * leaf + leaf * 0.35;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo((px + ex) / 2 + side * leaf * 0.08, (py + ey) / 2 - leaf * 0.12, ex, ey);
      ctx.lineWidth = len * 0.02 * (1.2 - t * 0.6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** City skyline silhouette between x0 and x1 standing on baseY. */
export function drawSkyline(ctx, x0, x1, baseY, maxH, color, windowColor, seed = 9) {
  const rnd = seeded(seed);
  ctx.save();
  let x = x0;
  while (x < x1) {
    const bw = maxH * (0.12 + rnd() * 0.2);
    const bh = maxH * (0.25 + Math.pow(rnd(), 1.4) * 0.75);
    ctx.fillStyle = color;
    ctx.fillRect(x, baseY - bh, bw + 1, bh);
    if (rnd() > 0.6) ctx.fillRect(x + bw * 0.45, baseY - bh - maxH * 0.12, Math.max(1, bw * 0.06), maxH * 0.12);
    if (rnd() > 0.7) {
      ctx.beginPath();
      ctx.moveTo(x, baseY - bh);
      ctx.lineTo(x + bw / 2, baseY - bh - bw * 0.5);
      ctx.lineTo(x + bw, baseY - bh);
      ctx.fill();
    }
    ctx.fillStyle = windowColor;
    const cols = Math.max(1, Math.floor(bw / (maxH * 0.05)));
    const rows = Math.max(1, Math.floor(bh / (maxH * 0.06)));
    for (let r = 1; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd() > 0.72) ctx.fillRect(x + (c + 0.3) * (bw / cols), baseY - bh + r * (bh / rows), Math.max(1, maxH * 0.012), Math.max(1, maxH * 0.016));
      }
    }
    x += bw + maxH * (0.01 + rnd() * 0.04);
  }
  ctx.restore();
}

/** A four-point sparkle with a soft glow. */
export function drawSparkle(ctx, x, y, r, color = '#ffffff', glow = 'rgba(255,240,200,0.9)') {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 1.2);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, 'rgba(255,220,180,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = glow;
  ctx.shadowBlur = r * 0.6;
  for (const [len, thick, rot] of [[r, r * 0.12, 0], [r * 0.55, r * 0.09, Math.PI / 4]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.quadraticCurveTo(thick * 0.4, -thick * 0.4, len, 0);
    ctx.quadraticCurveTo(thick * 0.4, thick * 0.4, 0, len);
    ctx.quadraticCurveTo(-thick * 0.4, thick * 0.4, -len, 0);
    ctx.quadraticCurveTo(-thick * 0.4, -thick * 0.4, 0, -len);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Anamorphic lens flare: hot core, long horizontal streak and a few ghosts along the line to the centre. */
export function drawLensFlare(ctx, x, y, size, W, H, tint = [255, 190, 120]) {
  const [r, g, b] = tint;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const core = ctx.createRadialGradient(x, y, 0, x, y, size);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.15, `rgba(${r},${g},${b},0.6)`);
  core.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = core;
  ctx.fillRect(x - size, y - size, size * 2, size * 2);
  const streak = ctx.createLinearGradient(x - size * 2.6, 0, x + size * 2.6, 0);
  streak.addColorStop(0, `rgba(${r},${g},${b},0)`);
  streak.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  streak.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = streak;
  ctx.fillRect(x - size * 2.6, y - size * 0.02, size * 5.2, size * 0.04);
  const cx = W / 2;
  const cy = H / 2;
  const ghosts = [[0.5, 0.18, 0.18], [0.85, 0.1, 0.22], [1.25, 0.28, 0.12], [1.6, 0.08, 0.2]];
  for (const [t, rad, alpha] of ghosts) {
    const gx = x + (cx - x) * t;
    const gy = y + (cy - y) * t;
    const gr = size * rad * 2;
    const ghost = ctx.createRadialGradient(gx, gy, gr * 0.6, gx, gy, gr);
    ghost.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.4})`);
    ghost.addColorStop(0.85, `rgba(${r},${Math.round(g * 0.8)},${b},${alpha})`);
    ghost.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = ghost;
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Dark elliptical glow behind the title plus a warm inner bloom, so the lettering reads over busy photos. */
export function drawTitleGlow(ctx, glow, color) {
  const { cx, cy, rx, ry } = glow;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx / ry, 1);
  const dark = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
  dark.addColorStop(0, 'rgba(8,2,16,0.78)');
  dark.addColorStop(0.55, 'rgba(8,2,16,0.55)');
  dark.addColorStop(1, 'rgba(8,2,16,0)');
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(0, 0, ry, 0, Math.PI * 2);
  ctx.fill();
  const [r, g, b] = color;
  const warm = ctx.createRadialGradient(0, 0, 0, 0, 0, ry * 0.8);
  warm.addColorStop(0, `rgba(${r},${g},${b},0.32)`);
  warm.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = warm;
  ctx.beginPath();
  ctx.arc(0, 0, ry * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Placeholder art for a panel with no photo: a small sunset with a palm. */
export function drawEmptyPanelArt(ctx, box, mood, palmColor) {
  drawSunsetSky(ctx, box, box.y + box.h * 0.72, box.x + box.w * 0.55, Math.min(box.w, box.h) * 0.22, mood);
  drawPalmSilhouette(ctx, box.x + box.w * 0.22, box.y + box.h, box.h * 0.8, 0.12, palmColor);
}
