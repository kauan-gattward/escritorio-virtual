import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITERATIONS, decryptObject, encryptObject } from '../docs/js/crypto.js';
import { tileToWorld, worldToTile } from '../docs/js/iso.js';
import { validateAll } from '../docs/js/layout.js';
import { findPath } from '../docs/js/path.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PASS = 'selftest-throwaway-password';
const OTHER = 'selftest-other-password';
const SECRET = 'super-secret-webhook-value';

function assert(cond) {
  if (!cond) throw new Error('assert');
}

async function runNode(args, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolvePromise({ code, out, err }));
  });
}

async function testCrypto() {
  assert(ITERATIONS >= 200000);
  const plain = { v: 1, webhookUrl: 'https://example.invalid/hook', senderKey: SECRET };
  const envelope = await encryptObject(PASS, plain);
  assert(envelope.iterations === ITERATIONS);
  assert(envelope.alg === 'AES-GCM');
  assert(envelope.kdf === 'PBKDF2');
  assert(envelope.hash === 'SHA-256');
  const packed = JSON.stringify(envelope);
  assert(!packed.includes(SECRET));
  assert(!packed.includes(PASS));
  const back = await decryptObject(PASS, envelope);
  assert(back.senderKey === SECRET);
  let rejected = false;
  try {
    await decryptObject(OTHER, envelope);
  } catch {
    rejected = true;
  }
  assert(rejected);
  const tampered = { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -4)}AAAA` };
  let tamperRejected = false;
  try {
    await decryptObject(PASS, tampered);
  } catch {
    tamperRejected = true;
  }
  assert(tamperRejected);
}

function testIso() {
  const center = tileToWorld(3, 5);
  const tile = worldToTile(center.x, center.y);
  assert(tile.x === 3 && tile.y === 5);
  const inside = worldToTile(center.x, center.y + 8);
  assert(inside.x === 3 && inside.y === 5);
}

function testPath() {
  const open = findPath(5, 5, () => false, 0, 0, 4, 4, false);
  assert(open && open[0].x === 0 && open[0].y === 0);
  assert(open[open.length - 1].x === 4 && open[open.length - 1].y === 4);
  assert(open.length === 5);
  const blocked = findPath(5, 1, (x) => x === 2, 0, 0, 4, 0, false);
  assert(blocked === null);
  const corner = findPath(2, 2, (x, y) => (x === 1 && y === 0) || (x === 0 && y === 1), 0, 0, 1, 1, false);
  assert(corner === null);
  const same = findPath(3, 3, () => false, 1, 1, 1, 1, false);
  assert(same && same.length === 1);
}

async function testCli() {
  const dir = await mkdtemp(join(tmpdir(), 'escritorio-'));
  try {
    const input = join(dir, 'config.json');
    const output = join(dir, 'config.enc.json');
    const plainPath = join(dir, 'out.json');
    const body = {
      v: 1,
      webhookUrl: 'https://example.invalid/hook',
      senderKey: SECRET,
      senderKeyHeader: 'X-Escritorio-Key',
    };
    await writeFile(input, JSON.stringify(body));
    const encrypted = await runNode(['tools/encrypt.js', 'config', input, output], { OFFICE_APP_PASSWORD: PASS });
    const blob = `${encrypted.out}\n${encrypted.err}\n${await readFile(output, 'utf8')}`;
    assert(encrypted.code === 0);
    assert(!blob.includes(SECRET));
    assert(!blob.includes(PASS));
    assert(encrypted.out.includes('escreveu'));
    const decrypted = await runNode(['tools/encrypt.js', 'decrypt', output, plainPath], { OFFICE_APP_PASSWORD: PASS });
    assert(decrypted.code === 0);
    assert(!decrypted.out.includes(SECRET));
    assert(!decrypted.err.includes(SECRET));
    const round = JSON.parse(await readFile(plainPath, 'utf8'));
    assert(round.senderKey === SECRET);
    const missing = await runNode(['tools/encrypt.js', 'config', input, output], { OFFICE_APP_PASSWORD: '' });
    assert(missing.code === 1);
    assert(missing.out.includes('FAIL') || missing.err.includes('FAIL'));
    assert(!missing.out.includes(SECRET) && !missing.err.includes(SECRET));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

try {
  await testCrypto();
  testIso();
  testPath();
  validateAll();
  await testCli();
  console.log('OK');
} catch {
  console.log('FAIL');
  process.exit(1);
}
