import test from 'node:test';
import assert from 'node:assert/strict';

test('capture action and message boundary with browser API mocks', async t => {
  const callbacks = {};
  const created = [];
  const originalTimer = globalThis.setTimeout;
  let captureCalls = 0;
  let queryCalls = 0;
  let failCapture = false;
  let changedTab = false;
  let mismatchBefore = false;
  const source = { id: 8, windowId: 2, url: 'https://example.com/' };
  const image = 'data:image/png;base64,AAAA';
  globalThis.chrome = {
    action: { onClicked: { addListener: fn => { callbacks.click = fn; } } },
    runtime: { id: 'test', getURL: path => `chrome-extension://test/${path}`,
      onInstalled: { addListener: fn => { callbacks.installed = fn; } },
      onMessage: { addListener: fn => { callbacks.message = fn; } } },
    tabs: {
      query: async () => { queryCalls++; return [{ ...source, id: mismatchBefore || (changedTab && queryCalls % 2 === 0) ? 9 : 8 }]; },
      captureVisibleTab: async (windowId, options) => {
        captureCalls++; assert.equal(windowId, 2); assert.equal(options.format, 'png');
        if (failCapture) throw new Error('Browser error containing a sensitive URL');
        return image;
      },
      create: async options => { created.push(options); return { id: 10 }; },
    },
  };
  globalThis.setTimeout = (...args) => { const timer = originalTimer(...args); timer.unref(); return timer; };
  t.after(() => { delete globalThis.chrome; globalThis.setTimeout = originalTimer; });
  await import('../../src/background/index.js');
  callbacks.installed({ reason: 'update' }); assert.equal(created.length, 0);
  callbacks.installed({ reason: 'install' }); assert.ok(created.pop().url.endsWith('#guide'));

  await callbacks.click(source);
  assert.equal(captureCalls, 1);
  assert.ok(!created[0].url.includes('data:'));
  const token = new URL(created[0].url).hash.slice(1);
  let response;
  callbacks.message({ type: 'capture:consume', token }, { id: 'evil', tab: { id: 10 }, url: created[0].url }, value => { response = value; });
  assert.equal(response, undefined);
  const sender = { id: 'test', tab: { id: 10 }, url: 'chrome-extension://test/editor.html' };
  callbacks.message({ type: 'capture:consume', token }, sender, value => { response = value; });
  assert.deepEqual(response, { ok: true, dataUrl: image });
  callbacks.message({ type: 'capture:consume', token }, sender, value => { response = value; });
  assert.deepEqual(response, { ok: false });

  await callbacks.click({ ...source, url: 'chrome://settings' });
  assert.equal(captureCalls, 1);
  assert.ok(created.at(-1).url.endsWith('#capture-error'));

  queryCalls = 0; changedTab = true;
  await callbacks.click(source);
  assert.ok(created.at(-1).url.endsWith('#capture-error'));
  changedTab = false; mismatchBefore = true;
  const previousCalls = captureCalls;
  await callbacks.click(source); assert.equal(captureCalls, previousCalls);
  mismatchBefore = false; failCapture = true;
  await callbacks.click(source);
  assert.ok(created.at(-1).url.endsWith('#capture-error'));
});
