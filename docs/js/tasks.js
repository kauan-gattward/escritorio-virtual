import { AGENT_MAP } from './content.js';
import { sessionDecrypt, sessionEncrypt } from './crypto.js';
import { TASKS_KEY, readJson, writeJson } from './persist.js';

const listeners = new Set();
let tasks = [];
let taskSalt = null;
let config = null;

export function setTaskConfig(next) {
  config = next && next.webhookUrl && next.senderKey ? next : null;
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
  if (mine.some((task) => task.status === 'aguardando conexão' || task.status === 'enviada' || task.status === 'trabalhando')) {
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

function payload(task) {
  return {
    agent: task.agent,
    text: task.text,
    id: task.id,
    createdAt: task.createdAt,
  };
}

async function postTask(task) {
  const header = config.senderKeyHeader || 'X-Escritorio-Key';
  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [header]: config.senderKey,
    },
    body: JSON.stringify(payload(task)),
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('http');
}

export async function sendTask(agent, text) {
  const name = String(agent || '').trim();
  const body = String(text || '').trim();
  if (!AGENT_MAP[name]) throw new Error('agent');
  if (!body) throw new Error('empty');
  const task = {
    id: `task_${crypto.randomUUID()}`,
    agent: name,
    text: body.slice(0, 2000),
    createdAt: new Date().toISOString(),
    status: 'aguardando conexão',
    response: null,
    updatedAt: null,
    unread: false,
  };
  if (config) {
    try {
      await postTask(task);
      task.status = 'enviada';
    } catch {
      task.status = 'aguardando conexão';
    }
  }
  tasks.push(task);
  await save();
  emit();
  return task;
}

export async function retryPending() {
  if (!config) return false;
  let changed = false;
  for (const task of tasks) {
    if (task.status !== 'aguardando conexão') continue;
    try {
      await postTask(task);
      task.status = 'enviada';
      changed = true;
    } catch {
      task.status = 'aguardando conexão';
    }
  }
  if (changed) await save();
  emit();
  return changed;
}

function mapStatus(status) {
  if (status === 'done') return 'resposta pronta';
  if (status === 'error') return 'erro';
  if (status === 'working') return 'trabalhando';
  return 'trabalhando';
}

export async function loadResults() {
  let response;
  try {
    response = await fetch('./data/results.enc.json', { cache: 'no-store' });
  } catch {
    return { ok: false, reason: 'rede' };
  }
  if (response.status === 404) return { ok: true, empty: true };
  if (!response.ok) return { ok: false, reason: 'http' };
  let envelope;
  try {
    envelope = await response.json();
  } catch {
    return { ok: false, reason: 'json' };
  }
  let data;
  try {
    data = await sessionDecrypt(envelope);
  } catch {
    return { ok: false, reason: 'auth' };
  }
  if (!data || data.v !== 1 || !Array.isArray(data.results)) return { ok: false, reason: 'formato' };
  let changed = false;
  for (const result of data.results) {
    if (!result || typeof result.id !== 'string' || typeof result.agent !== 'string') continue;
    let task = tasks.find((item) => item.id === result.id);
    if (!task) {
      task = {
        id: result.id,
        agent: result.agent,
        text: '(tarefa registrada fora deste aparelho)',
        createdAt: result.updatedAt || new Date().toISOString(),
        status: 'enviada',
        response: null,
        updatedAt: null,
        unread: false,
      };
      tasks.push(task);
      changed = true;
    }
    const next = mapStatus(result.status);
    const reply = typeof result.response === 'string' ? result.response : '';
    if (task.status !== next || task.response !== reply) {
      task.status = next;
      task.response = reply;
      task.updatedAt = result.updatedAt || new Date().toISOString();
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
  emit();
}
