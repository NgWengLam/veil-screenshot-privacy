import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const require = createRequire(import.meta.url);
let chromium;
try {
  const resolved = require.resolve('playwright', { paths: [process.cwd(), process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean) });
  ({ chromium } = require(resolved));
} catch {
  throw new Error('Install test tooling: npm install --no-save --package-lock=false playwright@1.62.1 && npx playwright install chromium');
}
const root = fileURLToPath(new URL('../../', import.meta.url));
const extensionPath = path.join(root, 'dist');
const profile = await mkdtemp(path.join(tmpdir(), 'veil-test-'));
const artifacts = path.join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
const webMode = process.env.VEIL_TEST_WEB === '1';
let server;
let webOrigin;
if (webMode) {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.gz': 'application/gzip', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
  const csp = JSON.parse(await readFile(path.join(extensionPath, 'manifest.json'), 'utf8')).content_security_policy.extension_pages;
  server = createServer(async (req, res) => {
    try {
      const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(extensionPath, '.' + relative);
      if (!file.startsWith(extensionPath + path.sep)) { res.writeHead(403); res.end(); return; }
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Content-Security-Policy': csp }); res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  webOrigin = `http://127.0.0.1:${server.address().port}`;
}
const context = await chromium.launchPersistentContext(profile, {
  ...(process.env.VEIL_BROWSER_EXECUTABLE ? { executablePath: process.env.VEIL_BROWSER_EXECUTABLE } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1440, height: 1150 }, acceptDownloads: true,
  args: ['--no-sandbox', '--disable-gpu', ...(!webMode ? [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] : [])],
});
const errors = [];
const remoteRequests = [];
const passed = [];
context.on('request', request => { if (/^https?:/.test(request.url()) && !(webOrigin && request.url().startsWith(webOrigin + '/'))) remoteRequests.push(request.url()); });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('dialog', dialog => dialog.accept());
const check = name => { passed.push(name); console.log(`PASS ${name}`); };
try {
  const worker = webMode ? null : context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = worker ? new URL(worker.url()).host : null;
  const editorUrl = webMode ? `${webOrigin}/editor.html` : `chrome-extension://${extensionId}/editor.html`;
  await page.goto(editorUrl);
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Ready when you are.');
  assert.equal(await page.locator('#export').isDisabled(), true);
  await page.screenshot({ path: path.join(artifacts, 'editor-empty.png'), fullPage: true });
  check(webMode ? 'Packaged editor loads with its restrictive CSP (web test mode)' : 'Real Manifest V3 extension loads without broad host permissions');

  await page.locator('#help').click();
  for (let step = 1; step <= 5; step++) {
    assert.match(await page.locator('#guide-step').textContent(), new RegExp(`STEP ${step} OF 5`));
    await page.waitForFunction(() => { const img = document.querySelector('#guide-picture'); return img.complete && img.naturalWidth > 0; });
    await page.locator('#guide-next').click();
  }
  assert.equal(await page.locator('#guide-dialog').isVisible(), false);
  await page.locator('#help').click(); await page.keyboard.press('Escape');
  assert.equal(await page.locator('#guide-dialog').isVisible(), false);
  check('Five-step walkthrough advances, reopens, and closes with Escape');

  await page.locator('#demo').click();
  await page.waitForFunction(() => document.querySelector('#canvas').width === 1200);
  await page.locator('#scan').click();
  await page.waitForFunction(() => !document.querySelector('#scan').disabled, undefined, { timeout: 95000 });
  assert.ok(await page.locator('#suggestions li').count() >= 2, await page.locator('#status').textContent());
  assert.match(await page.locator('#suggestions').textContent(), /Email/);
  assert.match(await page.locator('#suggestions').textContent(), /Phone number/);
  assert.equal(await page.locator('#export').isDisabled(), true);
  await page.screenshot({ path: path.join(artifacts, 'editor-suggestions.png'), fullPage: true });
  await page.locator('#select-suggestions').uncheck();
  assert.equal(await page.locator('#apply-suggestions').isDisabled(), true);
  await page.locator('#select-suggestions').check();
  const suggestionCount = await page.locator('#suggestions li').count();
  await page.locator('#apply-suggestions').click();
  assert.equal(await page.locator('#count').textContent(), String(suggestionCount));
  assert.equal(await page.locator('#export').isDisabled(), false);
  await page.locator('#undo').click();
  assert.equal(await page.locator('#count').textContent(), '0');
  check('Real bundled OCR finds email/phone; review gates export; applying is one undoable transaction');
  // A warm OCR engine can finish in about a second, faster than a separate click can land.
  // Start and cancel in the same task so the cancel path is tested deterministically.
  const cancelVisible = await page.evaluate(() => {
    document.querySelector('#scan').click();
    const visible = !document.querySelector('#scan-progress').hidden;
    document.querySelector('#cancel-scan').click();
    return visible;
  });
  assert.equal(cancelVisible, true, 'Cancel scan should be shown while scanning');
  await page.waitForFunction(() => !document.querySelector('#scan').disabled);
  assert.match(await page.locator('#status').textContent(), /cancelled/);
  assert.equal(await page.locator('#count').textContent(), '0');
  check('Cancelling local OCR terminates processing without changing covers');
  const bounds = await page.locator('#overlay').boundingBox();
  const start = { x: 307, y: 301 }, end = { x: 580, y: 336 };
  await page.mouse.move(bounds.x + start.x * bounds.width / 1200, bounds.y + start.y * bounds.height / 740);
  await page.mouse.down();
  await page.mouse.move(bounds.x + end.x * bounds.width / 1200, bounds.y + end.y * bounds.height / 740);
  await page.mouse.up();
  assert.equal(await page.locator('#count').textContent(), '1');
  assert.deepEqual(await page.evaluate(() => [...document.querySelector('#canvas').getContext('2d').getImageData(400, 320, 1, 1).data]), [17, 24, 39, 255]);
  await page.locator('#undo').click(); assert.equal(await page.locator('#count').textContent(), '0');
  await page.locator('#redo').click(); assert.equal(await page.locator('#count').textContent(), '1');
  check('Scaled pointer selection, opaque pixel replacement, undo and redo');

  await page.locator('.precise summary').click();
  for (const [id, value] of Object.entries({ 'region-x': '375', 'region-y': '179', 'region-width': '137', 'region-height': '29' })) {
    await page.locator(`#${id}`).fill(value);
  }
  await page.locator('#add-region').click();
  assert.equal(await page.locator('#count').textContent(), '2');
  await page.screenshot({ path: path.join(artifacts, 'editor-redacted.png'), fullPage: true });
  check('Keyboard-accessible coordinate entry');
  const picker = page.locator('[aria-label="Color for area 1"]');
  await picker.fill('#2563eb'); await picker.dispatchEvent('change');
  assert.deepEqual(await page.evaluate(() => [...document.querySelector('#canvas').getContext('2d').getImageData(400, 320, 1, 1).data]), [37,99,235,255]);
  await page.locator('#undo').click();
  check('Custom recoloring stays opaque and supports undo');


  await page.locator('#export').click();
  assert.equal(await page.locator('#confirm-export').isDisabled(), true);
  await page.locator('#review-confirm').check();
  assert.equal(await page.locator('#export-preview').evaluate(img => img.naturalWidth), 1200);
  await page.locator('#preview-native').check();
  assert.equal(await page.locator('#export-preview').evaluate(img => img.getBoundingClientRect().width), 1200);
  await page.screenshot({path:path.join(artifacts,'export-preview.png'),fullPage:true});
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#confirm-export').click();
  const download = await downloadPromise;
  const bytes = await readFile(await download.path());
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    chunks.push(bytes.toString('ascii', offset + 4, offset + 8));
    offset += length + 12;
  }
  assert.ok(!chunks.some(type => ['tEXt', 'iTXt', 'zTXt', 'eXIf'].includes(type)), 'No original metadata embedded');
  const pixels = await page.evaluate(async base64 => {
    const { captureToBlob } = await import('./src/platform/images.js');
    const bitmap = await createImageBitmap(captureToBlob(`data:image/png;base64,${base64}`));
    const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
    const ctx = c.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
    const output = { width: c.width, height: c.height,
      covered: [...ctx.getImageData(400, 320, 1, 1).data],
      untouched: [...ctx.getImageData(10, 400, 1, 1).data],
      second: [...ctx.getImageData(400, 190, 1, 1).data] };
    bitmap.close(); c.width = c.height = 0; return output;
  }, bytes.toString('base64'));
  assert.deepEqual(pixels, { width: 1200, height: 740, covered: [17, 24, 39, 255], untouched: [23, 43, 53, 255], second: [17, 24, 39, 255] });
  assert.ok(download.suggestedFilename().startsWith('veil-redacted-'));
  check('Reviewed export is a full-resolution PNG with burned-in covers and no source metadata');

  await page.locator('#status').click();
  await page.keyboard.press('Control+Shift+C');
  await page.waitForFunction(() => document.querySelector('#review-dialog').open);
  await page.locator('#review-confirm').check();
  // Verify the browser clipboard output, including decoded opaque pixels.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#confirm-copy').click();
  await page.waitForFunction(() => !document.querySelector('#review-dialog').open);
  const copied = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const bitmap = await createImageBitmap(await items[0].getType('image/png'));
    const c = document.createElement('canvas'); c.width=bitmap.width; c.height=bitmap.height;
    const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);
    const result=[...ctx.getImageData(400,320,1,1).data];bitmap.close();return result;
  });
  assert.deepEqual(copied,[17,24,39,255]);
  check('Keyboard opens clipboard preview; real clipboard PNG contains only redacted pixels');

  // A denied clipboard operation must keep the preview available for saving.
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'write', { configurable:true, value:async () => { throw new Error('denied'); } }));
  await page.locator('#copy').click(); await page.locator('#review-confirm').check(); await page.locator('#confirm-copy').click();
  await page.waitForFunction(() => document.querySelector('#export-error').textContent.includes('blocked'));
  assert.equal(await page.locator('#confirm-export').isEnabled(),true);
  await page.keyboard.press('Escape');
  await page.evaluate(() => delete navigator.clipboard.write);
  check('Clipboard failure retains preview and offers PNG fallback');

  let unexpectedDownloads = 0;
  const countDownload = () => unexpectedDownloads++;
  page.on('download', countDownload);
  await page.locator('#export').click(); await page.locator('#review-confirm').check(); await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#review-dialog').open);
  assert.equal(unexpectedDownloads, 0);
  page.off('download', countDownload);
  check('Cancelling review after an earlier export does not reuse the previous approval');

  await page.locator('#discard').click(); await page.locator('#discard-dialog button[value="discard"]').click();
  await page.waitForFunction(() => document.querySelector('#canvas').width === 0);
  assert.equal(await page.locator('#canvas').getAttribute('width'), '0');
  assert.equal(await page.locator('#export').isDisabled(), true);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.deepEqual(await page.evaluate(async () => await indexedDB.databases()), []);
  check('Discard clears canvases and state without persistent image storage');

  await page.locator('#file').setInputFiles({ name: 'test.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await page.waitForFunction(() => document.querySelector('#status').dataset.error === 'true');
  assert.match(await page.locator('#status').textContent(), /PNG, JPEG, or WebP/);
  await page.locator('#file').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a PNG') });
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('could not be opened'));
  check('SVG and malformed raster files are rejected safely');

  await page.locator('#file').setInputFiles({ name: 'already-redacted.png', mimeType: 'image/png', buffer: bytes });
  await page.waitForFunction(() => document.querySelector('#canvas').width === 1200);
  assert.equal(await page.locator('#count').textContent(), '0');
  await page.locator('#discard').click(); await page.keyboard.press('Escape');
  assert.equal(await page.locator('#canvas').getAttribute('width'), '1200');
  check('PNG import and cancellation of discard retain the current image');

  await page.locator('#zoom').selectOption('2');
  assert.equal(Math.round((await page.locator('#canvas').boundingBox()).width), 2400);
  await page.locator('#zoom').selectOption('fit');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, 'editor-mobile.png'), fullPage: true });
  check('Zoom and narrow layout work without horizontal page overflow');

  if (!webMode) {
  // Changing only the #hash does not reload the page, so load a blank page first (real captures open a new tab).
  await page.goto('about:blank');
  await page.goto(`${editorUrl}#${crypto.randomUUID()}`);
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('expired'));
  assert.equal(new URL(page.url()).hash, '');
  check('Expired capture handoff fails closed and removes token from address bar');

  // Exercise the real runtime sender boundary from an extension page.
  const invalid = await page.evaluate(async () => await chrome.runtime.sendMessage({ type: 'capture:consume', token: crypto.randomUUID() }));
  assert.deepEqual(invalid, { ok: false });
  }
  assert.equal(remoteRequests.length, 0, 'The extension made no HTTP(S) requests during the workflow');
  assert.deepEqual(errors, [], 'No JavaScript or CSP console errors');
  check('No external HTTP(S) requests or JavaScript/CSP errors');
  await writeFile(path.join(artifacts, 'test-results.json'), JSON.stringify({ passed, networkRequests: remoteRequests.length, errors,
    mode: webMode ? 'Packaged editor served on loopback; not extension runtime' : 'Installed extension',
    captureCoverage: 'Action event and browser capture API are mocked in unit tests. A real user-triggered toolbar capture remains a manual release check.' }, null, 2));
  console.log(`\n${passed.length} browser checks passed.`);
} catch (error) { console.error({errors}); throw error; } finally {
  await context.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
