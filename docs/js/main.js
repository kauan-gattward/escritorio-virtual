import { decryptObject, openSession, closeSession } from './crypto.js';
import { VERIFIER_KEY, readJson } from './persist.js';
import { clearMemory, loadResults, loadTaskStore, peekResults, retryPending, setTaskConfig } from './tasks.js';
import { VAULT_KEY, getVault, loadVault, patchVault } from './vault.js';
import { animateLock, startApp } from './ui.js';

animateLock();

const form = document.getElementById('lock-form');
const input = document.getElementById('password');
const error = document.getElementById('lock-error');
const button = document.getElementById('enter');

async function unlock(password) {
  let canonical = false;
  try {
    const proved = await peekResults(password, decryptObject);
    if (proved) canonical = true;
  } catch (err) {
    if (err && err.message === 'auth') throw err;
  }
  const vaultRaw = readJson(VAULT_KEY);
  const verifier = readJson(VERIFIER_KEY);
  let firstRun = false;
  if (vaultRaw) {
    try {
      await decryptObject(password, vaultRaw);
    } catch (err) {
      if (!canonical) throw err;
    }
  } else if (!canonical) {
    if (verifier) {
      const check = await decryptObject(password, verifier);
      if (!check || check.office !== 'escritorio') throw new Error('auth');
    } else {
      firstRun = true;
    }
  }
  openSession(password);
  await loadVault();
  try {
    const response = await fetch('./data/config.enc.json', { cache: 'no-store' });
    if (response.ok && !getVault().connection.webhookUrl) {
      const cfg = await decryptObject(password, await response.json());
      if (cfg?.webhookUrl && cfg?.senderKey) {
        await patchVault({
          connection: {
            webhookUrl: cfg.webhookUrl,
            senderKey: cfg.senderKey,
            senderKeyHeader: cfg.senderKeyHeader || 'Authorization',
          },
        });
      }
    }
  } catch {
    /* config antiga ausente ou de outra senha */
  }
  setTaskConfig(getVault().connection);
  await loadTaskStore();
  if (getVault().connection.webhookUrl && getVault().connection.senderKey) {
    await retryPending();
  }
  const connected = Boolean(getVault().connection.webhookUrl && getVault().connection.senderKey);
  return { firstRun, connected };
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
    loadResults().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) loadResults().catch(() => {});
    });
    window.addEventListener('focus', () => loadResults().catch(() => {}));
  } catch {
    closeSession();
    clearMemory();
    error.textContent = 'Não foi possível abrir. Senha incorreta ou arquivo inválido.';
  } finally {
    button.disabled = false;
    button.textContent = 'Entrar';
  }
});
