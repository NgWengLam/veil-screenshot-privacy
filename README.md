# Veil — Screenshot Privacy

A local-only screenshot redaction extension for Chrome, Edge and Firefox (Manifest V3).
Version 0.3.1 adds a Firefox build and more OCR suggestions: IC numbers without dashes, passport
numbers, bank account numbers, and passwords/secret keys. Version 0.3.0 added capture shortcuts, custom opaque colors, clipboard export, exact PNG previews,
an illustrated walkthrough, stronger button contrast, and a local OCR loading fix.
There are no accounts, subscriptions, analytics, or uploads. The recognition engine and its
English language data are bundled locally; they do not load from a CDN.

## Try it now

Download the ready-to-install files from the **Releases** page of this repository:
the signed `.xpi` for Firefox, and the `dist` ZIP for Chrome and Edge.
Or build them yourself: install Node.js 22+, then run `npm run build` in this folder
(no `npm install` is needed). This creates `dist/` (Chrome/Edge) and `dist-firefox/` (Firefox).

**Chrome or Edge:**

1. Extract the `dist` ZIP, or build it as described above.
2. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
3. Enable **Developer mode**, choose **Load unpacked**, and select the `dist` folder.
4. Pin **Veil — Screenshot Privacy** using the browser's Extensions menu.
5. Visit a normal HTTP/HTTPS page and press Alt/Option+Shift+V or click Veil's icon. The visible part of that tab opens in the editor.
6. Drag solid covers over private details. Use **Add by coordinates** for precise or keyboard-only input.
7. Click **Export PNG**, review the image, tick the confirmation box, and save.
8. **Discard image** or close the editor when finished.

**Firefox (128 or newer):** drag the signed `.xpi` from the Releases page into a Firefox window
and click **Add**. It stays installed after restarts.

For development, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**,
and select `dist-firefox/manifest.json`. A temporary add-on is removed when Firefox closes.
The Firefox build is signed through Mozilla's add-on review (unlisted).

To try the editor without capturing a page, clicking the icon on a browser-internal page opens
the editor with an explanatory capture message. Choose **Open image** or **Try a sample screenshot**.
The sample contains fictional details only.

**Validation status:** 20 Node tests, static/build checks and 17 browser checks passed. Browser
checks covered the packaged editor/OCR on loopback, not an installed extension, because the
available headless browser cannot run extension service workers. Test the updated unpacked
extension in Chrome/Edge before release. See `docs/VALIDATION.md`.

## Update from an earlier version

1. Close old Veil editor tabs (export anything you need first).
2. Extract this archive and replace the contents of the **same `dist` folder you previously loaded**.
3. At `chrome://extensions`, press **Reload** on Veil's card and confirm version **0.3.1**.
4. Capture a page again. Click **Find sensitive details**, review the amber outlines and tick
   the suggestions you want, then choose **Cover selected**.
5. Open **How it works** for the five-step guide. A fresh install opens it automatically;
   updating does not interrupt you with a new tab.

If you load a different folder as a new unpacked extension instead, remove the old Veil entry
so you do not accidentally open the previous version.

## Smart suggestions

The scan uses **local OCR plus pattern matching**, not a cloud chatbot. It suggests emails,
phone-like numbers, Malaysian IC numbers (with or without dashes), Malaysian-format passport
numbers, Luhn-valid payment-card patterns, valid IBANs, IPv4 addresses, common API keys and
tokens (GitHub, AWS, Google, Slack, Stripe/OpenAI-style, JWTs, private-key headers), and values
next to explicit English labels: names, addresses, IC/ID, passport, bank account, password,
PIN, OTP/TAC and API key. These are candidates, not a verified
classification of private data. Names without labels, faces, avatars, QR codes and non-Latin
text are not reliably detected and should be checked manually.

- Amber dashed outlines are suggestions only. They are never embedded into exports.
- Select/deselect candidates; **Cover selected** applies them as one undoable group.
- Export is disabled while suggestions are pending; apply selected candidates or dismiss them.
- Manual edits clear old suggestions to avoid using stale candidate state.
- Cancellation terminates the OCR worker even during initialization. It also ends after each scan.
- A scan uses a temporary preview up to 6 MP; large images can lose small text during downscaling.
- No recognized text, image, or guide-completion history is saved. No account is required.

## Included

- Explicit, user-triggered capture of the visible area of an HTTP/HTTPS tab.
- Local PNG, JPEG and WebP import; drag-and-drop; image paste via Ctrl/Cmd+V.
- Custom-color opaque rectangles, native-pixel coordinates, undo/redo and per-area removal.
- Fit, 100% and 200% views; source-resolution export.
- A review step, including a clear message when no areas are covered.
- PNG output rendered onto a fresh canvas. Covers replace source pixels in the export.
- No original filename, source URL or editable redaction layers in the exported file.
- Per-file limits: 20 MiB, 24 million pixels, 16,384 pixels per side; 250 redactions; 100 undo steps.
- One-use, short-lived screenshot transfer; no persistent screenshot history.

This version does **not** include cloud AI, blur, full-page scrolling capture,
batch processing, cloud sync, authentication, or billing. Redactions can be removed and redrawn;
dragging/resizing existing boxes is not yet included. The Firefox build (`dist-firefox/`) uses
the same code with a Firefox-specific manifest.

## Project layout

| Path | Responsibility |
| --- | --- |
| `manifest.json` | Extension metadata, minimal permissions and Content Security Policy |
| `src/background/` | Toolbar capture and short-lived, one-use screenshot handoff |
| `src/core/` | Redaction document/history, geometry, and flattened PNG rendering |
| `src/platform/` | Browser image decoding and download operations |
| `src/editor/` | UI orchestration, five-step guide, and fictional sample image |
| `src/detection/` | OCR scan coordination, sensitive-text rules and rectangle mapping |
| `public/vendor/ocr/` | Pinned worker, WASM engines, English data, licences and integrity hashes |
| `src/shared/` | Explicit limits and supported solid colors |
| `public/` | Editor HTML/CSS and bundled icons |
| `tests/unit/` | Geometry, limits, history, capture boundary and browser API mock tests |
| `tests/e2e/` | Actual loaded-extension UI and exported-pixel checks with Playwright |
| `scripts/` | Dependency-free build and security guardrails |
| `docs/` | Architecture, threat model, privacy statement and release checklist |
| `.github/workflows/` | Verification workflow for when this project is pushed to GitHub |
| `dist/` | Generated, installable extension; never edit this instead of source |

The implementation uses JavaScript ES modules, native browser UI APIs, and Canvas.
A framework or bundler is not required for this scope. Domain logic is separated from browser
APIs so future UI or browser changes do not require rewriting the redaction engine.

## Development

Use Node.js 22 or newer. Vendored engine files are already included, so normal builds do not
require npm install. To regenerate the OCR assets from the pinned lockfile, run:

```sh
npm ci --ignore-scripts
npm run vendor:ocr
```

```sh
npm run verify
```

This checks the security guardrails, runs unit tests, then regenerates `dist/`.
After changing source, rebuild and press **Reload** on the extension's card at `chrome://extensions`.
Close and reopen any old editor tabs so they use the new code.

To recreate the source + installable ZIP after verification, run `python3 scripts/package.py`.

Optional browser tests require a pinned, development-only Playwright installation:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
npm run build
npm run test:e2e
```

Playwright runs in its own temporary browser profile. It does not use your browser session.
Test screenshots are generated from fictional sample data into ignored `artifacts/` and are
not included in the release ZIP. See `docs/VALIDATION.md` for the results and remaining checks.

## Security and privacy

`activeTab` and `clipboardWrite` are requested. Clipboard access is write-only and used only
when you choose Copy image; there is no background clipboard reading. There are no host permissions, injected content scripts,
external messaging endpoints, analytics or image storage APIs. The CSP blocks external
connections and remote code. `connect-src 'self'` permits the OCR worker to read only packaged
resources; `wasm-unsafe-eval` permits the bundled recognition engine, not arbitrary JavaScript
eval. Language-data caching is disabled.

The original image remains in the editor's memory while editing so undo works. The extension
drops references and clears canvases on discard or page exit; it cannot guarantee forensic
erasure from browser/OS memory, swap, crash dumps or browser implementation caches.
An exported PNG is a local file controlled by the user. Closing the editor does not delete it.

Always inspect every sensitive detail. Suggestions can miss private details or flag harmless text.
See `docs/SECURITY.md` and `docs/PRIVACY.md` for precise boundaries.

## Adding paid plans later

The editor and image engine can stay in place. Add a separate account/entitlement adapter and
an independently deployed billing backend. Store only account identifiers and entitlement
records there. Do not route image bytes through that service. See `docs/ARCHITECTURE.md` for the
recommended boundaries and security requirements.

The structure supports this evolution, but a production release still needs real-browser
acceptance testing, store disclosures/assets, and a security review. The brand name is a
working project name, not a claim that it is available for commercial use.

## Technical references

- [Chrome Tabs API and activeTab](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Extension Content Security Policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)

## Shortcuts and preview (v0.3)

| Action | Shortcut |
| --- | --- |
| Capture visible tab | Alt+Shift+V (Option+Shift+V on Mac) |
| Open export preview | Ctrl/Cmd+Shift+E |
| Open clipboard preview | Ctrl/Cmd+Shift+C |
| Undo / redo | Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z |
| Open illustrated help | ? |

Assign or change capture keys at `chrome://extensions/shortcuts` (Edge: `edge://extensions/shortcuts`).
If another extension or your OS owns the keys, assign another combination there.
Editor shortcuts do not override typing in form fields or open dialogs.

Choose Custom and pick a color for new covers, or use a covered area's swatch to recolor it.
All colors are fully opaque; recoloring supports undo. In the export preview, enable 100%
inspection to check small details and edges. Confirm the review, then save or copy. The
preview, download and clipboard use the same flattened PNG. No automatic export happens.
Clipboard denial leaves the preview open and offers Save PNG as a fallback.

The previous OCR error was a CSP block on a base64-embedded WASM engine. The pinned upstream
external-WASM loaders now load packaged `.wasm` files. The `connect-src 'self'` policy stays
unchanged; neither screenshots nor OCR text are uploaded.
