# Security design and review notes

## Assets and trust boundaries

Sensitive assets are captured pixels, imported images and the details visible in them.
Web pages and imported files are untrusted. The extension package, browser image decoder and
OS are trusted for this MVP. An attacker controlling the browser or device is outside scope.

## Controls implemented

| Risk | Control |
| --- | --- |
| Passive collection of browsing content | Temporary `activeTab`; capture occurs after a toolbar click or assigned shortcut; no content scripts or host permissions |
| Capturing the wrong tab after a switch | Check the active tab before and after capture; discard on observed mismatch |
| Screenshot in a URL or persistent history | Only a random handoff token in the fragment; editor removes it immediately; no image storage APIs |
| Unauthorized capture consumption | Exact sender extension ID and editor URL, tab context, message type and token validation; one-use token |
| Stale screenshot remaining in worker | 20-second timeout, expiry-on-access and discard after consumption; worker termination clears memory |
| Original data recoverable under a cover | Opaque pixel replacement on a fresh export canvas; no editable layers; integer outward-rounded rectangles |
| Code injection | Packaged modules only, restrictive CSP, no eval, no HTML interpolation, no SVG import |
| Data transmission | CSP `connect-src 'self'` for packaged OCR assets only; no external endpoints, analytics or remote assets |
| Accidental revealing export | User review confirmation on every export; explicit warning when zero covers exist |
| Memory exhaustion | File, dimension, pixel, history, region and pending-capture limits |
| Metadata/source-name leakage | Fresh PNG encode and generic filename, not copying original binary metadata |

## Important boundaries

- This is user-reviewed redaction with optional heuristic OCR suggestions. Cover all copies of sensitive information, including avatars,
  QR codes, reflections, thumbnails, contextual clues and identifiers outside obvious fields.
- Undo restores source pixels in the editor. The original remains available in RAM until
  discarded or the tab exits; this is required for editing.
- Clearing canvases and dropping references is not guaranteed secure erasure of RAM/swap or
  browser crash dumps. No claim of forensic deletion is made.
- The extension does not delete input files, exported downloads, screenshots made by the OS,
  clipboard history or files synced by the user's own software.
- Rapid tab switching away and back between browser API checks cannot be made fully atomic
  with `captureVisibleTab`. Users should keep the target tab active during capture.
- Browser service workers may terminate. A lost pending capture produces an explicit retry
  message; it is never recovered by putting image data on disk.
- The static guardrail script is not a comprehensive vulnerability scanner or audit.
- Future billing/telemetry dependencies and OCR upgrades must be reviewed for new network and data access.

## Reporting an issue

Before public release, add a monitored security contact and a private vulnerability reporting
channel. Reproduction examples should use synthetic images, not customer screenshots.
Keep report logs free of screenshot data, file names, source URLs and auth tokens.

## v0.2 recognition boundary

The worker, SIMD/non-SIMD LSTM cores and English data are packaged with checksums and notices.
The custom worker adapter uses a pinned protocol and owns worker lifetime so cancellation
also works during initialization. Cache method is explicitly `none`. Worker messages are
matched to generated worker/job IDs. Errors shown in the UI are generic rather than raw OCR
payloads. Scans time out after 90 seconds and use at most 6 MP for recognition.

Candidate matching is heuristic: it does not prove that a number is a phone, an ID is valid,
or an image is free of private information. Unlabeled names, faces and QR codes are not
reliably detected. Small/non-Latin text can be missed. Export is gated while suggestions
remain pending; applying selected boxes is an atomic undoable edit. Suggestions are drawn
on the editor overlay only, never on the export canvas.
