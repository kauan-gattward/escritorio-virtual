import { AGENTS, CATALOG, DEFAULT_LOOK, ROOMS, cloneDefaultLayout } from './content.js';
import { findPath } from './path.js';
import {
  avatarFeetWorld,
  avatarHeadWorld,
  doorAnchor,
  drawAvatar,
  drawFloor,
  drawItem,
  drawWalls,
  fillTile,
  strokeFootprint,
} from './art.js';
import { facingForRot, footprintOf, roomPixelBounds, tileToWorld, worldToTile } from './iso.js';
import { buildOccupancy, canPlace, footprintSize, tilesOf } from './layout.js';
import { LAYOUT_KEY, readJson, writeJson } from './persist.js';
import { presence } from './tasks.js';

const WALK_SPEED = 2.85;
const debug = new URLSearchParams(location.search).has('debug');

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

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

export function mount(canvas, bubblesEl, emit) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    roomId: 'recepcao',
    rooms: null,
    inventory: [],
    player: null,
    npcs: [],
    mode: 'play',
    selectedId: null,
    place: null,
    hover: null,
    cam: { x: 0, y: 0, zoom: 1 },
    userCam: false,
    dpr: 1,
    view: { w: 1, h: 1 },
    fps: 0,
    reduce,
  };
  const occCache = new Map();
  const bubbleNodes = new Map();
  const chatLog = [];
  let saveTimer = 0;
  let running = true;
  let raf = 0;
  const pointers = new Map();
  let pan = null;
  let dragItem = null;
  let pinch = null;
  let suppressClick = false;
  let frames = 0;
  let fpsStamp = performance.now();

  function loadLayout() {
    const saved = readJson(LAYOUT_KEY);
    if (saved && saved.v === 1 && saved.rooms && saved.rooms.recepcao && saved.rooms.open) {
      state.rooms = saved.rooms;
      state.inventory = Array.isArray(saved.inventory) ? saved.inventory : [];
    } else {
      state.rooms = cloneDefaultLayout();
      state.inventory = [];
      writeJson(LAYOUT_KEY, { v: 1, rooms: state.rooms, inventory: state.inventory });
    }
  }

  function saveLayout() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      writeJson(LAYOUT_KEY, { v: 1, rooms: state.rooms, inventory: state.inventory });
    }, 120);
  }

  function occupancy(roomId) {
    if (!occCache.has(roomId)) occCache.set(roomId, buildOccupancy(state.rooms[roomId] || []));
    return occCache.get(roomId);
  }

  function invalidate(roomId = state.roomId) {
    occCache.delete(roomId);
  }

  function blockedFn(roomId) {
    const room = ROOMS[roomId];
    const block = occupancy(roomId).block;
    return (x, y) => x < 0 || y < 0 || x >= room.w || y >= room.h || block.has(`${x},${y}`);
  }

  function inRoom(x, y, room = ROOMS[state.roomId]) {
    return x >= 0 && y >= 0 && x < room.w && y < room.h;
  }

  loadLayout();
  const spawn = ROOMS.recepcao.spawn;
  state.player = {
    id: 'kauan',
    name: 'Kauan',
    x: spawn.x,
    y: spawn.y,
    dir: 1,
    action: 'idle',
    actionUntil: 0,
    wasSit: false,
    path: [],
    walkDist: 0,
    bob: 0,
    frame: 0,
    look: { ...DEFAULT_LOOK },
    motto: 'No escritório.',
    messages: [],
    pendingSit: null,
    pendingDoor: null,
  };
  state.npcs = AGENTS.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    motto: agent.motto,
    accent: agent.accent,
    x: agent.home.x,
    y: agent.home.y,
    dir: facingForRot(0),
    action: 'sit',
    ai: 'sit',
    timer: 1.5 + Math.random() * 3,
    path: [],
    walkDist: 0,
    bob: 0,
    frame: 0,
    look: agent.look,
    home: agent.home,
    messages: [],
    npc: true,
  }));

  function roomItems() {
    return state.rooms[state.roomId];
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - state.view.w / 2) / state.cam.zoom + state.cam.x,
      y: (sy - state.view.h / 2) / state.cam.zoom + state.cam.y,
    };
  }

  function worldToScreen(wx, wy) {
    return {
      x: (wx - state.cam.x) * state.cam.zoom + state.view.w / 2,
      y: (wy - state.cam.y) * state.cam.zoom + state.view.h / 2,
    };
  }

  function fit() {
    const bounds = roomPixelBounds(ROOMS[state.roomId]);
    const zx = state.view.w / Math.max(1, bounds.maxX - bounds.minX);
    const zy = state.view.h / Math.max(1, bounds.maxY - bounds.minY);
    state.cam.zoom = clamp(Math.min(zx, zy) * 0.9, 0.55, 1.35);
    state.cam.x = bounds.cx;
    state.cam.y = bounds.cy;
  }

  function clampCam() {
    const bounds = roomPixelBounds(ROOMS[state.roomId]);
    state.cam.x = clamp(state.cam.x, bounds.minX - 120, bounds.maxX + 120);
    state.cam.y = clamp(state.cam.y, bounds.minY - 80, bounds.maxY + 120);
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    state.view.w = Math.max(1, rect.width);
    state.view.h = Math.max(1, rect.height);
    state.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(state.view.w * state.dpr);
    canvas.height = Math.round(state.view.h * state.dpr);
    if (!state.userCam) fit();
  }

  function itemAt(x, y) {
    let found = null;
    for (const item of roomItems()) {
      if (CATALOG[item.type]?.rug) continue;
      if (!tilesOf(item).some((tile) => tile.x === x && tile.y === y)) continue;
      if (!found || CATALOG[item.type].surface) found = item;
    }
    return found;
  }

  function peopleHere() {
    const list = [];
    if (state.player) list.push(state.player);
    for (const npc of state.npcs) {
      if (npc.home.room === state.roomId) list.push(npc);
    }
    return list;
  }

  function hitAvatar(sx, sy) {
    const people = peopleHere();
    let found = null;
    let best = -Infinity;
    for (const person of people) {
      const feet = worldToScreen(avatarFeetWorld(person).x, avatarFeetWorld(person).y);
      const head = worldToScreen(avatarHeadWorld(person).x, avatarHeadWorld(person).y);
      const height = Math.max(52, feet.y - head.y + 8);
      const width = Math.max(48, 40 * state.cam.zoom);
      const top = feet.y - height;
      if (sx < feet.x - width / 2 || sx > feet.x + width / 2 || sy < top || sy > feet.y + 10) continue;
      const depth = person.x + person.y;
      if (depth >= best) {
        best = depth;
        found = person;
      }
    }
    return found;
  }

  function nearestWalkable(x, y) {
    const blocked = blockedFn(state.roomId);
    if (inRoom(x, y) && !blocked(x, y)) return { x, y };
    let best = null;
    let bestD = Infinity;
    for (let radius = 1; radius <= 4; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!inRoom(nx, ny) || blocked(nx, ny)) continue;
          const dist = dx * dx + dy * dy;
          if (dist < bestD) {
            bestD = dist;
            best = { x: nx, y: ny };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function walkTo(goal, extra = {}) {
    const room = ROOMS[state.roomId];
    const sx = Math.round(state.player.x);
    const sy = Math.round(state.player.y);
    const allow = Boolean(extra.allowGoal || extra.sit);
    const path = findPath(room.w, room.h, blockedFn(state.roomId), sx, sy, goal.x, goal.y, allow);
    if (!path) {
      emit('toast', 'Não dá para chegar');
      return false;
    }
    state.player.pendingDoor = extra.door || null;
    state.player.pendingSit = extra.sit || null;
    state.player.wasSit = false;
    if (state.player.action === 'dance') state.player.action = 'idle';
    if (path.length <= 1) {
      state.player.path = [];
      state.player.x = goal.x;
      state.player.y = goal.y;
      return true;
    }
    state.player.path = path.slice(1);
    return true;
  }

  function trySit(tile) {
    const seat = occupancy(state.roomId).seats.get(`${tile.x},${tile.y}`);
    if (!seat) return false;
    const occupied = state.npcs.some((npc) => npc.home.room === state.roomId
      && Math.round(npc.x) === tile.x && Math.round(npc.y) === tile.y);
    if (occupied) return false;
    return walkTo(
      { x: tile.x, y: tile.y },
      { sit: { x: tile.x, y: tile.y, dir: facingForRot(seat.item.rot || 0) }, allowGoal: true },
    );
  }

  function handleClick(sx, sy) {
    const world = screenToWorld(sx, sy);
    const tile = worldToTile(world.x, world.y);
    const room = ROOMS[state.roomId];
    if (state.mode === 'play') {
      const avatar = hitAvatar(sx, sy);
      if (avatar) {
        emit('avatar', avatar.id === 'kauan' ? { ...state.player, kind: 'player' } : { ...avatar, kind: 'npc' });
        return;
      }
    }
    if (!inRoom(tile.x, tile.y, room)) return;
    if (state.mode === 'place' && state.place) {
      placeAt(tile.x, tile.y);
      return;
    }
    if (state.mode === 'move') {
      const item = itemAt(tile.x, tile.y);
      selectItem(item);
      return;
    }
    if (trySit(tile)) return;
    const door = room.doors.find((entry) => entry.x === tile.x && entry.y === tile.y) || null;
    let goal = { x: tile.x, y: tile.y };
    if (!door && blockedFn(state.roomId)(goal.x, goal.y)) {
      goal = nearestWalkable(goal.x, goal.y);
      if (!goal) return;
    }
    walkTo(goal, { door });
  }

  function selectItem(item) {
    state.selectedId = item ? item.id : null;
    emit('selection', item || null);
  }

  function selectedItem() {
    return roomItems().find((item) => item.id === state.selectedId) || null;
  }

  function placeAt(x, y) {
    const draft = { ...state.place, x, y };
    if (!canPlace(ROOMS[state.roomId], roomItems(), draft, null)) {
      emit('toast', 'Não cabe aqui');
      return;
    }
    const placed = { ...draft, x, y, fromRoom: state.roomId };
    roomItems().push(placed);
    state.inventory = state.inventory.filter((item) => item.id !== placed.id);
    state.place = null;
    state.mode = 'play';
    invalidate();
    saveLayout();
    emit('inventory');
    emit('mode');
    emit('toast', 'Colocado');
  }

  function stepAlong(person, dt) {
    if (!person.path.length) return false;
    const target = person.path[0];
    const dx = target.x - person.x;
    const dy = target.y - person.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.045) {
      person.x = target.x;
      person.y = target.y;
      person.path.shift();
      if (!person.path.length) {
        person.bob = 0;
        return false;
      }
      return stepAlong(person, dt);
    }
    const step = Math.min(dist, WALK_SPEED * dt);
    person.x += (dx / dist) * step;
    person.y += (dy / dist) * step;
    person.walkDist += step;
    person.dir = dirSafe(dx, dy);
    person.action = 'walk';
    person.bob = state.reduce ? 0 : Math.abs(Math.sin(person.walkDist * Math.PI * 2)) * 3.2;
    person.frame = Math.floor(person.walkDist * 4) % 4;
    return true;
  }

  function dirSafe(dx, dy) {
    const sx = Math.sign(Math.round(dx * 2));
    const sy = Math.sign(Math.round(dy * 2));
    const key = `${Math.sign(dx) || sx},${Math.sign(dy) || sy}`;
    const map = {
      '1,0': 0, '1,1': 1, '0,1': 2, '-1,1': 3, '-1,0': 4, '-1,-1': 5, '0,-1': 6, '1,-1': 7,
    };
    return map[key] ?? 1;
  }

  function arrivePlayer() {
    const player = state.player;
    if (player.pendingDoor) {
      const door = player.pendingDoor;
      player.pendingDoor = null;
      enterRoom(door.to, door.toX, door.toY);
      return;
    }
    if (player.pendingSit) {
      const sit = player.pendingSit;
      player.pendingSit = null;
      player.x = sit.x;
      player.y = sit.y;
      player.dir = sit.dir;
      player.action = 'sit';
      player.wasSit = true;
      return;
    }
    if (player.action === 'walk') player.action = 'idle';
  }

  function updatePlayer(dt, now) {
    const player = state.player;
    const moving = stepAlong(player, dt);
    if (!moving && (player.path.length === 0) && (player.pendingDoor || player.pendingSit || player.action === 'walk')) {
      arrivePlayer();
    }
    if (player.action === 'wave' && now > player.actionUntil) {
      player.action = player.wasSit ? 'sit' : 'idle';
    }
    if ((player.action === 'idle' || player.action === 'sit' || player.action === 'dance') && !moving) {
      player.bob = 0;
      player.frame = Math.floor(now / (player.action === 'dance' ? 160 : 420)) % 4;
    }
    const life = 4600;
    player.messages = player.messages.filter((message) => now - message.born < life);
  }

  function randomStroll(npc) {
    const room = ROOMS[npc.home.room];
    const blocked = blockedFn(room.id);
    const doors = new Set(room.doors.map((door) => `${door.x},${door.y}`));
    const options = [];
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        if (!dx && !dy) continue;
        const x = npc.home.x + dx;
        const y = npc.home.y + dy;
        if (x < 0 || y < 0 || x >= room.w || y >= room.h) continue;
        if (blocked(x, y) || doors.has(`${x},${y}`)) continue;
        options.push({ x, y });
      }
    }
    if (!options.length) return null;
    return options[Math.floor(Math.random() * options.length)];
  }

  function updateNpc(npc, dt, now) {
    npc.timer -= dt;
    const room = ROOMS[npc.home.room];
    if (npc.ai === 'sit') {
      npc.action = 'sit';
      npc.x = npc.home.x;
      npc.y = npc.home.y;
      npc.dir = facingForRot(0);
      npc.bob = 0;
      npc.frame = Math.floor(now / 480 + npc.home.x) % 4;
      if (npc.timer <= 0) {
        if (presence(npc.id) === 'livre' && Math.random() < 0.65) {
          const goal = randomStroll(npc);
          if (goal) {
            const path = findPath(room.w, room.h, blockedFn(room.id), npc.home.x, npc.home.y, goal.x, goal.y, false);
            if (path && path.length > 1) {
              npc.path = path.slice(1);
              npc.ai = 'out';
              npc.action = 'walk';
            }
          }
        }
        npc.timer = 5 + Math.random() * 7;
      }
      return;
    }
    if (npc.ai === 'out' || npc.ai === 'return') {
      const moving = stepAlong(npc, dt);
      if (!moving && npc.path.length === 0) {
        if (npc.ai === 'return') {
          const playerThere = state.roomId === npc.home.room
            && state.player.action === 'sit'
            && Math.round(state.player.x) === npc.home.x
            && Math.round(state.player.y) === npc.home.y;
          if (playerThere) {
            npc.ai = 'wait';
            npc.action = 'idle';
            npc.timer = 1.4;
          } else {
            npc.ai = 'sit';
            npc.action = 'sit';
            npc.x = npc.home.x;
            npc.y = npc.home.y;
            npc.dir = facingForRot(0);
            npc.timer = 6 + Math.random() * 8;
          }
        } else {
          npc.ai = 'pause';
          npc.action = 'idle';
          npc.timer = 1 + Math.random() * 1.6;
        }
      }
      return;
    }
    npc.action = 'idle';
    npc.frame = Math.floor(now / 320) % 4;
    if (npc.timer <= 0) {
      const sx = Math.round(npc.x);
      const sy = Math.round(npc.y);
      const path = findPath(room.w, room.h, blockedFn(room.id), sx, sy, npc.home.x, npc.home.y, true);
      if (path && path.length > 1) {
        npc.path = path.slice(1);
        npc.ai = 'return';
      } else {
        npc.x = npc.home.x;
        npc.y = npc.home.y;
        npc.ai = 'sit';
        npc.action = 'sit';
      }
    }
  }

  function liftFor(item) {
    if (!CATALOG[item.type]?.surface) return 0;
    const baseMap = occupancy(state.roomId).base;
    for (const tile of tilesOf(item)) {
      const host = baseMap.get(`${tile.x},${tile.y}`);
      if (!host) continue;
      if (host.type === 'escrivaninha') return 32;
      if (host.type === 'mesa') return 28;
    }
    return 0;
  }

  function render(now) {
    const ctx = canvas.getContext('2d');
    const { dpr } = state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, state.view.w, state.view.h);
    ctx.fillStyle = '#161310';
    ctx.fillRect(0, 0, state.view.w, state.view.h);
    ctx.imageSmoothingEnabled = true;
    ctx.translate(state.view.w / 2, state.view.h / 2);
    ctx.scale(state.cam.zoom, state.cam.zoom);
    ctx.translate(-state.cam.x, -state.cam.y);

    const room = ROOMS[state.roomId];
    const time = now / 1000;
    drawFloor(ctx, room);
    for (const item of roomItems()) {
      if (item.type === 'tapete') drawItem(ctx, item, time);
    }
    drawWalls(ctx, room);

    const drawables = [];
    for (const item of roomItems()) {
      if (item.type === 'tapete') continue;
      const fp = footprintSize(item);
      const bias = CATALOG[item.type].surface ? 0.35 : 0.12;
      drawables.push({
        key: (item.x + fp.w - 1) + (item.y + fp.d - 1) + bias,
        paint: () => drawItem(ctx, item, time, { lift: liftFor(item) }),
      });
    }
    for (const person of peopleHere()) {
      drawables.push({
        key: person.x + person.y + 0.58,
        paint: () => drawAvatar(ctx, person),
      });
    }
    if (state.mode === 'place' && state.place && state.hover && inRoom(state.hover.x, state.hover.y)) {
      const ghost = { ...state.place, x: state.hover.x, y: state.hover.y };
      const fp = footprintSize(ghost);
      const valid = canPlace(room, roomItems(), ghost, null);
      drawables.push({
        key: (ghost.x + fp.w - 1) + (ghost.y + fp.d - 1) + 0.42,
        paint: () => {
          ctx.save();
          ctx.globalAlpha = 0.78;
          drawItem(ctx, ghost, time, { lift: liftFor(ghost) });
          ctx.restore();
          strokeFootprint(ctx, ghost, valid ? '#2c7a45' : '#d25a32');
        },
      });
    }
    drawables.sort((a, b) => a.key - b.key);
    for (const drawable of drawables) drawable.paint();

    if (state.hover && inRoom(state.hover.x, state.hover.y) && state.mode === 'play') {
      fillTile(ctx, state.hover.x, state.hover.y, 'rgba(226, 162, 59, 0.28)');
    }
    const selected = selectedItem();
    if (selected) strokeFootprint(ctx, selected, '#e2a23b');

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawHud(ctx);
    updateBubbles(now);
  }

  function drawHud(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const door of ROOMS[state.roomId].doors) {
      const anchor = doorAnchor(door);
      const screen = worldToScreen(anchor.x, anchor.y);
      pill(ctx, screen.x, screen.y, door.label, '#1e5c55', '#f7f1e6');
    }
    for (const item of roomItems()) {
      if (!item.label) continue;
      const fp = footprintOf(CATALOG[item.type].w, CATALOG[item.type].d, item.rot || 0);
      const ax = item.x + (fp.w - 1) / 2;
      const ay = item.y + (fp.d - 1) / 2;
      const crowded = peopleHere().some((person) => person.name === item.label && Math.hypot(person.x - ax, person.y - ay) < 1.8);
      if (crowded) continue;
      const spot = tileToWorld(ax, ay);
      const screen = worldToScreen(spot.x, spot.y - 34);
      pill(ctx, screen.x, screen.y, item.label, 'rgba(28, 22, 16, 0.82)', '#f7f1e6');
    }
    for (const person of peopleHere()) {
      const feet = worldToScreen(avatarFeetWorld(person).x, avatarFeetWorld(person).y + 8);
      pill(ctx, feet.x, feet.y, person.name, 'rgba(28, 22, 16, 0.88)', '#f7f1e6');
      if (person.npc) {
        const head = worldToScreen(avatarHeadWorld(person).x, avatarHeadWorld(person).y);
        const status = presence(person.id);
        const colors = status === 'resposta pronta'
          ? ['#d25a32', '#fffaf6']
          : status === 'trabalhando'
            ? ['#f3ddb0', '#6a4010']
            : ['#e5f3ef', '#174842'];
        pill(ctx, head.x, head.y - 8, status, colors[0], colors[1]);
      }
    }
  }

  function pill(ctx, x, y, text, bg, fg) {
    ctx.font = '600 12px "Segoe UI", sans-serif';
    const width = ctx.measureText(text).width + 14;
    ctx.fillStyle = bg;
    roundRect(ctx, x - width / 2, y - 9, width, 18, 9);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, x, y);
  }

  function updateBubbles(now) {
    const alive = new Set();
    for (const person of peopleHere()) {
      const messages = person.messages || [];
      messages.forEach((message, index) => {
        alive.add(message.id);
        let node = bubbleNodes.get(message.id);
        if (!node) {
          node = document.createElement('div');
          node.className = 'bubble';
          node.textContent = message.text;
          bubblesEl.appendChild(node);
          bubbleNodes.set(message.id, node);
        }
        const head = worldToScreen(avatarHeadWorld(person).x, avatarHeadWorld(person).y);
        const age = (now - message.born) / 1000;
        const stack = messages.length - 1 - index;
        const y = head.y - 36 - stack * 6 - age * 16;
        const opacity = age > 3.7 ? Math.max(0, 1 - (age - 3.7) / 0.9) : 1;
        node.style.transform = `translate(${head.x}px, ${y}px) translate(-50%, -100%)`;
        node.style.opacity = String(opacity);
      });
    }
    for (const [id, node] of bubbleNodes) {
      if (!alive.has(id)) {
        node.remove();
        bubbleNodes.delete(id);
      }
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - fpsStamp) / 1000);
    frames += 1;
    if (now - fpsStamp > 500) {
      state.fps = Math.round((frames * 1000) / (now - fpsStamp));
      frames = 0;
      fpsStamp = now;
    }
    updatePlayer(dt, now);
    for (const npc of state.npcs) updateNpc(npc, dt, now);
    render(now);
    raf = requestAnimationFrame(frame);
  }

  function localPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function beginPinch() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return;
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    pinch = { dist, zoom: state.cam.zoom, world: screenToWorld(mid.x, mid.y) };
    suppressClick = true;
    pan = null;
    dragItem = null;
  }

  function applyPinch() {
    const pts = [...pointers.values()];
    if (pts.length < 2 || !pinch) return;
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const zoom = clamp(pinch.zoom * (dist / pinch.dist), 0.45, 2.2);
    state.cam.zoom = zoom;
    state.cam.x = pinch.world.x - (mid.x - state.view.w / 2) / zoom;
    state.cam.y = pinch.world.y - (mid.y - state.view.h / 2) / zoom;
    state.userCam = true;
    clampCam();
  }

  function moveDrag(point) {
    const world = screenToWorld(point.x, point.y);
    const tile = worldToTile(world.x, world.y);
    const item = roomItems().find((entry) => entry.id === dragItem.id);
    if (!item) return;
    const nx = tile.x - dragItem.ox;
    const ny = tile.y - dragItem.oy;
    if (nx === item.x && ny === item.y) return;
    const draft = { ...item, x: nx, y: ny };
    if (!canPlace(ROOMS[state.roomId], roomItems(), draft, item.id)) return;
    item.x = nx;
    item.y = ny;
    invalidate();
    dragItem.moved = true;
  }

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    if (pointers.size >= 2) {
      beginPinch();
      return;
    }
    const world = screenToWorld(point.x, point.y);
    const tile = worldToTile(world.x, world.y);
    if (state.mode === 'move' && inRoom(tile.x, tile.y)) {
      const item = itemAt(tile.x, tile.y);
      if (item) {
        dragItem = {
          id: item.id,
          ox: tile.x - item.x,
          oy: tile.y - item.y,
          pointer: event.pointerId,
          moved: false,
        };
        selectItem(item);
        return;
      }
    }
    pan = { pointer: event.pointerId, lastX: point.x, lastY: point.y, moved: false };
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    const world = screenToWorld(point.x, point.y);
    const tile = worldToTile(world.x, world.y);
    state.hover = inRoom(tile.x, tile.y) ? { x: tile.x, y: tile.y } : null;
    if (pointers.size >= 2) {
      applyPinch();
      return;
    }
    if (dragItem && event.pointerId === dragItem.pointer) {
      moveDrag(point);
      return;
    }
    if (pan && event.pointerId === pan.pointer) {
      const dx = point.x - pan.lastX;
      const dy = point.y - pan.lastY;
      if (pan.originX == null) {
        pan.originX = pan.lastX;
        pan.originY = pan.lastY;
      }
      if (Math.hypot(point.x - pan.originX, point.y - pan.originY) > 7) {
        pan.moved = true;
        suppressClick = true;
        state.userCam = true;
        state.cam.x -= dx / state.cam.zoom;
        state.cam.y -= dy / state.cam.zoom;
        clampCam();
      }
      pan.lastX = point.x;
      pan.lastY = point.y;
    }
  });

  function endPointer(event) {
    const point = pointers.get(event.pointerId) || localPoint(event);
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (dragItem && dragItem.pointer === event.pointerId) {
      if (dragItem.moved) {
        saveLayout();
        suppressClick = true;
      }
      dragItem = null;
      return;
    }
    if (pan && pan.pointer === event.pointerId) {
      const moved = pan.moved;
      pan = null;
      if (!moved && !suppressClick && pointers.size === 0) handleClick(point.x, point.y);
    }
    if (pointers.size === 0) suppressClick = false;
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const point = localPoint(event);
    const before = screenToWorld(point.x, point.y);
    const factor = Math.exp(-event.deltaY * 0.0011);
    state.cam.zoom = clamp(state.cam.zoom * factor, 0.45, 2.2);
    const after = screenToWorld(point.x, point.y);
    state.cam.x += before.x - after.x;
    state.cam.y += before.y - after.y;
    state.userCam = true;
    clampCam();
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';
    if (event.key === 'Escape') {
      if (state.place) {
        state.place = null;
        state.mode = 'play';
        emit('mode');
        emit('toast', 'Cancelado');
      } else if (state.selectedId) {
        selectItem(null);
      } else emit('escape');
      return;
    }
    if (typing) return;
    const panStep = 28 / state.cam.zoom;
    if (event.key === 'ArrowLeft') state.cam.x -= panStep;
    else if (event.key === 'ArrowRight') state.cam.x += panStep;
    else if (event.key === 'ArrowUp') state.cam.y -= panStep;
    else if (event.key === 'ArrowDown') state.cam.y += panStep;
    else if (event.key === '+' || event.key === '=') state.cam.zoom = clamp(state.cam.zoom * 1.08, 0.45, 2.2);
    else if (event.key === '-' || event.key === '_') state.cam.zoom = clamp(state.cam.zoom / 1.08, 0.45, 2.2);
    else if (event.key === 'r' || event.key === 'R') api.rotate();
    else if (event.key === 'Delete' || event.key === 'Backspace') api.pickup();
    else return;
    state.userCam = true;
    clampCam();
    event.preventDefault();
  });

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(canvas.parentElement);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      fpsStamp = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });

  function enterRoom(id, x, y) {
    if (!ROOMS[id]) return;
    state.roomId = id;
    state.player.x = x;
    state.player.y = y;
    state.player.path = [];
    state.player.pendingDoor = null;
    state.player.pendingSit = null;
    state.player.action = 'idle';
    state.player.wasSit = false;
    state.selectedId = null;
    state.place = null;
    state.mode = 'play';
    state.userCam = false;
    fit();
    emit('room');
    emit('mode');
    emit('selection', null);
  }

  const api = {
    setLook(partial) {
      if (partial.motto != null) state.player.motto = String(partial.motto).slice(0, 42);
      const { motto, ...colors } = partial;
      Object.assign(state.player.look, colors);
    },
    getPlayer() {
      return state.player;
    },
    say(text) {
      const clean = String(text || '').trim().slice(0, 180);
      if (!clean) return;
      state.player.messages.push({ id: crypto.randomUUID(), text: clean, born: performance.now() });
      if (state.player.messages.length > 4) state.player.messages.shift();
      chatLog.push({ name: 'Kauan', text: clean, at: new Date().toISOString() });
      if (chatLog.length > 40) chatLog.shift();
      emit('chat', chatLog);
    },
    wave() {
      const player = state.player;
      player.wasSit = player.action === 'sit' && player.path.length === 0;
      player.path = [];
      player.pendingDoor = null;
      player.pendingSit = null;
      player.action = 'wave';
      player.actionUntil = performance.now() + 2200;
    },
    dance() {
      const player = state.player;
      if (player.action === 'dance') {
        player.action = 'idle';
        return;
      }
      player.path = [];
      player.pendingDoor = null;
      player.pendingSit = null;
      player.wasSit = false;
      player.action = 'dance';
    },
    sit() {
      const occ = occupancy(state.roomId);
      let best = null;
      let bestD = Infinity;
      for (const seat of occ.seats.values()) {
        const occupied = state.npcs.some((npc) => npc.home.room === state.roomId
          && Math.round(npc.x) === seat.x && Math.round(npc.y) === seat.y);
        if (occupied) continue;
        const dist = Math.hypot(seat.x - state.player.x, seat.y - state.player.y);
        if (dist < bestD) {
          bestD = dist;
          best = seat;
        }
      }
      if (!best || bestD > 8) {
        emit('toast', 'Nenhuma cadeira livre por perto');
        return;
      }
      trySit({ x: best.x, y: best.y });
    },
    setMode(mode) {
      state.mode = mode;
      if (mode !== 'place') state.place = null;
      if (mode !== 'move') selectItem(null);
      emit('mode');
    },
    getMode() {
      return state.mode;
    },
    rotate() {
      if (state.place) {
        state.place.rot = ((state.place.rot || 0) + 1) % 4;
        emit('mode');
        return;
      }
      const item = selectedItem();
      if (!item) {
        emit('toast', 'Selecione um móvel');
        return;
      }
      const rot = ((item.rot || 0) + 1) % 4;
      const draft = { ...item, rot };
      if (!canPlace(ROOMS[state.roomId], roomItems(), draft, item.id)) {
        emit('toast', 'Não gira aqui');
        return;
      }
      item.rot = rot;
      invalidate();
      saveLayout();
    },
    pickup() {
      const item = selectedItem();
      if (!item) {
        emit('toast', 'Selecione um móvel');
        return;
      }
      state.rooms[state.roomId] = roomItems().filter((entry) => entry.id !== item.id);
      state.inventory.push({
        id: item.id,
        type: item.type,
        rot: item.rot || 0,
        origin: item.origin || 'default',
        fromRoom: item.fromRoom || state.roomId,
        label: item.label || null,
      });
      invalidate();
      saveLayout();
      selectItem(null);
      emit('inventory');
      emit('toast', 'Na mochila');
    },
    beginPlace(item) {
      state.place = { ...item };
      state.mode = 'place';
      state.selectedId = null;
      emit('mode');
      emit('selection', null);
      emit('toast', 'Toque num piso livre');
    },
    cancelPlace() {
      state.place = null;
      state.mode = 'play';
      emit('mode');
    },
    addCatalog(type) {
      const item = {
        id: `cat_${crypto.randomUUID()}`,
        type,
        rot: 0,
        origin: 'catalog',
        fromRoom: null,
        label: null,
      };
      state.inventory.push(item);
      saveLayout();
      emit('inventory');
      emit('toast', 'Na mochila');
    },
    restoreRoom() {
      const id = state.roomId;
      const defaults = cloneDefaultLayout()[id];
      const rescued = roomItems().filter((item) => item.origin === 'catalog');
      state.inventory = state.inventory.filter((item) => !(item.origin === 'default' && item.fromRoom === id));
      for (const item of rescued) {
        state.inventory.push({
          id: item.id, type: item.type, rot: item.rot || 0, origin: 'catalog', fromRoom: id, label: item.label || null,
        });
      }
      state.rooms[id] = defaults;
      invalidate(id);
      saveLayout();
      emit('inventory');
      emit('toast', 'Móveis originais de volta');
    },
    goRoom(id) {
      const room = ROOMS[id];
      if (!room) return;
      enterRoom(id, room.spawn.x, room.spawn.y);
    },
    roomId() {
      return state.roomId;
    },
    inventory() {
      return state.inventory.slice();
    },
    chatLog() {
      return chatLog.slice();
    },
    fps() {
      return state.fps;
    },
  };

  resize();
  raf = requestAnimationFrame(frame);
  if (debug) {
    window.__office = {
      api,
      get fps() { return state.fps; },
    get zoom() { return state.cam.zoom; },
    get cam() { return { x: state.cam.x, y: state.cam.y, zoom: state.cam.zoom, w: state.view.w, h: state.view.h }; },
      get room() { return state.roomId; },
      get player() {
        return {
          x: state.player.x,
          y: state.player.y,
          action: state.player.action,
          dir: state.player.dir,
        };
      },
    click: handleClick,
    items() {
      return state.rooms[state.roomId].map((item) => ({
        id: item.id, type: item.type, x: item.x, y: item.y, rot: item.rot,
      }));
    },
    tile(x, y) {
      const point = tileToWorld(x, y);
      return worldToScreen(point.x, point.y);
    },
    feet(id) {
      const person = id === 'kauan' ? state.player : state.npcs.find((npc) => npc.id === id);
      const point = avatarFeetWorld(person);
      return worldToScreen(point.x, point.y - 28);
    },
  };
}
  return api;
}
