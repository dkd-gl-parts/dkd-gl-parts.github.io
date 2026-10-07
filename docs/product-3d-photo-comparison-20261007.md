# Private 3D preview / source-photo comparison

## Scope and acceptance

The system administrator can optionally open **元写真と比較** inside a private
Tripo review Viewer. The existing saved-image gallery supplies the reference
photos, including top, bottom and close-up photos not submitted to generation.
Clicking a thumbnail displays the original private image next to the rotating
GLB (stacked on mobile). The gallery retains the preparation screen's order and
image-number/ID labels. Nothing assigns a reference photo to a generation slot.

This is a quality-review aid, **not mesh correction**. The first generated
alternator remains unsuitable for product publication. Its stored GLB, ledger,
generation charge and publication status are unchanged.

## Data and authorization boundaries

- Reuse `core_product_images` rows already loaded by the existing authorized
  preparation flow, and `signProductImageUrl` for a selected original.
- No new table, policy, RPC, secret, external transmission or paid API call.
- Comparison is available only for the current authorized private review.
  Ordinary customer, registered-model and local-file Viewers remain unchanged.
- Clear signed image DOM and comparison state on Viewer/Tripo close, a new
  Viewer, account changes, and preparation-product/kind changes. Suppress stale
  photo requests after selection changes, collapse or lost authorization.
- Failed original retrieval identifies thumbnail-only display; failed decoding
  does not claim a successful quality check.
- Keep the existing strict CSP and pinned GLB loader.

## Verification

`tests/product-3d-photo-comparison.test.cjs` exercises opt-in display, source
selection, gallery order, target guards, race cancellation, failure states,
escaping, cleanup and non-mutation. Existing Viewer/Tripo/upload tests cover
the shared integration. `tests/serve-product-3d-photo-comparison.cjs` exposes
only a loopback synthetic fixture for hidden PC/mobile QA, without a login,
private photos or external API calls.

Local verification passed: 142 product-3D tests and all 127 authoritative
workflow Node commands. Static build, response-header/CSP guards and syntax
checks passed. Hidden IAB verified 1280x720 PC side-by-side rendering and
390x844 mobile stacked rendering without horizontal overflow, top/bottom
selection, zoom/reset, keyboard focus, original-photo retrieval failure,
and comparison hiding for a synthetic non-admin identity. Error retrieval
explicitly reports thumbnail-only comparison. Unit tests cover stale sessions,
selection races and image decoding failure. No user browser or credentials
were used. Synthetic photos/GLB prove UI behavior, not actual alternator quality.

Local screenshot evidence: task-owned
`D:/Documents/New project/.codex-tmp-product3d/PHOTO-COMPARISON-PC-20261007.png`
and `PHOTO-COMPARISON-MOBILE-20261007.png`. Public delivery of v1.1.1121 is
verified separately after the reviewed release; authenticated real-photo
comparison remains a distinct check.

## Release and rollback

Release through the normal frontend guard and static/header workflows. No
database or Tripo deployment is required. Pre-change main is
`34fcbbe8ec49b8ae064bc4e62c615119f90ab6b8`; restoring that reviewed frontend
would require a separate rollback decision and leave the private model intact.

## Next model-quality step

Use the existing top/bottom source photographs as evidence for actual geometry
correction or a suitable reconstruction workflow. The current Tripo H-series
contract accepts front/left/back/right, not six top/bottom inputs. Texture-only
changes or repeating the original four lateral views are not proven fixes.
Any additional paid generation or external image transfer needs its own scope
and authorization; it is not triggered by opening comparison.
