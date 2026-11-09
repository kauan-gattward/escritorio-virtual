import { decryptObject, encryptObject, openSession, closeSession } from './crypto.js';
import { VERIFIER_KEY, readJson, writeJson } from './persist.js';
import { clearMemory, loadTaskStore, setTaskConfig } from './tasks.js';
import { animateLock, startApp } from './ui.js';

const VERIFIER_PLAIN = { v: 1, kind: 'verifier', office: 'escritorio' };

animateLock();

const form = document.getElementById('lock-form');
const input = document.getElementById('password');
const error = document.getElementById('lock-error');
const button = document.getElementById('enter');

async function unlock(password) {
  const response = await fetch('./data/config.enc.json', { cache: 'no-store' });
  let config = null;
  let firstRun = false;
  if (response.ok) {
    const envelope = await response.json();
    config = await decryptObject(password, envelope);
    if (!config || typeof config.webhookUrl !== 'string' || typeof config.senderKey !== 'string') {
      throw new Error('formato');
    }
  } else if (response.status !== 404) {
    throw new Error('rede');
  } else {
    const saved = readJson(VERIFIER_KEY);
    if (saved) {
      const check = await decryptObject(password, saved);
      if (!check || check.office !== 'escritorio') throw new Error('auth');
    } else {
      firstRun = true;
      const envelope = await encryptObject(password, VERIFIER_PLAIN);
      writeJson(VERIFIER_KEY, envelope);
    }
  }
  openSession(password);
  setTaskConfig(config);
  await loadTaskStore();
  return { firstRun, connected: Boolean(config), config };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.textContent = '';
  const password = input.value;
  if (password.length < 8) {
    error.textContent = 'A senha precisa ter pelo menos 8 caracteres.';
    return;
  }
  button.disabled = true;
  button.textContent = 'Conferindo…';
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    const result = await unlock(password);
    input.value = '';
    startApp(result);
  } catch {
    closeSession();
    clearMemory();
    error.textContent = 'Não foi possível abrir. Senha incorreta ou arquivo inválido.';
  } finally {
    button.disabled = false;
    button.textContent = 'Entrar';
  }
});
