import { AGENT_MAP } from './content.js';
import { sessionDecrypt, sessionEncrypt } from './crypto.js';
import { TASKS_KEY, readJson, writeJson } from './persist.js';

const listeners = new Set();
let tasks = [];
let taskSalt = null;
let config = null;
let warnedCors = false;

const RAW_RESULTS = 'https://raw.githubusercontent.com/kauan-gattward/escritorio-virtual/main/docs/data/results.enc.json';

export function setTaskConfig(next) {
  const url = String(next?.webhookUrl || '').trim();
  const key = String(next?.senderKey || '').trim();
  config = url && key ? {
    webhookUrl: url,
    senderKey: key,
    senderKeyHeader: String(next.senderKeyHeader || 'Authorization').trim() || 'Authorization',
  } : null;
}

export function hasWebhook() {
  return Boolean(config);
}

export function listTasks(agentId) {
  if (!agentId) return tasks.slice();
  return tasks.filter((task) => task.agent === agentId);
}

export function presence(agentId) {
  const mine = listTasks(agentId);
  if (mine.some((task) => task.unread && (task.status === 'resposta pronta' || task.status === 'erro'))) {
    return 'resposta pronta';
  }
  if (mine.some((task) => ['aguardando conexão', 'enviada', 'trabalhando'].includes(task.status))) {
    return 'trabalhando';
  }
  return 'livre';
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(tasks);
}

export async function loadTaskStore() {
  const raw = readJson(TASKS_KEY);
  if (!raw) {
    tasks = [];
    taskSalt = null;
    emit();
    return;
  }
  try {
    const data = await sessionDecrypt(raw);
    tasks = Array.isArray(data?.tasks) ? data.tasks : [];
    taskSalt = raw.salt || null;
  } catch {
    tasks = [];
    taskSalt = null;
  }
  emit();
}

async function save() {
  const envelope = await sessionEncrypt({ v: 1, tasks }, taskSalt ? { salt: taskSalt } : {});
  taskSalt = envelope.salt;
  writeJson(TASKS_KEY, envelope);
}

function headerValue() {
  const name = config.senderKeyHeader || 'Authorization';
  if (name.toLowerCase() === 'authorization') {
    return config.senderKey.startsWith('Bearer ') ? config.senderKey : `Bearer ${config.senderKey}`;
  }
  return config.senderKey;
}

export function taskPayload(task) {
  const body = {
    id: task.id,
    agent: task.agent,
    text: task.text,
    createdAt: task.createdAt,
    room: task.room || '',
  };
  if (task.meetingId) body.meetingId = task.meetingId;
  return body;
}

async function postTask(task) {
  const header = config.senderKeyHeader || 'Authorization';
  const body = taskPayload(task);
  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        [header]: headerValue(),
      },
      body: JSON.stringify(body),
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('http');
    return { via: 'cors' };
  } catch (error) {
    try {
      await fetch(config.webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body),
        referrerPolicy: 'no-referrer',
      });
      return { via: 'no-cors', cors: true, message: error instanceof TypeError ? 'cors' : 'http' };
    } catch {
      throw error;
    }
  }
}

function makeTask(agent, text, room, meetingId) {
  return {
    id: `task_${crypto.randomUUID()}`,
    agent,
    text: String(text || '').trim().slice(0, 2000),
    createdAt: new Date().toISOString(),
    room: room || '',
    meetingId: meetingId || null,
    status: 'aguardando conexão',
    response: null,
    updatedAt: null,
    unread: false,
    lastError: '',
  };
}

async function deliver(task) {
  if (!config) {
    task.status = 'aguardando conexão';
    task.lastError = 'Sem webhook. A tarefa ficou neste aparelho.';
    return { queued: true };
  }
  try {
    const result = await postTask(task);
    task.status = 'enviada';
    task.lastError = result.via === 'no-cors'
      ? 'O navegador bloqueou a leitura da resposta (CORS). O envio foi tentado mesmo assim, sem o cabeçalho da chave.'
      : '';
    return result;
  } catch {
    task.status = 'aguardando conexão';
    task.lastError = 'Falha de rede ou CORS. A tarefa ficou na fila.';
    return { queued: true, error: true };
  }
}

export async function sendTask(agent, text, room, meetingId) {
  const name = String(agent || '').trim();
  const body = String(text || '').trim();
  if (!AGENT_MAP[name]) throw new Error('agent');
  if (!body) throw new Error('empty');
  const task = makeTask(name, body, room, meetingId);
  const delivery = await deliver(task);
  tasks.push(task);
  await save();
  emit();
  return { task, delivery };
}

export async function sendMeeting(agents, text, room = 'reuniao') {
  const meetingId = `meet_${crypto.randomUUID()}`;
  const sent = [];
  for (const agent of agents) {
    sent.push(await sendTask(agent, text, room, meetingId));
  }
  return { meetingId, sent };
}

export async function retryPending() {
  if (!config) return { sent: 0, cors: false };
  let sent = 0;
  let cors = false;
  for (const task of tasks) {
    if (task.status !== 'aguardando conexão') continue;
    const delivery = await deliver(task);
    if (task.status === 'enviada') sent += 1;
    if (delivery?.via === 'no-cors') cors = true;
  }
  await save();
  emit();
  return { sent, cors };
}

function mapStatus(status) {
  if (status === 'resposta pronta' || status === 'done') return 'resposta pronta';
  if (status === 'erro' || status === 'error') return 'erro';
  if (status === 'trabalhando' || status === 'working') return 'trabalhando';
  return 'trabalhando';
}

async function fetchEnvelope() {
  const stamp = Date.now();
  const urls = [
    `./data/results.enc.json?t=${stamp}`,
    `${RAW_RESULTS}?t=${stamp}`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.status === 404) continue;
      if (!response.ok) continue;
      return await response.json();
    } catch {
      /* tenta a próxima origem */
    }
  }
  return null;
}

export async function peekResults(password, decrypt) {
  const envelope = await fetchEnvelope();
  if (!envelope) return null;
  return decrypt(password, envelope);
}

export async function loadResults() {
  const envelope = await fetchEnvelope();
  if (!envelope) return { ok: true, empty: true };
  let data;
  try {
    data = await sessionDecrypt(envelope);
  } catch {
    return { ok: false, reason: 'auth' };
  }
  if (!data || !Array.isArray(data.results)) return { ok: false, reason: 'formato' };
  let changed = false;
  for (const result of data.results) {
    if (!result || typeof result.id !== 'string' || typeof result.agent !== 'string') continue;
    let task = tasks.find((item) => item.id === result.id);
    if (!task) {
      task = {
        id: result.id,
        agent: result.agent,
        text: '(tarefa registrada fora deste aparelho)',
        createdAt: result.updatedAt || data.updatedAt || new Date().toISOString(),
        room: result.room || '',
        meetingId: result.meetingId || null,
        status: 'enviada',
        response: null,
        updatedAt: null,
        unread: false,
        lastError: '',
      };
      tasks.push(task);
      changed = true;
    }
    const next = mapStatus(result.status);
    const reply = typeof result.response === 'string' ? result.response : '';
    if (task.status !== next || task.response !== reply || (result.meetingId && task.meetingId !== result.meetingId)) {
      task.status = next;
      task.response = reply;
      task.updatedAt = result.updatedAt || data.updatedAt || new Date().toISOString();
      if (result.meetingId) task.meetingId = result.meetingId;
      if (next === 'resposta pronta' || next === 'erro') task.unread = true;
      changed = true;
    }
  }
  if (changed) await save();
  emit();
  return { ok: true, changed };
}

export async function markRead(agentId) {
  let changed = false;
  for (const task of tasks) {
    if (task.agent === agentId && task.unread) {
      task.unread = false;
      changed = true;
    }
  }
  if (changed) {
    await save();
    emit();
  }
}

export function clearMemory() {
  tasks = [];
  taskSalt = null;
  config = null;
  warnedCors = false;
  emit();
}

export function takeCorsWarning(delivery) {
  if (delivery?.via !== 'no-cors' || warnedCors) return '';
  warnedCors = true;
  return 'CORS impediu ler a resposta. O envio opaco foi feito sem o cabeçalho da chave e a tarefa foi marcada como enviada.';
}
