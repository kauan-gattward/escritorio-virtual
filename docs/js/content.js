/** Dados das salas, móveis e colegas. Sem desenho e sem segredo. */

export const CATALOG = {
  escrivaninha: { name: 'Escrivaninha', cat: 'moveis', w: 2, d: 1, blocks: true },
  'mesa-l': { name: 'Mesa em L', cat: 'moveis', w: 3, d: 2, blocks: true },
  'mesa-pe': { name: 'Mesa de pé', cat: 'moveis', w: 2, d: 1, blocks: true },
  cadeira: { name: 'Cadeira', cat: 'moveis', w: 1, d: 1, blocks: true, sit: true },
  'cadeira-gamer': { name: 'Cadeira gamer', cat: 'moveis', w: 1, d: 1, blocks: true, sit: true },
  sofa: { name: 'Sofá', cat: 'moveis', w: 2, d: 1, blocks: true, sit: true },
  poltrona: { name: 'Poltrona', cat: 'moveis', w: 1, d: 1, blocks: true, sit: true },
  puff: { name: 'Puff', cat: 'moveis', w: 1, d: 1, blocks: true, sit: true },
  mesa: { name: 'Mesa de reunião', cat: 'moveis', w: 3, d: 2, blocks: true },
  estante: { name: 'Estante', cat: 'moveis', w: 2, d: 1, blocks: true },
  armario: { name: 'Armário', cat: 'moveis', w: 2, d: 1, blocks: true },
  gaveteiro: { name: 'Arquivo de gavetas', cat: 'moveis', w: 1, d: 1, blocks: true, use: 'archive' },
  divisoria: { name: 'Divisória de vidro', cat: 'moveis', w: 2, d: 1, blocks: true },
  computador: { name: 'Computador', cat: 'eletronicos', w: 1, d: 1, blocks: true, surface: true, anim: true },
  'monitor-duplo': { name: 'Monitor duplo', cat: 'eletronicos', w: 1, d: 1, blocks: true, surface: true, anim: true },
  notebook: { name: 'Notebook', cat: 'eletronicos', w: 1, d: 1, blocks: true, surface: true, anim: true },
  'pc-gamer': { name: 'PC gamer', cat: 'eletronicos', w: 1, d: 1, blocks: true, anim: true },
  'tv-parede': { name: 'TV de parede', cat: 'eletronicos', w: 2, d: 1, blocks: true, anim: true, use: 'tv' },
  'smart-tv': { name: 'Smart TV', cat: 'eletronicos', w: 2, d: 1, blocks: true, anim: true, use: 'tv' },
  projetor: { name: 'Projetor', cat: 'eletronicos', w: 1, d: 1, blocks: true },
  tela: { name: 'Tela de projeção', cat: 'eletronicos', w: 2, d: 1, blocks: true },
  impressora: { name: 'Impressora', cat: 'eletronicos', w: 1, d: 1, blocks: true, use: 'archive' },
  roteador: { name: 'Roteador', cat: 'eletronicos', w: 1, d: 1, blocks: true, anim: true },
  'caixa-som': { name: 'Caixa de som', cat: 'eletronicos', w: 1, d: 1, blocks: true },
  videogame: { name: 'Videogame', cat: 'eletronicos', w: 1, d: 1, blocks: true, anim: true },
  tablet: { name: 'Tablet', cat: 'eletronicos', w: 1, d: 1, blocks: true, surface: true, anim: true },
  celular: { name: 'Celular na mesa', cat: 'eletronicos', w: 1, d: 1, blocks: true, surface: true, anim: true },
  'ar-condicionado': { name: 'Ar-condicionado', cat: 'eletronicos', w: 1, d: 1, blocks: true },
  ventilador: { name: 'Ventilador', cat: 'eletronicos', w: 1, d: 1, blocks: true, anim: true },
  luminaria: { name: 'Luminária de chão', cat: 'decoracao', w: 1, d: 1, blocks: true },
  'luz-mesa': { name: 'Luminária de mesa', cat: 'decoracao', w: 1, d: 1, blocks: true, surface: true },
  neon: { name: 'Letreiro neon', cat: 'decoracao', w: 2, d: 1, blocks: true, anim: true },
  quadro: { name: 'Quadro branco', cat: 'decoracao', w: 2, d: 1, blocks: true },
  cortica: { name: 'Mural de cortiça', cat: 'decoracao', w: 2, d: 1, blocks: true },
  poster: { name: 'Quadro', cat: 'decoracao', w: 1, d: 1, blocks: true },
  relogio: { name: 'Relógio de parede', cat: 'decoracao', w: 1, d: 1, blocks: true },
  vaso: { name: 'Vaso', cat: 'decoracao', w: 1, d: 1, blocks: true },
  cortina: { name: 'Cortina', cat: 'decoracao', w: 2, d: 1, blocks: false },
  persiana: { name: 'Persiana', cat: 'decoracao', w: 2, d: 1, blocks: false },
  tapete: { name: 'Tapete', cat: 'decoracao', w: 3, d: 2, blocks: false, rug: true },
  planta: { name: 'Planta', cat: 'plantas', w: 1, d: 1, blocks: true },
  'planta-alta': { name: 'Planta alta', cat: 'plantas', w: 1, d: 1, blocks: true },
  suculenta: { name: 'Suculenta', cat: 'plantas', w: 1, d: 1, blocks: true, surface: true },
  'planta-mini': { name: 'Vaso pequeno', cat: 'plantas', w: 1, d: 1, blocks: true, surface: true },
  cafe: { name: 'Cafeteira', cat: 'cozinha', w: 1, d: 1, blocks: true, use: 'music' },
  'maquina-cafe': { name: 'Máquina de café', cat: 'cozinha', w: 1, d: 1, blocks: true, use: 'music' },
  microondas: { name: 'Micro-ondas', cat: 'cozinha', w: 1, d: 1, blocks: true, anim: true },
  frigobar: { name: 'Frigobar', cat: 'cozinha', w: 1, d: 1, blocks: true },
  bebedouro: { name: 'Bebedouro', cat: 'cozinha', w: 1, d: 1, blocks: true },
};

export const CATALOG_GROUPS = [
  { id: 'moveis', name: 'Móveis' },
  { id: 'eletronicos', name: 'Eletrônicos' },
  { id: 'decoracao', name: 'Decoração' },
  { id: 'plantas', name: 'Plantas' },
  { id: 'cozinha', name: 'Cozinha' },
];

export const CATALOG_ORDER = Object.keys(CATALOG);

function item(id, type, x, y, rot = 0, label = null) {
  return { id, type, x, y, rot, origin: 'default', label };
}

export const AGENTS = [
  {
    id: 'nexo',
    name: 'Nexo',
    role: 'Recepção',
    motto: 'Uma coisa de cada vez, com clareza.',
    accent: '#0f6e68',
    home: { room: 'recepcao', x: 4, y: 3 },
    look: {
      skin: '#f0c3a0', hair: '#0f6e68', hairStyle: 'side', shirt: '#143646', pants: '#1b1b1b',
      glasses: 'round', robot: false,
    },
  },
  {
    id: 'mochi',
    name: 'Mochi',
    role: 'Cuida do clima',
    motto: 'Devagar também chega.',
    accent: '#a85b78',
    home: { room: 'open', x: 5, y: 3 },
    look: {
      skin: '#f6d3bc', hair: '#7a4634', hairStyle: 'bun', shirt: '#f4efe4', pants: '#3d4a6b',
      blush: true, robot: false,
    },
  },
  {
    id: 'jarvis',
    name: 'Jarvis',
    role: 'Organiza a fila',
    motto: 'O próximo passo já está anotado.',
    accent: '#8c2f2f',
    home: { room: 'open', x: 8, y: 3 },
    look: {
      skin: '#e7c2a2', hair: '#d5dbe2', hairStyle: 'short', shirt: '#2b2f36', pants: '#2b2f36',
      glasses: 'rect', detail: 'tie', robot: false,
    },
  },
  {
    id: 'tati',
    name: 'Tati',
    role: 'Escreve e revisa',
    motto: 'A frase certa cabe numa linha.',
    accent: '#d4654a',
    home: { room: 'open', x: 11, y: 3 },
    look: {
      skin: '#8d5a3c', hair: '#1a120e', hairStyle: 'curly', shirt: '#d4654a', pants: '#2c3338',
      earring: true, robot: false,
    },
  },
  {
    id: 'alex',
    name: 'Alex',
    role: 'Monta e testa',
    motto: 'Se quebrou, a gente vê o porquê.',
    accent: '#3d7a4a',
    home: { room: 'open', x: 2, y: 8 },
    look: {
      skin: '#f0c09a', hair: '#b5522a', hairStyle: 'quiff', shirt: '#3d7a4a', pants: '#243044',
      freckles: true, robot: false,
    },
  },
  {
    id: 'alexandre',
    name: 'Alexandre',
    role: 'Olha o código',
    motto: 'Melhor legível do que esperto.',
    accent: '#2f5f9e',
    home: { room: 'open', x: 5, y: 8 },
    look: {
      skin: '#c48a62', hair: '#1c140f', hairStyle: 'neat', shirt: '#2f5f9e', pants: '#3a2a22',
      beard: true, robot: false,
    },
  },
  {
    id: 'unibot',
    name: 'Unibot',
    role: 'Automações',
    motto: 'Bip. Posso fazer isso de novo.',
    accent: '#7fa89a',
    home: { room: 'open', x: 8, y: 8 },
    look: {
      skin: '#d7ebe3', hair: '#16302c', hairStyle: 'robot', shirt: '#8fbfb0', pants: '#3e564e',
      robot: true,
    },
  },
];

export const AGENT_MAP = Object.fromEntries(AGENTS.map((agent) => [agent.id, agent]));

const recepcao = {
  id: 'recepcao',
  name: 'Recepção',
  blurb: 'Entrada, sofá e café.',
  w: 12,
  h: 10,
  floor: 'marble',
  wall: { fill: '#f4ecdf', shade: '#e3d6c4', trim: '#1e5c55', frame: '#c4a574' },
  spawn: { x: 3, y: 5 },
  doors: [
    { x: 0, y: 5, to: 'open', toX: 1, toY: 6, label: 'Open Office' },
  ],
  furniture: [
    item('rec-sofa', 'sofa', 4, 6, 0),
    item('rec-mesa', 'escrivaninha', 4, 2, 0, 'Recepção'),
    item('rec-cadeira', 'cadeira', 4, 3, 0),
    item('rec-pc', 'computador', 5, 2, 0),
    item('rec-cafe', 'cafe', 9, 2, 0),
    item('rec-planta-a', 'planta', 2, 2, 0),
    item('rec-planta-b', 'planta', 9, 7, 0),
    item('rec-luz', 'luminaria', 2, 7, 0),
    item('rec-quadro', 'quadro', 8, 6, 2),
  ],
};

const open = {
  id: 'open',
  name: 'Open Office',
  blurb: 'A mesa de cada agente.',
  w: 14,
  h: 12,
  floor: 'carpet',
  wall: { fill: '#e7efe9', shade: '#d3e0d8', trim: '#1e5c55', frame: '#8d9a90' },
  spawn: { x: 2, y: 6 },
  doors: [
    { x: 0, y: 6, to: 'recepcao', toX: 1, toY: 5, label: 'Recepção' },
    { x: 4, y: 0, to: 'reuniao', toX: 5, toY: 1, label: 'Sala de Reunião' },
    { x: 11, y: 0, to: 'kauan', toX: 5, toY: 1, label: 'Sala do Kauan' },
  ],
  furniture: [
    item('desk-nexo', 'escrivaninha', 2, 2, 0, 'Nexo'),
    item('chair-nexo', 'cadeira', 2, 3, 0),
    item('pc-nexo', 'computador', 3, 2, 0),
    item('desk-mochi', 'escrivaninha', 5, 2, 0, 'Mochi'),
    item('chair-mochi', 'cadeira', 5, 3, 0),
    item('pc-mochi', 'computador', 6, 2, 0),
    item('desk-jarvis', 'escrivaninha', 8, 2, 0, 'Jarvis'),
    item('chair-jarvis', 'cadeira', 8, 3, 0),
    item('pc-jarvis', 'computador', 9, 2, 0),
    item('desk-tati', 'escrivaninha', 11, 2, 0, 'Tati'),
    item('chair-tati', 'cadeira', 11, 3, 0),
    item('pc-tati', 'computador', 12, 2, 0),
    item('desk-alex', 'escrivaninha', 2, 7, 0, 'Alex'),
    item('chair-alex', 'cadeira', 2, 8, 0),
    item('pc-alex', 'computador', 3, 7, 0),
    item('desk-alexandre', 'escrivaninha', 5, 7, 0, 'Alexandre'),
    item('chair-alexandre', 'cadeira', 5, 8, 0),
    item('pc-alexandre', 'computador', 6, 7, 0),
    item('desk-unibot', 'escrivaninha', 8, 7, 0, 'Unibot'),
    item('chair-unibot', 'cadeira', 8, 8, 0),
    item('pc-unibot', 'computador', 9, 7, 0),
    item('open-planta-a', 'planta', 1, 10, 0),
    item('open-planta-b', 'planta', 12, 10, 0),
    item('open-planta-c', 'planta', 1, 1, 0),
    item('open-luz', 'luminaria', 12, 5, 0),
    item('open-cafe', 'cafe', 12, 8, 0),
  ],
};

const reuniao = {
  id: 'reuniao',
  name: 'Sala de Reunião',
  blurb: 'Mesa grande e quadro branco.',
  w: 12,
  h: 10,
  floor: 'wood',
  wall: { fill: '#f6f1e6', shade: '#e6dccb', trim: '#8c3d32', frame: '#b5814a' },
  spawn: { x: 2, y: 7 },
  doors: [
    { x: 5, y: 0, to: 'open', toX: 4, toY: 1, label: 'Open Office' },
  ],
  furniture: [
    item('reu-mesa', 'mesa', 4, 4, 0),
    item('reu-c1', 'cadeira', 4, 3, 2),
    item('reu-c2', 'cadeira', 5, 3, 2),
    item('reu-c3', 'cadeira', 6, 3, 2),
    item('reu-c4', 'cadeira', 4, 6, 0),
    item('reu-c5', 'cadeira', 6, 6, 0),
    item('reu-c6', 'cadeira', 3, 4, 1),
    item('reu-c7', 'cadeira', 7, 5, 3),
    item('reu-quadro', 'quadro', 8, 2, 0),
    item('reu-luz', 'luminaria', 2, 2, 0),
    item('reu-planta', 'planta', 2, 8, 0),
    item('reu-cafe', 'cafe', 9, 7, 0),
  ],
};

const kauan = {
  id: 'kauan',
  name: 'Sala do Kauan',
  blurb: 'Sua sala.',
  w: 10,
  h: 10,
  floor: 'warm',
  wall: { fill: '#f7f1e6', shade: '#eadfcd', trim: '#c4542c', frame: '#c4a574' },
  spawn: { x: 6, y: 4 },
  doors: [
    { x: 5, y: 0, to: 'open', toX: 11, toY: 1, label: 'Open Office' },
  ],
  furniture: [
    item('kau-sofa', 'sofa', 2, 6, 0),
    item('kau-mesa', 'escrivaninha', 2, 2, 0, 'Kauan'),
    item('kau-cadeira', 'cadeira', 2, 3, 0),
    item('kau-pc', 'computador', 3, 2, 0),
    item('kau-luz', 'luminaria', 6, 2, 0),
    item('kau-planta', 'planta', 8, 2, 0),
    item('kau-cafe', 'cafe', 8, 7, 0),
    item('kau-extra', 'cadeira', 6, 6, 2),
    item('kau-quadro', 'quadro', 6, 8, 2),
  ],
};

export const ROOM_LIST = [recepcao, open, reuniao, kauan];
export const ROOMS = Object.fromEntries(ROOM_LIST.map((room) => [room.id, room]));

export const DEFAULT_LOOK = {
  skin: '#c68642',
  hair: '#1a120e',
  hairStyle: 'short',
  shirt: '#f4efe6',
  pants: '#243044',
  glasses: null,
  robot: false,
};

export function cloneDefaultLayout() {
  const rooms = {};
  for (const room of ROOM_LIST) {
    rooms[room.id] = room.furniture.map((it) => ({ ...it, fromRoom: room.id }));
  }
  return rooms;
}
