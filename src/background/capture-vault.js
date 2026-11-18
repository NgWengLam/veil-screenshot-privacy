import { LIMITS } from '../shared/limits.js';

/** Ephemeral, one-use handoff. Worker termination intentionally loses pending captures. */
export class CaptureVault {
  #entries = new Map();
  constructor(now = () => Date.now()) { this.now = now; }
  issue(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,') ||
      dataUrl.length > LIMITS.captureCharacters) throw new Error('Invalid capture.');
    this.prune();
    if (this.#entries.size >= 2) throw new Error('Finish opening your previous capture first.');
    const token = crypto.randomUUID();
    this.#entries.set(token, { dataUrl, expires: this.now() + LIMITS.handoffMs });
    return token;
  }
  take(token) {
    this.prune();
    const entry = this.#entries.get(token);
    this.#entries.delete(token);
    return entry?.dataUrl ?? null;
  }
  discard(token) { this.#entries.delete(token); }
  prune() {
    for (const [token, entry] of this.#entries) if (entry.expires <= this.now()) this.#entries.delete(token);
  }
}

export function isEditorRequest(message, sender, extensionId, editorUrl) {
  return sender?.id === extensionId && Number.isInteger(sender?.tab?.id) &&
    typeof sender.url === 'string' && sender.url.split('#')[0] === editorUrl &&
    message?.type === 'capture:consume' && typeof message.token === 'string' &&
    /^[a-f0-9-]{36}$/.test(message.token);
}
