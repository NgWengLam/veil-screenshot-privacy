/** Coordinates are always source-image pixels, never CSS/display pixels. */
export function normalizeRect(start, end, width, height) {
  if (![start.x, start.y, end.x, end.y, width, height].every(Number.isFinite)) return null;
  const x = Math.max(0, Math.floor(Math.min(start.x, end.x)));
  const y = Math.max(0, Math.floor(Math.min(start.y, end.y)));
  const right = Math.min(width, Math.ceil(Math.max(start.x, end.x)));
  const bottom = Math.min(height, Math.ceil(Math.max(start.y, end.y)));
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

export function toImagePoint(clientX, clientY, bounds, width, height) {
  return {
    x: Math.max(0, Math.min(width, (clientX - bounds.left) * width / bounds.width)),
    y: Math.max(0, Math.min(height, (clientY - bounds.top) * height / bounds.height)),
  };
}
