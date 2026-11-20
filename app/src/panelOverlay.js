// Editor overlay drawn above the live preview (never part of an export): panel outlines with numbered badges, the
// selected panel's highlight with corner handles, and the ghost badge while a panel number is dragged to swap.

export function panelBadgePoint(panel) {
  // The top-left-most vertex (clipping can rotate the polygon's vertex order).
  const [x, y] = panel.poly.reduce((best, p) => (p[0] + p[1] < best[0] + best[1] ? p : best), panel.poly[0]);
  const r = Math.min(panel.bbox.w, panel.bbox.h) * 0.07;
  const off = Math.max(26, Math.min(40, r));
  return { x: x + off, y: y + off };
}

function trace(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function badge(ctx, x, y, r, label, active, k) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = active ? '#ffc93c' : 'rgba(18,10,28,0.82)';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2 / k;
  ctx.strokeStyle = active ? '#2a0f33' : '#ffc93c';
  ctx.stroke();
  ctx.fillStyle = active ? '#2a0f33' : '#ffc93c';
  ctx.font = `${(r * 1.15).toFixed(1)}px "GM Barlow Condensed", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + r * 0.06);
  ctx.restore();
}

/** k = overlay pixels per design pixel. */
export function drawPanelSelection(ctx, layout, selected, k, drag) {
  ctx.clearRect(0, 0, layout.W, layout.H);
  const r = 13 / k;
  layout.panels.forEach((panel, i) => {
    if (i === selected) return;
    ctx.save();
    trace(ctx, panel.poly);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.setLineDash([6 / k, 5 / k]);
    ctx.lineWidth = 1.2 / k;
    ctx.stroke();
    ctx.restore();
  });
  const sel = layout.panels[selected];
  if (sel) {
    ctx.save();
    trace(ctx, sel.poly);
    ctx.shadowColor = 'rgba(56,225,255,0.9)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#38e1ff';
    ctx.lineWidth = 3.2 / k;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    const hs = 9 / k;
    for (const [x, y] of sel.poly) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0b5c70';
      ctx.lineWidth = 1.5 / k;
      ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs);
      ctx.strokeRect(x - hs / 2, y - hs / 2, hs, hs);
    }
    // Mid-edge handles.
    for (let i = 0; i < sel.poly.length; i++) {
      const a = sel.poly[i];
      const b = sel.poly[(i + 1) % sel.poly.length];
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      ctx.beginPath();
      ctx.arc(mx, my, hs * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#38e1ff';
      ctx.fill();
    }
    ctx.restore();
  }
  layout.panels.forEach((panel, i) => {
    const p = panelBadgePoint(panel);
    badge(ctx, p.x, p.y, r, String(i + 1), i === selected, k);
  });
  if (drag) {
    badge(ctx, drag.x, drag.y, r * 1.2, String(drag.from + 1), true, k);
  }
}
