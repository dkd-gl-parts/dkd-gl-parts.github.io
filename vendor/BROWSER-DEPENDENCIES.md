# Self-hosted browser dependencies

These exact upstream browser bundles are served from the D-CATS origin so the
production Content Security Policy can keep `script-src 'self'`. The release
asset verifier recomputes each SHA-384 digest from the committed bytes and
requires the matching SRI value at every load site.

| Local asset | Upstream source | SHA-384 (base64) | License files |
| --- | --- | --- | --- |
| `supabase-js-2.115.0.js` | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js` | `CLZeq1dk8+Uzrs7TVvBUdlFoV5F0DMqgRoeHa8g5wJcuPe5SkVfEvdxB0ZuzlnBQ` | `supabase-js-2.115.0-LICENSE` |
| `jsbarcode-3.12.3.all.min.js` | `https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js` | `vmcSy8TM1KhZWBIKMKTR8AxbrJQCuConAolGY+42odu9ZGIzw8L8xAT/u7ul4X2U` | `jsbarcode-3.12.3-MIT-LICENSE.txt` |
| `zxing-browser-0.2.0.min.js` | `https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.0/umd/zxing-browser.min.js` | `HRtzk9lZgkbSgvUyQrnfC/GxiXZgwaNyD7hC9wcXlsBpDhkS80ISl73juef2FRuf` | `zxing-browser-0.2.0-LICENSE`, `zxing-library-0.22.0-LICENSE`, `zxing-text-encoding-0.9.0-LICENSE.md` |

Do not replace these files by hand. Fetch a reviewed exact version into an
isolated directory, verify its bytes independently, update this inventory and
the verifier together, and run all frontend checks before release.
