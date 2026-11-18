import { readFile, readdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFile(path.join(root, file), 'utf8');
const manifest = JSON.parse(await read('manifest.json'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['activeTab', 'clipboardWrite']);
for (const key of ['host_permissions', 'content_scripts', 'web_accessible_resources', 'externally_connectable', 'optional_permissions']) {
  assert.equal(manifest[key], undefined, `Unexpected capability: ${key}`);
}
for (const directive of ["default-src 'none'", "script-src 'self' 'wasm-unsafe-eval'", "connect-src 'self'", "worker-src 'self'", "object-src 'none'", "frame-ancestors 'none'"]) {
  assert.ok(manifest.content_security_policy.extension_pages.includes(directive), `Missing CSP: ${directive}`);
}
assert.ok(!/'unsafe-eval'|'unsafe-inline'|https?:/.test(manifest.content_security_policy.extension_pages));
async function* walk(dir) {
  for (const item of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) yield* walk(file); else yield file;
  }
}
let modules = 0;
for await (const file of walk('src')) {
  if (!file.endsWith('.js')) continue;
  const source = await read(file);
  const check = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  // Intentional guardrail, not a comprehensive security scanner.
  assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|eval|Function)\s*\(/.test(source), `Unexpected network/dynamic code: ${file}`);
  assert.ok(!/\b(localStorage|sessionStorage|indexedDB)\b|chrome\.storage|\.innerHTML\s*=|console\./.test(source), `Unexpected persistence/HTML/logging: ${file}`);
  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    assert.ok(match[1].startsWith('.'), `Runtime dependency must be local: ${file}`);
    await access(path.resolve(root, path.dirname(file), match[1]));
  }
  modules++;
}
const html = await read('public/editor.html');
assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'Inline script is forbidden.');
assert.ok(!/\son(?:click|load|error|submit|mouseover)\s*=/i.test(html));
for (const value of Object.values(manifest.icons)) await access(path.join(root, 'public', value));
const integrity = JSON.parse(await read('public/vendor/ocr/integrity.json'));
assert.deepEqual(integrity.packages, { 'tesseract.js': '6.0.1', 'tesseract.js-core': '6.0.0', '@tesseract.js-data/eng': '1.0.0' });
for (const [file, hash] of Object.entries(integrity.hashes)) {
  assert.equal(createHash('sha256').update(await readFile(path.join(root, 'public/vendor/ocr', file))).digest('hex'), hash, `OCR asset mismatch: ${file}`);
}
assert.ok((await read('src/platform/ocr-worker.js')).includes("cacheMethod: 'none'"), 'OCR must not persist image or text data');
console.log(`Checked ${modules} source modules, manifest permissions, CSP, imports, and privacy guardrails.`);

assert.equal(manifest.commands._execute_action.suggested_key.default, 'Alt+Shift+V');
for (const stem of ['tesseract-core-lstm', 'tesseract-core-simd-lstm']) {
  const loader = await read(`public/vendor/ocr/core/${stem}.wasm.js`);
  assert.ok(!/data:application\/octet-stream;base64,[A-Za-z0-9+/]{100}/.test(loader), 'Embedded WASM would violate connect-src self');
  await access(path.join(root, 'public/vendor/ocr', `${stem}.wasm`));
}
