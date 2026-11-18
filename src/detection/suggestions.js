import { findSensitiveSpans, labelOnlyKind } from './patterns.js';
import { normalizeRect } from '../core/geometry.js';

/** Convert OCR word boxes to source-image rectangles; never return recognized text to UI. */
export function suggestFromBlocks(blocks, width, height, scale = 1) {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid OCR scale.');
  const candidates = [];
  const lines = (blocks ?? []).flatMap(block => block.paragraphs ?? []).flatMap(paragraph => paragraph.lines ?? []);
  const lineRecords = lines.map(line => {
    let text = '';
    const words = [];
    for (const word of line.words ?? []) {
      if (typeof word.text !== 'string' || !word.bbox ||
        ![word.bbox.x0, word.bbox.x1, word.bbox.y0, word.bbox.y1].every(Number.isFinite)) continue;
      if (text) text += ' ';
      words.push({ start: text.length, end: text.length + word.text.length, box: word.bbox });
      text += word.text;
    }
    return { text, words };
  });
  function add(words, kind) {
    if (!words.length) return;
    const pad = 4 / scale;
    const x = Math.min(...words.map(word => word.box.x0)) / scale - pad;
    const y = Math.min(...words.map(word => word.box.y0)) / scale - pad;
    const right = Math.max(...words.map(word => word.box.x1)) / scale + pad;
    const bottom = Math.max(...words.map(word => word.box.y1)) / scale + pad;
    const rect = normalizeRect({ x, y }, { x: right, y: bottom }, width, height);
    if (!rect) return;
    if (candidates.some(other => Math.abs(other.x - rect.x) < 4 && Math.abs(other.y - rect.y) < 4 &&
      Math.abs(other.width - rect.width) < 4 && Math.abs(other.height - rect.height) < 4)) return;
    if (candidates.length < 150) candidates.push({ ...rect, kind });
  }
  for (let i = 0; i < lineRecords.length; i++) {
    const line = lineRecords[i];
    for (const match of findSensitiveSpans(line.text)) {
      add(line.words.filter(word => word.start < match.end && word.end > match.start), match.kind);
    }
    // A separate label line may identify the next line. Keep this narrow and spatially bounded.
    const labelKind = labelOnlyKind(line.text);
    if (labelKind) {
      const next = lineRecords[i + 1];
      const labelBox = line.words[0]?.box;
      const nextBox = next?.words[0]?.box;
      if (labelBox && nextBox && next.words.length <= 12 && nextBox.y0 >= labelBox.y1 &&
        nextBox.y0 - labelBox.y1 <= Math.max(35, (labelBox.y1 - labelBox.y0) * 3) &&
        Math.abs(nextBox.x0 - labelBox.x0) <= 35 && !/[:@]|^(email|phone|address|name)\b/i.test(next.text)) {
        add(next.words, labelKind);
      }
    }
  }
  return candidates;
}
