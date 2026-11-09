export const TILE_W = 64;
export const TILE_H = 32;
export const WALL_H = 112;

export function tileToWorld(x, y) {
  return {
    x: (x - y) * (TILE_W / 2),
    y: (x + y) * (TILE_H / 2),
  };
}

export function worldToTile(wx, wy) {
  const fx = (wx / (TILE_W / 2) + wy / (TILE_H / 2)) / 2;
  const fy = (wy / (TILE_H / 2) - wx / (TILE_W / 2)) / 2;
  return {
    x: Math.floor(fx + 0.5),
    y: Math.floor(fy + 0.5),
    fx,
    fy,
  };
}

export function footprintOf(w, d, rot) {
  const r = ((rot % 4) + 4) % 4;
  return r % 2 === 1 ? { w: d, d: w } : { w, d };
}

export function footprintCorners(w, d) {
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  const rel = (dx, dy) => ({ x: (dx - dy) * hw, y: (dx + dy) * hh });
  return {
    B: { x: 0, y: -hh },
    R: { x: rel(w - 1, 0).x + hw, y: rel(w - 1, 0).y },
    F: { x: rel(w - 1, d - 1).x, y: rel(w - 1, d - 1).y + hh },
    L: { x: rel(0, d - 1).x - hw, y: rel(0, d - 1).y },
  };
}

export function dirFromStep(dx, dy) {
  const key = `${Math.sign(dx)},${Math.sign(dy)}`;
  switch (key) {
    case '1,0': return 0;
    case '1,1': return 1;
    case '0,1': return 2;
    case '-1,1': return 3;
    case '-1,0': return 4;
    case '-1,-1': return 5;
    case '0,-1': return 6;
    case '1,-1': return 7;
    default: return 1;
  }
}

export function facingForRot(rot) {
  return [6, 0, 2, 4][((rot % 4) + 4) % 4];
}

export function roomPixelBounds(room) {
  const corners = [
    tileToWorld(0, 0),
    tileToWorld(room.w - 1, 0),
    tileToWorld(0, room.h - 1),
    tileToWorld(room.w - 1, room.h - 1),
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x - TILE_W / 2);
    maxX = Math.max(maxX, c.x + TILE_W / 2);
    minY = Math.min(minY, c.y - TILE_H / 2 - WALL_H);
    maxY = Math.max(maxY, c.y + TILE_H / 2);
  }
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
