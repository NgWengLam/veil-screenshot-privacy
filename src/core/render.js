/** Redactions replace pixels with fully opaque, integer-aligned rectangles. */
export function renderRedacted(context, source, regions) {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.drawImage(source, 0, 0);
  for (const region of regions) {
    context.fillStyle = region.color;
    context.fillRect(region.x, region.y, region.width, region.height);
  }
  context.restore();
}

export async function exportPng(source, documentState) {
  const canvas = document.createElement('canvas');
  canvas.width = documentState.width;
  canvas.height = documentState.height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not create an export canvas.');
    renderRedacted(context, source, documentState.regions);
    return await new Promise((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Export failed. Try a smaller image.')), 'image/png'));
  } finally {
    canvas.width = canvas.height = 0;
  }
}
