## B2 destination and permission guidance QA (v1.1.1106, 2026-10-06)

- Display the usual B2 folder and the exact target of this PC's existing G-drive shortcut. The target directory was confirmed to exist by a read-only filesystem check. This fixed shortcut target is labeled as PC-specific and is not claimed to be the absolute path of an arbitrary browser handle.
- Add a visible warning to keep the destination unchanged during normal use; only reselect after a move or administrator instructions. Replace ambiguous "未設定" with save-permission status and explicit confirmation guidance. Granted handles show the registered folder name and optional reselection; prompt/denied handles retain that name.
- Stop caching a failed B2 IndexedDB read as an empty registration. Actual production-function tests cover read failure and recovery on reopen, granted registration, permission loss and no handle. State inspection must not invoke a picker, request permission or write a handle. Existing CSV validation, picker and writes remain intact.
- Hidden IAB synthetic fixture: desktop 1280 x 1000 / 1280 x 900 and 320 x 844 Japanese/English/Chinese, pending/ready/permission/unsupported/read-error states. Document and section widths have no horizontal overflow; target and warning wrap. Tab reaches the confirmation button with a 2px outline; closing restores entry focus. Console warnings/errors: 0.
- All 125 authoritative workflow Node commands, static build, strict CSP/response headers and diff checks passed. Initial language-coverage failures found stale HTML help and a misplaced duplicate translation key; both were corrected before the complete successful run. No real picker, CSV write, native sales import/export or browser session copy was performed.
- Evidence is local/ignored in outputs/b2-default-folder, including desktop-ja-final.jpg and UI/workflow results. Owned IAB tab 6 closed, viewport reset, QA server PID 23864 verified against its command line before stop. No saved group was created; user browsers, clipboard and OS pointer were not operated. Existing .qa-output is preserved.
- Release uses the standing routine frontend authorization and normal PR/CI. Rollback is a revert of this PR; stored handles and existing data remain intact.

## B2 CSV save-folder clarity QA (v1.1.1105, 2026-10-06)

- Renamed the Business Exchange selection control to "B2 CSVの保存フォルダを選ぶ" and the configured-state control to "B2 CSVの保存フォルダを変更", with English and Chinese equivalents. Setup instructions use the new label.
- Gave B2 its own heading, existing-folder explanation, path block and lower action row. The selector is an outlined green button separated from the shared-folder/shortcut controls. A visible note, also referenced through aria-describedby, states that selection does not create the D-CATS業務連携 folder.
- Hidden IAB synthetic fixture uses the current markup, translations and actual folder-state renderer. At 1280 x 900, unset and ready controls have the expected names. At 320 x 844, Japanese/English/Chinese wrap without horizontal overflow. Keyboard Tab focuses the selector with a visible outline, close restores the entry focus, unsupported disables selection and permission state enables re-selection. Console warnings/errors: 0.
- Existing authoritative workflow: all 124 Node commands passed. Static build and strict CSP/response-header checks passed. No new tests mirroring the presentation change were added. Folder selection, permissions, storage, CSV writes, auth and native integration are unchanged; no real folder picker or CSV write was repeated.
- Screenshots/results are retained in ignored outputs/b2-folder-clarity. Owned IAB tab closed, viewport reset and QA server PID/commandline checked before stop. No user Chrome/Edge tab, group, clipboard or OS pointer operation. Pre-existing .qa-output preserved.
- Publish through normal PR/CI under existing authorization. Rollback is a normal revert of this PR; stored folder handles and existing user data are retained.
- PR221's already-published PC-folder shortcut update was merged into this branch. Its shortcut asset, headers, UI labels and verification remain intact. The adjacent HTML help conflict was resolved to retain the new Web label and new B2-specific selection label together. After integration, all 124 guards, build/headers and targeted hidden desktop/narrow layout checks passed. No successful import/export or shortcut download was repeated.
- PR191's concurrent main merge arrived before PR222 publication. Its GLB Viewer code, current CSP and dynamic version guard were preserved, and this release advanced to v1.1.1105 including the Viewer import cache. The B2 implementation remains scoped to presentation; no upstream feature code or security policy was changed relative to main.

## Google Drive desktop setup support QA (v1.1.1102, 2026-10-06)

- Added setup/help disclosure to Data Integration / Business Exchange: official installation/sign-in guide, shared-folder shortcut guide, per-PC/browser CSV-folder setup, administrator support, missing-folder and reconnection guidance.
- Help provides browser access without Drive for desktop and explains that opening a PC sync folder requires Drive installation/setup. This also fits the separate in-progress native-folder shortcut change. Help does not report installation or cloud synchronization as detected; no installer, authentication, native command or shared-folder permission action was added.
- Tested the real dialog markup, translations and existing functions in a synthetic localhost fixture in a hidden IAB. No browser authentication/session was copied and no production data was read or written.
- Desktop 1280 x 900: Enter opens the native details disclosure and exposes the setup steps/help links. The dialog is vertically scrollable within the viewport and the close control remains accessible.
- 390 x 844 and 320 x 844 Japanese, plus 320 x 844 English/Chinese: document width equals viewport width, dialog height 820px, text wraps and the actual Japanese Drive folder name remains identifiable. Closing restores the original trigger focus. Console warnings/errors: 0.
- Existing authoritative workflow 124 Node commands passed after synchronizing the new release version in the 3D-workflow guard. Static build, CSP/response headers and diff checks passed. No successful sales import/export was repeated.
- Owned IAB tab closed, viewport override reset, owned QA HTTP server stopped. Regular Chrome/Edge, shared clipboard and OS cursor were not operated. Existing `.qa-output` files were preserved.
- Evidence (ignored, local only): `outputs/drive-support/desktop-ja.png`, `mobile-ja-390.png`, `mobile-ja-320.png`, `mobile-en-320.png`, `mobile-zh-320.png`, `ui-results.json`, `workflow-results.json`.
- Actual installation/sign-in on a PC without Drive and later protected-backup automation were not executed; the new feature provides setup/support guidance. Rollback is a revert of this frontend change through normal CI.

final result: passed

# 澤藤・末尾省略品番の候補照合（2026-10-05、v1.1.1100）

- 合成データのみの非表示IAB。SYNTHETIC-SAW / 0355-502-002 / TEST-OEM-1000,1009 / 商品ID100,109。実API・認証情報のコピー・本番入庫なし。
- PC1280×1000: 初回は製造原価の候補2件とも未チェック、入庫先未選択。正式品番を選んだだけでは入庫不可。確認チェックでのみ有効化、手動解除で再び無効になる。Tabで次の修正ボタンへ移動し、再描画後の確認フォーカスを保持。
- 確認済み履歴を再現すると商品109だけが初期チェックされ、正式メーカー品番・純正品番・商品ID・末尾省略ラベルを表示。履歴競合は両候補未チェック・入庫先未選択で案内を表示。
- 遅延中の照合表示と操作停止、通信失敗の明示と再試行可能、候補なし・保留一覧なし、権限なしのstock画面非表示を確認。無権限/会社違い/古い入力/二重送信は実関数の合成DB・VMでも拒否検証。
- 390×844 / 320×844: ページのscrollWidthとclientWidthが一致。表は既存の840px最小幅で表内横スクロール。取込品番は一行保持（16px高）、確認文は読めるように折返し。日本語/英語/中国語の追加翻訳と既存キーを自動検査。
- 実コードの新規guard、旧原価取込・履歴・保留・マスタ登録gate、全authoritative workflow129 Nodeコマンド・静的build・厳格CSP/response headers・syntax・diff検査が成功。
- proof（ローカル・合成データ）: `outputs/sawafuji-qa/prior-link-desktop.png`, `prior-link-mobile.png`。通常Chrome/Edge・共有clipboard・OSカーソルは変更なし。専用タブ/viewport/helperは完了時に後片付けする。
- 実業務の入庫/商品作成・複数接続競合実測は実施しない。DBではprivate migrationのsnapshot再比較と選択マスタFOR SHARE、既存台帳/stock lockを審査し、PostgreSQL17/18の44呼出しで原子的失敗を確認する。

final result: passed

## PC folder shortcut QA (2026-10-06)

- Data Integration / Business Exchange downloads the approved PC's Windows folder link. The G-drive target is explicit and the HTTPS Drive action remains separate. Existing CSV save-folder selection is unchanged.
- The committed 713-byte .lnk is generated with pinned build-only pylnk3 0.4.3. Read-only Windows COM verifies the exact directory target, working directory, empty arguments and existing folder. Deterministic SHA256: `8d5f4312b2ac441aea976b06c66d3615f8fb22a1a8a43bc1da37b49487327764`. No ExtraData tracker blocks or machine IDs are distributed; no Explorer window was opened.
- The actual production functions pass VM tests for direct same-origin/versioned download, filename, rapid-repeat guard, anchor cleanup, DOM/click failure, explicit retry and modal focus. CI also checks binary/header contracts and existing B2/HanbaiOh folder-selection behavior.
- Hidden IAB uses isolated actual markup/functions/translations, no real authentication or production API. 1280 x 900 desktop, 390 x 844 mobile and 320 x 844 Chinese: actions fit; DOM scrollWidth equals viewport. Initial focus, close-focus restoration, synthetic error, error clearing, and retry availability pass. Console errors: 0.
- The IAB download event completed and the resulting 713-byte `.download` file matches the binary SHA256. This browser uses its own temporary filename extension; normal browser `.lnk` filename is requested by both download attribute and Content-Disposition. Browser security prompts, automatic desktop placement and actual Explorer opening are not established by this QA. No file-API restrictions are bypassed.
- Evidence: ignored local `outputs/folder-workspace/desktop.png`, `mobile-error.png`, `mobile-en.png`, `mobile-zh.png`, workflow results. The owned hidden tab is closed, viewport reset and QA server stopped. No normal Chrome/Edge tabs/groups, pointer, clipboard or existing desktop shortcut were changed.
- After incorporating concurrent Drive setup support, the final v1.1.1103 release passes all 124 authoritative Node checks, static build and strict security headers again. Hidden IAB rechecks the integrated desktop and 320px English layout, summary keyboard focus, support expansion/scrolling and zero horizontal overflow. Existing support and CSV actions remain present.

final result: passed (normal browser saving and desktop placement remain the user's operation)

## Business shared-folder shortcut QA (v1.1.1101)

- Request: provide a desktop shortcut to the specified D-CATS business-exchange shared folder from Data Integration / Business Exchange.
- Replaced the machine-specific G-drive .lnk asset with a portable Windows .url download containing only the fixed HTTPS folder URL. No native execution, shortcut file-API writes, Drive permissions, authentication, or CSV save-folder settings changed.
- Hidden IAB used the actual menu/dialog markup, translations, and feature functions with an isolated synthetic context; no user browser credentials or production writes.
- Desktop 1280 x 900 and mobile 390 x 844 / 320 x 844: actions and Japanese/English/Chinese labels fit without horizontal overflow. Mobile actions stack; the document width equals the viewport.
- Download initiation message, synthetic object-URL failure, error styling, error clearing on reopen, initial button focus, keyboard Tab to the B2 save-folder button, and focus restoration on close passed. Console warn/error count was zero.
- The IAB download-completion event timed out. Actual downloaded-file persistence and Windows opening were not established by browser QA; the exact CRLF InternetShortcut payload, filename, Blob MIME, anchor download, duplicate-click guard, cleanup, failure, and explicit retry passed the production-function VM guard. The UI does not claim desktop placement or completed saving.
- All 124 authoritative search-performance workflow Node checks, static build, and strict response-header/CSP verification passed. Existing B2/HanbaiOh CSV-folder contracts remain guarded.
- Evidence (local only): `outputs/business-workspace/desktop-ja.png`, `mobile-ja.png`, `mobile-en.png`, `mobile-zh.png`, and `mobile-error.png`.
- The task-owned hidden tab was closed, viewport override reset, and local QA server stopped. No Chrome/Edge tabs or saved groups were created; the user's pointer and clipboard were untouched.

final result: passed (download persistence and Windows desktop placement require the user's normal save operation)

# パレット保留・後日入庫（2026-10-05、v1.1.1099）

- 非表示IABのみ。合成TEST-PALLET / TEST-1001（2台）/ TEST-9999（3台）、本番API/実アカウント接続なし。
- デスクトップ: 未解決を理由付き保留にし、1品番2台だけ入庫・残り1品番3台は在庫未反映。画面再読込後、保留管理からファイル再選択なしで再開。
- 390px: マスタ準備済みの合成状態で再照合しても保留は自動解除しない。解除後、登録済み行は読取専用・再加算なし。後日入庫は1品番3台のみ、保留0で管理一覧から消える。ページ横はみ出し0（表内スクロール）。
- 理由を入力後に確定ボタンが再有効化されない問題を発見・修正。inputイベント回帰試験と非表示UIで修正確認。通信エラーの明示、権限なしの画面非表示、空一覧を確認。console error/warn 0。
- proof: ignored local `outputs/container-held-qa/held-partial-desktop.png`, `held-resume-mobile.png`。通常Chrome/Edge・認証コピー・共有クリップボード・OSカーソル不操作。
- DBはprivate repositoryのmigrationで既存非公開台帳を利用。PGlite合成SQL25呼出しで部分/全件保留、従来全件入庫、再開・再送・不変条件・無権限・会社違い・active条件・API grant・原子的rollbackを検証。実DBへの業務データ試験は行わない。実複数接続の競合試験は未実施、既存の台帳/在庫ロックとunique制約を保持して審査。

## 以前の紐づけ候補の初期チェック（2026-10-05、v1.1.1098）

- パレット取込時、有効な保存リストの元品番と商品IDを読み取り、一つの候補商品に特定できる場合だけ初期チェック。「以前の紐づけ」ラベルで理由を表示する。旧リストの元品番配列が空の場合のみ、保存済みメーカー/純正品番で完全一致照合する。
- 読取SQLで既存列・外部キー・RLSを確認。有効リスト81明細すべて元品番配列が空で、保存済み品番あり。旧データへの書込みや補完は行わず、既存の管理/閲覧権限を保持する。
- 必要な候補IDだけを100件単位で読む。activeリスト・最小列・id順・exact count付きページ取得で、サーバー上限が要求ページより小さくても全明細を確認する。エラー・途中失敗・件数不整合・上限超過は履歴全体を破棄し手動選択へ戻す。閲覧不可の利用者では取得しない。
- 実関数をVMで検査: 正規化、複数候補から過去の1件、履歴なしの単独候補、同一商品への重複履歴、競合する複数商品、明示された元品番優先、候補外のID、手動解除/選択の再描画維持、決定済み除外、escaping、複数ページ/バッチ、エラー/途中失敗/不完全応答、古い検索の破棄、成功検索が履歴取得を待つこと。
- 非表示IABの実HTML・実検索/選択/計算関数＋合成データ・遅延サービスで、履歴一致だけchecked、手動変更、全選択/全解除、計算失敗後の解除保持、計算成功後の候補グループ除外、競合/履歴取得失敗時の非選択と案内を確認。原価計算はボタンの操作時のみ。PC1280×900・mobile390/320×844で横はみ出し0。
- 日本語/英語/中国語のラベルと説明を確認。320pxの英語/中国語でkeyboard Tabが次の候補チェックへ移動し、横はみ出し0。console error 0、warningは意図した計算/履歴サービス失敗の2件のみ。
- 証拠: `outputs/cost-workspace/import-history-desktop.png`、`import-history-mobile-390.png`、`import-history-mobile-320.png`、`import-history-mobile-en.png`、`import-history-mobile-zh.png`。合成値であり顧客データ/実価格を公開しない。通常ブラウザ・認証コピー・共有クリップボード・カーソル不操作。
- 全120 Node workflowコマンド・構文・static build・strict CSP/headers・diffチェック成功。認証済み本番での操作と実サービス応答時間は未検証。読み取りSQL以外の本番データ操作なし。公開/本番配信検証はタスクログで別途記録する。

final result: passed

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

## Manufacturing-cost processing visibility QA (v1.1.1097)

- Request: make it obvious that candidate search, cost calculation, and saved-list loading are running.
- Implemented a high-contrast blue status card, 18px processing title, 30px animated spinner, actual request-phase description, busy button text, and explicit completion messages. No invented percentages or completion estimates.
- The status live region is outside the busy result regions. Previously disabled controls remain disabled after completion; conflicting/duplicate starts are ignored and every asynchronous path releases its owned busy state in `finally`.
- Production renderers and async functions tested with synthetic delayed services in a hidden IAB; no copied authentication or production writes.
- Desktop 1280 x 900: search matching phase, catalog/component phase, search completion, cost calculation and completion, saved-list loading and completion verified. Status title computed to 18px dark navy; document width stayed 1280px.
- 390 x 844 and 320 x 844, including English and Chinese at 320px: status text wraps within the card with no horizontal overflow. Reduced-motion animation removal checked by the regression guard; OS/browser preferences were not changed.
- Synthetic network failure: error displayed, spinner/status card cleared, and search re-enabled. The expected application warning was captured; no uncaught console error was introduced. Zero-result and permission/stale/readonly/duplicate scenarios are covered by the guards.
- All 118 initial authoritative workflow Node commands passed; after preserving the concurrent frontend release, all 119 combined workflow commands, static build, strict CSP/response headers, JavaScript syntax and diff checks passed. Data matching contracts, financial calculations, save contracts, permissions, stock and database unchanged.
- Evidence (local only): `outputs/cost-workspace/loading-search-1280.png`, `loading-calc-1280.png`, `loading-320.png`, `loading-progress-detail.png`.
- Authenticated production operations and genuine backend latency were not exercised; fault/delay evidence uses isolated synthetic data only.

final result: passed

## Product ID inline detail QA (v1.1.1095)

- Request: keep the product-ID label and number on one horizontal line in the manufacturing-cost detail panel.
- Implementation: a full-width semantic definition-list row using the existing translated Product ID label; other metadata remains two columns and the full-width part-number heading remains 24px.
- Synthetic production-renderer fixture only; no copied authentication/session or production data mutations.
- Hidden IAB at 1280 x 900, 390 x 844, and 320 x 844: label and ID share a baseline, row height is 20px, numeric ID is complete, and document width matches the viewport without horizontal overflow.
- Japanese, English, and Chinese labels checked at 320px; selected product changes update the ID. Mouse click and keyboard Enter selection remain functional.
- Empty and loading fixtures retain their existing states; the verifier covers stale selection, escaping, permissions, read-only actions, and dialog keyboard behavior. Authenticated production save/import/delete was not exercised for this display-only change.
- All 117 authoritative workflow Node commands, static build, response-header/CSP verification, syntax, and diff checks passed. No security, money, stock, database, or permission behavior changed.
- Evidence (local only): `outputs/cost-workspace/product-id-1280.png`, `product-id-320.png`, and the focused `product-id-detail.png`.

final result: passed
## Independent GLB Viewer release QA (v1.1.1104, 2026-10-06)

- Hidden IAB only, using actual product-media markup, product-3d controller and pinned Viewer with synthetic product/Auth responses. No user session was copied and no production product/Storage was written.
- Desktop 1280x720, smartphone 390x844 and tablet 820x1180: self-contained official Khronos Draco Box rendered under the production CSP. Actual drag changed rendering; zoom/reset, autorotation, whole-shell fullscreen and close worked. Mobile shell width/scrollWidth were 390px and controls remained within the viewport.
- No registered model, permission denial, generation-failure with a ready uploaded alternative, and logout cleanup were checked. Lookup outages now show a recoverable error, not a cached successful empty result. Unit tests cover product/kind/auth races and ambiguous upload/delete outcomes.
- Required codec permissions are limited to WebAssembly compilation and self/blob workers. JavaScript eval, inline scripts/handlers and external GLB resources remain forbidden; codecs are pinned and self-hosted.
- Prior approved isolated authenticated API E2E completed upload, signed-GLB/provenance readback, replacement/old-URL denial and deletion/deleted-URL denial. That environment was deleted; no new billed resources are needed.
- Local regression: 62 product-3D tests; all authoritative workflow commands, static build and response-header guards. Actual user-created asset quality and physical-device touch remain distinct, unverified checks.
- Evidence is local-only in the task-owned `.codex-tmp-product3d/viewer-draco-*-20261006.png` files. Regular Chrome/Edge, clipboard and OS pointer are untouched. Owned IAB tab/viewport/helper cleanup is required at completion.

final result: passed for synthetic responsive GLB viewing; production release is verified separately.

## 2026-10-06: Company-specific Sales King account and three data categories

- Prepared v1.1.1107 with a system-admin-only actual-company section, saved-password login and separate product/customer/sales CSV preparation controls. Unconnected vendor exports remain explicitly disabled; CSV preparation never reports actual import success.
- Tested the authenticated browser boundary with synthetic identities: exact requests, actor/device ownership, 180-second expiry, duplicate sign-in, role/session change and ambiguous responses. Passwords and Auth tokens are absent from the Native protocol.
- The authoritative frontend workflow's 126 Node commands passed, including all 119 verifier coverage, shared role/order/pricing checks, static build and response headers. A version-reference and translation-gate failure was corrected without disabling either guard.
- Headless isolated Playwright: 1280x900 and 390x900, login success, all three preparation states, pending/error, unauthorized/logged-out hiding, no horizontal control overflow; zero browser errors and zero external requests. Contexts, browser and local server closed in finally.
- Screenshots inspected: task-owned `.qa-output/company-controls-20261006/company-1280.png` and `company-390.png`. Synthetic protocol replies do not prove real vendor login/import/export. No normal browser, clipboard, cursor or user vendor session was operated.

## 2026-10-07: Private product-3D source-photo comparison (v1.1.1121)

- Optional system-admin-only comparison in a current private Tripo review. All already-authorized source photos can be reviewed, including top/bottom images not submitted to the first four-view generation. No generation-slot, paid API, Storage, database or publication mutation.
- Hidden IAB using the production markup, styles, comparison functions and pinned GLB Viewer with six synthetic photos and an embedded textured GLB; no copied credentials or real product data.
- PC 1280x720 renders 3D and the source-photo panel side by side; 390x844 stacks them with independent photo scrolling and no horizontal document overflow. Top/bottom original selection, zoom/reset and keyboard focus verified.
- Original retrieval failure explicitly reports thumbnail-only display. A synthetic non-admin identity cannot open comparison. Unit tests cover pending requests after close, collapse, product/kind/session loss, selection races, image decoding failure, escaping and non-mutation.
- 142 product-3D tests and all 127 authoritative workflow Node commands passed, including static build, strict CSP/response headers and syntax. No pinned vendor codec, permission or CSP change.
- Local evidence: task-owned `PHOTO-COMPARISON-PC-20261007.png` and `PHOTO-COMPARISON-MOBILE-20261007.png` in `.codex-tmp-product3d`. These are synthetic UI evidence, not proof of alternator shape accuracy or authenticated real-photo comparison.
- The actual first alternator GLB remains private and fails top/bottom geometry quality. Comparison does not correct a mesh or enable six-view generation. Public delivery and owned-tab/helper cleanup are recorded separately.

final result: passed for synthetic responsive comparison; product-model quality remains failed.

## Production backup readiness QA (v1.1.1126, 2026-10-07)

- Admin-only Business Workspace card for seven fixed prerequisites. Initial states are unverified; registered login credentials are never treated as a backup password. A ready result still requires a new backup and shared-storage verification before import. Password registration, Google authorization and real vendor backup creation remain separate work.
- Uses a fresh existing company-enrollment signature only for the narrower native read of the same actor/device/company. No new Edge/DB authority or credential transport. Public state validation rejects unknown fields, identities, destinations, secret fields and inconsistent ready flags. Login, enrollment, backup and import are not invoked by this check.
- Native related tests: 131 pass, 0 fail, 0 skip, including an isolated packaged host with real Windows DPAPI device binding and a before/after hash inventory proving no local file changes. Four reception flags and background-only-v1 remain unchanged.
- Hidden browser synthetic fixture uses actual modal markup, CSS, extracted application handlers and real browser bridge with synthetic issuer/native transport. 18 checks pass at 1280/390/320 px and Japanese/English/Chinese: pending, ready, invalid response, failure, unauthorized, busy controls, owner change, close cancellation, keyboard focus and hidden unauthorized/logged-out states. Console errors 0; production Auth and vendor operations 0. Dynamic status translations refresh on language change and clear on close/owner change.
- Initial harness cancellation assertion ran before the posted cancellation event; waiting for that event fixed the harness. Visual review found dynamic summary not translating on language switch; status now carries its translation key. Full 127-command authoritative frontend workflow and dist response headers pass after updating release-version expectations and the isolated 3D worker asset query; business logic in those version-only files is unchanged.
- Evidence remains in .qa-output/backup-readiness-ui-20261007, workflow initial/final JSON, and canonical docs/evidence/hanbaioh-backup-readiness-ui-20261007. Normal Chrome/Edge, clipboard and desktop cursor were not operated. Task-owned headless browsers/server closed.
