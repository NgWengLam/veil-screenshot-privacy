import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRect, toImagePoint } from '../../src/core/geometry.js';
import { RedactionDocument } from '../../src/core/document.js';
import { CaptureVault, isEditorRequest } from '../../src/background/capture-vault.js';
import { LIMITS } from '../../src/shared/limits.js';
import { captureToBlob } from '../../src/platform/images.js';

test('reverse drag rounds outwards and clamps to source pixels', () => {
  assert.deepEqual(normalizeRect({ x: 20.1, y: 40.8 }, { x: -3, y: 2.3 }, 100, 100), { x: 0, y: 2, width: 21, height: 39 });
  assert.deepEqual(normalizeRect({ x: 90, y: 90 }, { x: 200, y: 210 }, 100, 100), { x: 90, y: 90, width: 10, height: 10 });
});
test('invalid, empty and completely out-of-bounds selections are rejected', () => {
  assert.equal(normalizeRect({ x: NaN, y: 1 }, { x: 2, y: 3 }, 100, 100), null);
  assert.equal(normalizeRect({ x: 5, y: 5 }, { x: 5, y: 5 }, 100, 100), null);
  assert.equal(normalizeRect({ x: 101, y: 101 }, { x: 110, y: 110 }, 100, 100), null);
});
test('scaled/offset preview maps precisely to native pixels', () => {
  assert.deepEqual(toImagePoint(160, 120, { left: 10, top: 20, width: 300, height: 200 }, 1200, 800), { x: 600, y: 400 });
  assert.deepEqual(toImagePoint(-30, 999, { left: 10, top: 20, width: 300, height: 200 }, 1200, 800), { x: 0, y: 800 });
});
test('image limits include dimensions, pixel count and malformed values', () => {
  for (const [w, h] of [[0, 1], [1, Infinity], [1.2, 10], [20000, 1], [6000, 6000]]) assert.throws(() => new RedactionDocument(w, h));
  assert.doesNotThrow(() => new RedactionDocument(6000, 4000));
});
test('undo, redo, deletion and branch changes preserve independent state', () => {
  const doc = new RedactionDocument(200, 100);
  doc.add({ x: 1, y: 2, width: 30, height: 20 }, '#111827');
  const snapshot = doc.regions; snapshot[0].x = 99;
  assert.equal(doc.regions[0].x, 1);
  const id = doc.regions[0].id;
  doc.remove(id); assert.equal(doc.regions.length, 0);
  doc.undo(); assert.equal(doc.regions[0].id, id);
  doc.redo(); assert.equal(doc.regions.length, 0);
  doc.undo(); doc.undo(); assert.equal(doc.regions.length, 0);
  doc.add({ x: 20, y: 20, width: 10, height: 10 }, '#ffffff');
  assert.equal(doc.canRedo, false);
});
test('only opaque approved colors and bounded region counts are accepted', () => {
  const doc = new RedactionDocument(100, 100);
  assert.throws(() => doc.add({ x: 0, y: 0, width: 10, height: 10 }, 'transparent'));
  for (let i = 0; i < LIMITS.regions; i++) doc.add({ x: 0, y: 0, width: 2, height: 2 }, '#111827');
  assert.throws(() => doc.add({ x: 0, y: 0, width: 2, height: 2 }, '#111827'));
  for (let i = 0; i < LIMITS.history; i++) doc.undo();
  assert.equal(doc.canUndo, false);
});
test('capture tokens are one-use, expire, can be revoked and enforce capacity', () => {
  let now = 0;
  const vault = new CaptureVault(() => now);
  const image = 'data:image/png;base64,AAAA';
  const first = vault.issue(image);
  assert.equal(vault.take(first), image); assert.equal(vault.take(first), null);
  const expired = vault.issue(image); now += LIMITS.handoffMs;
  assert.equal(vault.take(expired), null);
  const revoked = vault.issue(image); vault.discard(revoked); assert.equal(vault.take(revoked), null);
  vault.issue(image); vault.issue(image); assert.throws(() => vault.issue(image));
  assert.throws(() => new CaptureVault().issue('https://example.com/image.png'));
});
test('capture messages require the exact extension editor and valid token shape', () => {
  const url = 'chrome-extension://abc/editor.html';
  const sender = { id: 'abc', tab: { id: 5 }, url };
  const message = { type: 'capture:consume', token: crypto.randomUUID() };
  assert.equal(isEditorRequest(message, sender, 'abc', url), true);
  for (const changed of [{ ...sender, id: 'other' }, { ...sender, url: 'https://example.com/' },
    { ...sender, tab: undefined }, { ...sender, url: `${url}?other=1` }, { ...sender, url: `${url}/fake` }]) {
    assert.equal(isEditorRequest(message, changed, 'abc', url), false);
  }
  assert.equal(isEditorRequest({ ...message, type: 'capture:anything' }, sender, 'abc', url), false);
  assert.equal(isEditorRequest({ ...message, token: {} }, sender, 'abc', url), false);
});
test('data URL conversion accepts PNG only and enforces size limit', () => {
  assert.equal(captureToBlob('data:image/png;base64,AAAA').type, 'image/png');
  assert.throws(() => captureToBlob('data:image/svg+xml;base64,AAAA'));
  assert.throws(() => captureToBlob('https://example.com/image.png'));
  assert.throws(() => captureToBlob('data:image/png;base64,' + 'A'.repeat(LIMITS.captureCharacters)));
});
