/**
 * Envelope AES-GCM. O mesmo arquivo vale no navegador e no Node 22+.
 *
 * Formato (JSON):
 * {
 *   "v": 1,
 *   "alg": "AES-GCM",
 *   "kdf": "PBKDF2",
 *   "hash": "SHA-256",
 *   "iterations": 210000,
 *   "salt": "<base64 de 16 bytes>",
 *   "iv": "<base64 de 12 bytes>",
 *   "ciphertext": "<base64 de ciphertext || tag GCM de 16 bytes>"
 * }
 *
 * A chave é AES-256, derivada da senha com PBKDF2-HMAC-SHA-256.
 * O Web Crypto já grava a tag no fim do ciphertext; não separe a tag.
 */

export const ITERATIONS = 210000;
export const MIN_ITERATIONS = 200000;
export const MAX_ITERATIONS = 5000000;

const keyCache = new Map();
let sessionPassword = null;

export function openSession(password) {
  sessionPassword = password;
  keyCache.clear();
}

export function closeSession() {
  sessionPassword = null;
  keyCache.clear();
}

export function hasSession() {
  return sessionPassword != null;
}

export function bytesToB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < u8.length; i += step) {
    bin += String.fromCharCode(...u8.subarray(i, i + step));
  }
  return btoa(bin);
}

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password, saltBytes, iterations) {
  const cacheId = `${iterations}:${bytesToB64(saltBytes)}:${password.length}:${hashPassword(password)}`;
  if (sessionPassword === password && keyCache.has(cacheId)) return keyCache.get(cacheId);
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  if (sessionPassword === password) keyCache.set(cacheId, key);
  return key;
}

function hashPassword(password) {
  let h = 2166136261;
  for (let i = 0; i < password.length; i += 1) {
    h ^= password.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function checkEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') throw new Error('envelope');
  if (envelope.v !== 1 || envelope.alg !== 'AES-GCM') throw new Error('envelope');
  if (envelope.kdf !== 'PBKDF2' || envelope.hash !== 'SHA-256') throw new Error('envelope');
  const n = envelope.iterations;
  if (!Number.isInteger(n) || n < MIN_ITERATIONS || n > MAX_ITERATIONS) throw new Error('iterations');
  if (typeof envelope.salt !== 'string' || typeof envelope.iv !== 'string') throw new Error('envelope');
  if (typeof envelope.ciphertext !== 'string') throw new Error('envelope');
}

export async function encryptObject(password, value, options = {}) {
  if (typeof password !== 'string' || password.length === 0) throw new Error('password');
  const saltBytes = options.salt ? b64ToBytes(options.salt) : crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = options.iterations || ITERATIONS;
  if (iterations < MIN_ITERATIONS) throw new Error('iterations');
  const key = await deriveKey(password, saltBytes, iterations);
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations,
    salt: bytesToB64(saltBytes),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(cipher),
  };
}

export async function sessionEncrypt(value, options) {
  if (!sessionPassword) throw new Error('session');
  return encryptObject(sessionPassword, value, options);
}

export async function sessionDecrypt(envelope) {
  if (!sessionPassword) throw new Error('session');
  return decryptObject(sessionPassword, envelope);
}

export async function decryptObject(password, envelope) {
  if (typeof password !== 'string' || password.length === 0) throw new Error('password');
  checkEnvelope(envelope);
  const salt = b64ToBytes(envelope.salt);
  const iv = b64ToBytes(envelope.iv);
  const cipher = b64ToBytes(envelope.ciphertext);
  if (salt.length < 16 || iv.length !== 12 || cipher.length < 17) throw new Error('envelope');
  const key = await deriveKey(password, salt, envelope.iterations);
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  } catch {
    throw new Error('auth');
  }
  try {
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error('json');
  }
}
