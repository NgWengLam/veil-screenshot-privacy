# Architecture and extension points

## Current boundaries

The extension is one deployable client with no application server. Its state lives in memory.

1. A toolbar action grants temporary `activeTab` access. The background worker checks that the
   source is an HTTP/HTTPS tab, captures its visible viewport, and checks the active tab again.
2. `CaptureVault` holds the PNG data URL for at most 20 seconds while the editor opens. The
   editor URL contains a random one-use token, never the screenshot or source-page URL.
3. The editor validates/consumes the token over an internal runtime message. The worker
   accepts requests only from this extension's exact editor page. It deletes the token as
   part of consumption. Pending screenshots are also lost if the service worker terminates.
4. The editor decodes the PNG into an `ImageBitmap`. A `RedactionDocument` contains only
   geometry, approved colors, IDs and bounded undo history; it never contains image bytes.
5. The preview and export use the same `renderRedacted` primitive. The export draws the source
   then opaque, outward-rounded pixel rectangles onto a fresh canvas before PNG encoding.
6. Download uses a short-lived object URL and a generic filename. No download permission is
   requested. The browser owns the user's final Save/Download behavior.

## Why this structure

- `core` is independent of Chrome APIs. Geometry/history can be tested with Node alone.
- `background` owns browser privileges and exposes one narrowly scoped message.
- `platform` owns decoding and saving. Additional browser adapters belong here.
- `editor` owns presentation and interaction; it never persists image content.
- `shared` contains configuration that must agree across these boundaries.
- `public` contains only packaged assets. No CDN, remote fonts or remotely loaded scripts are needed. OCR assets are vendored
  locally with package integrity hashes and licence notices.
- `dist` is reproducible output, assembled from a small allowlist of source folders.

JavaScript modules keep the first version buildable without a supply chain of bundler and UI
packages. If TypeScript is added, these module boundaries can remain unchanged. Avoid a
framework migration solely for monetization; the domain and service boundaries matter more.

## Local OCR (implemented in v0.2)

`src/detection/scan.js` takes a temporary copy of the redacted preview, bounded to 6 MP.
`src/platform/ocr-worker.js` owns a native Worker running pinned Tesseract.js 6.0.1. Owning
that worker directly permits immediate cancellation even while the engine is initializing.
The adapter is version-specific; update its protocol tests when upgrading the engine.

Only packaged engine/model paths are provided. Language caching is disabled. The CSP allows
same-origin resource reads and WASM compilation, but no external connections, remote code,
inline scripts or arbitrary JavaScript eval. Each scan gets a fresh worker and destroys it
on completion, failure, cancellation, timeout or page exit.

`patterns.js` identifies candidate text spans; `suggestions.js` maps their OCR word boxes back
to source pixels with a small safety margin. Only categories and rectangle coordinates leave
this stage for the UI, not recognized strings. Outlines live on a separate overlay and are
excluded from export. Applying selected suggestions adds one undoable group of opaque covers.
Export is unavailable until the user applies or dismisses the suggestions. Editing redactions
invalidates existing suggestions. Names/faces/QR codes are not generally recognized.

The five-step guide is in `src/editor/guide.js`, with native dialog focus handling, keyboard
navigation, and a practice-sample action. Fresh installation opens the guide once via the
installation event. The Help button reopens it; no guide-seen flag is stored.

## Future account and subscription services

Add modules only when implementation starts:

| Proposed path | Role |
| --- | --- |
| `src/services/entitlements.js` | Narrow interface returning plan and feature entitlements; no image arguments |
| `src/platform/account-client.js` | Authentication and communication with one approved API origin |
| `src/account/` | Optional sign-in, plan and licence UI |
| `apps/api/` or an independent repository | Account/entitlement endpoints and verified payment webhooks |

The image engine and existing editor remain in their current locations. The API should
accept only account/entitlement payloads; do not reuse capture messages or document state as
API request payloads. Keep auth tokens out of source code, URLs, screenshots and diagnostic
logs. Store no payment card data; use a hosted payment provider flow.

When monetization is introduced:

- Verify payment webhooks and assign entitlements on the server. Never trust a client plan flag.
- Use scoped, expiring credentials and a revocation/grace policy appropriate to the product.
- Add only the exact required API origin to networking permissions/CSP after review.
- Preserve a no-network image-processing boundary and test that image data cannot appear in
  outbound payloads or telemetry.
- Retain a free local editor path if that is the chosen product policy.
- Remember that client-only paid features are modifiable by a determined user. Signed licence
  claims improve authenticity but cannot make distributed client code tamper-proof.

No login/billing placeholders or fake security controls are shipped in this version.

## Limits and lifecycle

Import validation rejects unsupported MIME types and compressed files larger than 20 MiB;
decoded dimensions are checked before editor canvases are created. The browser must still
decode the raster to discover its dimensions, so this is a resource guardrail rather than a
hard defence against all hostile image decoders. Browser updates remain important.

Memory includes the decoded source, two preview canvases, a temporary export canvas, and a
PNG blob. At the 24 MP ceiling this can use hundreds of megabytes. Lower the cap for low-memory
target devices. No automatic restore is offered: refreshing loses the editor session.

## Export preview and colors (v0.3)

A preview serializes a fresh redacted PNG once, displays it via a temporary object URL and
locks editing. Save and clipboard share that same Blob; neither receives source image data.
Closing the preview revokes the URL and drops the Blob. Clipboard failure leaves the dialog
open for retry or download. The browser clipboard operation begins directly from a click.
Colors are validated as six-digit hex values in the domain model, excluding transparency,
CSS expressions and alpha channels. Recoloring commits one undoable history change.
The reserved `_execute_action` command uses the existing toolbar capture path and sender
checks. It does not add a global key listener, host permissions or background page reading.
