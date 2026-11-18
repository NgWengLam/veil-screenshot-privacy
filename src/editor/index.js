import { normalizeRect, toImagePoint } from '../core/geometry.js';
import { renderRedacted, exportPng } from '../core/render.js';
import { decodeImage, captureToBlob, downloadBlob } from '../platform/images.js';
import { makeDemo } from './demo.js';
import { scanForSuggestions } from '../detection/scan.js';
import { setupGuide } from './guide.js';

const $ = id => document.getElementById(id);
const canvas = $('canvas');
const overlay = $('overlay');
const ctx = canvas.getContext('2d');
const overlayCtx = overlay.getContext('2d');
let source = null;
let model = null;
let drag = null;
let loadGeneration = 0;
let busy = false;
let saved = true;
let previewFrame = null;
let suggestions = [];
let scanController = null;
let exportBlob = null;
let exportUrl = null;
let exporting = false;

function announce(message, error = false) {
  $('status').textContent = message;
  $('status').dataset.error = String(error);
}
function color() { const value = document.querySelector('input[name="color"]:checked').value; return value === 'custom' ? $('custom-color').value : value; }
$('custom-color').addEventListener('input', () => { document.querySelector('input[value="custom"]').checked = true; });
function syncControls() {
  $('export').disabled = !model || busy || Boolean(drag) || suggestions.length > 0;
  $('copy').disabled = $('export').disabled;
  $('discard').disabled = !model || busy;
  $('undo').disabled = !model?.canUndo || busy;
  $('redo').disabled = !model?.canRedo || busy;
  $('add-region').disabled = !model || busy;
  $('zoom').disabled = !model || busy;
  $('open').disabled = $('choose').disabled = $('demo').disabled = busy;
  $('scan').disabled = !model || busy || Boolean(drag);
  $('apply-suggestions').disabled = busy || !suggestions.some(item => item.selected);
  $('dismiss-suggestions').disabled = busy;
  $('select-suggestions').disabled = busy;
  $('suggestion-review').hidden = suggestions.length === 0;
  $('scan-progress').hidden = !scanController;
  $('select-suggestions').checked = suggestions.length > 0 && suggestions.every(item => item.selected);
  $('select-suggestions').indeterminate = suggestions.some(item => item.selected) && !suggestions.every(item => item.selected);
}
function drawSuggestions() {
  if (!model || !suggestions.length) return;
  const ratio = model.width / Math.max(1, overlay.getBoundingClientRect().width);
  overlayCtx.save();
  overlayCtx.lineWidth = 2 * ratio;
  overlayCtx.setLineDash([6 * ratio, 4 * ratio]);
  overlayCtx.strokeStyle = '#bc7411';
  for (const area of suggestions) if (area.selected) {
    overlayCtx.strokeRect(area.x, area.y, area.width, area.height);
  }
  overlayCtx.restore();
}
function paintSuggestions() {
  $('suggestions').replaceChildren();
  for (const [index, area] of suggestions.entries()) {
    const item = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = area.selected; checkbox.disabled = busy;
    const text = document.createElement('span');
    text.textContent = `${index + 1}. ${area.kind}`;
    checkbox.addEventListener('change', () => {
      area.selected = checkbox.checked;
      overlayCtx.clearRect(0, 0, overlay.width, overlay.height); drawSuggestions(); syncControls();
    });
    label.append(checkbox, text); item.append(label); $('suggestions').append(item);
  }
}
function resetSuggestions(message = 'Works on screenshots and imported images. English / Latin text.') {
  suggestions = [];
  $('scan-summary').textContent = message;
}
function fitCanvas() {
  if (!model) return;
  const stage = $('stage');
  const style = getComputedStyle(stage);
  const available = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const scale = $('zoom').value === 'fit' ? Math.min(1, Math.max(1, available) / model.width) : Number($('zoom').value);
  $('canvas-wrap').style.width = `${model.width * scale}px`;
  $('canvas-wrap').style.height = `${model.height * scale}px`;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height); drawSuggestions();
}
function render() {
  if (model && source) renderRedacted(ctx, source, model.regions);
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  drawSuggestions();
  const regions = model?.regions ?? [];
  $('count').textContent = String(regions.length);
  $('areas-empty').hidden = regions.length > 0;
  $('regions').replaceChildren();
  for (const [i, region] of regions.entries()) {
    const item = document.createElement('li');
    const description = document.createElement('span');
    description.textContent = `Area ${String(i + 1).padStart(2, '0')}`;
    const dimensions = document.createElement('small');
    dimensions.textContent = `${region.width} × ${region.height} px · ${region.color}`;
    description.append(dimensions);
    const remove = document.createElement('button');
    remove.className = 'remove-region';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove area ${i + 1}`);
    remove.disabled = busy;
    remove.addEventListener('click', () => {
      if (busy) return;
      model.remove(region.id); resetSuggestions(); saved = false; render();
      const remaining = $('regions').querySelectorAll('button');
      (remaining[Math.min(i, remaining.length - 1)] ?? $('add-region')).focus();
      announce('Cover removed. Those details are visible again.');
    });
    const picker = document.createElement('input');
    picker.type = 'color'; picker.value = region.color; picker.className = 'area-color'; picker.disabled = busy;
    picker.setAttribute('aria-label', `Color for area ${i + 1}`);
    picker.addEventListener('change', () => { if (busy) return; model.recolor(region.id, picker.value); saved = false; render(); announce('Cover color changed.'); });
    item.append(description, picker, remove); $('regions').append(item);
  }
  paintSuggestions(); syncControls();
}
function cancelDrag() {
  if (drag && overlay.hasPointerCapture(drag.pointerId)) overlay.releasePointerCapture(drag.pointerId);
  drag = null;
  if (previewFrame !== null) cancelAnimationFrame(previewFrame);
  previewFrame = null;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  drawSuggestions();
  syncControls();
}
function clearImage() {
  releaseExport();
  loadGeneration++;
  scanController?.abort();
  resetSuggestions();
  cancelDrag();
  source?.close(); source = null; model = null;
  canvas.width = canvas.height = overlay.width = overlay.height = 0;
  $('canvas-wrap').hidden = true; $('empty').hidden = false;
  $('file').value = '';
  $('image-label').textContent = 'Your private workspace';
  $('dimensions').textContent = 'NOTHING UPLOADED. EVER.';
  $('canvas-tip').textContent = 'Capture a browser tab using the Veil toolbar icon.';
  saved = true;
  render();
}
function askDiscard() {
  if (!model) return Promise.resolve(true);
  $('discard-dialog').returnValue = '';
  $('discard-dialog').showModal();
  return new Promise(resolve => $('discard-dialog').addEventListener('close', () => {
    resolve($('discard-dialog').returnValue === 'discard');
  }, { once: true }));
}
async function openImage(blob, label) {
  if (busy) return;
  busy = true; syncControls();
  const generation = ++loadGeneration;
  let decoded;
  try {
    decoded = await decodeImage(blob);
    if (generation !== loadGeneration) { decoded.bitmap.close(); return; }
    if (model && !await askDiscard()) { decoded.bitmap.close(); return; }
    if (generation !== loadGeneration) { decoded.bitmap.close(); return; }
    cancelDrag();
    source?.close();
    source = decoded.bitmap; model = decoded.state; saved = false; resetSuggestions();
    canvas.width = overlay.width = model.width;
    canvas.height = overlay.height = model.height;
    $('empty').hidden = true; $('canvas-wrap').hidden = false;
    $('image-label').textContent = label;
    $('dimensions').textContent = `${model.width.toLocaleString()} × ${model.height.toLocaleString()} PX`;
    $('canvas-tip').textContent = 'Drag to cover · Ctrl/Cmd+Z to undo · Esc to cancel';
    $('zoom').value = 'fit';
    fitCanvas(); render();
    announce('Image opened locally. Draw a box over each sensitive detail.');
  } catch (error) { announce(error.message || 'Unable to open this image.', true); }
  finally { busy = false; render(); }
}
function point(event) {
  return toImagePoint(event.clientX, event.clientY, overlay.getBoundingClientRect(), model.width, model.height);
}
function add(rect) {
  if (!rect || !model || busy) return;
  try {
    if (model.add(rect, color())) { resetSuggestions(); saved = false; render(); announce('Area covered. Check the edges before exporting.'); }
  } catch (error) { announce(error.message, true); }
}

overlay.addEventListener('pointerdown', event => {
  if (!model || busy || event.button !== 0 || !event.isPrimary) return;
  event.preventDefault();
  drag = { start: point(event), end: point(event), pointerId: event.pointerId };
  overlay.setPointerCapture(event.pointerId); syncControls();
});
overlay.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag.end = point(event);
  if (previewFrame !== null) return;
  previewFrame = requestAnimationFrame(() => {
    previewFrame = null;
    if (!drag || !model) return;
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    drawSuggestions();
    const rect = normalizeRect(drag.start, drag.end, model.width, model.height);
    if (!rect) return;
    overlayCtx.fillStyle = color();
    overlayCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
    overlayCtx.strokeStyle = '#45b394';
    overlayCtx.lineWidth = 2 * model.width / overlay.getBoundingClientRect().width;
    overlayCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  });
});
overlay.addEventListener('pointerup', event => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const rect = normalizeRect(drag.start, point(event), model.width, model.height);
  cancelDrag(); add(rect);
});
overlay.addEventListener('pointercancel', cancelDrag);
overlay.addEventListener('lostpointercapture', () => { if (drag) cancelDrag(); });

$('open').addEventListener('click', () => $('file').click());
$('choose').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', () => {
  const file = $('file').files?.[0];
  $('file').value = '';
  if (file) void openImage(file, 'Local image');
});
$('demo').addEventListener('click', async () => {
  try { await openImage(await makeDemo(), 'Sample · fictional customer details'); }
  catch { announce('The sample could not be created.', true); }
});
document.addEventListener('dragover', event => { event.preventDefault(); });
document.addEventListener('drop', event => { event.preventDefault(); });
$('stage').addEventListener('dragover', event => { event.preventDefault(); $('stage').classList.add('drag-over'); });
$('stage').addEventListener('dragleave', event => {
  if (!$('stage').contains(event.relatedTarget)) $('stage').classList.remove('drag-over');
});
$('stage').addEventListener('drop', event => {
  event.preventDefault(); $('stage').classList.remove('drag-over');
  if (busy) return;
  if (event.dataTransfer.files.length !== 1) { announce('Drop one PNG, JPEG, or WebP image at a time.', true); return; }
  void openImage(event.dataTransfer.files[0], 'Local image');
});
document.addEventListener('paste', event => {
  if (busy || document.querySelector('dialog[open]') || /INPUT|TEXTAREA/.test(event.target.tagName)) return;
  const item = [...(event.clipboardData?.items ?? [])].find(value => value.type.startsWith('image/'));
  if (item) { event.preventDefault(); const file = item.getAsFile(); if (file) void openImage(file, 'Pasted image'); }
});

function undo() { if (!model || busy || drag) return; model.undo(); resetSuggestions(); saved = false; render(); announce('Undone. Review your covers before exporting.'); }
function redo() { if (!model || busy || drag) return; model.redo(); resetSuggestions(); saved = false; render(); announce('Redone.'); }
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
$('zoom').addEventListener('change', () => { cancelDrag(); fitCanvas(); });
new ResizeObserver(fitCanvas).observe($('stage'));
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]')) return;
  if (event.key === 'Escape') { cancelDrag(); return; }
  if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && ['e', 'c'].includes(event.key.toLowerCase())) {
    event.preventDefault(); void openExport(event.key.toLowerCase() === 'c'); return;
  }
  if (event.key === '?') { event.preventDefault(); guide.open(); return; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault(); event.shiftKey ? redo() : undo();
  }
});
$('coordinates').addEventListener('submit', event => {
  event.preventDefault();
  if (!model || busy) return;
  const [x, y, width, height] = ['region-x', 'region-y', 'region-width', 'region-height'].map(id => Number($(id).value));
  if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1 ||
    x + width > model.width || y + height > model.height) {
    announce('Enter whole-pixel coordinates and a rectangle that fits inside the image.', true); return;
  }
  add({ x, y, width, height });
});
$('discard').addEventListener('click', async () => {
  if (busy) return;
  if (await askDiscard()) { clearImage(); announce('Workspace cleared. No image history was saved.'); }
});
function releaseExport() {
  $('export-preview').removeAttribute('src');
  if (exportUrl) URL.revokeObjectURL(exportUrl);
  exportUrl = null; exportBlob = null;
}
async function openExport(copy = false) {
  if (!model || busy || drag || suggestions.length || document.querySelector('dialog[open]')) return;
  busy = true; render();
  $('review-confirm').checked = false;
  $('confirm-export').disabled = $('confirm-copy').disabled = true;
  $('export-error').textContent = '';
  $('preview-native').checked = false; $('export-preview').classList.remove('native-size');
  $('review-description').textContent = model.regions.length
    ? `${model.regions.length} covered areas. Inspect the whole image, including names, avatars and keys.`
    : 'No areas are covered. All original details will be visible.';
  try {
    exportBlob = await exportPng(source, model);
    exportUrl = URL.createObjectURL(exportBlob);
    $('export-preview').src = exportUrl;
    await $('export-preview').decode();
    $('review-dialog').returnValue = ''; $('review-dialog').showModal();
    $('review-confirm').focus();
    $('confirm-copy').classList.toggle('primary', copy);
  } catch { releaseExport(); busy = false; render(); announce('Preview failed. Please try again.', true); }
}
$('export').addEventListener('click', () => void openExport());
$('copy').addEventListener('click', () => void openExport(true));
$('preview-native').addEventListener('change', () => $('export-preview').classList.toggle('native-size', $('preview-native').checked));
$('review-confirm').addEventListener('change', () => {
  $('confirm-export').disabled = $('confirm-copy').disabled = !$('review-confirm').checked || exporting;
});
async function finishExport(copy) {
  if (!exportBlob || exporting || !$('review-confirm').checked) return;
  exporting = true; $('confirm-export').disabled = $('confirm-copy').disabled = true;
  try {
    if (copy) {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('unavailable');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': exportBlob })]);
    } else downloadBlob(exportBlob);
    saved = true;
    announce(copy ? 'Image copied. Paste it into your destination app.' : 'PNG download started. Discard the image when finished.');
    $('review-dialog').close();
  } catch {
    $('export-error').textContent = copy ? 'Clipboard unavailable or blocked. Try again, or save the PNG instead.' : 'Download failed. Please try again.';
  } finally {
    exporting = false;
    $('confirm-export').disabled = $('confirm-copy').disabled = !$('review-confirm').checked;
  }
}
$('confirm-export').addEventListener('click', () => void finishExport(false));
$('confirm-copy').addEventListener('click', () => void finishExport(true));
$('review-dialog').addEventListener('cancel', event => { if (exporting) event.preventDefault(); });
document.querySelector('#review-dialog form').addEventListener('submit', event => { if (exporting) event.preventDefault(); });
$('review-dialog').addEventListener('close', () => { releaseExport(); busy = false; render(); });
document.querySelector('.brand').addEventListener('click', async event => {
  event.preventDefault();
  if (!busy && await askDiscard()) { clearImage(); announce('Ready when you are.'); }
});
window.addEventListener('beforeunload', event => {
  if (model && !saved) { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('pagehide', clearImage);

$('scan').addEventListener('click', async () => {
  if (!model || busy || drag) return;
  resetSuggestions('Scanning locally…');
  const generation = loadGeneration;
  const controller = new AbortController();
  scanController = controller; busy = true;
  $('scan-meter').value = 0; $('scan-label').textContent = 'Preparing local scan…';
  render();
  try {
    const found = await scanForSuggestions(canvas, { signal: controller.signal, onProgress: progress => {
      if (controller.signal.aborted) return;
      $('scan-meter').value = Math.max(Number($('scan-meter').value), progress);
      $('scan-label').textContent = `Scanning on your device… ${$('scan-meter').value}%`;
    } });
    if (controller.signal.aborted || generation !== loadGeneration) return;
    suggestions = found.map(area => ({ ...area, selected: true }));
    $('scan-summary').textContent = found.length
      ? `${found.length} possible sensitive area${found.length === 1 ? '' : 's'}. Review the amber outlines, then apply or dismiss.`
      : 'No matching text found. This does not mean the image is safe to share. Check it manually.';
    announce(found.length ? 'Suggestions ready. Amber outlines are not covers. Review them before exporting.' : 'Scan finished. No matching text found; please review manually.');
  } catch (error) {
    if (generation !== loadGeneration) return;
    $('scan-summary').textContent = error.name === 'AbortError' ? 'Scan cancelled. Your image and existing covers are unchanged.' : 'Scan unavailable. You can still cover sensitive details manually.';
    announce(error.name === 'AbortError' ? 'Scan cancelled.' : error.message, error.name !== 'AbortError');
  } finally {
    if (scanController === controller) { scanController = null; busy = false; render(); }
  }
});
$('cancel-scan').addEventListener('click', () => scanController?.abort());
$('select-suggestions').addEventListener('change', () => {
  suggestions.forEach(area => { area.selected = $('select-suggestions').checked; }); render();
});
$('apply-suggestions').addEventListener('click', () => {
  if (busy || !model) return;
  const chosen = suggestions.filter(area => area.selected);
  if (!chosen.length) return;
  try {
    model.addMany(chosen, color());
    resetSuggestions(`${chosen.length} suggested area${chosen.length === 1 ? '' : 's'} covered. Check the image for anything missed.`);
    saved = false; render(); announce('Selected suggestions covered. Undo removes this group in one step.');
  } catch (error) { announce(error.message, true); }
});
$('dismiss-suggestions').addEventListener('click', () => {
  if (busy) return;
  resetSuggestions('Suggestions dismissed. Check sensitive details manually.'); render(); announce('Suggestions dismissed. No covers were added.');
});
const guide = setupGuide({ onPractice: () => { if (!busy) $('demo').click(); } });

async function receiveCapture() {
  const token = location.hash.slice(1);
  history.replaceState(null, '', location.pathname);
  if (!token) return;
  if (token === 'guide') { guide.open(); return; }
  if (token === 'capture-error') {
    announce('Capture unavailable. Open a normal http/https page and click Veil again, or import an image here.', true); return;
  }
  if (!globalThis.chrome?.runtime?.sendMessage) { announce('Open this editor from the installed extension to capture a tab.', true); return; }
  try {
    const result = await chrome.runtime.sendMessage({ type: 'capture:consume', token });
    if (!result?.ok) throw new Error('expired');
    const blob = captureToBlob(result.dataUrl);
    result.dataUrl = null;
    await openImage(blob, 'Captured screenshot');
  } catch { announce('This capture expired or was already opened. Return to the page and click Veil again.', true); }
}
render();
void receiveCapture();
