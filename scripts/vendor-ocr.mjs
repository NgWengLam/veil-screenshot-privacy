import { readFile, readdir, mkdir, cp, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const packages = { 'tesseract.js': '6.0.1', 'tesseract.js-core': '6.0.0', '@tesseract.js-data/eng': '1.0.0' };
for (const [name, version] of Object.entries(packages)) {
  const actual = JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
  if (actual.version !== version) throw new Error(`Unexpected ${name} version. Run npm ci --ignore-scripts.`);
}
const target = path.join(root, 'public/vendor/ocr');
await rm(target, { recursive: true, force: true });
for (const dir of ['core', 'lang', 'licenses']) await mkdir(path.join(target, dir), { recursive: true });
await cp(path.join(root, 'node_modules/tesseract.js/dist/worker.min.js'), path.join(target, 'worker.min.js'));
await cp(path.join(root, 'node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt'), path.join(target, 'licenses/worker-bundle.txt'));
// The worker expects *.wasm.js names. Use upstream external-WASM loaders
// under those names so connect-src 'self' never needs a data: exception.
for (const stem of ['tesseract-core-lstm', 'tesseract-core-simd-lstm']) {
  await cp(path.join(root, 'node_modules/tesseract.js-core', `${stem}.js`), path.join(target, 'core', `${stem}.wasm.js`));
  await cp(path.join(root, 'node_modules/tesseract.js-core', `${stem}.wasm`), path.join(target, `${stem}.wasm`));
}
await cp(path.join(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'), path.join(target, 'lang/eng.traineddata.gz'));
// Include notices from bundled components and all installed transitive package licences.
const names = (await readdir(path.join(root, 'node_modules'))).filter(name => !name.startsWith('.') && !name.startsWith('@'));
names.push('@tesseract.js-data/eng');
const notices = [];
for (const name of names) {
  const dir = path.join(root, 'node_modules', name);
  const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  notices.push(`${pkg.name}@${pkg.version} — ${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license)} — ${typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? ''}`);
  for (const file of await readdir(dir)) if (/^(licen[cs]e|copying|notice)/i.test(file)) {
    await cp(path.join(dir, file), path.join(target, 'licenses', `${name.replaceAll('/', '_')}-${file}`));
  }
}
await writeFile(path.join(target, 'licenses/PACKAGES.txt'), notices.join('\n') + '\n');
const hashes = {};
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else hashes[path.relative(target, file).split(path.sep).join('/')] = createHash('sha256').update(await readFile(file)).digest('hex');
  }
}
await walk(target);
await writeFile(path.join(target, 'integrity.json'), JSON.stringify({ packages, hashes }, null, 2) + '\n');
console.log('Bundled pinned OCR worker, SIMD/non-SIMD LSTM engines, English data and licence notices.');
