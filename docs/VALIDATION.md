# Validation record — 2026-10-16, v0.3.0

## Passed

- **17 Node tests**: geometry/scaling, history/raster coverage, input limits, mocked browser
  capture handling, capture expiry/replay/sender boundaries, fresh-install guide behavior,
  detection patterns, OCR coordinate mapping, and atomic suggestion batches.
- **Static checks/build**: syntax/import checks for 14 source modules, minimal permissions,
  local-only CSP, privacy guardrails and SHA-256 hashes for packaged OCR assets.
- **16 browser checks** in Chromium 153 headless: packaged editor load, five guide steps,
  actual local OCR detecting email/phone in fictional sample data, selection/review/export
  gating, accepting suggestions as one undoable edit, scan cancellation, manual drag/undo/redo,
  coordinate input, downloaded PNG pixels and metadata, review-cancellation regression,
  discard, malformed files, import, zoom/narrow layout, no external requests, no browser data
  storage, and no JavaScript/CSP errors. Visually inspected the suggestions interface.

## Browser verification scope

The available headless-shell browser does not start extension service workers. The browser
suite ran the **exact packaged editor and OCR assets served on loopback** with the manifest's restrictive CSP sent as a response header on
every resource, including the OCR worker. This verifies UI, Canvas exports, Workers, WASM and OCR, but not the installed
extension origin, toolbar permission grant, or Manifest V3 service-worker runtime.

The user reported that the v0.1 capture/editor workflow worked in their browser. v0.3 still
needs an unpacked-extension acceptance pass in Chrome/Edge, especially OCR on the extension
origin and fresh-install onboarding. The default suite loads the actual extension when a
full Chromium build is available. Toolbar capture is mocked in the Node tests.

## Reproduction

```sh
npm run verify
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
npm run test:e2e
```

For an existing Chromium binary without extension support:

```sh
VEIL_TEST_WEB=1 VEIL_BROWSER_EXECUTABLE=/absolute/path/to/chromium npm run test:e2e
```

Tests use a disposable profile and fictional data. Web mode binds only to loopback. Artifacts
are excluded from the release. High-DPI devices, actual toolbar capture and screen readers
remain on the release checklist. This is a tested MVP, not an independent security audit.

## v0.3 regression coverage

The browser suite now applies CSP to the worker response as well as the editor. This catches
embedded data-URL fetches that the old meta-only web harness missed. Real bundled OCR passes
with external WASM files and `connect-src 'self'`; no policy relaxation was needed.
The suite also verifies opaque custom recoloring/undo, a full-resolution 100% PNG preview,
real clipboard PNG pixels, clipboard-denial fallback, and keyboard preview invocation.
All five illustrations load; the editor and preview were visually inspected.
OS-level capture shortcuts, extension-origin OCR and paste into external desktop apps remain
manual acceptance checks because this browser binary cannot run extension service workers.
