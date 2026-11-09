import { AGENT_MAP, CATALOG, CATALOG_ORDER, DEFAULT_LOOK, ROOM_LIST, ROOMS } from './content.js';
import { paintAvatarPreview, paintPreview } from './art.js';
import { mount } from './game.js';
import { AVATAR_KEY, readJson, writeJson } from './persist.js';
import {
  hasWebhook,
  listTasks,
  loadResults,
  markRead,
  presence,
  retryPending,
  sendTask,
  subscribe,
} from './tasks.js';

const SKIN = ['#f6d7c0', '#e8b48a', '#c68642', '#a56b3c', '#7a4a2b', '#4d3428'];
const HAIR = ['#1a120e', '#3b2417', '#6b3a22', '#b5522a', '#d8a45a', '#0f6e68'];
const SHIRT = ['#f4efe6', '#1e5c55', '#d25a32', '#143646', '#3d7a4a', '#2f5f9e', '#2b2f36', '#e2a23b'];
const PANTS = ['#243044', '#1b1b1b', '#3a2a22', '#1e5c55', '#4a3b6a', '#6e4a32'];

const windows = new Map();
let z = 10;
let game = null;
let look = null;
let openAgent = null;

function toast(text) {
  const host = document.getElementById('toasts');
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = text;
  host.appendChild(node);
  setTimeout(() => node.remove(), 2400);
}

function openWindow(id, title, render) {
  const host = document.getElementById('windows');
  let win = windows.get(id);
  if (!win) {
    win = document.createElement('section');
    win.className = 'window';
    win.dataset.id = id;
    win.style.left = `${16 + (windows.size % 3) * 24}px`;
    win.style.top = `${16 + (windows.size % 4) * 18}px`;
    const header = document.createElement('header');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Fechar');
    close.textContent = '×';
    close.addEventListener('click', () => closeWindow(id));
    header.append(heading, close);
    const body = document.createElement('div');
    body.className = 'body';
    win.append(header, body);
    header.addEventListener('pointerdown', (event) => dragWindow(win, header, event));
    win.addEventListener('pointerdown', () => {
      z += 1;
      win.style.zIndex = String(z);
    });
    host.appendChild(win);
    windows.set(id, win);
  }
  const heading = win.querySelector('strong');
  heading.textContent = title;
  const body = win.querySelector('.body');
  body.replaceChildren();
  render(body);
  z += 1;
  win.style.zIndex = String(z);
  win.hidden = false;
  return win;
}

function closeWindow(id) {
  const win = windows.get(id);
  if (win) win.remove();
  windows.delete(id);
  if (id === 'agent') openAgent = null;
}

function dragWindow(win, header, event) {
  if (event.target.closest('button')) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const left = win.offsetLeft;
  const top = win.offsetTop;
  const stage = document.getElementById('stage');
  function move(ev) {
    const maxL = Math.max(0, stage.clientWidth - 48);
    const maxT = Math.max(0, stage.clientHeight - 48);
    win.style.left = `${Math.max(0, Math.min(maxL, left + ev.clientX - startX))}px`;
    win.style.top = `${Math.max(0, Math.min(maxT, top + ev.clientY - startY))}px`;
  }
  function up() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function fmt(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function renderRooms(body) {
  body.replaceChildren();
  const list = document.createElement('div');
  list.className = 'room-list';
  for (const room of ROOM_LIST) {
    const button = document.createElement('button');
    button.type = 'button';
    if (room.id === game.roomId()) button.setAttribute('aria-current', 'true');
    const strong = document.createElement('strong');
    strong.textContent = room.name;
    const small = document.createElement('small');
    small.textContent = room.blurb;
    button.append(strong, small);
    button.addEventListener('click', () => {
      game.goRoom(room.id);
      renderRooms(body);
    });
    list.appendChild(button);
  }
  const restore = document.createElement('button');
  restore.className = 'ghost';
  restore.type = 'button';
  restore.textContent = 'Restaurar móveis desta sala';
  restore.addEventListener('click', () => game.restoreRoom());
  body.append(list, restore);
}

function renderCatalog(body) {
  body.replaceChildren();
  const grid = document.createElement('div');
  grid.className = 'catalog-grid';
  for (const type of CATALOG_ORDER) {
    const card = document.createElement('div');
    card.className = 'catalog-card';
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    paintPreview(canvas, type);
    const name = document.createElement('strong');
    name.textContent = CATALOG[type].name;
    const button = document.createElement('button');
    button.className = 'tiny';
    button.type = 'button';
    button.textContent = 'Pôr na mochila';
    button.addEventListener('click', () => game.addCatalog(type));
    card.append(canvas, name, button);
    grid.appendChild(card);
  }
  body.appendChild(grid);
}

function renderBag(body) {
  body.replaceChildren();
  const items = game.inventory();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'A mochila está vazia. Pegue um móvel da sala ou do catálogo.';
    body.appendChild(empty);
    return;
  }
  const stack = document.createElement('div');
  stack.className = 'stack';
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'bag-row';
    const strong = document.createElement('strong');
    strong.textContent = CATALOG[item.type]?.name || item.type;
    const button = document.createElement('button');
    button.className = 'tiny';
    button.type = 'button';
    button.textContent = 'Colocar';
    button.addEventListener('click', () => {
      game.beginPlace(item);
      closeWindow('bag');
    });
    row.append(strong, button);
    stack.appendChild(row);
  }
  body.appendChild(stack);
}

function swatchRow(label, colors, key) {
  const wrap = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = label;
  const row = document.createElement('div');
  row.className = 'swatches';
  for (const color of colors) {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.background = color;
    button.setAttribute('aria-label', color);
    button.setAttribute('aria-pressed', String(look[key] === color));
    button.addEventListener('click', () => {
      look[key] = color;
      applyLook();
      row.querySelectorAll('button').forEach((swatch) => {
        swatch.setAttribute('aria-pressed', String(swatch === button));
      });
    });
    row.appendChild(button);
  }
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = toHex(look[key]);
  picker.addEventListener('input', () => {
    look[key] = picker.value;
    applyLook();
  });
  row.appendChild(picker);
  wrap.append(title, row);
  return wrap;
}

function toHex(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888888';
}

function applyLook() {
  game.setLook(look);
  writeJson(AVATAR_KEY, { v: 1, ...look });
  const canvas = document.getElementById('avatar-preview');
  if (canvas) paintAvatarPreview(canvas, game.getPlayer().look, 'wave');
}

function refreshLook(body) {
  if (!body) return;
  body.replaceChildren();
  renderLook(body);
}

function renderLook(body) {
  body.replaceChildren();
  const canvas = document.createElement('canvas');
  canvas.id = 'avatar-preview';
  canvas.width = 220;
  canvas.height = 180;
  paintAvatarPreview(canvas, game.getPlayer().look, 'wave');
  const colors = document.createElement('div');
  colors.className = 'colors';
  colors.append(
    swatchRow('Pele', SKIN, 'skin'),
    swatchRow('Cabelo', HAIR, 'hair'),
    swatchRow('Camisa', SHIRT, 'shirt'),
    swatchRow('Calça', PANTS, 'pants'),
  );
  const label = document.createElement('label');
  label.textContent = 'Frase';
  const motto = document.createElement('input');
  motto.id = 'motto';
  motto.maxLength = 42;
  motto.value = look.motto || '';
  motto.addEventListener('input', () => {
    look.motto = motto.value;
    applyLook();
  });
  body.append(canvas, colors, label, motto);
}

function renderTalk(body) {
  body.replaceChildren();
  const log = game.chatLog();
  if (!log.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Ninguém falou ainda nesta visita.';
    body.appendChild(empty);
    return;
  }
  for (const line of log) {
    const row = document.createElement('div');
    row.className = 'log-line';
    const who = document.createElement('b');
    who.textContent = `${line.name}: `;
    row.append(who, document.createTextNode(line.text));
    body.appendChild(row);
  }
}

function renderHelp(body) {
  body.replaceChildren();
  const lines = [
    'Toque num piso para andar. Arraste para mover a câmera. No celular, use dois dedos para aproximar.',
    'Portas na parede trocam de sala. O botão Salas também.',
    'Mover: arraste um móvel. Girar e Pegar ficam na faixa acima do chat.',
    'Clique numa cadeira ou sofá para sentar. Acenar e Dançar são seus.',
    'Clique num colega para pedir uma tarefa. Sem webhook, a tarefa fica neste aparelho como “aguardando conexão”.',
    hasWebhook()
      ? 'A conexão com o webhook está configurada.'
      : 'Ainda não há config.enc.json. Por isso nada é enviado para fora.',
  ];
  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    body.appendChild(p);
  }
}

function statusClass(status) {
  if (status === 'resposta pronta') return 'ready';
  if (status === 'erro') return 'bad';
  if (status === 'livre') return 'ready';
  return 'wait';
}

function renderAgent(body, agentId) {
  body.replaceChildren();
  const agent = agentId === 'kauan' ? null : AGENT_MAP[agentId];
  const player = game.getPlayer();
  const card = document.createElement('div');
  card.className = 'portrait-card';
  const canvas = document.createElement('canvas');
  canvas.className = 'portrait';
  canvas.width = 160;
  canvas.height = 140;
  if (agent) paintAvatarPreview(canvas, agent.look, 'idle');
  else paintAvatarPreview(canvas, player.look, 'wave');
  const info = document.createElement('div');
  const name = document.createElement('h2');
  name.className = 'who';
  name.textContent = agent ? agent.name : 'Kauan';
  const role = document.createElement('p');
  role.textContent = agent ? agent.role : 'Dono da sala';
  const motto = document.createElement('p');
  motto.className = 'muted';
  motto.textContent = agent ? agent.motto : player.motto;
  info.append(name, role, motto);
  if (agent) {
    const badge = document.createElement('p');
    badge.className = `status ${statusClass(presence(agent.id))}`;
    badge.textContent = presence(agent.id);
    info.appendChild(badge);
  }
  card.append(canvas, info);
  body.appendChild(card);
  if (!agent) {
    const button = document.createElement('button');
    button.className = 'primary';
    button.type = 'button';
    button.textContent = 'Personalizar';
    button.addEventListener('click', () => openWindow('look', 'Visual', renderLook));
    body.appendChild(button);
    return;
  }
  const field = document.createElement('label');
  field.textContent = 'Nova tarefa';
  const area = document.createElement('textarea');
  area.rows = 3;
  area.maxLength = 2000;
  area.placeholder = 'Descreva a tarefa…';
  const row = document.createElement('div');
  row.className = 'row';
  const send = document.createElement('button');
  send.className = 'primary';
  send.type = 'button';
  send.textContent = 'Enviar tarefa';
  send.addEventListener('click', async () => {
    send.disabled = true;
    try {
      const task = await sendTask(agent.id, area.value);
      area.value = '';
      toast(task.status === 'enviada' ? 'Tarefa enviada' : 'Aguardando conexão');
    } catch {
      toast('Escreva a tarefa primeiro');
    } finally {
      send.disabled = false;
      if (openAgent === agent.id) renderAgent(body, agent.id);
    }
  });
  const refresh = document.createElement('button');
  refresh.className = 'ghost';
  refresh.type = 'button';
  refresh.textContent = 'Atualizar respostas';
  refresh.addEventListener('click', async () => {
    const result = await loadResults();
    toast(result.ok ? 'Respostas atualizadas' : 'Sem resultados novos');
    if (openAgent === agent.id) renderAgent(body, agent.id);
  });
  row.append(send, refresh);
  if (hasWebhook()) {
    const retry = document.createElement('button');
    retry.className = 'ghost';
    retry.type = 'button';
    retry.textContent = 'Enviar pendentes';
    retry.addEventListener('click', async () => {
      await retryPending();
      toast('Fila revista');
      if (openAgent === agent.id) renderAgent(body, agent.id);
    });
    row.appendChild(retry);
  }
  const listTitle = document.createElement('h3');
  listTitle.textContent = 'Tarefas';
  const tasks = listTasks(agent.id).slice().reverse();
  body.append(field, area, row, listTitle);
  if (!tasks.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Nenhuma tarefa ainda.';
    body.appendChild(empty);
    return;
  }
  for (const task of tasks) {
    const block = document.createElement('article');
    block.className = 'task';
    const meta = document.createElement('div');
    meta.className = `status ${statusClass(task.status)}`;
    meta.textContent = `${fmt(task.createdAt)} · ${task.status}`;
    const text = document.createElement('p');
    text.textContent = task.text;
    block.append(meta, text);
    if (task.response) {
      const reply = document.createElement('div');
      reply.className = 'reply';
      reply.textContent = task.response;
      block.appendChild(reply);
    }
    body.appendChild(block);
  }
}

function updateChrome() {
  const room = ROOMS[game.roomId()];
  document.getElementById('room-label').textContent = room.name;
  const count = game.inventory().length;
  const badge = document.getElementById('bag-count');
  badge.hidden = count === 0;
  badge.textContent = String(count);
  const mode = game.getMode();
  document.getElementById('tool-move').setAttribute('aria-pressed', String(mode === 'move'));
  const bar = document.getElementById('context');
  const label = document.getElementById('context-label');
  const pickup = document.getElementById('ctx-pickup');
  const cancel = document.getElementById('ctx-cancel');
  if (mode === 'place') {
    bar.hidden = false;
    label.textContent = 'Escolha o piso';
    pickup.hidden = true;
    cancel.hidden = false;
  } else if (mode === 'move') {
    bar.hidden = false;
    label.textContent = 'Arraste um móvel';
    pickup.hidden = false;
    cancel.hidden = true;
  } else {
    bar.hidden = true;
  }
}

function openAgentCard(avatar) {
  if (avatar.kind === 'player') {
    openWindow('me', 'Kauan', (body) => renderAgent(body, 'kauan'));
    return;
  }
  openAgent = avatar.id;
  markRead(avatar.id).catch(() => {});
  openWindow('agent', avatar.name, (body) => renderAgent(body, avatar.id));
}

export function startApp({ firstRun, connected }) {
  look = { ...DEFAULT_LOOK, motto: 'No escritório.', ...(readJson(AVATAR_KEY) || {}) };
  document.getElementById('lock').hidden = true;
  document.getElementById('app').hidden = false;
  const pill = document.getElementById('link-pill');
  pill.textContent = connected ? 'Conexão pronta' : 'Sem conexão';
  pill.classList.toggle('live', connected);
  if (firstRun) {
    const banner = document.getElementById('banner');
    document.getElementById('banner-text').textContent = 'Primeira execução neste navegador. Não há config.enc.json: as tarefas ficam só aqui, como “aguardando conexão”, até a fase 2.';
    banner.hidden = false;
  }
  document.getElementById('banner-close').addEventListener('click', () => {
    document.getElementById('banner').hidden = true;
  });

  game = mount(document.getElementById('view'), document.getElementById('bubbles'), (event, payload) => {
    if (event === 'toast') toast(payload);
    if (event === 'avatar') openAgentCard(payload);
    if (event === 'room' || event === 'mode' || event === 'inventory' || event === 'selection') updateChrome();
    if (event === 'chat') {
      const talk = windows.get('talk');
      if (talk && !talk.hidden) renderTalk(talk.querySelector('.body'));
    }
    if (event === 'escape') {
      const top = [...windows.values()].sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
      if (top) closeWindow(top.dataset.id);
    }
    if (event === 'inventory' && windows.get('bag')) renderBag(windows.get('bag').querySelector('.body'));
  });
  game.setLook(look);
  updateChrome();

  document.getElementById('chat').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    game.say(input.value);
    input.value = '';
  });
  document.getElementById('tool-wave').addEventListener('click', () => game.wave());
  document.getElementById('tool-sit').addEventListener('click', () => game.sit());
  document.getElementById('tool-dance').addEventListener('click', () => game.dance());
  document.getElementById('tool-move').addEventListener('click', () => {
    game.setMode(game.getMode() === 'move' ? 'play' : 'move');
  });
  document.getElementById('tool-lock').addEventListener('click', () => {
    location.reload();
  });
  document.getElementById('ctx-rotate').addEventListener('click', () => game.rotate());
  document.getElementById('ctx-pickup').addEventListener('click', () => game.pickup());
  document.getElementById('ctx-cancel').addEventListener('click', () => game.cancelPlace());

  document.querySelectorAll('[data-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.open;
      const titles = {
        rooms: 'Salas',
        catalog: 'Catálogo',
        bag: 'Mochila',
        look: 'Visual',
        talk: 'Conversa',
        help: 'Ajuda',
      };
      const render = {
        rooms: renderRooms,
        catalog: renderCatalog,
        bag: renderBag,
        look: renderLook,
        talk: renderTalk,
        help: renderHelp,
      }[id];
      openWindow(id, titles[id], render);
    });
  });

  subscribe(() => {
    if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
    if (openAgent && windows.get('agent')) {
      const body = windows.get('agent').querySelector('.body');
      renderAgent(body, openAgent);
    }
  });

  loadResults().catch(() => {});
  setInterval(() => { loadResults().catch(() => {}); }, 60000);
}

export function animateLock() {
  const canvas = document.getElementById('lock-preview');
  if (!canvas) return;
  const lookPreview = { ...DEFAULT_LOOK };
  let frame = 0;
  function tick() {
    if (document.getElementById('app') && !document.getElementById('app').hidden) return;
    paintAvatarPreview(canvas, lookPreview, frame % 8 < 4 ? 'wave' : 'idle');
    frame += 1;
    setTimeout(tick, 420);
  }
  tick();
}
