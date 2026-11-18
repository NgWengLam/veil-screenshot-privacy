# Veil privacy statement — version 0.3.1

This statement describes the code delivered in this project. Add the publisher's identity
and contact details before using it as a public store policy.

## Images

Veil processes screenshots and selected image files on your device. It does not upload images
to a server. Images are kept in the editor's memory while you work. A screenshot is briefly
held in the extension worker's memory while its editor opens. Veil does not save an image
history, original files or editing sessions in extension/browser storage.

The original remains in memory during editing, including after export, until you discard it
or close the editor. The application clears references and canvases when the session ends;
browser/operating-system memory management is outside the application's control.

When you export, your browser saves a PNG to the location you choose or your configured
Downloads folder. You control that file. Veil does not delete your originals or downloads.

## Local recognition and guide

An optional scan reads text from the current image on your device. Recognized text and word
positions are held temporarily in memory. Candidate categories and rectangles are shown for
you to review. No text or image is sent to a cloud AI service. The recognition worker is
terminated after the scan, on cancellation, or when the editor exits. No OCR cache or scan
history is persisted. The walkthrough does not store completion history.

## Accounts, analytics and third parties

This version has no accounts, subscriptions, advertising, analytics, telemetry, remote AI
services, or third-party image-processing services. It makes no external application network requests. The local OCR worker reads only assets
packaged with the extension. Language-model caching is disabled.
Your browser's extension distribution/update service operates separately from Veil.

## Permission

`activeTab` lets Veil capture the visible part of the tab you explicitly select by clicking
its toolbar icon or using its assigned shortcut. The extension does not request continuous access to every website or read
your browsing history. Internal browser pages and non-HTTP/HTTPS sources are not captured by
this version; you can import a local image instead.

## Future changes

If accounts, billing or external integrations are added, this statement and the corresponding
store disclosures must be updated before release. Account data must remain separate from
image content, and any change to local-only processing must be explicitly disclosed.

## Clipboard export

`clipboardWrite` allows copying the reviewed flattened PNG when you press Copy image.
Veil never automatically reads the clipboard. The operating system may keep or synchronize
clipboard history according to your settings. Discarding the editor does not clear the OS
clipboard, clipboard history, downloaded files, or copies pasted into another app.
