import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decryptObject, encryptObject } from '../docs/js/crypto.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(code) {
  console.error(code ? `FAIL ${code}` : 'FAIL');
  process.exit(1);
}

function assertConfig(value) {
  if (!value || value.v !== 1) throw new Error('formato');
  if (typeof value.webhookUrl !== 'string' || value.webhookUrl.length === 0) throw new Error('formato');
  if (typeof value.senderKey !== 'string' || value.senderKey.length === 0) throw new Error('formato');
  if (value.senderKeyHeader != null && typeof value.senderKeyHeader !== 'string') throw new Error('formato');
}

function assertResults(value) {
  if (!value || value.v !== 1 || !Array.isArray(value.results)) throw new Error('formato');
  for (const result of value.results) {
    if (!result || typeof result.id !== 'string' || typeof result.agent !== 'string') throw new Error('formato');
    if (!['working', 'done', 'error'].includes(result.status)) throw new Error('formato');
    if (typeof result.response !== 'string' || typeof result.updatedAt !== 'string') throw new Error('formato');
  }
}

const password = process.env.OFFICE_APP_PASSWORD;
if (typeof password !== 'string' || password.length === 0) fail('senha');

const [kind, inputPath, outputPath] = process.argv.slice(2);
if (!kind || !inputPath) fail('uso');

try {
  const raw = await readFile(resolve(inputPath), 'utf8');
  const json = JSON.parse(raw);
  if (kind === 'decrypt') {
    if (!outputPath) fail('uso');
    const plain = await decryptObject(password, json);
    await writeFile(resolve(outputPath), `${JSON.stringify(plain, null, 2)}\n`, { mode: 0o600 });
    console.log(`escreveu ${resolve(outputPath)}`);
  } else if (kind === 'config' || kind === 'results') {
    if (kind === 'config') assertConfig(json);
    else assertResults(json);
    const envelope = await encryptObject(password, json);
    const target = outputPath
      ? resolve(outputPath)
      : resolve(root, kind === 'config' ? 'docs/data/config.enc.json' : 'docs/data/results.enc.json');
    await writeFile(target, `${JSON.stringify(envelope, null, 2)}\n`);
    console.log(`escreveu ${target}`);
  } else {
    fail('uso');
  }
} catch (error) {
  if (error && (error.message === 'formato' || error instanceof SyntaxError)) fail('formato');
  fail();
}
