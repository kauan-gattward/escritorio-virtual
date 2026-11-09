const DIRS = [
  { dx: 1, dy: 0, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 1, cost: Math.SQRT2 },
  { dx: 1, dy: -1, cost: Math.SQRT2 },
  { dx: -1, dy: 1, cost: Math.SQRT2 },
  { dx: -1, dy: -1, cost: Math.SQRT2 },
];

function key(x, y) {
  return `${x},${y}`;
}

function heuristic(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  const d = 1;
  const d2 = Math.SQRT2;
  return d * (dx + dy) + (d2 - 2 * d) * Math.min(dx, dy);
}

/**
 * A* em grade de 8 direções.
 * blocked(x, y) deve ser verdadeiro fora da sala ou em móvel.
 * Diagonal não corta canto: os dois vizinhos ortogonais precisam estar livres.
 * allowGoal deixa o destino ser um piso bloqueado (cadeira).
 */
export function findPath(w, h, blocked, sx, sy, gx, gy, allowGoal = false) {
  if (sx === gx && sy === gy) return [{ x: sx, y: sy }];
  if (gx < 0 || gy < 0 || gx >= w || gy >= h) return null;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  const goalBlocked = blocked(gx, gy);
  if (goalBlocked && !allowGoal) return null;

  const isBlocked = (x, y) => {
    if (allowGoal && x === gx && y === gy) return false;
    return blocked(x, y);
  };

  const startK = key(sx, sy);
  const goalK = key(gx, gy);
  const open = [startK];
  const g = new Map([[startK, 0]]);
  const f = new Map([[startK, heuristic(sx, sy, gx, gy)]]);
  const came = new Map();
  const inOpen = new Set([startK]);

  while (open.length) {
    let bestI = 0;
    let bestF = f.get(open[0]);
    for (let i = 1; i < open.length; i += 1) {
      const score = f.get(open[i]);
      if (score < bestF) {
        bestF = score;
        bestI = i;
      }
    }
    const current = open.splice(bestI, 1)[0];
    inOpen.delete(current);
    if (current === goalK) {
      const path = [];
      let cursor = current;
      while (cursor) {
        const [x, y] = cursor.split(',').map(Number);
        path.push({ x, y });
        cursor = came.get(cursor);
      }
      path.reverse();
      return path;
    }
    const [cx, cy] = current.split(',').map(Number);
    for (const dir of DIRS) {
      const nx = cx + dir.dx;
      const ny = cy + dir.dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (isBlocked(nx, ny)) continue;
      if (dir.dx !== 0 && dir.dy !== 0) {
        if (isBlocked(cx + dir.dx, cy) || isBlocked(cx, cy + dir.dy)) continue;
      }
      const nk = key(nx, ny);
      const tentative = g.get(current) + dir.cost;
      if (tentative < (g.get(nk) ?? Infinity)) {
        came.set(nk, current);
        g.set(nk, tentative);
        f.set(nk, tentative + heuristic(nx, ny, gx, gy));
        if (!inOpen.has(nk)) {
          open.push(nk);
          inOpen.add(nk);
        }
      }
    }
  }
  return null;
}
