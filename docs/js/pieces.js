import { CATALOG } from './content.js';
import { footprintCorners, footprintOf } from './iso.js';

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
  return { B2, R2, F2, L2, B, R, F, L };
}

function centerOf(w, d, lift = 0) {
  const c = footprintCorners(w, d);
  return {
    x: (c.B.x + c.R.x + c.F.x + c.L.x) / 4,
    y: (c.B.y + c.R.y + c.F.y + c.L.y) / 4 - lift,
  };
}

const LOOK = {
  'mesa-l': { kind: 'desk', wood: '#d7b07a', h: 30 },
  'mesa-pe': { kind: 'desk', wood: '#c4a574', h: 42 },
  'cadeira-gamer': { kind: 'seat', cloth: '#1b1e28', accent: '#d25a32' },
  poltrona: { kind: 'seat', cloth: '#8d3b32', accent: '#e7c2a2' },
  puff: { kind: 'puff', cloth: '#1e5c55' },
  estante: { kind: 'shelf', wood: '#a56d38' },
  armario: { kind: 'cabinet', wood: '#8d6a3a' },
  gaveteiro: { kind: 'drawers', wood: '#c4a574' },
  divisoria: { kind: 'glass' },
  'monitor-duplo': { kind: 'screens', n: 2, glow: '#9ee0d6' },
  notebook: { kind: 'laptop', glow: '#b7efe4' },
  'pc-gamer': { kind: 'tower', body: '#1b1e28', glow: '#d25a32' },
  'tv-parede': { kind: 'tv', wide: 54, glow: '#8fd0ea' },
  'smart-tv': { kind: 'tv', wide: 62, glow: '#d7c6ff' },
  projetor: { kind: 'projector' },
  tela: { kind: 'screenboard', wide: 58 },
  impressora: { kind: 'printer' },
  roteador: { kind: 'router' },
  'caixa-som': { kind: 'speaker' },
  videogame: { kind: 'console' },
  tablet: { kind: 'slab', glow: '#d5ebe6' },
  celular: { kind: 'phone', glow: '#f3ddb0' },
  'ar-condicionado': { kind: 'ac' },
  ventilador: { kind: 'fan' },
  'luz-mesa': { kind: 'desklamp' },
  neon: { kind: 'neon' },
  cortica: { kind: 'board', face: '#c4a574', ink: '#d25a32' },
  poster: { kind: 'frame' },
  relogio: { kind: 'clock' },
  vaso: { kind: 'vase' },
  cortina: { kind: 'curtain', color: '#6e8a9a' },
  persiana: { kind: 'blind' },
  'planta-alta': { kind: 'plant', pot: '#c4542c', leaf: '#245833', tall: true },
  suculenta: { kind: 'plant', pot: '#e7d3b0', leaf: '#7fa86a', mini: true },
  'planta-mini': { kind: 'plant', pot: '#d25a32', leaf: '#3e8a48', mini: true },
  'maquina-cafe': { kind: 'coffee' },
  microondas: { kind: 'micro' },
  frigobar: { kind: 'fridge' },
  bebedouro: { kind: 'cooler' },
};

export function hasPiece(type) {
  return Boolean(LOOK[type]);
}

export function drawPiece(ctx, type, rot, frame) {
  const spec = LOOK[type];
  const def = CATALOG[type];
  if (!spec || !def) return false;
  ctx.save();
  ctx.scale(1.8, 1.8);
  const fp = footprintOf(def.w, def.d, rot || 0);
  const on = frame % 2 === 1;
  let drawn = false;
  if (spec.kind === 'desk') {
    prism(ctx, fp.w, fp.d, spec.h - 6, 6, spec.wood, '#a56d38', '#7c522c');
    drawn = true;
  } else if (spec.kind === 'seat') {
    prism(ctx, 1, 1, 12, 8, spec.cloth, '#241c16', '#3a3128');
    ctx.fillStyle = spec.accent;
    ctx.fillRect(-6, -34, 12, 10);
    drawn = true;
  } else if (spec.kind === 'puff') {
    prism(ctx, 1, 1, 0, 12, spec.cloth, '#174842', '#143e3b');
    drawn = true;
  } else if (spec.kind === 'shelf' || spec.kind === 'cabinet' || spec.kind === 'drawers') {
    const h = spec.kind === 'drawers' ? 22 : 40;
    prism(ctx, fp.w, fp.d, 0, h, '#e4bc78', spec.wood, '#7c522c');
    ctx.fillStyle = '#f7f3ea';
    const c = centerOf(fp.w, fp.d, h - 6);
    ctx.fillRect(c.x - 10, c.y, 8, 4);
    ctx.fillRect(c.x + 2, c.y, 8, 4);
    drawn = true;
  } else if (spec.kind === 'glass') {
    prism(ctx, fp.w, fp.d, 0, 36, 'rgba(198,230,232,0.55)', 'rgba(150,190,194,0.45)', 'rgba(120,160,168,0.5)');
    drawn = true;
  } else if (spec.kind === 'screens' || spec.kind === 'laptop' || spec.kind === 'slab' || spec.kind === 'phone') {
    const c = centerOf(1, 1, 4);
    const glow = on ? spec.glow : '#5f8f8a';
    if (spec.kind === 'screens') {
      ctx.fillStyle = '#243038';
      ctx.fillRect(c.x - 16, c.y - 22, 14, 16);
      ctx.fillRect(c.x + 2, c.y - 22, 14, 16);
      ctx.fillStyle = glow;
      ctx.fillRect(c.x - 14, c.y - 20, 10, 10);
      ctx.fillRect(c.x + 4, c.y - 20, 10, 10);
    } else if (spec.kind === 'laptop') {
      ctx.fillStyle = '#d9dee3';
      ctx.fillRect(c.x - 12, c.y - 2, 24, 6);
      ctx.fillStyle = '#243038';
      ctx.fillRect(c.x - 10, c.y - 16, 20, 14);
      ctx.fillStyle = glow;
      ctx.fillRect(c.x - 8, c.y - 14, 16, 10);
    } else if (spec.kind === 'phone') {
      ctx.fillStyle = '#241c16';
      ctx.fillRect(c.x - 4, c.y - 12, 8, 14);
      ctx.fillStyle = glow;
      ctx.fillRect(c.x - 3, c.y - 10, 6, 10);
    } else {
      ctx.fillStyle = '#2c3338';
      ctx.fillRect(c.x - 10, c.y - 8, 18, 12);
      ctx.fillStyle = glow;
      ctx.fillRect(c.x - 8, c.y - 6, 14, 8);
    }
    drawn = true;
  } else if (spec.kind === 'tower' || spec.kind === 'console' || spec.kind === 'router' || spec.kind === 'speaker') {
    const h = spec.kind === 'tower' ? 28 : spec.kind === 'speaker' ? 22 : 12;
    prism(ctx, 1, 1, 0, h, '#3a4150', spec.body || '#2c3338', '#1b1e28');
    ctx.fillStyle = on ? (spec.glow || '#3d7a4a') : '#6e6256';
    const c = centerOf(1, 1, h - 4);
    ctx.fillRect(c.x - 2, c.y, 4, 4);
    drawn = true;
  } else if (spec.kind === 'tv' || spec.kind === 'screenboard' || spec.kind === 'board' || spec.kind === 'frame' || spec.kind === 'clock' || spec.kind === 'curtain' || spec.kind === 'blind' || spec.kind === 'neon') {
    const wide = spec.wide || (fp.w > 1 ? 48 : 28);
    const c = centerOf(fp.w, fp.d, 8);
    ctx.fillStyle = '#8e979d';
    ctx.fillRect(c.x - 4, c.y + 8, 4, 16);
    ctx.fillRect(c.x + wide / 4, c.y + 8, 4, 16);
    if (spec.kind === 'tv' || spec.kind === 'screenboard') {
      ctx.fillStyle = '#241c16';
      ctx.fillRect(c.x - wide / 2, c.y - 36, wide, 32);
      ctx.fillStyle = on ? spec.glow || '#d5ebe6' : '#355e66';
      ctx.fillRect(c.x - wide / 2 + 4, c.y - 32, wide - 8, 24);
    } else if (spec.kind === 'neon') {
      ctx.strokeStyle = on ? '#7dffd2' : '#2f6b5a';
      ctx.lineWidth = 3;
      ctx.strokeRect(c.x - 20, c.y - 28, 40, 16);
    } else if (spec.kind === 'clock') {
      ctx.fillStyle = '#f7f3ea';
      ctx.beginPath();
      ctx.arc(c.x, c.y - 16, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#241c16';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 16);
      ctx.lineTo(c.x, c.y - 24);
      ctx.moveTo(c.x, c.y - 16);
      ctx.lineTo(c.x + 6, c.y - 14);
      ctx.stroke();
    } else if (spec.kind === 'curtain' || spec.kind === 'blind') {
      ctx.fillStyle = spec.color || '#d9cbb8';
      ctx.fillRect(c.x - wide / 2, c.y - 40, wide, 36);
      ctx.strokeStyle = 'rgba(36,28,22,0.35)';
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(c.x - wide / 2 + i * (wide / 4), c.y - 40);
        ctx.lineTo(c.x - wide / 2 + i * (wide / 4), c.y - 4);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = spec.face || '#f4efe6';
      ctx.fillRect(c.x - 16, c.y - 34, 32, 26);
      ctx.strokeStyle = spec.ink || '#1e5c55';
      ctx.strokeRect(c.x - 16, c.y - 34, 32, 26);
    }
    drawn = true;
  } else if (spec.kind === 'projector') {
    prism(ctx, 1, 1, 16, 8, '#d9dee3', '#8e979d', '#5c656b');
    ctx.fillStyle = on ? '#f7f3ea' : '#6e6256';
    const c = centerOf(1, 1, 20);
    ctx.fillRect(c.x + 6, c.y, 4, 4);
    drawn = true;
  } else if (spec.kind === 'printer') {
    prism(ctx, 1, 1, 0, 16, '#f7f3ea', '#d9dee3', '#8e979d');
    ctx.fillStyle = '#241c16';
    const c = centerOf(1, 1, 10);
    ctx.fillRect(c.x - 8, c.y - 6, 16, 4);
    drawn = true;
  } else if (spec.kind === 'ac') {
    prism(ctx, 1, 1, 20, 10, '#f7f3ea', '#d9dee3', '#b7c0c6');
    drawn = true;
  } else if (spec.kind === 'fan') {
    const c = centerOf(1, 1, 16);
    ctx.strokeStyle = '#8e979d';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + 16);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    ctx.fillStyle = '#d9dee3';
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(on ? 0.6 : 0);
    ctx.fillRect(-10, -2, 20, 4);
    ctx.fillRect(-2, -10, 4, 20);
    ctx.restore();
    drawn = true;
  } else if (spec.kind === 'desklamp') {
    const c = centerOf(1, 1, 0);
    ctx.strokeStyle = '#8d6a34';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x, c.y - 22);
    ctx.stroke();
    ctx.fillStyle = '#f6f1e6';
    ctx.fillRect(c.x - 8, c.y - 28, 16, 6);
    drawn = true;
  } else if (spec.kind === 'vase' || spec.kind === 'plant') {
    const c = centerOf(1, 1, 0);
    ctx.fillStyle = spec.pot || '#c4a574';
    ctx.fillRect(c.x - (spec.mini ? 5 : 7), c.y - 12, spec.mini ? 10 : 14, 12);
    ctx.fillStyle = spec.leaf || '#2f6b3a';
    const h = spec.tall ? 28 : spec.mini ? 10 : 16;
    ctx.fillRect(c.x - 6, c.y - 12 - h, 12, h);
    ctx.fillRect(c.x - 12, c.y - 12 - h * 0.6, 8, 8);
    drawn = true;
  } else if (spec.kind === 'coffee' || spec.kind === 'micro' || spec.kind === 'fridge' || spec.kind === 'cooler') {
    const h = spec.kind === 'fridge' || spec.kind === 'cooler' ? 32 : 18;
    const body = spec.kind === 'cooler' ? '#d25a32' : spec.kind === 'fridge' ? '#e7eef0' : '#3e3834';
    prism(ctx, 1, 1, 0, h, '#f4efe6', body, '#2a2522');
    ctx.fillStyle = on ? '#e2a23b' : '#6e6256';
    const c = centerOf(1, 1, h - 6);
    ctx.fillRect(c.x - 3, c.y, 4, 4);
    drawn = true;
  }
  ctx.restore();
  return drawn;
}
