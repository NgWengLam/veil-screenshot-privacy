# Release checklist

The project structure is intended to evolve into production. This checklist identifies work
needed before a public release; it does not claim that an audit or store review has occurred.

## Engineering

- [ ] Run `npm run verify` on the exact release source.
- [ ] Run `npm run test:e2e` with the pinned Playwright/browser combination.
- [ ] Install the actual packaged extension in Chrome and Edge; verify the real toolbar action
      on normal pages, incognito only if intentionally supported, multiple windows, and a
      Retina/high-DPI display. Confirm viewport-only capture is clear to users.
- [ ] Test capture failure and service-worker restart; original image must never persist.
- [ ] Confirm exported pixels with overlapping covers, white covers, very small selections,
      edges, reverse dragging, 200% zoom and an uncensored area immediately beside a cover.
- [ ] Confirm cancel/retry workflows, keyboard navigation, undo/redo, file size limits and
      low-memory behavior. Check screen-reader announcement and pointer/touch behavior.
- [ ] Monitor network requests and storage during capture, editing, export, refresh and exit.
- [ ] Review browser permissions/CSP and any future dependencies for least privilege.
- [ ] Perform a security review using synthetic data. Never put real user screenshots in tests.

## Product and publishing

- [ ] Choose and clear the final product name, publisher identity and asset rights.
- [ ] Add publisher support/security contacts and a public privacy policy matching the build.
- [ ] Prepare genuine store screenshots, description, icons and permission justification.
- [ ] State limitations accurately: heuristic text suggestions plus manual review, no full-page capture, no cloud history.
- [ ] Verify current Chrome Web Store / Edge Add-ons rules at submission time.
- [ ] Increment the version and archive the exact source and built release.
- [ ] Push source to a repository and use protected review/release practices.

Do not add a signing secret, payment secret or private API credential to any extension file.

## v0.2 acceptance checks

- [ ] Capture a webpage, scan, verify the amber outlines, accept some candidates, and export.
- [ ] Repeat with an imported screenshot, then cancel a scan during initialization and rescan.
- [ ] Check that ignoring suggestions does not change pixels and undo reverses a whole accepted group.
- [ ] Verify all OCR files load from the extension origin, with no CDN fallback or IndexedDB cache.
- [ ] Open How it works, use Back/Next/Escape, and practice with the fictional sample.
- [ ] Test names, faces and QR codes manually; the detector does not claim comprehensive coverage.

## v0.3 acceptance

- [ ] Reload unpacked extension, close old editors, and confirm version 0.3.1.
- [ ] Test Alt/Option+Shift+V capture and shortcut reassignment in Chrome and Edge.
- [ ] Run sample OCR from the extension origin with no CSP errors and no remote requests.
- [ ] Change a cover's custom color; undo it and inspect the exported pixel color.
- [ ] Inspect preview at 100%; save and copy; paste into another application.
- [ ] Verify clipboard denial fallback and no export on Escape/Back.
- [ ] Review the illustrated guide with keyboard navigation and a screen reader.
