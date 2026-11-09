export const LAYOUT_KEY = 'escritorio.layout.v1';
export const AVATAR_KEY = 'escritorio.avatar.v1';
export const VERIFIER_KEY = 'escritorio.verifier.v1';
export const TASKS_KEY = 'escritorio.tasks.v1';

export function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key) {
  localStorage.removeItem(key);
}
