# Local document parsers

SheetJS CE 0.20.3 comes from the official, versioned SheetJS CDN. The npm
`xlsx` 0.18.5 package is not the current distribution. Both manufacturing
import consumers use the same full build (including Japanese code pages).
The loader checks the exact version and uses SHA-384 Subresource Integrity.

PDF.js 6.3.289 uses the official **legacy** build to include upstream language
polyfills. The main ES module, module worker, CMaps, standard fonts and their
licenses come from one `pdfjs-dist` tarball. `parser-inventory.json` records
the archive provenance and exact SHA-256/SHA-384 of every deployed file.
The npm archive was checked against its published SHA-512 integrity.

The application extracts text only; it does not load the viewer, sandbox,
annotation scripting, render pages or execute document actions. It explicitly
sets `isEvalSupported: false` (retained defensively; this eval optimization no
longer exists in PDF.js 6) and `useWasm: false`. No WASM/image-decoder assets
are deployed or needed for this text-only path. CMaps and standard fonts stay
on the same origin. Main-module SRI, the inventory guard and versioned worker
path prevent accidentally mixing release files. Each loading task is destroyed
on success and error. CSP remains `script-src 'self'` without eval allowances.

The upstream legacy support baseline is Chrome 125+, Chromium Edge, Firefox
ESR+, and Safari 18+ (mostly supported). Modern builds require the latest
browser features, so they are not used here. Earlier browser versions are not
claimed supported by this update. Node is used only for CI, not the browser
runtime. No LTS/security support commitment for PDF.js 4.x was found; merely
choosing the first 2024 fix would not establish a maintained distribution.

Sources reviewed 2026-09-21:

- <https://cdn.sheetjs.com/>
- <https://docs.sheetjs.com/docs/getting-started/installation/standalone/>
- <https://cdn.sheetjs.com/advisories/CVE-2023-30533>
- <https://cdn.sheetjs.com/advisories/CVE-2024-22363>
- <https://github.com/mozilla/pdf.js/releases/tag/v6.3.289>
- <https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#faq-support>
- <https://github.com/mozilla/pdf.js/wiki/Setup-pdf.js-in-a-website>
- <https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq>
- <https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j>

Update all matching bundles/support assets, inventory hashes, `.gitattributes`
and the asset verifier together. Preserve the upstream bytes and licenses.
Run the import/runtime guards, the full workflow and browser tests under the
production CSP. A rollback must restore the whole parser set and caller code
from the same reviewed commit, never a mismatched main/worker pair.
