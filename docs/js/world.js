import { AGENTS, CATALOG, ROOMS } from './content.js';
import { findPath } from './path.js';
import { buildOccupancy, tilesOf } from './layout.js';

function shift(items, ox, oy, useMap, roomId) {
  return items.map((it) => ({
    ...it,
    x: it.x + ox,
    y: it.y + oy,
    fromRoom: roomId,
    use: useMap[it.id] || null,
  }));
}

const ROOM_OF = { copa: 'copa', proj: 'projetos', arq: 'arquivo', open: 'open' };

function piece(id, type, x, y, rot, label, use) {
  const prefix = id.split('-')[0];
  return {
    id, type, x, y, rot, origin: 'default', label: label || null, use: use || null,
    fromRoom: ROOM_OF[prefix] || prefix,
  };
}

const USE = {
  'rec-mesa': 'reception',
  'rec-quadro': 'notices',
  'desk-nexo': 'agent:nexo',
  'desk-mochi': 'agent:mochi',
  'desk-jarvis': 'agent:jarvis',
  'desk-tati': 'agent:tati',
  'desk-alex': 'agent:alex',
  'desk-alexandre': 'agent:alexandre',
  'desk-unibot': 'agent:unibot',
  'reu-mesa': 'meeting',
  'reu-quadro': 'board',
  'kau-mesa': 'notes',
  'kau-quadro': 'goals',
  'kau-luz': 'pomodoro',
  'kau-pc': 'links',
  'kau-cafe': 'finances',
};

function areaFrom(roomId, ox, oy, doors) {
  const src = ROOMS[roomId];
  return {
    id: src.id,
    name: src.name,
    blurb: src.blurb,
    ox,
    oy,
    w: src.w,
    h: src.h,
    floor: src.floor,
    wall: src.wall,
    doors,
    spawn: { x: ox + src.spawn.x, y: oy + src.spawn.y },
    furniture: shift(src.furniture, ox, oy, USE, src.id),
  };
}

function rectTiles(ox, oy, w, h, into) {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) into.add(`${ox + x},${oy + y}`);
  }
}

function boxTiles(x0, y0, x1, y1, into) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) into.add(`${x},${y}`);
  }
}

function makeFloor(spec) {
  const tiles = new Set();
  const furniture = [];
  for (const area of spec.areas) {
    rectTiles(area.ox, area.oy, area.w, area.h, tiles);
    furniture.push(...area.furniture);
  }
  for (const extra of spec.extras) boxTiles(extra.x0, extra.y0, extra.x1, extra.y1, tiles);
  tiles.add(`${spec.elevator.x},${spec.elevator.y}`);
  tiles.add(`${spec.stairs.x},${spec.stairs.y}`);
  let maxX = 0;
  let maxY = 0;
  for (const key of tiles) {
    const [x, y] = key.split(',').map(Number);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    ...spec,
    tiles,
    furniture,
    w: maxX + 2,
    h: maxY + 2,
  };
}

const terreo = makeFloor({
  id: 'terreo',
  name: 'Térreo',
  level: 0,
  blurb: 'Recepção e copa',
  elevator: { x: 13, y: 11 },
  stairs: { x: 14, y: 11 },
  extras: [{ x0: 13, y0: 4, x1: 15, y1: 11 }],
  areas: [
    areaFrom('recepcao', 1, 1, []),
    {
      id: 'copa',
      name: 'Copa',
      blurb: 'Pausa, música e humor.',
      ox: 16,
      oy: 1,
      w: 10,
      h: 10,
      floor: 'warm',
      wall: { fill: '#f6efe4', shade: '#e6d8c4', trim: '#c4542c', frame: '#c4a574' },
      doors: [{ x: 0, y: 5, to: 'recepcao', toX: 12, toY: 6, label: 'Recepção' }],
      spawn: { x: 20, y: 5 },
      furniture: [
        piece('copa-sofa', 'sofa', 18, 6, 0, null, 'mood'),
        piece('copa-cafe', 'cafe', 22, 2, 0, null, 'music'),
        piece('copa-planta', 'planta', 17, 2, 0),
        piece('copa-luz', 'luminaria', 23, 7, 0),
      ],
    },
  ],
});

const andar1 = makeFloor({
  id: 'andar1',
  name: '1º andar',
  level: 1,
  blurb: 'Open Office e reunião',
  elevator: { x: 15, y: 13 },
  stairs: { x: 16, y: 13 },
  extras: [{ x0: 15, y0: 6, x1: 19, y1: 13 }],
  areas: [
    areaFrom('open', 1, 1, []),
    areaFrom('reuniao', 20, 2, [{ x: 0, y: 5, to: 'open', toX: 14, toY: 7, label: 'Open Office' }]),
  ],
});

andar1.furniture.push(piece('open-kanban', 'quadro', 5, 10, 0, 'Quadro', 'kanban'));
for (const item of andar1.furniture) {
  if (/^reu-c\d+$/.test(item.id)) item.tableSeat = true;
}

const andar2 = makeFloor({
  id: 'andar2',
  name: '2º andar',
  level: 2,
  blurb: 'Projetos e arquivo',
  elevator: { x: 15, y: 11 },
  stairs: { x: 16, y: 11 },
  extras: [{ x0: 15, y0: 4, x1: 17, y1: 11 }],
  areas: [
    {
      id: 'projetos',
      name: 'Sala de Projetos',
      blurb: 'Clientes e o próximo passo.',
      ox: 1,
      oy: 1,
      w: 14,
      h: 10,
      floor: 'carpet',
      wall: { fill: '#e7efe9', shade: '#d3e0d8', trim: '#1e5c55', frame: '#8d9a90' },
      doors: [],
      spawn: { x: 3, y: 7 },
      furniture: [
        piece('proj-mesa', 'mesa', 4, 4, 0, 'Projetos', 'projects'),
        piece('proj-c1', 'cadeira', 4, 3, 2),
        piece('proj-c2', 'cadeira', 6, 3, 2),
        piece('proj-c3', 'cadeira', 5, 6, 0),
        piece('proj-quadro', 'quadro', 10, 2, 0, null, 'projects'),
        piece('proj-planta', 'planta', 2, 2, 0),
        piece('proj-luz', 'luminaria', 12, 7, 0),
      ],
    },
    {
      id: 'arquivo',
      name: 'Arquivo',
      blurb: 'Links, notas e respostas.',
      ox: 18,
      oy: 1,
      w: 12,
      h: 10,
      floor: 'wood',
      wall: { fill: '#f3ecdf', shade: '#e2d5c3', trim: '#6e5844', frame: '#b5814a' },
      doors: [{ x: 0, y: 4, to: 'projetos', toX: 14, toY: 5, label: 'Projetos' }],
      spawn: { x: 24, y: 6 },
      furniture: [
        piece('arq-mesa', 'escrivaninha', 21, 2, 0, 'Arquivo', 'archive'),
        piece('arq-cadeira', 'cadeira', 21, 3, 0),
        piece('arq-pc', 'computador', 22, 2, 0),
        piece('arq-quadro', 'quadro', 25, 6, 2, null, 'archive'),
        piece('arq-planta', 'planta', 27, 8, 0),
        piece('arq-luz', 'luminaria', 27, 2, 0),
      ],
    },
  ],
});

const cobertura = makeFloor({
  id: 'cobertura',
  name: 'Cobertura',
  level: 3,
  blurb: 'Sala do Kauan',
  elevator: { x: 3, y: 12 },
  stairs: { x: 5, y: 12 },
  extras: [{ x0: 2, y0: 11, x1: 12, y1: 12 }],
  areas: [
    areaFrom('kauan', 2, 1, []),
  ],
});

export const FLOOR_LIST = [terreo, andar1, andar2, cobertura];
export const FLOORS = Object.fromEntries(FLOOR_LIST.map((floor) => [floor.id, floor]));

export const AREA_LIST = FLOOR_LIST.flatMap((floor) => floor.areas.map((area) => ({ ...area, floorId: floor.id })));
export const AREAS = Object.fromEntries(AREA_LIST.map((area) => [area.id, area]));

export function floorOfArea(areaId) {
  return FLOOR_LIST.find((floor) => floor.areas.some((area) => area.id === areaId)) || null;
}

export function areaAt(floor, x, y) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  return floor.areas.find((area) => ix >= area.ox && iy >= area.oy && ix < area.ox + area.w && iy < area.oy + area.h) || null;
}

export function agentHome(agent) {
  const area = AREAS[agent.home.room];
  const floor = floorOfArea(area.id);
  return {
    floorId: floor.id,
    areaId: area.id,
    x: area.ox + agent.home.x,
    y: area.oy + agent.home.y,
    dir: 6,
  };
}

export function cloneFloorLayouts() {
  const floors = {};
  for (const floor of FLOOR_LIST) {
    floors[floor.id] = floor.furniture.map((it) => ({ ...it }));
  }
  return floors;
}

export function portalAt(floor, x, y) {
  if (floor.elevator.x === x && floor.elevator.y === y) return { kind: 'elevator', x, y };
  if (floor.stairs.x === x && floor.stairs.y === y) return { kind: 'stairs', x, y };
  return null;
}

export function besidePortal(floor, portal) {
  const options = [
    { x: portal.x, y: portal.y + 1 },
    { x: portal.x + 1, y: portal.y },
    { x: portal.x - 1, y: portal.y },
    { x: portal.x, y: portal.y - 1 },
  ];
  return options.find((tile) => floor.tiles.has(`${tile.x},${tile.y}`) && !portalAt(floor, tile.x, tile.y)) || { x: portal.x, y: portal.y };
}

function blockedFactory(floor) {
  const block = buildOccupancy(floor.furniture).block;
  return (x, y) => !floor.tiles.has(`${x},${y}`) || block.has(`${x},${y}`);
}

export function validateWorld() {
  const errors = [];
  const ids = new Set();
  for (const floor of FLOOR_LIST) {
    for (const item of floor.furniture) {
      if (!CATALOG[item.type]) errors.push(`tipo ${item.type}`);
      if (ids.has(item.id)) errors.push(`id ${item.id}`);
      ids.add(item.id);
      for (const tile of tilesOf(item)) {
        if (!floor.tiles.has(`${tile.x},${tile.y}`)) errors.push(`${item.id} fora do piso ${floor.id}`);
        if (portalAt(floor, tile.x, tile.y)) errors.push(`${item.id} no elevador/escada`);
      }
    }
    for (const area of floor.areas) {
      for (const door of area.doors) {
        const wx = area.ox + door.x;
        const wy = area.oy + door.y;
        if (!floor.tiles.has(`${wx},${wy}`)) errors.push(`porta ${area.id} fora`);
      }
    }
    for (let i = 0; i < floor.furniture.length; i += 1) {
      for (let j = i + 1; j < floor.furniture.length; j += 1) {
        const a = floor.furniture[i];
        const b = floor.furniture[j];
        const share = tilesOf(a).some((tile) => tilesOf(b).some((other) => other.x === tile.x && other.y === tile.y));
        if (!share) continue;
        const da = CATALOG[a.type];
        const db = CATALOG[b.type];
        const ok = (da.rug && !db.rug) || (db.rug && !da.rug)
          || (da.surface && !db.surface && !db.rug)
          || (db.surface && !da.surface && !da.rug);
        if (!ok) errors.push(`sobrepõe ${a.id} ${b.id}`);
      }
    }
    const occ = buildOccupancy(floor.furniture);
    for (const area of floor.areas) {
      if (occ.block.has(`${area.spawn.x},${area.spawn.y}`)) errors.push(`spawn ${area.id}`);
    }
    if (floor.areas.length > 1) {
      const [a, b] = floor.areas;
      const path = findPath(floor.w, floor.h, blockedFactory(floor), a.spawn.x, a.spawn.y, b.spawn.x, b.spawn.y, false);
      if (!path) errors.push(`sem caminho ${a.id} → ${b.id}`);
    }
    const home = floor.areas[0];
    const toLift = findPath(floor.w, floor.h, blockedFactory(floor), home.spawn.x, home.spawn.y, floor.elevator.x, floor.elevator.y, false);
    if (!toLift) errors.push(`elevador isolado em ${floor.id}`);
  }
  for (const agent of AGENTS) {
    const home = agentHome(agent);
    const floor = FLOORS[home.floorId];
    const chair = floor.furniture.find((it) => it.type === 'cadeira'
      && tilesOf(it).some((tile) => tile.x === home.x && tile.y === home.y));
    if (!chair) errors.push(`${agent.id} sem cadeira no prédio`);
  }
  if (errors.length) {
    const error = new Error(errors.join('; '));
    error.details = errors;
    throw error;
  }
  return true;
}
