import { CaptureVault, isEditorRequest } from './capture-vault.js';
import { LIMITS } from '../shared/limits.js';

const vault = new CaptureVault();
const editorUrl = chrome.runtime.getURL('editor.html');
let capturing = false;

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') void chrome.tabs.create({ url: `${editorUrl}#guide` }).catch(() => {});
});

chrome.action.onClicked.addListener(async tab => {
  if (capturing) return;
  capturing = true;
  let token;
  try {
    // Fail closed for browser internals and other extensions, even if the API permits them.
    if (!tab.url || !/^https?:\/\//.test(tab.url)) throw new Error('Unsupported page.');
    const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (active?.id !== tab.id) throw new Error('The active tab changed.');
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const [after] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (after?.id !== tab.id || after?.url !== tab.url) throw new Error('The active tab changed.');
    token = vault.issue(dataUrl);
    setTimeout(() => vault.discard(token), LIMITS.handoffMs);
    await chrome.tabs.create({ url: `${editorUrl}#${token}`, windowId: tab.windowId });
  } catch {
    if (token) vault.discard(token);
    // Do not log raw browser errors, page URLs or image content.
    await chrome.tabs.create({ url: `${editorUrl}#capture-error` }).catch(() => {});
  } finally { capturing = false; }
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!isEditorRequest(message, sender, chrome.runtime.id, editorUrl)) return false;
  const dataUrl = vault.take(message.token);
  respond(dataUrl ? { ok: true, dataUrl } : { ok: false });
  return false;
});
