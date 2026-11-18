import { recognizeLocally } from '../platform/ocr-worker.js';
import { suggestFromBlocks } from './suggestions.js';

/** Analyze a bounded copy of the current preview; previously covered text is not re-read. */
export async function scanForSuggestions(preview, options) {
  const scale = Math.min(1, Math.sqrt(6_000_000 / (preview.width * preview.height)));
  const canvas = document.createElement('canvas');
  const width = preview.width, height = preview.height;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  try {
    canvas.getContext('2d').drawImage(preview, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare the image for scanning.')), 'image/png'));
    if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const blocks = await recognizeLocally(bytes, options);
    return suggestFromBlocks(blocks, width, height, scale);
  } finally { canvas.width = canvas.height = 0; }
}
