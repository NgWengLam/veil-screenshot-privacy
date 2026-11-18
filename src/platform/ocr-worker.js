/**
 * Narrow adapter for the pinned Tesseract.js 6.0.1 worker protocol.
 * Own the native Worker directly so Cancel also terminates it during initialization.
 * Change this adapter only alongside the pinned engine and integration tests.
 */
export async function recognizeLocally(imageBytes, { signal, onProgress = () => {} } = {}) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const base = new URL('../../vendor/ocr/', import.meta.url);
  const worker = new Worker(new URL('worker.min.js', base), { name: 'veil-local-ocr' });
  const workerId = crypto.randomUUID();
  const pending = new Map();
  let closed = false;
  function stop(error) {
    if (closed) return;
    closed = true;
    worker.terminate();
    for (const task of pending.values()) task.reject(error);
    pending.clear();
  }
  const abort = () => stop(new DOMException('Cancelled', 'AbortError'));
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(() => stop(new Error('The scan took too long. Try a smaller image.')), 90_000);
  worker.onmessage = ({ data: message }) => {
    if (closed || message?.workerId !== workerId) return;
    if (message.status === 'progress') {
      const progress = Math.max(0, Math.min(1, Number(message.data?.progress) || 0));
      onProgress(message.action === 'recognize' ? Math.round(35 + progress * 65) : Math.round(progress * 30));
      return;
    }
    const task = pending.get(message.jobId);
    if (!task || task.action !== message.action) return;
    pending.delete(message.jobId);
    if (message.status === 'resolve') task.resolve(message.data);
    else task.reject(new Error('Local text recognition failed. Please try again or cover details manually.'));
  };
  worker.onerror = event => {
    event.preventDefault();
    stop(new Error('The local recognition engine could not start. Reload the extension and try again.'));
  };
  worker.onmessageerror = () => stop(new Error('Local text recognition could not read this image.'));
  function request(action, payload) {
    if (closed) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    const jobId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      pending.set(jobId, { action, resolve, reject });
      worker.postMessage({ workerId, jobId, action, payload });
    });
  }
  try {
    await request('load', { options: { lstmOnly: true, corePath: new URL('core/', base).href, logging: false } });
    await request('loadLanguage', { langs: 'eng', options: {
      langPath: new URL('lang/', base).href.replace(/\/$/, ''), gzip: true,
      cacheMethod: 'none', lstmOnly: true,
    } });
    await request('initialize', { langs: 'eng', oem: 1, config: {} });
    await request('setParameters', { params: { tessedit_pageseg_mode: '11', user_defined_dpi: '150' } });
    const result = await request('recognize', { image: imageBytes, options: {}, output: { text: false, blocks: true } });
    return result.blocks ?? [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    stop(new DOMException('Finished', 'AbortError'));
  }
}
