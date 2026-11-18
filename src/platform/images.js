import { LIMITS } from '../shared/limits.js';
import { RedactionDocument } from '../core/document.js';

/** Only raster PNG/JPEG/WebP. SVG, GIF and remote URLs are not accepted. */
export async function decodeImage(blob) {
  if (!(blob instanceof Blob) || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  }
  if (blob.size > LIMITS.fileBytes) throw new Error('Choose an image smaller than 20 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(blob); }
  catch { throw new Error('This image could not be opened. Try another PNG, JPEG, or WebP.'); }
  try {
    // Validate decoded dimensions; compressed file size alone is insufficient.
    const state = new RedactionDocument(bitmap.width, bitmap.height);
    return { bitmap, state };
  } catch (error) {
    bitmap.close();
    throw error;
  }
}

export function captureToBlob(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > LIMITS.captureCharacters ||
    !dataUrl.startsWith('data:image/png;base64,')) throw new Error('Invalid screenshot. Capture the tab again.');
  const binary = atob(dataUrl.slice('data:image/png;base64,'.length));
  return new Blob([Uint8Array.from(binary, character => character.charCodeAt(0))], { type: 'image/png' });
}

export function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `veil-redacted-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
