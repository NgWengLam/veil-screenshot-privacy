import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRedacted } from '../../src/core/render.js';
import { RedactionDocument } from '../../src/core/document.js';

test('rendering replaces every selected source pixel and preserves adjacent pixels', () => {
  // Tiny software raster surface: verifies geometry/compositing independently of a browser.
  // Actual PNG encoder and browser Canvas remain covered by the separate browser suite.
  const width = 8, height = 6;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const source = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < source.length; i += 4) source.set([231, 72, 93, 200], i);
  const context = {
    canvas: { width, height }, globalAlpha: 0.2, globalCompositeOperation: 'multiply',
    save() {}, restore() {}, setTransform() {}, clearRect() { pixels.fill(0); },
    drawImage(image) { pixels.set(image); },
    fillRect(x, y, w, h) {
      assert.equal(this.globalAlpha, 1); assert.equal(this.globalCompositeOperation, 'source-over');
      const rgb = this.fillStyle.match(/[a-f0-9]{2}/g).map(v => parseInt(v, 16));
      for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) pixels.set([...rgb, 255], (row * width + col) * 4);
    },
  };
  const doc = new RedactionDocument(width, height);
  doc.add({ x: 1.2, y: 1.8, width: 2.9, height: 2.3 }, '#111827');
  doc.add({ x: 3, y: 2, width: 2, height: 1 }, '#ffffff');
  renderRedacted(context, source, doc.regions);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const expected = y === 2 && x >= 3 && x < 5 ? [255, 255, 255, 255]
      : x >= 1 && x < 5 && y >= 1 && y < 5 ? [17, 24, 39, 255] : [231, 72, 93, 200];
    assert.deepEqual([...pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 4)], expected, `pixel ${x},${y}`);
  }
  assert.deepEqual([...source.slice(0, 4)], [231, 72, 93, 200], 'Original data was not mutated');
});
