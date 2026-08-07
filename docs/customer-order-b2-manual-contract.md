# 得意先注文・B2クラウド手動運用 DB契約

## 方針

- ヤマトB2クラウドAPI連携は保留する。
- D-CATSで注文受付と出荷管理を行い、B2クラウドへは基本レイアウト95列のCSVを手動で取り込む。
- B2クラウドで送り状を発行した後、出荷送り状番号と返送用送り状番号をD-CATSへ手動登録する。
- APIアクセス認証キー、請求先コードなどの秘密・契約情報をpublic frontendへ保存しない。
- 最終価格、税、送料、在庫確保、注文状態の変更はすべてDB関数またはEdge Function内で確定する。
- frontend `v1.1.698`は、`get_customer_order_feature_status`と得意先別公開設定の両方が有効になるまで実得意先の注文機能を表示しない。
- 社内管理者向け開発プレビューは実注文権限と分離し、価格・在庫確認、注文送信、注文履歴RPCを呼び出さない。
- 得意先管理の「受注導線をプレビュー」は得意先向け品番検索を開く。在庫が1以上で、表示対象の価格が取得できる商品区分だけ注文ボタンを有効にし、商品を設定してから受注画面へ移動する。
- 商品詳細の注文ボタンは、選択した商品区分を注文内容へ設定してから受注画面を開く。同じ商品が設定済みの場合は数量を自動加算せず、受注画面で数量を変更する。
- 過去のお届け先検索は、ログイン中の得意先に属する注文住所スナップショットだけを対象とし、社内開発プレビューでは検索RPCを呼び出さない。
- 郵便番号検索は通常、zipcloudの郵便番号検索APIへ7桁の郵便番号だけを送信する。氏名、電話番号、会社名、住所は外部へ送信しない。
- API障害または通信断時は、日本郵便の公開データから生成した同一オリジンの端末内住所データへ自動的に切り替える。注文画面を開いた後に10分割データをバックグラウンドでCache Storageへ保存し、画面を止めない。
- 社内向け開発プレビューでは「自動」「APIのみ」「ローカルのみ」を切り替え、検索結果の表示文で使用したデータ源とローカルデータ版を確認できる。実得意先には切替UIを表示しない。
- ローカル住所データはGitHub Actionsで毎月、日本郵便のUTF-8全国一括データから再生成する。件数、47都道府県、代表郵便番号、分割ファイルのSHA-256検証を通過した場合だけ更新する。
- APIとローカルデータの両方で検索不能な場合も住所の手入力を継続できる。通信断中は住所変換だけが可能で、注文確定はサーバー接続回復後に行う。

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
4. `preview_customer_order`で最新の販売価格、在庫、送料、コア返却条件を確認する。
5. `place_customer_order`が同じ条件を再検証し、注文作成と在庫引当を1トランザクションで行う。
6. 社内担当者が注文を受付し、出荷準備へ進める。
7. 対象注文を選択し、`get_sales_order_b2_export`からB2基本レイアウトCSVを出力する。
8. B2クラウドへCSVを取り込み、出荷用と、必要な場合はコア返送用の送り状を発行する。
9. `register_sales_order_shipping`で出荷・返送の送り状番号を別々に登録する。
10. 出荷、コア返却受付、完了まで履歴を残す。

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

### `preview_customer_order(target_items jsonb, target_shipping_address jsonb)`

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
  "shipping_address": {}
}
```

- 得意先ID、価格ランク、表示対象はAuthユーザーから確定する。ブラウザの得意先IDを信用しない。
- 大光製・非公開カテゴリ・価格対象外の商品を拒否する。
- `preview_token`は短時間のみ有効とし、ユーザー、得意先、明細、価格、在庫確認時刻へ結び付ける。

### `place_customer_order(...)`

引数:

- `target_items jsonb`
- `target_shipping_address jsonb`
- `target_requested_delivery_date date`
- `target_delivery_time text`
- `target_customer_note text`
- `target_preview_token text`
- `target_idempotency_key text`

要件:

- 価格、税、送料、在庫、表示権限を再計算する。
- 注文ヘッダ、明細、住所スナップショット、価格スナップショット、在庫引当、監査イベントを1トランザクションで作成する。
- 同じ得意先と`target_idempotency_key`の再送は同じ注文を返す。
- 在庫不足、価格変更、無効なpreview tokenの場合は注文を作成せず、再確認を要求する。

### `list_customer_orders(target_limit int)`

ログイン中の得意先に属する注文のみ返す。主な出力:

- `id`, `order_number`, `status`, `ordered_at`
- `subtotal_jpy`, `shipping_fee_jpy`, `tax_jpy`, `total_jpy`
- `core_return_required`, `core_return_status`
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

注文・明細・住所・金額・送り状・コア返却状態と、現在実行可能な`allowed_actions[]`を返す。

### `update_sales_order_status(target_order_id bigint, target_action text, target_note text, target_expected_version bigint)`

- `accept`, `prepare_shipping`, `ship`, `complete`, `cancel`を状態遷移表で制限する。
- 楽観ロック用versionを確認する。
- 取消時の在庫引当解除を同一トランザクションで行う。
- 出荷後の取消は通常操作で許可しない。

### `get_sales_order_b2_export(target_order_ids bigint[])`

社内権限専用。CSVへ変換可能な行を返す。コア返却が必要な注文は原則2行返す。

- `direction: outbound`: 大光電機から得意先への出荷用
- `direction: core_return`: 得意先から大光電機への返送用
- `b2_values`: B2基本レイアウトと同じ順序の95要素配列を推奨
- またはfrontend契約に定義した`b2_fields`オブジェクト
- 住所、電話、郵便番号、請求先顧客コード、運賃管理番号の不足は`errors[]`で返し、CSV出力を止める

返送用の送り状種類は契約運用に合わせてDB側の設定で決定し、ブラウザに固定しない。

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
- コア返却不要の注文へ返送番号を登録しない。
- 変更前後を履歴へ記録し、上書きだけで履歴を失わない。
- 出荷番号と返送番号の重複利用を防止する。

## 推奨データ境界

具体的なテーブル名はDB作業で既存構造を確認して決める。少なくとも以下を分離する。

- 注文ヘッダ
- 注文明細と価格・税・コア条件スナップショット
- 配送先スナップショット
- 在庫引当
- 状態遷移履歴
- 送り状発行履歴（出荷・返送の方向を保持）
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
- B2 CSVは95列で、出荷行と必要な返送行を識別できる。
- 出荷・返送の送り状番号を個別に検索・変更履歴確認できる。
- 商品詳細の注文操作から受注画面を開いた時点で、対象商品と商品区分が注文内容に設定されている。
- 過去のお届け先は自社注文分だけを電話番号または氏名で検索でき、他の得意先住所は返らない。
- 郵便番号検索が失敗しても、住所を手入力して注文処理を続行できる。
- 送り先を変更した場合は価格・送料確認済み状態を破棄し、再確認するまで注文確定できない。
- API認証キーはpublic frontend、Git、operation logへ残らない。
- Security Advisorに新しい未解決警告がない。

## リリース順序

1. DB migrationとRPCをprivate repositoryで実装・検証する。
2. `get_customer_order_feature_status`は初期状態で両機能をfalseにする。
3. frontend `v1.1.698`を本番反映する。
4. 社内管理だけを有効化し、テスト注文とB2 CSV取込みを確認する。
5. 得意先テストアカウントだけ注文を有効化する。
6. 受注、在庫引当、取消、出荷、返送番号、コア返却まで通しで確認後、対象を拡大する。

ロールバック時はfeature statusをfalseへ戻して画面入口を即時非表示にし、作成済み注文データは削除しない。
