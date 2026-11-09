import { AGENTS } from './content.js';
import { listTasks, presence, sendMeeting, sendTask, takeCorsWarning } from './tasks.js';
import { getVault, patchVault, uid } from './vault.js';
import { setMusic } from './music.js';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (value != null) node.setAttribute(key, String(value));
  }
  for (const child of children) node.append(child);
  return node;
}

function field(label, node) {
  const wrap = el('label', { class: 'stack' });
  wrap.append(el('strong', { text: label }), node);
  return wrap;
}

function fmt(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function refresh(body, render) {
  body.replaceChildren();
  render(body);
}

async function afterSend(delivery, toast) {
  const note = takeCorsWarning(delivery);
  if (note) toast(note);
  else if (delivery?.queued) toast(delivery.error ? 'Falha ao enviar. Ficou na fila.' : 'Aguardando conexão');
  else toast('Tarefa enviada');
}

export function renderReception(body, { toast }) {
  body.replaceChildren();
  const vault = getVault();
  const today = new Date().toISOString().slice(0, 10);
  body.append(el('h3', { text: 'Hoje' }));
  const events = vault.calendar.filter((item) => item.date === today);
  if (!events.length) body.append(el('p', { class: 'muted', text: 'Nada na agenda de hoje.' }));
  for (const event of events) body.append(el('p', { text: event.text }));
  body.append(el('h3', { text: 'Pendências' }));
  for (const agent of AGENTS) {
    const open = listTasks(agent.id).filter((task) => task.status !== 'resposta pronta').length;
    body.append(el('p', { text: `${agent.name}: ${presence(agent.id)} · ${open} em aberto` }));
  }
  const name = el('input', { id: 'visit-name', maxlength: '80', placeholder: 'Nome' });
  const phone = el('input', { id: 'visit-phone', maxlength: '40', placeholder: 'Telefone' });
  const origin = el('input', { id: 'visit-origin', maxlength: '80', placeholder: 'Origem' });
  const add = el('button', { class: 'primary', type: 'button', text: 'Registrar visita' });
  add.addEventListener('click', async () => {
    if (!name.value.trim()) return;
    const visitors = getVault().visitors.concat({
      id: uid('vis'), name: name.value.trim(), phone: phone.value.trim(), origem: origin.value.trim(), at: new Date().toISOString(),
    });
    await patchVault({ visitors });
    toast('Visita registrada');
    renderReception(body, { toast });
  });
  body.append(el('h3', { text: 'Visitantes' }), field('Nome', name), field('Telefone', phone), field('Origem', origin), add);
  const list = [...getVault().visitors].reverse().slice(0, 12);
  if (!list.length) body.append(el('p', { class: 'muted', text: 'Ninguém passou ainda.' }));
  for (const visit of list) {
    body.append(el('p', { text: `${fmt(visit.at)} · ${visit.name} · ${visit.phone} · ${visit.origem}` }));
  }
}

export function renderNotices(body, { toast }) {
  body.replaceChildren();
  const input = el('textarea', { rows: '3', maxlength: '400', placeholder: 'Aviso para o escritório' });
  const add = el('button', { class: 'primary', type: 'button', text: 'Publicar' });
  add.addEventListener('click', async () => {
    if (!input.value.trim()) return;
    await patchVault({ notices: getVault().notices.concat({ id: uid('note'), text: input.value.trim(), at: new Date().toISOString() }) });
    toast('Aviso no mural');
    renderNotices(body, { toast });
  });
  body.append(input, add);
  for (const notice of [...getVault().notices].reverse()) {
    body.append(el('article', { class: 'task' }, [
      el('div', { class: 'status wait', text: fmt(notice.at) }),
      el('p', { text: notice.text }),
    ]));
  }
}

export function renderKanban(body) {
  body.replaceChildren();
  const columns = [
    ['A fazer', (task) => task.status === 'aguardando conexão'],
    ['Fazendo', (task) => task.status === 'enviada' || task.status === 'trabalhando'],
    ['Feito', (task) => task.status === 'resposta pronta' || task.status === 'erro'],
  ];
  const grid = el('div', { class: 'kanban' });
  for (const [title, match] of columns) {
    const col = el('section', { class: 'kanban-col' });
    col.append(el('h3', { text: title }));
    const items = listTasks().filter(match).slice(-12).reverse();
    if (!items.length) col.append(el('p', { class: 'muted', text: 'Vazio' }));
    for (const task of items) {
      col.append(el('article', { class: 'task' }, [
        el('strong', { text: task.agent }),
        el('p', { text: task.text }),
      ]));
    }
    grid.append(col);
  }
  body.append(grid);
}

export function renderMeeting(body, { toast }) {
  body.replaceChildren();
  const picks = el('div', { class: 'stack' });
  for (const agent of AGENTS) {
    const label = el('label', { class: 'check' });
    const box = el('input', { type: 'checkbox', value: agent.id });
    if (['nexo', 'tati', 'jarvis'].includes(agent.id)) box.checked = true;
    label.append(box, document.createTextNode(` ${agent.name}`));
    picks.append(label);
  }
  const text = el('textarea', { rows: '3', maxlength: '2000', placeholder: 'Pergunta para a mesa' });
  const start = el('button', { class: 'primary', type: 'button', text: 'Começar reunião' });
  const clock = el('p', { id: 'meet-clock', class: 'status ready', text: 'Timer parado' });
  start.addEventListener('click', async () => {
    const agents = [...picks.querySelectorAll('input:checked')].map((node) => node.value);
    if (!agents.length || !text.value.trim()) {
      toast('Escolha pessoas e escreva a pergunta');
      return;
    }
    const began = Date.now();
    window.clearInterval(renderMeeting.tick);
    renderMeeting.tick = window.setInterval(() => {
      const node = document.getElementById('meet-clock');
      if (!node) { window.clearInterval(renderMeeting.tick); return; }
      const sec = Math.floor((Date.now() - began) / 1000);
      node.textContent = `Reunião ${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    }, 500);
    const result = await sendMeeting(agents, text.value.trim(), 'reuniao');
    const cors = result.sent.some((item) => item.delivery?.via === 'no-cors');
    toast(cors ? 'Reunião enviada sem leitura da resposta (CORS).' : 'Reunião enviada');
    renderMeeting(body, { toast });
    const node = document.getElementById('meet-clock');
    if (node) node.textContent = 'Reunião em curso';
  });
  body.append(el('h3', { text: 'Quem participa' }), picks, text, start, clock, el('h3', { text: 'Respostas' }));
  const meetings = new Map();
  for (const task of listTasks()) {
    if (!task.meetingId) continue;
    if (!meetings.has(task.meetingId)) meetings.set(task.meetingId, []);
    meetings.get(task.meetingId).push(task);
  }
  const rows = [...meetings.values()].reverse().slice(0, 3);
  if (!rows.length) body.append(el('p', { class: 'muted', text: 'Nenhuma reunião ainda.' }));
  for (const group of rows) {
    const board = el('div', { class: 'kanban' });
    for (const task of group) {
      board.append(el('article', { class: 'task' }, [
        el('strong', { text: task.agent }),
        el('div', { class: 'status wait', text: task.status }),
        el('p', { text: task.response || task.text }),
      ]));
    }
    body.append(board);
  }
}

export function renderBoard(body, { toast }) {
  body.replaceChildren();
  const area = el('textarea', { rows: '8', maxlength: '4000' });
  area.value = getVault().meetingNotes;
  const save = el('button', { class: 'primary', type: 'button', text: 'Guardar quadro' });
  save.addEventListener('click', async () => {
    await patchVault({ meetingNotes: area.value });
    toast('Quadro guardado');
  });
  body.append(area, save);
}

function textTool(key, title, placeholder) {
  return (body, { toast }) => {
    body.replaceChildren();
    const area = el('textarea', { rows: '8', maxlength: '8000', placeholder });
    area.value = getVault()[key] || '';
    const save = el('button', { class: 'primary', type: 'button', text: 'Guardar' });
    save.addEventListener('click', async () => {
      await patchVault({ [key]: area.value });
      toast(`${title} guardado`);
    });
    body.append(el('h3', { text: title }), area, save);
  };
}

export const renderNotes = textTool('notes', 'Notas', 'Anote aqui');
export const renderFinances = textTool('finances', 'Vendas e contas', 'Valor, cliente, observação');

export function renderGoals(body, { toast }) {
  listEditor(body, { toast, key: 'goals', title: 'Metas', placeholder: 'Nova meta' });
}

export function renderTodos(body, { toast }) {
  listEditor(body, { toast, key: 'todos', title: 'Lista', placeholder: 'Nova tarefa pessoal' });
}

function listEditor(body, { toast, key, title, placeholder }) {
  body.replaceChildren();
  const input = el('input', { maxlength: '160', placeholder });
  const add = el('button', { class: 'primary', type: 'button', text: 'Adicionar' });
  add.addEventListener('click', async () => {
    if (!input.value.trim()) return;
    const items = getVault()[key].concat({ id: uid('item'), text: input.value.trim(), done: false });
    await patchVault({ [key]: items });
    toast('Adicionado');
    listEditor(body, { toast, key, title, placeholder });
  });
  body.append(el('h3', { text: title }), input, add);
  for (const item of getVault()[key]) {
    const row = el('label', { class: 'check' });
    const box = el('input', { type: 'checkbox' });
    box.checked = item.done;
    box.addEventListener('change', async () => {
      const items = getVault()[key].map((entry) => entry.id === item.id ? { ...entry, done: box.checked } : entry);
      await patchVault({ [key]: items });
    });
    row.append(box, document.createTextNode(` ${item.text}`));
    body.append(row);
  }
}

export function renderPomodoro(body, { toast }) {
  body.replaceChildren();
  const clock = el('p', { class: 'who', text: '25:00' });
  const paint = () => {
    const current = getVault().pomodoro;
    const left = current.running ? Math.max(0, current.endsAt - Date.now()) : (current.mode === 'pausa' ? 5 : 25) * 60000;
    const sec = Math.ceil(left / 1000);
    clock.textContent = `${current.mode} ${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    if (current.running && left <= 0) {
      const next = current.mode === 'foco' ? 'pausa' : 'foco';
      patchVault({ pomodoro: { running: true, mode: next, endsAt: Date.now() + (next === 'foco' ? 25 : 5) * 60000 } });
      toast(next === 'pausa' ? 'Foco concluído. Pausa.' : 'Pausa concluída.');
    }
  };
  paint();
  window.clearInterval(renderPomodoro.tick);
  renderPomodoro.tick = window.setInterval(paint, 500);
  const start = el('button', { class: 'primary', type: 'button', text: getVault().pomodoro.running ? 'Pausar' : 'Começar' });
  start.addEventListener('click', async () => {
    const current = getVault().pomodoro;
    if (current.running) {
      await patchVault({ pomodoro: { ...current, running: false } });
    } else {
      const minutes = current.mode === 'pausa' ? 5 : 25;
      await patchVault({ pomodoro: { running: true, mode: current.mode || 'foco', endsAt: Date.now() + minutes * 60000 } });
    }
    renderPomodoro(body, { toast });
  });
  body.append(clock, start);
}

export function renderLinks(body, { toast }) {
  body.replaceChildren();
  const label = el('input', { maxlength: '60', placeholder: 'Nome' });
  const url = el('input', { maxlength: '300', placeholder: 'https://' });
  const add = el('button', { class: 'primary', type: 'button', text: 'Guardar link' });
  add.addEventListener('click', async () => {
    if (!label.value.trim()) return;
    await patchVault({ links: getVault().links.concat({ id: uid('link'), label: label.value.trim(), url: url.value.trim() }) });
    toast('Link guardado');
    renderLinks(body, { toast });
  });
  body.append(label, url, add);
  for (const link of getVault().links) {
    const row = el('p');
    if (link.url) {
      const a = el('a', { href: link.url, target: '_blank', rel: 'noreferrer', text: link.label });
      row.append(a);
    } else row.textContent = link.label;
    body.append(row);
  }
}

export function renderMusic(body, { toast }) {
  body.replaceChildren();
  const on = getVault().music;
  const button = el('button', { class: 'primary', type: 'button', text: on ? 'Parar o lofi' : 'Tocar lofi' });
  button.addEventListener('click', async () => {
    const next = !getVault().music;
    setMusic(next);
    await patchVault({ music: next });
    toast(next ? 'Música baixa ligada' : 'Música pausada');
    renderMusic(body, { toast });
  });
  body.append(el('p', { text: 'Um ruído macio, gerado aqui no navegador. Nada é baixado.' }), button);
}

export function renderMood(body, { toast }) {
  body.replaceChildren();
  const moods = [['foco', 'Foco'], ['pausa', 'Pausa'], ['social', 'Social'], ['cansado', 'Cansado']];
  for (const [id, label] of moods) {
    const button = el('button', { class: 'tiny', type: 'button', text: label });
    if (getVault().mood === id) button.setAttribute('aria-pressed', 'true');
    button.addEventListener('click', async () => {
      await patchVault({ mood: id });
      toast(`Humor: ${label}`);
      renderMood(body, { toast });
    });
    body.append(button);
  }
}

export function renderProjects(body, { toast }) {
  body.replaceChildren();
  for (const project of getVault().projects) {
    const card = el('article', { class: 'task' });
    card.append(el('h3', { text: project.name }));
    const status = el('input', { maxlength: '40', value: project.status });
    const next = el('input', { maxlength: '160', value: project.next });
    const url = el('input', { maxlength: '300', value: project.url, placeholder: 'https://' });
    const save = el('button', { class: 'tiny', type: 'button', text: 'Salvar' });
    save.addEventListener('click', async () => {
      const projects = getVault().projects.map((item) => item.id === project.id
        ? { ...item, status: status.value, next: next.value, url: url.value }
        : item);
      await patchVault({ projects });
      toast(`${project.name} atualizado`);
    });
    card.append(field('Status', status), field('Próximo passo', next), field('Link', url), save);
    if (project.url) card.append(el('a', { href: project.url, target: '_blank', rel: 'noreferrer', text: 'Abrir' }));
    body.append(card);
  }
}

export function renderArchive(body, { toast }) {
  body.replaceChildren();
  const query = el('input', { maxlength: '80', placeholder: 'Buscar no arquivo' });
  const host = el('div');
  const paint = () => {
    host.replaceChildren();
    const q = query.value.trim().toLowerCase();
    const rows = [...getVault().archive].reverse().filter((item) => !q || `${item.title} ${item.body}`.toLowerCase().includes(q));
    if (!rows.length) host.append(el('p', { class: 'muted', text: 'Arquivo vazio.' }));
    for (const item of rows.slice(0, 30)) {
      host.append(el('article', { class: 'task' }, [
        el('strong', { text: item.title }),
        el('p', { text: item.body }),
      ]));
    }
  };
  query.addEventListener('input', paint);
  const title = el('input', { maxlength: '80', placeholder: 'Título' });
  const bodyText = el('textarea', { rows: '3', maxlength: '4000', placeholder: 'Texto ou resposta' });
  const add = el('button', { class: 'primary', type: 'button', text: 'Arquivar' });
  add.addEventListener('click', async () => {
    if (!title.value.trim()) return;
    await patchVault({
      archive: getVault().archive.concat({ id: uid('arc'), title: title.value.trim(), body: bodyText.value.trim(), at: new Date().toISOString() }),
    });
    toast('Arquivado');
    renderArchive(body, { toast });
  });
  const saveReplies = el('button', { class: 'ghost', type: 'button', text: 'Arquivar respostas prontas' });
  saveReplies.addEventListener('click', async () => {
    const extra = listTasks().filter((task) => task.status === 'resposta pronta' && task.response).map((task) => ({
      id: uid('arc'), title: `${task.agent}: ${task.text.slice(0, 48)}`, body: task.response, at: task.updatedAt || new Date().toISOString(),
    }));
    await patchVault({ archive: getVault().archive.concat(extra) });
    toast('Respostas copiadas para o arquivo');
    renderArchive(body, { toast });
  });
  body.append(query, host, title, bodyText, add, saveReplies);
  paint();
}

function safeCalc(expr) {
  const clean = expr.replace(/\s/g, '');
  const tokens = clean.match(/\d+\.?\d*|[+\-*/]/g);
  if (!tokens || tokens.join('') !== clean || tokens.length < 3) return '';
  let acc = Number(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) {
    const n = Number(tokens[i + 1]);
    if (!Number.isFinite(n)) return '';
    if (tokens[i] === '+') acc += n;
    else if (tokens[i] === '-') acc -= n;
    else if (tokens[i] === '*') acc *= n;
    else if (tokens[i] === '/') acc = n === 0 ? NaN : acc / n;
  }
  return Number.isFinite(acc) ? String(acc) : '';
}

export function renderCalc(body) {
  body.replaceChildren();
  const out = el('input', { readonly: 'readonly', value: '0' });
  let acc = '';
  const grid = el('div', { class: 'calc' });
  const keys = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', 'C', '=', '+'];
  for (const key of keys) {
    const button = el('button', { type: 'button', class: 'tiny', text: key });
    button.addEventListener('click', () => {
      if (key === 'C') acc = '';
      else if (key === '=') {
        if (!/^[\d+\-*/. ()]+$/.test(acc)) acc = '';
        else {
          acc = safeCalc(acc);
        }
      } else acc += key;
      out.value = acc || '0';
    });
    grid.append(button);
  }
  body.append(out, grid);
}

export function renderCalendar(body, { toast }) {
  body.replaceChildren();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  body.append(el('h3', { text: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }));
  const grid = el('div', { class: 'cal' });
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < first; i += 1) grid.append(el('span'));
  for (let day = 1; day <= days; day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const has = getVault().calendar.some((item) => item.date === date);
    const button = el('button', { type: 'button', class: 'tiny', text: String(day) });
    if (has) button.setAttribute('aria-pressed', 'true');
    button.addEventListener('click', async () => {
      const text = window.prompt('Nota deste dia', getVault().calendar.find((item) => item.date === date)?.text || '');
      if (text == null) return;
      const calendar = getVault().calendar.filter((item) => item.date !== date);
      if (text.trim()) calendar.push({ id: uid('day'), date, text: text.trim() });
      await patchVault({ calendar });
      toast('Agenda atualizada');
      renderCalendar(body, { toast });
    });
    grid.append(button);
  }
  body.append(grid);
}

export function renderSearch(body) {
  body.replaceChildren();
  const input = el('input', { maxlength: '80', placeholder: 'Buscar tarefas, notas, respostas' });
  const host = el('div');
  const paint = () => {
    host.replaceChildren();
    const q = input.value.trim().toLowerCase();
    if (!q) { host.append(el('p', { class: 'muted', text: 'Digite para buscar.' })); return; }
    const vault = getVault();
    const hits = [];
    for (const task of listTasks()) {
      if (`${task.text} ${task.response || ''} ${task.agent}`.toLowerCase().includes(q)) hits.push(`${task.agent}: ${task.text}`);
    }
    if (vault.notes.toLowerCase().includes(q)) hits.push('Notas pessoais');
    for (const item of vault.todos) if (item.text.toLowerCase().includes(q)) hits.push(`Lista: ${item.text}`);
    for (const item of vault.archive) if (`${item.title} ${item.body}`.toLowerCase().includes(q)) hits.push(`Arquivo: ${item.title}`);
    for (const item of vault.projects) if (`${item.name} ${item.next} ${item.status}`.toLowerCase().includes(q)) hits.push(`Projeto: ${item.name}`);
    if (!hits.length) host.append(el('p', { class: 'muted', text: 'Nada encontrado.' }));
    for (const hit of hits.slice(0, 20)) host.append(el('p', { text: hit }));
  };
  input.addEventListener('input', paint);
  body.append(input, host);
  paint();
}

export function renderQuickTask(body, { toast, room }) {
  body.replaceChildren();
  const select = el('select');
  for (const agent of AGENTS) select.append(el('option', { value: agent.id, text: agent.name }));
  const text = el('textarea', { rows: '3', maxlength: '2000', placeholder: 'Pedido rápido' });
  const send = el('button', { class: 'primary', type: 'button', text: 'Enviar' });
  send.addEventListener('click', async () => {
    if (!text.value.trim()) return;
    const { delivery } = await sendTask(select.value, text.value.trim(), room || '');
    await afterSend(delivery, toast);
    text.value = '';
  });
  body.append(select, text, send);
}

export function renderSettings(body, { toast }) {
  body.replaceChildren();
  const current = getVault().connection;
  const url = el('input', { maxlength: '400', placeholder: 'https://', value: current.webhookUrl });
  const key = el('input', { type: 'password', maxlength: '200', placeholder: 'chave', value: current.senderKey, autocomplete: 'off' });
  const header = el('input', { maxlength: '80', value: current.senderKeyHeader || 'Authorization' });
  const save = el('button', { class: 'primary', type: 'button', text: 'Guardar conexão' });
  save.addEventListener('click', async () => {
    await patchVault({ connection: { webhookUrl: url.value.trim(), senderKey: key.value, senderKeyHeader: header.value.trim() || 'Authorization' } });
    const { retryPending, setTaskConfig } = await import('./tasks.js');
    setTaskConfig(getVault().connection);
    const result = await retryPending();
    toast(result.sent ? `Conexão guardada. ${result.sent} tarefa(s) reenviada(s).` : 'Conexão guardada neste aparelho.');
    if (result.cors) toast('Parte do envio foi sem CORS: a chave não pôde ir no cabeçalho.');
  });
  body.append(
    el('p', { text: 'A URL e a chave ficam cifradas neste navegador. Nada disso entra no Git.' }),
    field('Webhook', url),
    field('Chave', key),
    field('Cabeçalho', header),
    el('p', { class: 'muted', text: 'Padrão: Authorization com o valor Bearer mais a chave. Se o nome não for Authorization, a chave vai crua nesse cabeçalho.' }),
    save,
  );
}

export function renderElevator(body, { floors, current, ride }) {
  body.replaceChildren();
  for (const floor of floors) {
    const button = el('button', { class: 'ghost', type: 'button', text: floor.name });
    if (floor.id === current) button.setAttribute('aria-pressed', 'true');
    button.addEventListener('click', () => ride(floor.id));
    body.append(button);
  }
}

export function toolMenu(body, open) {
  body.replaceChildren();
  const tools = [
    ['notes', 'Notas'],
    ['todos', 'Lista'],
    ['pomodoro', 'Pomodoro'],
    ['calc', 'Calculadora'],
    ['calendar', 'Calendário'],
    ['search', 'Busca'],
    ['quick', 'Pedido rápido'],
  ];
  for (const [id, label] of tools) {
    const button = el('button', { class: 'ghost', type: 'button', text: label });
    button.addEventListener('click', () => open(id));
    body.append(button);
  }
}
