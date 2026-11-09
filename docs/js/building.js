import { FLOOR_LIST } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function buildingLayout(view) {
  const narrow = view.w < 560;
  const hw = narrow ? Math.min(118, view.w * 0.34) : 168;
  const cx = view.w / 2;
  const ground = Math.min(view.h * 0.74, view.h - 88);
  const step = narrow ? 58 : 70;
  return FLOOR_LIST.map((floor, index) => ({
    id: floor.id,
    name: floor.name,
    blurb: floor.blurb,
    index,
    cx,
    hw,
    base: ground - index * step,
  }));
}

function pane(ctx, x, y, w, h, dots) {
  ctx.fillStyle = '#c5e6ef';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, w, Math.max(2, h * 0.12));
  for (const dot of dots) {
    const px = x + 3 + dot.u * (w - 8);
    const py = y + 4 + dot.v * (h - 12);
    ctx.fillStyle = dot.color;
    ctx.fillRect(px, py, 4, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px, py + 7, 4, 2);
  }
  ctx.strokeStyle = '#f7f3ea';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function tree(ctx, x, y) {
  ctx.fillStyle = '#6b4a2e';
  ctx.fillRect(x, y, 6, 16);
  ctx.fillStyle = '#2f6b3a';
  ctx.beginPath();
  ctx.arc(x + 3, y - 4, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3e8a48';
  ctx.beginPath();
  ctx.arc(x + 8, y - 10, 9, 0, Math.PI * 2);
  ctx.fill();
}

export function drawBuilding(ctx, view, samples, zoom = 1) {
  const floors = buildingLayout(view);
  ctx.save();
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-view.w / 2, -view.h / 2);

  const sky = ctx.createLinearGradient(0, 0, 0, view.h);
  sky.addColorStop(0, '#1c3334');
  sky.addColorStop(1, '#14110e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.w, view.h);

  const ground = floors[0];
  ctx.fillStyle = '#243028';
  ctx.beginPath();
  ctx.ellipse(ground.cx, ground.base + 28, ground.hw + 70, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  tree(ctx, ground.cx - ground.hw - 36, ground.base + 8);
  tree(ctx, ground.cx + ground.hw + 24, ground.base + 4);

  for (const floor of floors) {
    const { cx, base, hw } = floor;
    const h = 52;
    const dots = samples[floor.id] || [];
    const leftDots = dots.filter((_, i) => i % 2 === 0);
    const rightDots = dots.filter((_, i) => i % 2 === 1);
    ctx.fillStyle = '#cbb89a';
    ctx.beginPath();
    ctx.moveTo(cx - hw, base);
    ctx.lineTo(cx, base + 28);
    ctx.lineTo(cx, base + 28 - h);
    ctx.lineTo(cx - hw, base - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a89274';
    ctx.beginPath();
    ctx.moveTo(cx + hw, base);
    ctx.lineTo(cx, base + 28);
    ctx.lineTo(cx, base + 28 - h);
    ctx.lineTo(cx + hw, base - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = floor.index === floors.length - 1 ? '#d25a32' : '#efe4d2';
    ctx.beginPath();
    ctx.moveTo(cx, base - h - 16);
    ctx.lineTo(cx + hw, base - h);
    ctx.lineTo(cx, base - h + 16);
    ctx.lineTo(cx - hw, base - h);
    ctx.closePath();
    ctx.fill();
    pane(ctx, cx - hw + 18, base - h + 12, Math.round(hw * 0.34), 26, leftDots);
    pane(ctx, cx - hw * 0.42, base - h + 12, Math.round(hw * 0.28), 26, rightDots);
    if (floor.index === 0) {
      ctx.fillStyle = '#2a2118';
      ctx.fillRect(cx + 18, base - 36, 22, 36);
      ctx.fillStyle = '#e2a23b';
      ctx.fillRect(cx + 26, base - 18, 3, 3);
    }
    ctx.fillStyle = '#f7f1e6';
    ctx.font = '700 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(floor.name, cx - hw - 16, base - 34);
  }

  ctx.fillStyle = '#f7f1e6';
  ctx.font = '700 22px Georgia, Palatino, serif';
  ctx.textAlign = 'center';
  ctx.fillText('O Escritório', ground.cx, 42);
  ctx.font = '600 13px "Segoe UI", sans-serif';
  ctx.fillStyle = '#d9cbb8';
  ctx.fillText('Toque num andar para entrar', ground.cx, 64);
  ctx.restore();
  return floors;
}

export function hitFloor(view, sx, sy, zoom = 1) {
  const floors = buildingLayout(view);
  const x = view.w / 2 + (sx - view.w / 2) / zoom;
  const y = view.h / 2 + (sy - view.h / 2) / zoom;
  for (let i = floors.length - 1; i >= 0; i -= 1) {
    const floor = floors[i];
    const top = floor.base - 50;
    const bottom = floor.base + 8;
    if (x >= floor.cx - floor.hw && x <= floor.cx + floor.hw && y >= top && y <= bottom) {
      return floor.id;
    }
  }
  return null;
}

export function floorAnchor(view, floorId) {
  const floors = buildingLayout(view);
  return floors.find((floor) => floor.id === floorId) || floors[0];
}
