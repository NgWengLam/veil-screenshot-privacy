# Third-party components

Veil 0.3.1 includes these pinned, locally packaged recognition components:

| Component | Version | Source | Licence information |
| --- | --- | --- | --- |
| Tesseract.js worker | 6.0.1 | https://github.com/naptha/tesseract.js | Apache-2.0; bundled component notices retained |
| Tesseract.js core (SIMD and non-SIMD LSTM builds) | 6.0.0 | https://github.com/naptha/tesseract.js-core | Apache-2.0 and accompanying upstream component notices |
| English recognition data, `4.0.0_best_int` | @tesseract.js-data/eng 1.0.0 | https://github.com/naptha/tessdata | Package metadata declares MIT; training data retains upstream licensing |

Supplied licence files and package attribution are in `public/vendor/ocr/licenses/` and are
included in the extension under `vendor/ocr/licenses/`. The worker bundle's own notices are
preserved. `package-lock.json` records npm integrity; `vendor/ocr/integrity.json` records the
SHA-256 hashes of the packaged assets. Vendor files are copied unchanged.

All engine assets are shipped in the extension; running OCR does not contact these projects
or a CDN. Development-only browser tooling is not included in the extension archive.

Packaging note (v0.3): upstream `tesseract-core[-simd]-lstm.js` external-WASM loaders are
copied unchanged under the `.wasm.js` filenames expected by the worker. Their corresponding
`.wasm` binaries live beside `worker.min.js`, because Emscripten resolves them from the worker
URL. No engine source was modified. Integrity hashes cover the loaders and binaries.
