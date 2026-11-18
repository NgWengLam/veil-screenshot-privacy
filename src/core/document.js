import { LIMITS } from '../shared/limits.js';
import { normalizeRect } from './geometry.js';

/** Image bytes are intentionally not part of history or serializable app state. */
export class RedactionDocument {
  #past = [];
  #future = [];
  #regions = [];
  constructor(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > LIMITS.dimension || height > LIMITS.dimension || width * height > LIMITS.pixels) {
      throw new Error('Image is too large. Use an image up to 24 megapixels and 16,384 pixels per side.');
    }
    this.width = width;
    this.height = height;
  }
  get regions() { return this.#regions.map(region => ({ ...region })); }
  get canUndo() { return this.#past.length > 0; }
  get canRedo() { return this.#future.length > 0; }
  #commit(next) {
    this.#past.push(this.#regions);
    if (this.#past.length > LIMITS.history) this.#past.shift();
    this.#regions = next;
    this.#future = [];
  }
  add(rect, color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Choose a supported solid color.');
    if (this.#regions.length >= LIMITS.regions) throw new Error('Maximum 250 redactions per image.');
    const normalized = normalizeRect({ x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height }, this.width, this.height);
    if (!normalized) return false;
    this.#commit([...this.#regions, { ...normalized, color, id: crypto.randomUUID() }]);
    return true;
  }
  addMany(rectangles, color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Choose a supported solid color.');
    if (this.#regions.length + rectangles.length > LIMITS.regions) throw new Error('Maximum 250 redactions per image. Select fewer suggestions.');
    const additions = rectangles.map(rect => {
      const normalized = normalizeRect({ x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + rect.height }, this.width, this.height);
      if (!normalized) throw new Error('A suggestion is outside the image. Please scan again.');
      return { ...normalized, color, id: crypto.randomUUID() };
    });
    if (additions.length) this.#commit([...this.#regions, ...additions]);
  }
  recolor(id, color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Choose an opaque six-digit color.');
    if (this.#regions.some(region => region.id === id && region.color !== color)) {
      this.#commit(this.#regions.map(region => region.id === id ? { ...region, color } : region));
    }
  }
  remove(id) {
    const next = this.#regions.filter(region => region.id !== id);
    if (next.length !== this.#regions.length) this.#commit(next);
  }
  undo() {
    if (!this.canUndo) return;
    this.#future.push(this.#regions);
    this.#regions = this.#past.pop();
  }
  redo() {
    if (!this.canRedo) return;
    this.#past.push(this.#regions);
    this.#regions = this.#future.pop();
  }
}
