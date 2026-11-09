import { CATALOG, ROOMS, AGENTS } from './content.js';
import { footprintOf } from './iso.js';

export function tilesOf(item) {
  const def = CATALOG[item.type];
  if (!def) return [];
  const fp = footprintOf(def.w, def.d, item.rot || 0);
  const tiles = [];
  for (let ix = 0; ix < fp.w; ix += 1) {
    for (let iy = 0; iy < fp.d; iy += 1) {
      tiles.push({ x: item.x + ix, y: item.y + iy });
    }
  }
  return tiles;
}

export function footprintSize(item) {
  const def = CATALOG[item.type];
  return footprintOf(def.w, def.d, item.rot || 0);
}

function overlaps(a, b) {
  const ta = tilesOf(a);
  const tb = new Set(tilesOf(b).map((t) => `${t.x},${t.y}`));
  return ta.some((t) => tb.has(`${t.x},${t.y}`));
}

export function buildOccupancy(items, ignoreId = null) {
  const block = new Set();
  const seats = new Map();
  const base = new Map();
  const surfaces = new Map();
  const rugs = new Set();
  for (const item of items) {
    if (item.id === ignoreId) continue;
    const def = CATALOG[item.type];
    if (!def) continue;
    for (const tile of tilesOf(item)) {
      const k = `${tile.x},${tile.y}`;
      if (def.rug) {
        rugs.add(k);
        continue;
      }
      if (def.surface) {
        surfaces.set(k, item);
        continue;
      }
      base.set(k, item);
      if (def.blocks) block.add(k);
      if (def.sit) seats.set(k, { item, x: tile.x, y: tile.y });
    }
  }
  for (const [k, item] of surfaces) {
    if (!base.has(k) && CATALOG[item.type].blocks) block.add(k);
  }
  return { block, seats, base, surfaces, rugs };
}

export function canPlace(room, items, item, ignoreId = null) {
  const def = CATALOG[item.type];
  if (!def) return false;
  const tiles = tilesOf(item);
  if (!tiles.length) return false;
  for (const tile of tiles) {
    if (tile.x < 0 || tile.y < 0 || tile.x >= room.w || tile.y >= room.h) return false;
    if (room.doors.some((door) => door.x === tile.x && door.y === tile.y)) return false;
  }
  const occ = buildOccupancy(items, ignoreId);
  if (def.rug) {
    return tiles.every((tile) => !occ.rugs.has(`${tile.x},${tile.y}`));
  }
  if (def.surface) {
    return tiles.every((tile) => !occ.surfaces.has(`${tile.x},${tile.y}`));
  }
  return tiles.every((tile) => !occ.base.has(`${tile.x},${tile.y}`));
}

export function validateAll() {
  const errors = [];
  const ids = new Set();
  for (const room of Object.values(ROOMS)) {
    for (const item of room.furniture) {
      if (ids.has(item.id)) errors.push(`id repetido ${item.id}`);
      ids.add(item.id);
      if (!CATALOG[item.type]) errors.push(`tipo ${item.type}`);
      for (const tile of tilesOf(item)) {
        if (tile.x < 0 || tile.y < 0 || tile.x >= room.w || tile.y >= room.h) {
          errors.push(`${item.id} fora da sala ${room.id}`);
        }
      }
      for (const door of room.doors) {
        if (tilesOf(item).some((tile) => tile.x === door.x && tile.y === door.y)) {
          errors.push(`${item.id} em cima da porta`);
        }
        if (door.x !== 0 && door.y !== 0) errors.push(`porta fora da parede em ${room.id}`);
        if (door.x < 0 || door.y < 0 || door.x >= room.w || door.y >= room.h) {
          errors.push(`porta fora de ${room.id}`);
        }
        const dest = ROOMS[door.to];
        if (!dest) errors.push(`porta para sala inexistente ${door.to}`);
        else if (door.toX < 0 || door.toY < 0 || door.toX >= dest.w || door.toY >= dest.h) {
          errors.push(`chegada inválida ${door.to}`);
        }
      }
    }
    for (let i = 0; i < room.furniture.length; i += 1) {
      for (let j = i + 1; j < room.furniture.length; j += 1) {
        const a = room.furniture[i];
        const b = room.furniture[j];
        if (!overlaps(a, b)) continue;
        const da = CATALOG[a.type];
        const db = CATALOG[b.type];
        const ok = (da.rug && !db.rug) || (db.rug && !da.rug)
          || (da.surface && !db.surface && !db.rug)
          || (db.surface && !da.surface && !da.rug);
        if (!ok) errors.push(`sobrepõe ${a.id} e ${b.id}`);
      }
    }
    const spawnBlocked = buildOccupancy(room.furniture).block.has(`${room.spawn.x},${room.spawn.y}`);
    if (spawnBlocked) errors.push(`spawn bloqueado em ${room.id}`);
    for (const door of room.doors) {
      const dest = ROOMS[door.to];
      if (!dest) continue;
      const arrivalBlocked = buildOccupancy(dest.furniture).block.has(`${door.toX},${door.toY}`);
      if (arrivalBlocked) errors.push(`chegada bloqueada ${room.id} → ${door.to}`);
      const onDoor = dest.doors.some((d) => d.x === door.toX && d.y === door.toY);
      if (onDoor) errors.push(`chegada em outra porta ${door.to}`);
    }
  }
  for (const agent of AGENTS) {
    const room = ROOMS[agent.home.room];
    if (!room) {
      errors.push(`casa de ${agent.id} sem sala`);
      continue;
    }
    const chair = room.furniture.find((it) => it.type === 'cadeira'
      && tilesOf(it).some((tile) => tile.x === agent.home.x && tile.y === agent.home.y));
    if (!chair) errors.push(`${agent.id} sem cadeira`);
  }
  if (errors.length) {
    const error = new Error(errors.join('; '));
    error.details = errors;
    throw error;
  }
  return true;
}
