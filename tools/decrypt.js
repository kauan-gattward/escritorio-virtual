import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decryptObject } from '../docs/js/crypto.js';

function fail() {
  console.error('FAIL');
  process.exit(1);
}

const password = process.env.OFFICE_APP_PASSWORD;
const inputPath = process.argv[2];
if (typeof password !== 'string' || password.length === 0 || !inputPath) fail();

try {
  const raw = await readFile(resolve(inputPath), 'utf8');
  const plain = await decryptObject(password, JSON.parse(raw));
  process.stdout.write(`${JSON.stringify(plain, null, 2)}\n`);
} catch {
  fail();
}
