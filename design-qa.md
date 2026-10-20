# Sales pricing split view — design QA

Result: **passed** (2026-10-20)

## Visual truth and comparison

- Selected visual: option 2, `D:/Documents/New project/.codex-artifacts/sales-pricing-design-options-20261020/design-2.png`.
- Final implementation: `D:/Documents/New project/.codex-artifacts/sales-pricing-split-layout-20261020/desktop-final.jpg`.
- Source 1487×1058 px; implementation 1440×1024 px, CSS viewport 1440×1024, effective density 1. The source is rendered at the same 1440 px width (height 1024.6 px; no meaningful aspect-ratio drift).
- State: same seven illustrative identities, first three selected, first identity inspected, all-results filter. Fixture counts and genuine numbers use explicit test data; generated sample numbers and margins are not business authority.
- Both images were loaded together before judging: `comparison-full.jpg` (1920×800), `comparison-table.jpg` (1920×800), `comparison-detail.jpg` (1040×960), in the same task folder. Focused comparisons normalize each full image to 1440 px width before cropping.
- Final mobile: `mobile-list-final.jpg`, `mobile-detail-final.jpg`, 390×844 CSS/px. Mobile is an approved adaptation because the reference defines desktop only.

## Findings and repairs

- [P2, fixed] Individual pricing could sit below the visible inspector. The inspector now scrolls its evidence separately and keeps its individual action visible. At 1440×1024 the action ends at y911, above the bulk footer; at 390×844 it ends at y695.5, above the bulk footer. The return-to-list control also stays accessible.
- [P2, fixed] English auxiliary controls overflowed at 320 px. Controls now wrap within the available width. Both document and master-panel horizontal overflow are zero at 320 px.
- [P2, fixed] The original page put the table below long explanations and operations. Explanations now disclose on demand. At 1440×1024 the table begins around y270 and the seven sample rows are 80 px each (previous audit: y883 and 187 px rows). A fixed bottom action region stays visible.
- No remaining P0–P2 findings. Optional P3: fine typography and generated badge shapes are not pixel-identical to the concept; established app fonts, longer truthful state labels and semantic colors take priority.

## Required fidelity surfaces

- **Fonts/typography:** existing system UI font retained; 17 px part numbers and editable prices, 28 px detail heading, 13–15 px supporting text. Hierarchy and wrapping reviewed in Japanese, English and Chinese. No clipping in changed controls at tested widths.
- **Spacing/layout:** 64% list / 36% inspector, compact rows, rose selection, thin dividers and restrained corner radii match the selected direction. Functional filter, reference-fetch and refresh controls require one compact row beyond the static concept. Desktop evidence and mobile details have independent scrolling.
- **Colors/tokens:** existing navy header and red brand accent retained; rose selected/proposed surfaces, green eligible, amber review and blue configured states. Text labels convey status without relying on color. Focus uses a visible blue outline.
- **Image quality/assets/icons:** existing D-CATS production brand asset and header are reused. No new decorative art, custom SVG, fake logo, rasterized interface or placeholder product image. Native disclosures and text actions replace illustrative concept affordances with working controls.
- **Copy/content:** company price explicitly means net class 1; supplier reference and EC tax/source information are separate. Correct profit uses selling price as denominator. Unsupported generated memo placeholders and incorrect sample mappings are not copied. Editable inputs, exact exclusion messages, source dates and component counts use the existing row contract.

## Interaction, accessibility and validation

- All-results selection, indeterminate state, filter-scoped selection, eligible-only bulk confirmation/cancel, protected configured prices and component-zero exclusion retained. Header selection remains visible on mobile with a 44 px label target.
- Part buttons work with Enter. Inspector return restores the corresponding part button. Table and inspector prices synchronize and drafts survive selection/filter changes. Individual actions preserve product identity and existing permission/session checks.
- Three-language desktop/mobile success plus loading, empty, error, unauthorized and stale-session states captured. Intermediate widths 1280/1024/900/720 and 320 px reviewed; 720×512 exercises the space available at approximately 200% desktop scaling. No new animation or motion.
- Final feature tests and authoritative workflow: 147/147, including static build and response headers. Exact source comparison confirms 23 financial/permission/commit/fetch functions unchanged. New behavioral tests cover the split inspector, draft synchronization, changing filters, escaping, individual entry and stale permission guards.
- Synthetic fixture receipt: price saves 0, external fetches 0. Production verification is recorded separately after release; the fixtures do not connect to production.

## Delivery checklist

- [x] Resolve selected second displayed image.
- [x] Build within existing application and preserve server financial contracts.
- [x] Compare full composition and focused list/detail regions in paired inputs.
- [x] Repair P0–P2 and capture final desktop/mobile behavior.
- [x] Pass feature/full workflow, build and strict headers.
- [ ] Normal PR/CI/deployment and live verification (recorded in task evidence).
