# 品番詳細の折り返し修正（2026-10-05、v1.1.1094）

利用者の追加指示を優先し、品番とメーカー情報を左右に分割する配置を修正した。品番見出しは全幅の独立した行、メーカー情報はその下の2列とする。既存の24pxフォント・全文・選択機能・原価計算を保持する。

- 問題画像: `C:/Users/yamam/AppData/Local/Temp/codex-clipboard-267b55c0-5580-4e28-9b95-eab3a7db5422.png`。末尾の「1」だけ折り返していた。
- 検証画面: `outputs/cost-workspace/part-number-1280.png`（1280×900、1画像pixel/CSS px）。詳細欄の拡大証拠: `outputs/cost-workspace/part-number-detail.png`。
- 非表示IABの合成fixtureで対象品番 `8-97120-356-1` を再現し、1280/1487/390/320pxすべてで見出し高さ33.59px・行高33.6px、24pxのまま1行に表示できることを確認。メーカー情報は見出しの下、横はみ出し0。
- 極端に長い合成品番は省略・縮小・横スクロールを使わず安全に折り返し、1280/320pxで横はみ出し0。通常の対象品番の末尾だけ折り返す不具合は解消。
- 品番切替、Enter選択、部品明細を確認。console error/warn 0、全117 Node検査・静的build・CSP・diff検査成功。
- 変更は詳細識別欄のCSSと回帰検査、配信版のみ。実DB・価格・在庫・認証情報を操作していない。認証済み本番の保存/削除/取込は未操作。
- 最新の表示要件を優先するため、下記採用画像との相違（メーカー情報を下段へ移動）は意図的。全体の一覧＋詳細、配色、アセット、文字サイズは維持する。

final result: passed

# 製造原価・採用2案のDesign QA

Date: 2026-10-05

## Findings

現在、actionable P0/P1/P2はなし。一覧と右側詳細、上部2行の操作と集計帯を採用2案に合わせた。既存の原価計算・保存・CSV・登録条件は変更しない。

## Comparison target and normalization

- Source visual truth: `C:/Users/yamam/.codex/generated_images/01a0a29e-046f-7062-a797-e2b7e2ba44c4/exec-1d516f93-7dcf-4051-851c-84fdc598742c.png`
- Implementation: `index.html`, `app.js`, `manufacturing-cost-workspace.css` in `D:/Documents/New project/worktrees/manufacturing-cost-workspace-20261005`.
- Browser-rendered implementation screenshot: `outputs/cost-workspace/desktop-final.png`.
- Source pixels: 1487×1058. Implementation pixels: 1487×1058. CSS viewport: 1487×1058. Effective captured density: 1 image pixel per CSS pixel; no rescale or device frame. In-app-browser full-page capture excludes browser chrome.
- State: Japanese, saved list loaded, first product selected, company settings closed, component disclosure collapsed. Synthetic fixture uses the two displayed reference products and explicitly labelled synthetic extra rows. No production account/session copied, no production API requests, no business data writes.
- Full-view evidence: source and final screenshot opened together in the same comparison input. Major regions match: two-row operations, four-value aggregate strip, approximately 2:1 list/detail split. Workspace top is 371 CSS px, source approximately 374 pixels; all controls and collapsed component-detail control remain visible at the target viewport.
- Focused evidence: `outputs/cost-workspace/source-detail.png` paired with `implementation-detail.png`, and `source-controls.png` paired with `implementation-controls.png`, in the same comparison input. Crops align actual content regions; source detail 487×684, implementation detail 485×687; controls source 1439×241, implementation 1440×239. No stretching.
- Responsive screenshots: `outputs/cost-workspace/desktop-1280.png` (1280×900), `mobile-390.png` (390×844, selected detail opened). DOM width checks also at 1024/768/320, long part number and large amount stress states: no document overflow and no overwide rendered element.

## Fidelity surfaces

- Fonts/typography: existing `--dcats-font-ui` Japanese UI font stack retained, scoped consistently to screen and settings. Primary part number is 18px bold in list and 24px in detail; manufacturer codes are 12/14px supporting text. Amounts remain prominent 17/18/28px with tabular digits. No part-number truncation; long identifiers wrap. Target generated typography is inferred, not a supplied licensed typeface; the established D-CATS font and slightly denser supporting labels are intentional product constraints, not a pixel-perfect font identity claim.
- Spacing/layout rhythm: 24px desktop outer spacing, 16px grid gap, approximately 1.95:1 tracks, compact 40px controls, 8px card radii. Both regions align and component disclosure is above the fold at target size. List height adapts to viewport; detail has independent overflow for longer content. Mobile uses stacked cards and collapsible detail, not a squeezed desktop table.
- Colors/tokens: original navy/red D-CATS header and action red retained. GLTEK blue, DKD green, navy total, pale blue selected row and amber missing-input warnings follow the visual target. White cards over light neutral background. Focus has visible blue outline. No new global theme or security-style changes.
- Image quality/assets: real D-CATS branding retained rather than imitating generated logo text. Gear and spreadsheet icons are self-hosted official Bootstrap Icons SVGs with license, not handcrafted SVG or emoji substitutes. The screen needs no product photos or raster illustrations. Native disclosure markers are functional affordances, not replacements for a branded image asset.
- Copy/content: generated mock's false implication of human review (確認済み) is intentionally replaced with 不足なし. Existing save-scope note, clear action, list naming/deletion, all missing-input and saved-price-difference notices remain. Company subtotal appears once in each company heading, avoiding redundant lines and DKD double-counting. No prompt text or prototype labels appear in production code.

## Comparison history

1. Initial full comparison: blocked. P1/P2 legacy native bevels/font fallback, centred query label, oversized toolbar gaps, table footer below fold. Evidence: `desktop-initial-full.png`. Fix: scoped font and 1px controls, explicit row search layout, compact toolbar, viewport-adaptive table height. Post-fix evidence: `desktop-revised-full.png` and `desktop-revised.png`.
2. Revised comparison: blocked. P2 repeated primary identifier, stacked metadata and separate core note pushed component detail below fold. Keyboard trap did not cover the nested category dialog. Fix: compact identity grid, omit duplicate primary genuine number, inline core note, tighter detail rhythm, trap active nested dialog and restore opener focus. Evidence: previous `desktop-final.png` capture and actual browser keyboard checks; latest screenshot replaces only this task-owned capture.
3. Final comparison: passed after the fixes. Source and recaptured `desktop-final.png` compared together, followed by focused detail and control crops. Final detail panel bottom is 1046px within 1058px viewport. No remaining substantive mismatch; observed deviations above are deliberate existing-product constraints.

## Primary interactions and verification

- Product selection changes selected styling, aria-pressed, identity, company subtotals and total; unknown ID ignored; selection retained on recalculation, removed product falls back, empty/loading clear stale detail.
- Company setting changes recalculate displayed totals; close/Escape restores focus. Background screen becomes inert while open. Nested category dialog: last control Tab wraps to first, Escape closes only nested dialog and returns focus to category opener; second Escape closes parent and removes inert. VM regression also covers reverse Tab.
- Missing unit price, quantity, replacement rate, no components and snapshot unit-price difference visible in both compact list and detail. 部品を確認 opens and populates real lazy component renderer. No unearned human-confirmed status.
- Mobile initial detail closed; selection opens and scrolls detail into view. Long-number, large-money, empty, loading, componentless, read-only and Japanese/English/Chinese fixture states verified.
- Browser console errors/warnings checked: zero for fixture scenarios. Fixture CSP denies external connections; no backend writes. Existing mutation, import, matching, CSV, role and financial verifier contracts all remain tested by authoritative workflow suite.
- `node --check app.js`; all 117 Node workflow commands passed; static build and security headers passed; `git diff --check` passed.

## Open questions / residual test gaps

- Authenticated production manufacturing list and real save/delete/import mutations were not operated: no approved dedicated test login is available and user browser sessions must not be copied. Synthetic browser QA plus production-function regression verifies changed UI; it is not a claim of live authenticated transaction QA.
- Error/network/expired-session flows are preserved rather than changed. Loading/empty/stale clear paths are tested; no production failure injection or real database mutation was performed.
- Actual production delivery verification is recorded separately in the task log after release; this report passes local design/interaction acceptance, not deployment by itself.
- CSV export button executed the unchanged production exporter and showed the completed row-count message without console errors. IAB did not deliver a download event within 15 seconds, so the physical downloaded file was not inspected; file-format regression remains covered by existing verifier contracts. No switch to user Chrome/Edge was attempted.

## Implementation checklist

- [x] Accepted image resolved and compared against browser-rendered implementation.
- [x] Full-view and focused-region fidelity surfaces checked.
- [x] P1/P2 findings fixed, revised screenshots recaptured and compared.
- [x] Desktop/mobile, warnings, lazy details, keyboard focus and read-only/stale states tested.
- [x] Workflow-equivalent regression, static assets and strict CSP verified.
- [x] No production data/session mutation.

Follow-up polish: no blocking polish item. Preserve existing product branding and wording choices described above.

final result: passed

## Earlier release QA history (unchanged)

# D-CATS shared customer/internal/manufacturing UI design QA

final result: passed

## Login redesign release QA (v1.1.710)

- Approved desktop concept: `C:\Users\yamam\.codex\generated_images\019fd0a8-f714-7391-a0ee-d2ae6b8cf62d\exec-67ffce8e-1a4c-41d2-9ad2-12c4a30247de.png`
- Approved mobile concept: `C:\Users\yamam\.codex\generated_images\019fd0a8-f714-7391-a0ee-d2ae6b8cf62d\exec-f6be2d9d-6602-4cd6-988e-6a1532e7802d.png`
- Desktop implementation: `C:\Users\yamam\Documents\GitHub\dcats-login-release-20260810\outputs\dcats-login-v1.1.710-desktop.png`
- Mobile implementation: `C:\Users\yamam\Documents\GitHub\dcats-login-release-20260810\outputs\dcats-login-v1.1.710-mobile.png`
- Desktop comparison: `C:\Users\yamam\Documents\GitHub\dcats-login-release-20260810\outputs\dcats-login-v1.1.710-desktop-comparison.png`
- Mobile comparison: `C:\Users\yamam\Documents\GitHub\dcats-login-release-20260810\outputs\dcats-login-v1.1.710-mobile-comparison.png`

### Verified presentation

- D-CATS is the primary brand and the exact subtitle is `自動車部品検索・受発注システム`.
- DAIKO and GLTEK are visible as secondary partner brands using their source image assets.
- Desktop 1440 x 1024, mobile 390 x 844, and compact mobile 360 x 800 were inspected.
- The 390 px and 360 px states have no horizontal overflow and fit the complete login surface in the viewport.
- Reference and implementation were compared side by side after the final desktop partner-position adjustment.

### Verified behavior

- Password visibility updates the input type, `aria-pressed`, and the translated accessible label.
- Japanese and English switching updates the login heading, subtitle, welcome text, and visibility label.
- Empty submission shows the existing local validation error without issuing an authentication request.
- Password-reset navigation opens and returns to login.
- Browser console warnings and errors: none.
- No credentials were used and no production data was changed.

### Release checks

- JavaScript syntax, version consistency (`v1.1.710`), static build, security response headers, and all non-postal workflow checks passed.
- `verify-postal-data.js` remains the documented Windows checkout exception: `core.autocrlf=true` adds one checkout byte to shard 0. The postal files are unchanged by this release and the Git blob/manifest contract remains the release source of truth.

final result: passed

Reference: `C:\Users\yamam\Documents\New project\outputs\design-ideation\dcats-common-components-20260807\04-final-unified-component-system.png`

## Verified states

- Desktop: 1440 x 900
- Mobile: 390 x 844
- Customer order components: header, tabs, cards, inputs, select, primary/secondary buttons, status treatment
- Internal sales components: header, search/filter controls, result card, badges, customer select, condition cards
- Manufacturing components: header, search/category/filter controls, production cards, detail heading, detail sections, inline quantity control

## Measured contract

- Shared header: 48px
- Customer regular controls: 40px
- Internal and manufacturing compact controls: 34px
- Control radius: 6px
- Card radius: 8px
- Border: 1px, `#cbd5df`
- Focus: 2px, `#2f6fed`
- Heading/body/supporting typography: 18px / 14px / 12px
- Customer primary: `#154c3d`
- Internal primary: existing D-CATS logo red `#d6001d`

## Visual comparison

- Compared the selected reference and the customer, internal-sales, and manufacturing renders together at the same 1440 x 900 viewport.
- Customer, internal-sales, and manufacturing screens retain their existing information density and layout while sharing the specified geometry, typography hierarchy, borders, focus treatment, and status presentation.
- Manufacturing desktop measurements: header 48px; search, category, ranking action, and filter controls 34px; control radius 6px; selected production-card radius 8px; detail heading 18px; card/body text 14px.
- Manufacturing mobile measurements: 390 x 844 viewport at DPR 1; page width 390/390px and production-body width 375/375px, so no horizontal overflow; the same 34px controls and 8px cards are preserved.
- Focused manufacturing search uses a single 2px `#2f6fed` ring. Selected manufacturing cards use the same D-CATS red inset marker and soft red surface as internal sales cards.
- Visual review found no P0, P1, or P2 layout, spacing, typography, border, radius, clipping, or overflow issue.

## Functional safety

- No order, price, stock, authentication, permission, database, or data-loading behavior was changed.
- 35 static feature guards passed. `verify-postal-data.js` remains excluded in the Windows worktree because it is byte/hash sensitive and `core.autocrlf=true` changes the checked-out shard by one CRLF byte; the Git blob and manifest both remain 477379 bytes, and all postal lookup behavior guards passed.
- Static build and security response-header verification passed.

## Font-family unification QA (v1.1.702)

- Source visual truth: `C:\Users\yamam\AppData\Local\Temp\codex-clipboard-8ff286e7-1b1c-4e15-b4d9-a210ca6e35b1.png`
- Desktop implementation: `C:\Users\yamam\Documents\New project\outputs\implementation\dcats-common-ui-components-20260807\font-unification-desktop.png`
- Mobile implementation: `C:\Users\yamam\Documents\New project\outputs\implementation\dcats-common-ui-components-20260807\font-unification-mobile.png`
- Source pixels: 600 x 508. The source is a cropped sales-management screenshot with unknown device density, so comparison is limited to the visible typography state rather than false pixel-level layout matching.
- Desktop implementation: 1200 x 720 CSS pixels at DPR 1. Mobile implementation: 390 x 844 CSS pixels at DPR 1.
- State: part number `28100-B2150` shown in search input, result card, and detail heading for sales, manufacturing, and customer catalog contexts.
- Full-view comparison: the source showed a visibly narrower monospace face in the sales result card and the UI sans-serif face in the adjacent detail heading. The implementation uses the same `--dcats-font-ui` stack for both and preserves hierarchy through size and weight only.
- Focused typography comparison: sales card, sales detail, manufacturing card/detail, customer card/detail, search inputs, buttons, and customer select all compute to `"Noto Sans JP", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif`.
- Form-control verification: inputs, buttons, selects, and textareas inherit the same screen font instead of browser-default control fonts.
- Responsive verification: mobile document width was 390/390px with no horizontal overflow; the font change caused no clipping, broken wrapping, or control collision.
- Interaction verification: the focused sales search input retained the existing 2px blue focus ring and the same shared font stack.
- Image and icon fidelity: no image or icon asset changed; the supplied D-CATS icon is reused without substitution.
- Colors, spacing, radii, and copy are unchanged from the previously passed common-component design.
- Comparison history: the earlier P2 typography inconsistency was the sales result-card product code using `monospace` while the detail product code used the UI font. The scoped inheritance override removes that mismatch. Post-fix comparison found no remaining P0, P1, or P2 issue.
- Accepted exception: barcode text, manufacturing serials, logs, and other technical outputs retain their explicit monospaced font because character alignment is functional there.

final result: passed

## Latest manufacturing-cost workspace acceptance

final result: passed
