import { sessionDecrypt, sessionEncrypt } from './crypto.js';
import { readJson, writeJson } from './persist.js';

export const VAULT_KEY = 'escritorio.vault.v1';

export const DEFAULT_PROJECTS = [
  { id: 'blue', name: 'Blue Ocean Flats', url: '', status: 'Em andamento', next: 'Definir o próximo passo' },
  { id: 'sereia', name: 'Vida de Sereia', url: '', status: 'Em andamento', next: 'Definir o próximo passo' },
  { id: 'futveco', name: 'Futveco', url: '', status: 'Em andamento', next: 'Definir o próximo passo' },
  { id: 'pepita', name: 'Pepita do Dia', url: '', status: 'Em andamento', next: 'Definir o próximo passo' },
  { id: 'leads', name: 'Leads app', url: '', status: 'Em andamento', next: 'Definir o próximo passo' },
];

export function blankVault() {
  return {
    v: 1,
    connection: { webhookUrl: '', senderKey: '', senderKeyHeader: 'Authorization' },
    notes: '',
    todos: [],
    goals: [],
    visitors: [],
    notices: [],
    meetingNotes: '',
    finances: '',
    links: [],
    projects: DEFAULT_PROJECTS.map((item) => ({ ...item })),
    archive: [],
    mood: 'foco',
    music: false,
    calendar: [],
    pomodoro: { running: false, mode: 'foco', endsAt: 0 },
  };
}

let vault = blankVault();
let salt = null;
const listeners = new Set();

export function getVault() {
  return vault;
}

export function subscribeVault(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(vault);
}

export async function loadVault() {
  const raw = readJson(VAULT_KEY);
  if (!raw) {
    vault = blankVault();
    salt = null;
    await saveVault();
    return vault;
  }
  try {
    const data = await sessionDecrypt(raw);
    vault = { ...blankVault(), ...data, connection: { ...blankVault().connection, ...(data.connection || {}) } };
    if (!Array.isArray(vault.projects) || vault.projects.length === 0) vault.projects = blankVault().projects;
    salt = raw.salt || null;
  } catch {
    vault = blankVault();
    salt = null;
    await saveVault();
  }
  emit();
  return vault;
}

export async function saveVault() {
  const envelope = await sessionEncrypt(vault, salt ? { salt } : {});
  salt = envelope.salt;
  writeJson(VAULT_KEY, envelope);
  emit();
}

export async function patchVault(partial) {
  vault = { ...vault, ...partial };
  if (partial.connection) vault.connection = { ...vault.connection, ...partial.connection };
  await saveVault();
  return vault;
}

export function uid(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
