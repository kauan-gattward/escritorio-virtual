import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encryptObject } from '../docs/js/crypto.js';

function fail(code) {
  console.error(code ? `FAIL ${code}` : 'FAIL');
  process.exit(1);
}

const password = process.env.OFFICE_APP_PASSWORD;
if (typeof password !== 'string' || password.length === 0) fail('senha');

const args = process.argv.slice(2);
let inputPath = '';
let outputPath = '';
if (args[0] === 'config' || args[0] === 'results' || args[0] === 'decrypt') {
  inputPath = args[1] || '';
  outputPath = args[2] || '';
  if (args[0] === 'decrypt') fail('uso');
} else {
  inputPath = args[0] || '';
  outputPath = args[1] || '';
}
if (!inputPath || !outputPath) fail('uso');

try {
  const json = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  if (!json || typeof json !== 'object' || Array.isArray(json)) fail('formato');
  const envelope = await encryptObject(password, json);
  await writeFile(resolve(outputPath), `${JSON.stringify(envelope, null, 2)}\n`);
  console.log(`escreveu ${resolve(outputPath)}`);
} catch (error) {
  if (error && (error.message === 'formato' || error instanceof SyntaxError)) fail('formato');
  fail();
}
