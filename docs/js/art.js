import { TILE_W, TILE_H, WALL_H, tileToWorld, footprintCorners } from './iso.js';
import { footprintSize } from './layout.js';
import { drawPiece, hasPiece } from './pieces.js';

const spriteCache = new Map();

const INK = '#241c16';
const WOOD = '#c48a4a';
const WOOD_L = '#e4bc78';
const WOOD_D = '#7c522c';
const WOOD_M = '#a56d38';

const FLOORS = {
  marble: ['#e8e2d6', '#ded6c8', '#cfc6b6'],
  carpet: ['#718f8b', '#65827e', '#56736f'],
  wood: ['#d0aa72', '#c09660', '#a8844c'],
  warm: ['#e0b883', '#d1a56e', '#b88b52'],
};

export function shade(hex, amt) {
  const n = Number.parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const target = amt < 0 ? 0 : 255;
  const p = Math.min(1, Math.abs(amt));
  r = Math.round(r + (target - r) * p);
  g = Math.round(g + (target - g) * p);
  b = Math.round(b + (target - b) * p);
  const h = (v) => v.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function quad(ctx, a, b, c, d, color) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function along(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function diamond(ctx, cx, cy, hw, hh, color) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * 2, -(y + h) * 2, w * 2, h * 2);
}

function prism(ctx, w, d, base, height, top, left, right) {
  const c = footprintCorners(w, d);
  const up = (p, z) => ({ x: p.x, y: p.y - z });
  const B = up(c.B, base);
  const R = up(c.R, base);
  const F = up(c.F, base);
  const L = up(c.L, base);
  const B2 = up(c.B, base + height);
  const R2 = up(c.R, base + height);
  const F2 = up(c.F, base + height);
  const L2 = up(c.L, base + height);
  quad(ctx, L2, F2, F, L, left);
  quad(ctx, R2, F2, F, R, right);
  quad(ctx, B2, R2, F2, L2, top);
  ctx.beginPath();
  ctx.moveTo(B2.x, B2.y);
  ctx.lineTo(R2.x, R2.y);
  ctx.lineTo(F2.x, F2.y);
  ctx.lineTo(L2.x, L2.y);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(36, 28, 22, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  return { B, R, F, L, B2, R2, F2, L2 };
}

function edgeByRot(rot, faces, which) {
  const r = ((rot % 4) + 4) % 4;
  const far = {
    0: [faces.B2, faces.R2],
    1: [faces.R2, faces.F2],
    2: [faces.F2, faces.L2],
    3: [faces.L2, faces.B2],
  };
  const near = {
    0: [faces.F2, faces.L2],
    1: [faces.L2, faces.B2],
    2: [faces.B2, faces.R2],
    3: [faces.R2, faces.F2],
  };
  return (which === 'near' ? near : far)[r];
}

function groundShadow(ctx, w, d) {
  const c = footprintCorners(w, d);
  const cx = (c.B.x + c.R.x + c.F.x + c.L.x) / 4;
  const cy = (c.B.y + c.R.y + c.F.y + c.L.y) / 4 + 2;
  ctx.fillStyle = 'rgba(28, 20, 12, 0.16)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(14, w * 16), Math.max(7, d * 7), 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawGroundTile(ctx, x, y, kind, door = false) {
  const colors = FLOORS[kind] || FLOORS.wood;
  const p = tileToWorld(x, y);
  const base = door ? '#d7a07a' : colors[(x + y) % 2];
  diamond(ctx, p.x, p.y, TILE_W / 2, TILE_H / 2, base);
  ctx.beginPath();
  ctx.moveTo(p.x - TILE_W / 2, p.y);
  ctx.lineTo(p.x, p.y + TILE_H / 2);
  ctx.lineTo(p.x + TILE_W / 2, p.y);
  ctx.closePath();
  ctx.fillStyle = door ? 'rgba(120, 60, 30, 0.16)' : 'rgba(40, 28, 16, 0.07)';
  ctx.fill();
  if (!door && (kind === 'wood' || kind === 'warm')) {
    ctx.beginPath();
    ctx.moveTo(p.x - 18, p.y - 3);
    ctx.lineTo(p.x + 14, p.y + 5);
    ctx.strokeStyle = 'rgba(90, 58, 24, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - TILE_H / 2);
  ctx.lineTo(p.x + TILE_W / 2, p.y);
  ctx.lineTo(p.x, p.y + TILE_H / 2);
  ctx.lineTo(p.x - TILE_W / 2, p.y);
  ctx.closePath();
  ctx.strokeStyle = door ? 'rgba(122, 58, 28, 0.45)' : 'rgba(70, 52, 32, 0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawPortal(ctx, x, y, kind) {
  const p = tileToWorld(x, y);
  ctx.save();
  ctx.translate(p.x, p.y);
  diamond(ctx, 0, 0, 26, 12, kind === 'elevator' ? '#2c3338' : '#8d6a34');
  if (kind === 'elevator') {
    ctx.fillStyle = '#d5dbe0';
    ctx.fillRect(-14, -36, 12, 28);
    ctx.fillRect(2, -36, 12, 28);
    ctx.fillStyle = '#8fd8cc';
    ctx.fillRect(-11, -32, 6, 18);
    ctx.fillRect(5, -32, 6, 18);
    ctx.fillStyle = '#e2a23b';
    ctx.fillRect(-2, -40, 4, 4);
  } else {
    ctx.fillStyle = '#f4efe4';
    ctx.fillRect(-16, -12, 32, 6);
    ctx.fillRect(-12, -20, 28, 6);
    ctx.fillRect(-8, -28, 24, 6);
    ctx.fillStyle = '#7c522c';
    ctx.fillRect(-16, -8, 32, 2);
    ctx.fillRect(-12, -16, 28, 2);
    ctx.fillRect(-8, -24, 24, 2);
  }
  ctx.restore();
}

export function drawFloor(ctx, room) {
  const colors = FLOORS[room.floor] || FLOORS.wood;
  for (let y = 0; y < room.h; y += 1) {
    for (let x = 0; x < room.w; x += 1) {
      const p = tileToWorld(x, y);
      const door = room.doors.some((d) => d.x === x && d.y === y);
      const base = door ? '#d7a07a' : colors[(x + y) % 2];
      diamond(ctx, p.x, p.y, TILE_W / 2, TILE_H / 2, base);
      ctx.beginPath();
      ctx.moveTo(p.x - TILE_W / 2, p.y);
      ctx.lineTo(p.x, p.y + TILE_H / 2);
      ctx.lineTo(p.x + TILE_W / 2, p.y);
      ctx.closePath();
      ctx.fillStyle = door ? 'rgba(120, 60, 30, 0.16)' : 'rgba(40, 28, 16, 0.07)';
      ctx.fill();
      if (!door && (room.floor === 'wood' || room.floor === 'warm')) {
        ctx.beginPath();
        ctx.moveTo(p.x - 18, p.y - 3);
        ctx.lineTo(p.x + 14, p.y + 5);
        ctx.strokeStyle = 'rgba(90, 58, 24, 0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - TILE_H / 2);
      ctx.lineTo(p.x + TILE_W / 2, p.y);
      ctx.lineTo(p.x, p.y + TILE_H / 2);
      ctx.lineTo(p.x - TILE_W / 2, p.y);
      ctx.closePath();
      ctx.strokeStyle = door ? 'rgba(122, 58, 28, 0.45)' : 'rgba(70, 52, 32, 0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function wallFace(ctx, bottomA, bottomB, topA, topB, room, windowed, door) {
  const wall = room.wall;
  if (!door) {
    quad(ctx, topA, topB, bottomB, bottomA, wall.fill);
    const base0 = along(bottomA, topA, 0.09);
    const base1 = along(bottomB, topB, 0.09);
    quad(ctx, base0, base1, bottomB, bottomA, shade(wall.trim, -0.35));
    const trim0 = along(bottomA, topA, 0.9);
    const trim1 = along(bottomB, topB, 0.9);
    quad(ctx, topA, topB, trim1, trim0, wall.trim);
    if (windowed) wallWindow(ctx, bottomA, bottomB, topA, topB);
    return;
  }
  const p = (u, v) => along(along(bottomA, topA, v), along(bottomB, topB, v), u);
  quad(ctx, p(0, 1), p(0.14, 1), p(0.14, 0), p(0, 0), wall.frame);
  quad(ctx, p(0.86, 1), p(1, 1), p(1, 0), p(0.86, 0), shade(wall.frame, -0.12));
  quad(ctx, p(0.14, 1), p(0.86, 1), p(0.86, 0.7), p(0.14, 0.7), wall.trim);
  quad(ctx, p(0.18, 0.68), p(0.82, 0.68), p(0.82, 0.04), p(0.18, 0.04), '#24312f');
  quad(ctx, p(0.18, 0.68), p(0.82, 0.68), p(0.78, 0.6), p(0.22, 0.6), 'rgba(255,255,255,0.05)');
}

function wallWindow(ctx, bottomA, bottomB, topA, topB) {
  const p = (u, v) => along(along(bottomA, topA, v), along(bottomB, topB, v), u);
  const u0 = 0.28;
  const u1 = 0.72;
  const v0 = 0.38;
  const v1 = 0.76;
  quad(ctx, p(u0, v1), p(u1, v1), p(u1, v0), p(u0, v0), '#d5ebe6');
  quad(ctx, p(0.47, v1), p(0.53, v1), p(0.53, v0), p(0.47, v0), '#f7f3ea');
  quad(ctx, p(u0, 0.55), p(u1, 0.55), p(u1, 0.6), p(u0, 0.6), '#f7f3ea');
}

function nearDoor(room, x, y) {
  return room.doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
}

export function drawWalls(ctx, room) {
  const h = WALL_H;
  for (let y = 0; y < room.h; y += 1) {
    const c = tileToWorld(0, y);
    const bottomA = { x: c.x, y: c.y - TILE_H / 2 };
    const bottomB = { x: c.x - TILE_W / 2, y: c.y };
    const topA = { x: bottomA.x, y: bottomA.y - h };
    const topB = { x: bottomB.x, y: bottomB.y - h };
    const door = room.doors.find((d) => d.x === 0 && d.y === y) || null;
    const windowed = !door && !nearDoor(room, 0, y) && y % 2 === 1;
    wallFace(ctx, bottomA, bottomB, topA, topB, room, windowed, door);
  }
  for (let x = 0; x < room.w; x += 1) {
    const c = tileToWorld(x, 0);
    const bottomA = { x: c.x, y: c.y - TILE_H / 2 };
    const bottomB = { x: c.x + TILE_W / 2, y: c.y };
    const topA = { x: bottomA.x, y: bottomA.y - h };
    const topB = { x: bottomB.x, y: bottomB.y - h };
    const door = room.doors.find((d) => d.x === x && d.y === 0) || null;
    const windowed = !door && !nearDoor(room, x, 0) && x % 2 === 0;
    const saved = room.wall;
    room.wall = { ...saved, fill: saved.shade };
    wallFace(ctx, bottomA, bottomB, topA, topB, room, windowed, door);
    room.wall = saved;
  }
}

export function doorAnchor(door) {
  const p = tileToWorld(door.x, door.y);
  return { x: p.x, y: p.y - 86 };
}

function drawRug(ctx, item) {
  const fp = footprintSize(item);
  const c = footprintCorners(fp.w, fp.d);
  const center = {
    x: (c.B.x + c.R.x + c.F.x + c.L.x) / 4,
    y: (c.B.y + c.R.y + c.F.y + c.L.y) / 4,
  };
  const shrink = (p, k) => ({
    x: center.x + (p.x - center.x) * k,
    y: center.y + (p.y - center.y) * k,
  });
  quad(ctx, shrink(c.B, 0.9), shrink(c.R, 0.9), shrink(c.F, 0.9), shrink(c.L, 0.9), '#8d3b32');
  quad(ctx, shrink(c.B, 0.62), shrink(c.R, 0.62), shrink(c.F, 0.62), shrink(c.L, 0.62), '#f0e2c8');
  quad(ctx, shrink(c.B, 0.34), shrink(c.R, 0.34), shrink(c.F, 0.34), shrink(c.L, 0.34), '#1e5c55');
}

function drawDesk(ctx, item) {
  const fp = footprintSize(item);
  groundShadow(ctx, fp.w, fp.d);
  const c = footprintCorners(fp.w, fp.d);
  ctx.strokeStyle = WOOD_D;
  ctx.lineWidth = 3;
  for (const p of [c.B, c.R, c.F, c.L]) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 26);
    ctx.stroke();
  }
  const top = prism(ctx, fp.w, fp.d, 26, 6, WOOD_L, WOOD, WOOD_D);
  const [n0, n1] = edgeByRot(item.rot || 0, top, 'near');
  const paperA = along(n0, n1, 0.18);
  const paperB = along(n0, n1, 0.42);
  quad(ctx,
    { x: paperA.x, y: paperA.y - 2 },
    { x: paperB.x, y: paperB.y - 2 },
    { x: paperB.x, y: paperB.y + 8 },
    { x: paperA.x, y: paperA.y + 8 },
    '#f7f4ee');
}

function drawMonitor(ctx, a, b, screen) {
  const a2 = { x: a.x, y: a.y - 20 };
  const b2 = { x: b.x, y: b.y - 20 };
  quad(ctx, a2, b2, b, a, '#243038');
  const s0 = along(a, b, 0.12);
  const s1 = along(a, b, 0.88);
  const s2 = along(a2, b2, 0.88);
  const s3 = along(a2, b2, 0.12);
  quad(ctx,
    { x: s3.x, y: s3.y + 3 },
    { x: s2.x, y: s2.y + 3 },
    { x: s1.x, y: s1.y - 2 },
    { x: s0.x, y: s0.y - 2 },
    screen);
}

function drawComputer(ctx, item, time, lift) {
  const base = lift || 0;
  const fp = footprintSize(item);
  if (!base) groundShadow(ctx, fp.w, fp.d);
  const top = prism(ctx, 1, 1, base, base ? 3 : 18, '#d9dee3', '#aeb6bc', '#7d868c');
  const [f0, f1] = edgeByRot(item.rot || 0, top, 'far');
  const a = along(f0, f1, 0.2);
  const b = along(f0, f1, 0.8);
  const blink = Math.floor(time * 2) % 2 === 0;
  drawMonitor(ctx, a, b, blink ? '#b7efe4' : '#8fd8cc');
  const [n0, n1] = edgeByRot(item.rot || 0, top, 'near');
  const k0 = along(n0, n1, 0.3);
  const k1 = along(n0, n1, 0.7);
  quad(ctx, k0, k1, { x: k1.x, y: k1.y + 5 }, { x: k0.x, y: k0.y + 5 }, '#2c3338');
}

function drawChair(ctx, item) {
  groundShadow(ctx, 1, 1);
  const c = footprintCorners(1, 1);
  ctx.strokeStyle = WOOD_D;
  ctx.lineWidth = 2;
  for (const p of [c.B, c.R, c.F, c.L]) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 12);
    ctx.stroke();
  }
  const top = prism(ctx, 1, 1, 12, 5, '#2a7a70', '#1e5c55', '#174842');
  const back = {
    0: [top.F2, top.L2],
    1: [top.L2, top.B2],
    2: [top.B2, top.R2],
    3: [top.R2, top.F2],
  }[((item.rot || 0) % 4 + 4) % 4];
  const a = back[0];
  const b = back[1];
  const a2 = { x: a.x, y: a.y - 18 };
  const b2 = { x: b.x, y: b.y - 18 };
  quad(ctx, a2, b2, b, a, WOOD);
  quad(ctx,
    along(a2, b2, 0.16),
    along(a2, b2, 0.84),
    along(a, b, 0.84),
    along(a, b, 0.16),
    '#1e5c55');
}

function drawSofa(ctx, item) {
  const fp = footprintSize(item);
  groundShadow(ctx, fp.w, fp.d);
  const top = prism(ctx, fp.w, fp.d, 0, 16, '#2f7c72', '#1e5c55', '#143e3b');
  const back = {
    0: [top.F2, top.L2],
    1: [top.L2, top.B2],
    2: [top.B2, top.R2],
    3: [top.R2, top.F2],
  }[((item.rot || 0) % 4 + 4) % 4];
  const a2 = { x: back[0].x, y: back[0].y - 22 };
  const b2 = { x: back[1].x, y: back[1].y - 22 };
  quad(ctx, a2, b2, back[1], back[0], '#174842');
  const arms = {
    0: [[top.L2, top.B2], [top.R2, top.F2]],
    1: [[top.B2, top.R2], [top.F2, top.L2]],
    2: [[top.R2, top.F2], [top.L2, top.B2]],
    3: [[top.F2, top.L2], [top.B2, top.R2]],
  }[((item.rot || 0) % 4 + 4) % 4];
  for (const [p, q] of arms) {
    quad(ctx, { x: p.x, y: p.y - 10 }, { x: q.x, y: q.y - 10 }, q, p, '#143e3b');
  }
  const cushion = along(top.B2, top.F2, 0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(cushion.x - 7, cushion.y - 4, 14, 6);
}

function drawTable(ctx, item) {
  const fp = footprintSize(item);
  groundShadow(ctx, fp.w, fp.d);
  const c = footprintCorners(fp.w, fp.d);
  ctx.strokeStyle = WOOD_D;
  ctx.lineWidth = 3;
  for (const p of [c.B, c.R, c.F, c.L]) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 22);
    ctx.stroke();
  }
  const top = prism(ctx, fp.w, fp.d, 22, 6, WOOD_L, WOOD, WOOD_D);
  const mid = {
    x: (top.B2.x + top.F2.x) / 2,
    y: (top.B2.y + top.F2.y) / 2,
  };
  ctx.fillStyle = '#f7f4ee';
  ctx.fillRect(mid.x - 10, mid.y - 8, 12, 8);
  ctx.fillStyle = '#d25a32';
  ctx.fillRect(mid.x + 4, mid.y - 6, 8, 6);
}

function drawPlant(ctx, time) {
  groundShadow(ctx, 1, 1);
  const c = footprintCorners(1, 1);
  const cx = (c.B.x + c.R.x + c.F.x + c.L.x) / 4;
  const cy = (c.B.y + c.R.y + c.F.y + c.L.y) / 4;
  ctx.fillStyle = '#8d3b22';
  ctx.fillRect(cx - 7, cy - 14, 14, 12);
  ctx.fillStyle = '#e07a48';
  ctx.fillRect(cx - 8, cy - 18, 16, 5);
  const sway = Math.sin(time * 1.3) * 1.5;
  const leaves = [
    [-16, -34, 14, 16, '#245833'],
    [2, -36, 14, 16, '#2f6b3a'],
    [-8, -48, 16, 16, '#3e8a48'],
    [-2, -58, 10, 14, '#4e9a56'],
    [8, -44, 10, 12, '#214e30'],
    [-4, -28, 12, 10, '#2a6840'],
  ];
  for (const [x, y, w, h, color] of leaves) {
    ctx.fillStyle = color;
    ctx.fillRect(cx + x + sway, cy + y, w, h);
  }
}

function drawLamp(ctx) {
  groundShadow(ctx, 1, 1);
  prism(ctx, 1, 1, 0, 6, WOOD_L, WOOD, WOOD_D);
  const c = footprintCorners(1, 1);
  const cx = (c.B.x + c.R.x + c.F.x + c.L.x) / 4;
  const cy = (c.B.y + c.R.y + c.F.y + c.L.y) / 4;
  ctx.strokeStyle = '#8d6a34';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx, cy - 62);
  ctx.stroke();
  quad(ctx,
    { x: cx - 16, y: cy - 74 },
    { x: cx + 16, y: cy - 74 },
    { x: cx + 10, y: cy - 54 },
    { x: cx - 10, y: cy - 54 },
    '#f6f1e6');
  ctx.fillStyle = 'rgba(226, 162, 59, 0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 28, 11, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoffee(ctx, time) {
  groundShadow(ctx, 1, 1);
  const c = footprintCorners(1, 1);
  const cx = (c.B.x + c.R.x + c.F.x + c.L.x) / 4;
  const cy = (c.B.y + c.R.y + c.F.y + c.L.y) / 4;
  ctx.fillStyle = '#2a2522';
  ctx.fillRect(cx - 14, cy - 28, 28, 26);
  ctx.fillStyle = '#4a433d';
  ctx.fillRect(cx - 14, cy - 32, 28, 6);
  ctx.fillStyle = '#1b1a19';
  ctx.fillRect(cx - 8, cy - 24, 12, 16);
  ctx.fillStyle = '#7fafa4';
  ctx.fillRect(cx - 6, cy - 20, 8, 10);
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(cx + 6, cy - 8, 8, 6);
  ctx.fillStyle = '#c4542c';
  ctx.fillRect(cx + 8, cy - 12, 4, 3);
  ctx.fillStyle = Math.floor(time * 2) % 2 === 0 ? '#d25a32' : '#3d7a4a';
  ctx.fillRect(cx - 12, cy - 26, 3, 3);
  const phase = time * 3;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 3; i += 1) {
    const y = cy - 40 - ((phase * 8 + i * 7) % 16);
    ctx.fillRect(cx + 8 + Math.sin(phase + i) * 2, y, 2, 5);
  }
}

function drawBoard(ctx, item) {
  const fp = footprintSize(item);
  groundShadow(ctx, fp.w, fp.d);
  const c = footprintCorners(fp.w, fp.d);
  const cx = (c.B.x + c.R.x + c.F.x + c.L.x) / 4;
  const cy = (c.B.y + c.R.y + c.F.y + c.L.y) / 4;
  const rot = ((item.rot || 0) % 4 + 4) % 4;
  const wide = rot % 2 === 0 ? 54 : 36;
  ctx.fillStyle = '#8e979d';
  ctx.fillRect(cx - wide / 2 + 6, cy - 10, 4, 14);
  ctx.fillRect(cx + wide / 2 - 10, cy - 10, 4, 14);
  ctx.fillStyle = '#d5dbe0';
  ctx.beginPath();
  ctx.moveTo(cx - wide / 2, cy - 62);
  ctx.lineTo(cx + wide / 2 + 8, cy - 70);
  ctx.lineTo(cx + wide / 2 + 8, cy - 18);
  ctx.lineTo(cx - wide / 2, cy - 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fbfaf7';
  ctx.beginPath();
  ctx.moveTo(cx - wide / 2 + 4, cy - 56);
  ctx.lineTo(cx + wide / 2 + 2, cy - 62);
  ctx.lineTo(cx + wide / 2 + 2, cy - 24);
  ctx.lineTo(cx - wide / 2 + 4, cy - 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d25a32';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - wide / 4, cy - 48);
  ctx.lineTo(cx + 4, cy - 50);
  ctx.stroke();
  ctx.strokeStyle = '#1e5c55';
  ctx.beginPath();
  ctx.moveTo(cx - wide / 4, cy - 40);
  ctx.lineTo(cx + wide / 5, cy - 42);
  ctx.stroke();
  ctx.strokeStyle = '#e2a23b';
  ctx.beginPath();
  ctx.moveTo(cx - wide / 5, cy - 32);
  ctx.lineTo(cx + 2, cy - 33);
  ctx.stroke();
}

function drawItemRaw(ctx, item, time, opts) {
  if (hasPiece(item.type)) {
    drawPiece(ctx, item.type, item.rot || 0, Math.floor(time * 2) % 2);
    return;
  }
  if (item.type === 'tapete') drawRug(ctx, item);
  else if (item.type === 'escrivaninha') drawDesk(ctx, item);
  else if (item.type === 'computador') drawComputer(ctx, item, time, opts.lift || 0);
  else if (item.type === 'cadeira') drawChair(ctx, item);
  else if (item.type === 'sofa') drawSofa(ctx, item);
  else if (item.type === 'mesa') drawTable(ctx, item);
  else if (item.type === 'planta') drawPlant(ctx, time);
  else if (item.type === 'luminaria') drawLamp(ctx);
  else if (item.type === 'cafe') drawCoffee(ctx, time);
  else if (item.type === 'quadro') drawBoard(ctx, item);
}

export function drawItem(ctx, item, time = 0, opts = {}) {
  const origin = tileToWorld(item.x || 0, item.y || 0);
  const frame = Math.floor(Number(time) * 2) % 2;
  const key = `${item.type}|${(item.rot || 0) % 4}|${frame}|${opts.lift || 0}`;
  let sprite = spriteCache.get(key);
  if (!sprite && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 260;
    canvas.height = 220;
    const g = canvas.getContext('2d');
    g.translate(130, 160);
    drawItemRaw(g, { ...item, x: 0, y: 0 }, frame ? 1.2 : 0.15, opts);
    sprite = { canvas, ox: -130, oy: -160 };
    spriteCache.set(key, sprite);
    if (spriteCache.size > 72) spriteCache.delete(spriteCache.keys().next().value);
  }
  if (sprite) {
    ctx.drawImage(sprite.canvas, origin.x + sprite.ox, origin.y + sprite.oy);
    return;
  }
  ctx.save();
  ctx.translate(origin.x, origin.y);
  drawItemRaw(ctx, { ...item, x: 0, y: 0 }, time, opts);
  ctx.restore();
}

export function strokeFootprint(ctx, item, color) {
  const origin = tileToWorld(item.x, item.y);
  const fp = footprintSize(item);
  const c = footprintCorners(fp.w, fp.d);
  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.beginPath();
  ctx.moveTo(c.B.x, c.B.y);
  ctx.lineTo(c.R.x, c.R.y);
  ctx.lineTo(c.F.x, c.F.y);
  ctx.lineTo(c.L.x, c.L.y);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function fillTile(ctx, x, y, color) {
  const p = tileToWorld(x, y);
  diamond(ctx, p.x, p.y, TILE_W / 2 - 1, TILE_H / 2 - 1, color);
}

const MIRROR = new Set([0, 6, 7]);
const KIND = {
  0: 'front3',
  1: 'front',
  2: 'front3',
  3: 'side',
  4: 'back3',
  5: 'back',
  6: 'back3',
  7: 'side',
};

const SIT_NUDGE = {
  0: [8, 3],
  1: [0, 8],
  2: [-8, 3],
  3: [-10, 0],
  4: [-6, -3],
  5: [0, -4],
  6: [6, -3],
  7: [10, 0],
};

function hair(ctx, look, bottom) {
  const style = look.hairStyle || 'short';
  const color = look.hair;
  const dark = shade(color, -0.28);
  const lite = shade(color, 0.25);
  if (style === 'bun') {
    px(ctx, -7, bottom, 14, 7, color);
    px(ctx, -4, bottom + 6, 8, 7, color);
    px(ctx, -2, bottom + 11, 3, 3, lite);
  } else if (style === 'curly') {
    px(ctx, -11, bottom - 1, 22, 9, color);
    px(ctx, -12, bottom + 3, 4, 5, dark);
    px(ctx, 8, bottom + 2, 4, 6, color);
    px(ctx, -8, bottom + 7, 16, 4, color);
    px(ctx, -5, bottom + 10, 4, 3, lite);
  } else if (style === 'quiff') {
    px(ctx, -8, bottom, 16, 6, color);
    px(ctx, -2, bottom + 5, 8, 8, color);
    px(ctx, 0, bottom + 12, 4, 3, lite);
  } else if (style === 'side') {
    px(ctx, -8, bottom, 16, 6, color);
    px(ctx, -11, bottom + 1, 6, 4, color);
    px(ctx, 2, bottom + 5, 7, 3, dark);
    px(ctx, -6, bottom + 5, 3, 2, lite);
  } else if (style === 'neat') {
    px(ctx, -8, bottom, 16, 7, color);
    px(ctx, -1, bottom + 1, 1, 6, dark);
    px(ctx, -7, bottom + 6, 4, 2, lite);
  } else {
    px(ctx, -8, bottom, 16, 6, color);
    px(ctx, -6, bottom + 5, 4, 2, lite);
  }
}

function faceExtras(ctx, look, hy, mode) {
  if (look.blush) {
    px(ctx, -7, hy + 4, 2, 1, 'rgba(210, 120, 120, 0.7)');
    if (mode !== 'side') px(ctx, 5, hy + 4, 2, 1, 'rgba(210, 120, 120, 0.7)');
  }
  if (look.freckles) {
    px(ctx, -6, hy + 4, 1, 1, shade(look.skin, -0.25));
    px(ctx, -4, hy + 3, 1, 1, shade(look.skin, -0.25));
    if (mode !== 'side') {
      px(ctx, 4, hy + 4, 1, 1, shade(look.skin, -0.25));
      px(ctx, 6, hy + 3, 1, 1, shade(look.skin, -0.25));
    }
  }
  if (look.beard) {
    px(ctx, -4, hy + 1, 8, 3, look.hair);
    px(ctx, -3, hy - 1, 6, 2, shade(look.hair, 0.08));
  }
  if (look.earring) px(ctx, -11, hy + 4, 2, 2, '#e2b657');
  if (look.glasses && mode !== 'back') {
    const y = hy + 6;
    const ink = INK;
    if (mode === 'side') {
      px(ctx, -8, y, 5, 4, ink);
      px(ctx, -7, y + 1, 3, 2, 'rgba(190, 225, 224, 0.8)');
    } else if (look.glasses === 'rect') {
      px(ctx, -6, y, 5, 4, ink);
      px(ctx, -5, y + 1, 3, 2, 'rgba(190, 225, 224, 0.75)');
      px(ctx, 1, y, 5, 4, ink);
      px(ctx, 2, y + 1, 3, 2, 'rgba(190, 225, 224, 0.75)');
      px(ctx, -1, y + 1, 2, 1, ink);
    } else {
      px(ctx, -6, y, 5, 5, ink);
      px(ctx, -5, y + 1, 3, 3, 'rgba(190, 225, 224, 0.8)');
      px(ctx, 1, y, 5, 5, ink);
      px(ctx, 2, y + 1, 3, 3, 'rgba(190, 225, 224, 0.8)');
      px(ctx, -1, y + 2, 2, 1, ink);
    }
  }
}

function limbs(ctx, look, frame, action, torsoBottom) {
  const shirt = look.shirt;
  const shirtD = shade(shirt, -0.22);
  const skin = look.skin;
  const skinD = shade(skin, -0.16);
  const swing = action === 'walk' ? [-2, 0, 2, 0][frame % 4] : 0;
  if (action === 'wave') {
    const up = frame % 2 === 0 ? 14 : 11;
    px(ctx, -12, torsoBottom + swing, 4, 8, shirt);
    px(ctx, -12, torsoBottom + 6, 4, 3, skinD);
    px(ctx, 8, torsoBottom + up, 4, 8, shirtD);
    px(ctx, 8, torsoBottom + up + 7, 4, 3, skin);
    return;
  }
  if (action === 'dance') {
    const lift = [10, 14, 10, 6][frame % 4];
    px(ctx, -12, torsoBottom + lift, 4, 8, shirt);
    px(ctx, -12, torsoBottom + lift + 7, 4, 3, skin);
    px(ctx, 8, torsoBottom + (16 - lift), 4, 8, shirtD);
    px(ctx, 8, torsoBottom + (23 - lift), 4, 3, skin);
    return;
  }
  px(ctx, -12, torsoBottom + swing, 4, 8, shirt);
  px(ctx, -12, torsoBottom + 6 + swing, 4, 3, skinD);
  px(ctx, 8, torsoBottom - swing, 4, 8, shirtD);
  px(ctx, 8, torsoBottom + 6 - swing, 4, 3, skin);
}

function drawFront(ctx, person) {
  const { look, frame, action } = person;
  const pants = look.pants;
  const pantsD = shade(pants, -0.22);
  const shoe = shade(pants, -0.48);
  const shirt = look.shirt;
  const shirtD = shade(shirt, -0.2);
  const skin = look.skin;
  const skinD = shade(skin, -0.16);
  const bob = action === 'dance' ? [0, 1, 0, 2][frame % 4] : 0;
  if (action === 'sit') {
    px(ctx, -8, 0, 7, 4, pants);
    px(ctx, 1, 0, 7, 4, pantsD);
    px(ctx, -10, -1, 5, 3, shoe);
    px(ctx, 5, -1, 5, 3, shoe);
  } else {
    const step = action === 'walk' ? [0, 2, 0, -2][frame % 4] : 0;
    px(ctx, -7, Math.max(0, step), 5, 3, shoe);
    px(ctx, -7, 3 + Math.max(0, step), 5, 8, pants);
    px(ctx, 2, Math.max(0, -step), 5, 3, shoe);
    px(ctx, 2, 3 + Math.max(0, -step), 5, 8, pantsD);
  }
  const torso = (action === 'sit' ? 5 : 11) + bob;
  px(ctx, -8, torso, 16, 10, shirt);
  px(ctx, -8, torso, 3, 10, shirtD);
  px(ctx, -8, torso, 16, 2, shade(shirt, -0.12));
  if (look.detail === 'tie') {
    px(ctx, -1, torso + 7, 2, 2, '#f4efe6');
    px(ctx, -1, torso + 1, 2, 6, '#8c2f2f');
  }
  limbs(ctx, look, frame, action, torso);
  const hy = torso + 10;
  px(ctx, -8, hy, 16, 12, skin);
  px(ctx, -10, hy + 4, 2, 4, skinD);
  px(ctx, 8, hy + 4, 2, 4, skinD);
  px(ctx, -5, hy + 5, 4, 4, '#fffef8');
  px(ctx, 1, hy + 5, 4, 4, '#fffef8');
  px(ctx, -4, hy + 6, 2, 2, INK);
  px(ctx, 2, hy + 6, 2, 2, INK);
  px(ctx, -4, hy + 7, 1, 1, '#fff');
  px(ctx, 2, hy + 7, 1, 1, '#fff');
  px(ctx, -2, hy + 2, 4, 1, shade(skin, -0.35));
  hair(ctx, look, hy + 8);
  faceExtras(ctx, look, hy, 'front');
}

function drawFront3(ctx, person) {
  const { look, frame, action } = person;
  const pants = look.pants;
  const shoe = shade(pants, -0.48);
  const shirt = look.shirt;
  const skin = look.skin;
  const bob = action === 'dance' ? [0, 1, 0, 2][frame % 4] : 0;
  if (action === 'sit') {
    px(ctx, -6, 0, 10, 4, pants);
    px(ctx, -8, -1, 4, 3, shoe);
  } else {
    const step = action === 'walk' ? [0, 2, 0, -2][frame % 4] : 0;
    px(ctx, -6, Math.max(0, -step), 4, 3, shoe);
    px(ctx, -6, 3 + Math.max(0, -step), 4, 8, shade(pants, -0.15));
    px(ctx, -1, Math.max(0, step), 5, 3, shoe);
    px(ctx, -1, 3 + Math.max(0, step), 5, 8, pants);
  }
  const torso = (action === 'sit' ? 5 : 11) + bob;
  px(ctx, -7, torso, 13, 10, shirt);
  px(ctx, -7, torso, 3, 10, shade(shirt, -0.22));
  limbs(ctx, look, frame, action, torso);
  const hy = torso + 10;
  px(ctx, -7, hy, 13, 12, skin);
  px(ctx, -9, hy + 4, 2, 3, shade(skin, -0.16));
  px(ctx, -4, hy + 5, 4, 4, '#fffef8');
  px(ctx, -3, hy + 6, 2, 2, INK);
  px(ctx, 2, hy + 6, 2, 2, INK);
  px(ctx, -6, hy + 4, 2, 2, shade(skin, -0.2));
  px(ctx, -2, hy + 2, 3, 1, shade(skin, -0.35));
  hair(ctx, look, hy + 8);
  faceExtras(ctx, look, hy, 'front');
}

function drawSide(ctx, person) {
  const { look, frame, action } = person;
  const pants = look.pants;
  const shoe = shade(pants, -0.48);
  const shirt = look.shirt;
  const skin = look.skin;
  const step = action === 'walk' ? [0, 3, 0, -2][frame % 4] : 0;
  if (action === 'sit') {
    px(ctx, -8, 0, 8, 4, pants);
    px(ctx, -10, -1, 4, 3, shoe);
  } else {
    px(ctx, -2, 1, 5, 9, shade(pants, -0.2));
    px(ctx, -3, 0 + Math.max(0, step), 5, 3, shoe);
    px(ctx, -3, 3 + Math.max(0, step), 5, 8, pants);
  }
  const torso = action === 'sit' ? 5 : 11;
  px(ctx, -4, torso, 9, 10, shirt);
  px(ctx, -4, torso, 2, 10, shade(shirt, -0.2));
  if (action === 'wave') {
    const up = frame % 2 === 0 ? 14 : 11;
    px(ctx, -5, torso + up, 4, 8, shirt);
    px(ctx, -6, torso + up + 7, 4, 3, skin);
  } else if (action === 'dance') {
    const lift = [8, 13, 8, 5][frame % 4];
    px(ctx, -6, torso + lift, 4, 8, shirt);
    px(ctx, -7, torso + lift + 7, 3, 3, skin);
  } else {
    px(ctx, -6, torso - 1, 4, 8, shirt);
    px(ctx, -7, torso + 5, 3, 3, skin);
  }
  const hy = torso + 10;
  px(ctx, -5, hy, 10, 12, skin);
  px(ctx, -7, hy + 3, 3, 2, shade(skin, -0.12));
  px(ctx, 4, hy + 5, 2, 3, shade(skin, -0.16));
  px(ctx, -4, hy + 6, 3, 3, '#fffef8');
  px(ctx, -4, hy + 7, 2, 2, INK);
  px(ctx, -2, hy + 3, 2, 1, shade(skin, -0.35));
  hair(ctx, { ...look, hairStyle: look.hairStyle === 'bun' ? 'bun' : 'short' }, hy + 8);
  if (look.hairStyle === 'curly') px(ctx, 3, hy + 8, 5, 6, look.hair);
  if (look.hairStyle === 'quiff') px(ctx, -6, hy + 16, 5, 5, look.hair);
  faceExtras(ctx, look, hy, 'side');
}

function drawBack(ctx, person) {
  const { look, frame, action } = person;
  const pants = look.pants;
  const shoe = shade(pants, -0.48);
  const shirt = look.shirt;
  const step = action === 'walk' ? [0, 2, 0, -2][frame % 4] : 0;
  if (action !== 'sit') {
    px(ctx, -7, Math.max(0, step), 5, 3, shoe);
    px(ctx, -7, 3 + Math.max(0, step), 5, 8, pants);
    px(ctx, 2, Math.max(0, -step), 5, 3, shoe);
    px(ctx, 2, 3 + Math.max(0, -step), 5, 8, shade(pants, -0.18));
  }
  const torso = action === 'sit' ? 6 : 11;
  px(ctx, -8, torso, 16, 10, shirt);
  px(ctx, 5, torso, 3, 10, shade(shirt, -0.18));
  px(ctx, -1, torso + 8, 2, 4, shade(shirt, -0.28));
  limbs(ctx, look, frame, action === 'wave' ? 'idle' : action, torso);
  const hy = torso + 10;
  px(ctx, -8, hy, 16, 12, shade(look.skin, -0.08));
  hair(ctx, look, hy + 4);
  px(ctx, -8, hy + 4, 16, 8, look.hair);
}

function drawBack3(ctx, person) {
  const { look, frame, action } = person;
  const pants = look.pants;
  const shoe = shade(pants, -0.48);
  const shirt = look.shirt;
  const step = action === 'walk' ? [0, 2, 0, -2][frame % 4] : 0;
  if (action !== 'sit') {
    px(ctx, -5, Math.max(0, -step), 4, 3, shoe);
    px(ctx, -5, 3 + Math.max(0, -step), 4, 8, shade(pants, -0.12));
    px(ctx, 0, Math.max(0, step), 5, 3, shoe);
    px(ctx, 0, 3 + Math.max(0, step), 5, 8, pants);
  }
  const torso = action === 'sit' ? 6 : 11;
  px(ctx, -6, torso, 13, 10, shirt);
  px(ctx, 4, torso, 3, 10, shade(shirt, -0.2));
  limbs(ctx, look, frame, action === 'wave' ? 'idle' : action, torso);
  const hy = torso + 10;
  px(ctx, -6, hy, 12, 12, shade(look.skin, -0.06));
  px(ctx, -8, hy + 4, 2, 3, shade(look.skin, -0.16));
  hair(ctx, look, hy + 5);
  px(ctx, -6, hy + 6, 12, 6, look.hair);
}

function drawRobot(ctx, person) {
  const { look, frame, action } = person;
  const metal = look.shirt;
  const dark = look.pants;
  const screen = look.hair;
  const step = action === 'walk' ? [0, 2, 0, -2][frame % 4] : 0;
  const bob = action === 'dance' ? [0, 2, 0, 3][frame % 4] : 0;
  if (action !== 'sit') {
    px(ctx, -7, Math.max(0, step), 5, 3, shade(dark, -0.2));
    px(ctx, -7, 3 + Math.max(0, step), 5, 6, dark);
    px(ctx, 2, Math.max(0, -step), 5, 3, shade(dark, -0.2));
    px(ctx, 2, 3 + Math.max(0, -step), 5, 6, dark);
  } else {
    px(ctx, -8, 0, 16, 4, dark);
  }
  const torso = (action === 'sit' ? 5 : 9) + bob;
  px(ctx, -8, torso, 16, 11, metal);
  px(ctx, -8, torso, 3, 11, shade(metal, -0.2));
  px(ctx, -2, torso + 3, 4, 4, shade(metal, 0.2));
  if (action === 'wave') {
    const up = frame % 2 === 0 ? 14 : 11;
    px(ctx, -12, torso, 4, 8, metal);
    px(ctx, 8, torso + up, 4, 8, shade(metal, -0.15));
  } else if (action === 'dance') {
    const lift = [8, 14, 8, 4][frame % 4];
    px(ctx, -12, torso + lift, 4, 7, metal);
    px(ctx, 8, torso + (12 - lift), 4, 7, shade(metal, -0.15));
  } else {
    px(ctx, -12, torso + (action === 'walk' ? step : 0), 4, 8, metal);
    px(ctx, 8, torso - (action === 'walk' ? step : 0), 4, 8, shade(metal, -0.15));
  }
  const hy = torso + 11;
  px(ctx, -7, hy, 14, 10, shade(metal, 0.08));
  px(ctx, -5, hy + 2, 10, 6, screen);
  const blink = frame % 4 === 3 && action === 'idle';
  if (!blink) {
    px(ctx, -3, hy + 4, 2, 2, '#d7fff4');
    px(ctx, 2, hy + 4, 2, 2, '#d7fff4');
  } else {
    px(ctx, -3, hy + 4, 7, 1, '#d7fff4');
  }
  const tip = Math.sin(frame + (action === 'dance' ? 1 : 0)) * 1;
  px(ctx, -1, hy + 10, 2, 5, shade(metal, -0.3));
  px(ctx, -2 + tip, hy + 15, 4, 3, '#e2a23b');
}

export function drawAvatar(ctx, person) {
  const feet = tileToWorld(person.x, person.y);
  const bob = person.bob || 0;
  let ox = 0;
  let oy = -bob;
  if (person.action === 'sit') {
    const nudge = SIT_NUDGE[person.dir] || [0, 6];
    ox += nudge[0];
    oy += nudge[1] - 16;
  }
  ctx.save();
  ctx.translate(feet.x + ox, feet.y + oy);
  ctx.fillStyle = 'rgba(28, 20, 12, 0.22)';
  ctx.beginPath();
  ctx.ellipse(-ox * 0.2, bob + 2, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const mirror = MIRROR.has(person.dir);
  if (mirror) ctx.scale(-1, 1);
  if (person.look.robot) drawRobot(ctx, person);
  else {
    const kind = KIND[person.dir] || 'front';
    if (kind === 'front') drawFront(ctx, person);
    else if (kind === 'front3') drawFront3(ctx, person);
    else if (kind === 'side') drawSide(ctx, person);
    else if (kind === 'back') drawBack(ctx, person);
    else drawBack3(ctx, person);
  }
  ctx.restore();
}

export function avatarHeadWorld(person) {
  const feet = tileToWorld(person.x, person.y);
  const bob = person.bob || 0;
  const lift = person.action === 'sit' ? 18 : 0;
  return { x: feet.x, y: feet.y - 74 - bob - lift };
}

export function avatarFeetWorld(person) {
  const feet = tileToWorld(person.x, person.y);
  return { x: feet.x, y: feet.y - (person.bob || 0) };
}

export function paintPreview(canvas, type) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height * 0.72);
  ctx.scale(0.72, 0.72);
  drawItem(ctx, { type, x: 0, y: 0, rot: 0, id: 'preview' }, 1.2);
  ctx.restore();
}

export function paintAvatarPreview(canvas, look, action = 'idle') {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height * 0.78);
  drawAvatar(ctx, {
    x: 0,
    y: 0,
    dir: 1,
    frame: action === 'wave' ? 0 : 0,
    action,
    look,
    bob: 0,
  });
  ctx.restore();
}
