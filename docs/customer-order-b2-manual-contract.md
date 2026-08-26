# 得意先注文・B2クラウド手動運用 DB契約

## 方針

- ヤマトB2クラウドAPI直接連携は、有料・大口契約向けのため導入を見送る。
- D-CATSで注文受付と出荷管理を行い、B2クラウドへは商品発送用の基本レイアウト95列CSVを手動で取り込む。
- コア返却用複写伝票はB2 CSVに含めず、「ヤマト宅急便　着払い」または「佐川急便着払い」を注文単位で別管理する。
- APIアクセス認証キー、請求先コードなどの秘密・契約情報をpublic frontendへ保存しない。
- 最終価格、税、送料、在庫確保、注文状態の変更はすべてDB関数またはEdge Function内で確定する。
- frontend `v1.1.699`は、`get_customer_order_feature_status`と得意先別公開設定の両方が有効になるまで実得意先の注文機能を表示しない。
- 社内管理者向け開発プレビューは実注文権限と分離し、価格・在庫確認、注文送信、注文履歴RPCを呼び出さない。
- 得意先管理の「受注導線をプレビュー」は得意先向け品番検索を開く。在庫が1以上で、表示対象の価格が取得できる商品区分だけ注文ボタンを有効にし、商品を設定してから受注画面へ移動する。
- 商品詳細の注文ボタンは、選択した商品区分を注文内容へ設定してから受注画面を開く。同じ商品が設定済みの場合は数量を自動加算せず、受注画面で数量を変更する。
- 過去のお届け先検索は、ログイン中の得意先に属する注文住所スナップショットだけを対象とし、社内開発プレビューでは検索RPCを呼び出さない。
- 郵便番号検索は通常、zipcloudの郵便番号検索APIへ7桁の郵便番号だけを送信する。氏名、電話番号、会社名、住所は外部へ送信しない。
- API障害または通信断時は、日本郵便の公開データから生成した同一オリジンの端末内住所データへ自動的に切り替える。注文画面を開いた後に10分割データをバックグラウンドでCache Storageへ保存し、画面を止めない。
- 社内向け開発プレビューでは「自動」「APIのみ」「ローカルのみ」を切り替え、検索結果の表示文で使用したデータ源とローカルデータ版を確認できる。実得意先には切替UIを表示しない。
- ローカル住所データはGitHub Actionsで毎月、日本郵便のUTF-8全国一括データから再生成する。件数、47都道府県、代表郵便番号、分割ファイルのSHA-256検証を通過した場合だけ更新する。
- APIとローカルデータの両方で検索不能な場合も住所の手入力を継続できる。通信断中は住所変換だけが可能で、注文確定はサーバー接続回復後に行う。
- 商品発送便は有効な送料マスタから選択する。コア返却便は返却必要商品を含む場合だけ表示し、送料マスタの有効便に加えて返却専用の`佐川急便 / 飛脚宅配便`を選択できる。社内プレビューでは商品発送便に関西発・15時締切の暫定サービスレベルを使って最短日を表示するが、実注文公開前にサーバー側のサービスレベル設定を正とし、ブラウザ計算を信用しない。
- 宅急便系は最短日をお届け希望日へ自動設定し、得意先は指定可能範囲内で変更できる。ネコポス、クロネコゆうパケット、クロネコゆうメールなど日時指定不可のサービスは、希望日・時間帯を送信せず到着目安だけを表示する。

## 得意先別の受注公開設定

- `customer_display_settings.customer_ordering_enabled boolean not null default false`を追加する。
- migration適用時は既存得意先をすべて`false`にし、明示的に公開した得意先だけ`true`へ変更する。
- 得意先管理の既存権限とRLSでのみ更新を許可し、得意先ユーザー自身には変更を許可しない。
- `get_customer_order_feature_status`の`customer_ordering`は、全体機能が有効かつログイン中の得意先の`customer_ordering_enabled = true`の場合だけ`true`を返す。
- `preview_customer_order`、`place_customer_order`、`list_customer_orders`も同じ公開条件をサーバー側で再確認し、非公開中は注文作成・参照を許可しない。
- 社内向けの`internal_management`は得意先別公開設定と分離し、受注準備・テストを継続できるようにする。
- ロールバック時は全得意先の`customer_ordering_enabled`を`false`へ戻し、作成済み注文は削除しない。

## 業務フロー

1. 得意先が商品カタログで品番を検索し、リビルトまたは新品の注文ボタンを押す。
2. 選択した商品を注文内容へ設定した状態で受注画面を開く。
3. 以前のお届け先を電話番号または氏名で検索して選択するか、郵便番号検索を使って新規入力する。
4. 商品発送便を選択し、送り先都道府県とサービスレベルから自動設定された最短のお届け希望日を確認する。コア返却必要商品を含む場合は、返送用送り状へ使用するコア返却便も別に選択する。
5. `preview_customer_order`で最新の販売価格、在庫、送料、コア返却条件を確認する。
6. `place_customer_order`が同じ条件を再検証し、注文作成と在庫引当を1トランザクションで行う。
7. 社内担当者が注文を受付し、出荷準備へ進める。
8. 対象注文を選択し、`create_sales_order_b2_export`で商品発送用B2 CSVを初回発行する。発行済み注文の重複出力は防止する。
9. データ破損時は発行時の同一データを再ダウンロードし、内容を再作成する場合だけ理由付きで再発行する。
10. B2クラウドで商品発送用送り状を発行し、B2発行済データCSVをD-CATSへ取り込む。
11. 出荷指示書のコードと商品の製造シリアルを照合し、出荷確定する。B2取込と出荷確定の後に完了した方が、保証書と必要なコア返却シートを印刷待ちに登録する。
12. コア返却が必要な注文は、ヤマト宅急便　着払いまたは佐川急便着払いの複写伝票種類、手書き／ドットプリンタ、伝票番号を登録する。ドットプリンタ運用では、出荷照合とB2取込の完了後に担当者が注文単位で印刷する。
13. 出荷、コア返却受付、完了まで履歴を残す。

## 必須RPC

### `get_customer_order_feature_status()`

認証ユーザーに対して利用可能な機能だけを返す。未実装時はfrontendが機能を非表示にする。

```json
{
  "enabled": true,
  "customer_ordering": true,
  "internal_management": false,
  "reason": ""
}
```

社内ユーザーには`internal_management`、得意先ユーザーには`customer_ordering`だけを権限に応じて返す。

### `preview_customer_order(target_items jsonb, target_shipping_address jsonb, target_shipping_method jsonb, target_core_return_shipping_method jsonb)`

入力例:

```json
[
  { "dkd_shohin_id": 12011, "product_kind": "rebuilt", "quantity": 2 }
]
```

出力例:

```json
{
  "valid": true,
  "preview_token": "署名または一時ID",
  "items": [
    {
      "dkd_shohin_id": 12011,
      "product_kind": "rebuilt",
      "quantity": 2,
      "unit_price_jpy": 7500,
      "available_stock_qty": 66,
      "line_total_jpy": 15000,
      "core_return_required": true,
      "core_charge_jpy": null
    }
  ],
  "subtotal_jpy": 15000,
  "shipping_fee_jpy": 900,
  "tax_jpy": 1590,
  "total_jpy": 17490,
  "outbound_shipping_method": { "carrier_name": "ヤマト運輸", "service_name": "宅急便" },
  "core_return_shipping_method": { "carrier_name": "ヤマト運輸", "service_name": "宅急便" },
  "shipping_address": {}
}
```

- 得意先ID、価格ランク、表示対象はAuthユーザーから確定する。ブラウザの得意先IDを信用しない。
- 大光製・非公開カテゴリ・価格対象外の商品を拒否する。
- `target_shipping_method`は`carrier_name`と`service_name`を含む。サーバーは有効な送料・サービスレベル、商品サイズ・重量、お届け先を使って送料と最短日を再計算する。
- `target_core_return_shipping_method`はコア返却必要商品を含む場合だけ必須とし、`carrier_name`と`service_name`を含む。返却不要の場合はnullを要求する。サーバーは発送便と別に検証し、送料マスタの有効便または返却専用の`佐川急便 / 飛脚宅配便`だけを許可する。
- 商品発送便とコア返却便を注文スナップショットへ別々に保存する。B2 CSVは商品発送便だけに使用し、コア返却は複写伝票管理に使用する。
- `preview_token`は短時間のみ有効とし、ユーザー、得意先、明細、価格、在庫確認時刻へ結び付ける。

### `place_customer_order(...)`

引数:

- `target_items jsonb`
- `target_shipping_address jsonb`
- `target_shipping_method jsonb`
- `target_core_return_shipping_method jsonb`
- `target_requested_delivery_date date`
- `target_delivery_time text`
- `target_customer_note text`
- `target_preview_token text`
- `target_idempotency_key text`

要件:

- 価格、税、送料、在庫、表示権限を再計算する。
- 配送サービスの日時指定可否、最短日、B2で指定可能な最長日を再検証する。日時指定不可サービスでは希望日・時間帯がnullであることを要求する。
- 注文ヘッダ、明細、住所スナップショット、価格スナップショット、在庫引当、監査イベントを1トランザクションで作成する。
- 同じ得意先と`target_idempotency_key`の再送は同じ注文を返す。
- 在庫不足、価格変更、無効なpreview tokenの場合は注文を作成せず、再確認を要求する。

### `list_customer_orders(target_limit int)`

ログイン中の得意先に属する注文のみ返す。主な出力:

- `id`, `order_number`, `status`, `ordered_at`
- `subtotal_jpy`, `shipping_fee_jpy`, `tax_jpy`, `total_jpy`
- `core_return_required`, `core_return_status`
- `outbound_shipping_method`, `core_return_shipping_method`
- `outbound_tracking_number`, `return_tracking_number`
- `items[]`

### `search_customer_delivery_addresses(target_query text, target_limit int)`

ログイン中の得意先が過去の注文で使用した住所スナップショットを、電話番号または氏名で検索する。

- 得意先IDをブラウザから受け取らず、Authユーザーと得意先所属から確定する。
- 電話番号は数字だけに正規化して部分一致、氏名は`recipient_name`と`company_name`を対象に部分一致する。
- 空文字検索を拒否し、`target_limit`は1～20件、frontendは8件を指定する。
- 同じ会社名、氏名、電話番号、郵便番号、住所は最新利用分へ重複排除する。
- 取消済み注文を除外し、利用日時の新しい順に返す。
- 社内管理者の開発プレビューからは呼び出さない。

主な出力:

- `company_name`, `recipient_name`, `phone_number`
- `postal_code`, `prefecture_code`, `prefecture_name`
- `address_line_1`, `address_line_2`
- `last_used_at`, `usage_count`

住所は注文確定時の配送先スナップショットを検索元とするため、別の住所台帳を新設しなくても次回注文から検索できる。将来、注文前の住所登録や名称変更が必要になった時点で専用住所台帳へ移行する。

### `list_sales_orders(target_status text, target_search text, target_limit int)`

社内の`customer_order.manage`権限専用。一覧に必要な最小項目のみ返す。

### `get_sales_order_detail(target_order_id bigint)`

注文・明細・住所・金額・商品発送便・コア返却便・送り状・コア返却状態と、現在実行可能な`allowed_actions[]`を返す。

### `update_sales_order_status(target_order_id bigint, target_action text, target_note text, target_expected_version bigint)`

- `accept`, `prepare_shipping`, `ship`, `complete`, `cancel`を状態遷移表で制限する。
- 楽観ロック用versionを確認する。
- 取消時の在庫引当解除を同一トランザクションで行う。
- 出荷後の取消は通常操作で許可しない。

### `create_sales_order_b2_export(...)` / `get_sales_order_b2_export_batch(...)` / `list_sales_order_b2_exports(...)`

社内権限専用。商品発送用のみを出力し、初回発行行と再発行行のスナップショットを保持する。

- 発行済み注文の初回発行を拒否し、重複CSV作成を防止する。
- 同じ内容が必要な場合は保存スナップショットを再ダウンロードする。
- 内容を再生成する再発行は5文字以上の理由を必須とし、操作ユーザーと日時を記録する。
- CSVはB2基本レイアウトと同じ順序の95要素を保持する。
- 住所、電話、郵便番号、請求先顧客コード、運賃管理番号が不足する場合は発行を止める。

### `register_sales_order_shipping(...)`

引数:

- `target_order_id bigint`
- `target_outbound_tracking_number text`
- `target_return_tracking_number text`
- `target_carrier_name text`
- `target_shipped_on date`
- `target_expected_version bigint`

要件:

- 送り状番号は12桁を検証する。
- `target_return_tracking_number`は後方互換のため残すが、新運用ではnullを指定し、商品発送番号だけを登録する。
- 変更前後を履歴へ記録し、上書きだけで履歴を失わない。
- 出荷番号と返送番号の重複利用を防止する。

### `preview_sales_order_b2_shipments(target_rows jsonb)` / `import_sales_order_b2_shipments(...)`

- ヤマトB2クラウドの「発行済データ」CSVはShift-JISとUTF-8の両方を受け付け、日本語ヘッダー名で列を特定する。
- D-CATSからB2へ出力する際、`お客様管理番号`へ商品発送の`注文番号-O`を設定する。過去に発行した`注文番号-R`は取込互換性のため照合可能なままとする。
- 発行済CSVの照合はこの完全一致キーだけで行い、宛先名・電話番号・住所から注文を推測しない。
- 取込前RPCは注文、得意先、発送区分、送り状番号、出荷日、配送サービス、登録済み・競合を返す。
- 確定RPCはファイルSHA-256で二重取込を防ぎ、取込ファイル、行番号、原文、判定、操作ユーザーを監査履歴へ保存する。
- 同じ送り状番号の再取込は登録済みとして扱い、別注文で使用中の番号は競合として反映しない。
- 商品発送行の取込は送り状番号を登録する。在庫減算と保証情報更新は出荷指示書と製造シリアルの照合完了時に行う。
- 手入力・B2取込・変更前の送り状をすべて注文詳細の発送履歴で確認できるようにする。

### 得意先ごとの既定便

- `customer_display_settings`へ商品発送用とコア返却用の運送会社・配送サービスを別々に保存する。
- 初期値はいずれも`ヤマト運輸 / 宅急便`とし、注文画面を開いた時に自動選択する。
- コア返却便だけは`佐川急便 / 飛脚宅配便`へ変更でき、商品発送便の候補と送料計算には追加しない。
- 注文時に変更した便は注文スナップショットへ保存し、得意先の既定値そのものは変更しない。

## 推奨データ境界

具体的なテーブル名はDB作業で既存構造を確認して決める。少なくとも以下を分離する。

- 注文ヘッダ
- 注文明細と価格・税・コア条件スナップショット
- 配送先スナップショット
- 在庫引当
- 状態遷移履歴
- 送り状発行履歴（出荷・返送の方向を保持）
- B2 CSV初回発行・再ダウンロード用スナップショット・理由付き再発行履歴
- コア返却用複写伝票（ヤマト宅急便　着払い／佐川急便着払い、手書き／ドットプリンタ）
- コア返却受付履歴

公開スキーマに作業用・バックアップ用テーブルは作成しない。公開する永続テーブルはRLS、明示的なgrant、policy、監査、rollbackを同じmigrationで定義する。

## B2基本レイアウト

- 参照テンプレート: `B2クラウド_外部データ取込_基本レイアウト.xls`
- 出力列数: 95列
- frontend出力: UTF-8 BOM付きCSV
- B2取込み: 「外部データから発行」-「基本レイアウト」
- 1回の取込みはB2の上限1,000件以内にする。RPCも1,000行を超える出力を拒否する。
- 契約コード類はDBまたはサーバー秘密設定から補完し、frontendへ保存しない。

## 受入条件

- 受注公開が未設定または`false`の得意先には、注文入口と注文操作を表示せず、注文RPCも拒否する。
- 得意先は自社注文以外を参照できない。
- ブラウザで価格や合計を改変しても、保存値へ反映されない。
- 二重クリック、通信再送、更新ボタン連打で注文が重複しない。
- 在庫不足時に注文と引当が一部だけ作成されない。
- 取消時に引当が確実に解除される。
- B2 CSVは95列の商品発送行だけを含み、初回発行の重複を防止できる。
- コア返却用複写伝票はヤマト宅急便　着払いと佐川急便着払いを区別し、返送用伝票番号を個別に確認できる。ドットプリンタ発行は自動印刷へ混在せず、出荷帳票発行画面から明示操作する。
- 保証書に出荷照合済みの製造シリアルが印字される。
- 商品詳細の注文操作から受注画面を開いた時点で、対象商品と商品区分が注文内容に設定されている。
- 過去のお届け先は自社注文分だけを電話番号または氏名で検索でき、他の得意先住所は返らない。
- 郵便番号検索が失敗しても、住所を手入力して注文処理を続行できる。
- 送り先を変更した場合は価格・送料確認済み状態を破棄し、再確認するまで注文確定できない。
- 商品発送便を変更した場合も価格・送料確認済み状態を破棄し、希望日は新しいサービスレベルから再計算する。
- コア返却便を変更した場合も確認済み状態を破棄するが、商品発送のお届け希望日は変更しない。返却不要注文ではコア返却便を表示・保存しない。
- お届け希望日のブラウザ改変ではサーバー算出の最短日より前を指定できず、日時指定不可サービスへ希望日・時間帯を保存できない。
- API認証キーはpublic frontend、Git、operation logへ残らない。
- Security Advisorに新しい未解決警告がない。

## リリース順序

1. DB migrationとRPCをprivate repositoryで実装・検証する。
2. `get_customer_order_feature_status`は初期状態で両機能をfalseにする。
3. frontend `v1.1.699`を本番反映する。
4. 社内管理だけを有効化し、テスト注文とB2 CSV取込みを確認する。
5. 得意先テストアカウントだけ注文を有効化する。
6. 受注、在庫引当、取消、出荷、返送番号、コア返却まで通しで確認後、対象を拡大する。

ロールバック時はfeature statusをfalseへ戻して画面入口を即時非表示にし、作成済み注文データは削除しない。
