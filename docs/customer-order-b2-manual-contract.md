# 得意先注文・B2クラウド手動運用 DB契約

## 方針

- ヤマトB2クラウドAPI連携は保留する。
- D-CATSで注文受付と出荷管理を行い、B2クラウドへは基本レイアウト95列のCSVを手動で取り込む。
- B2クラウドで送り状を発行した後、出荷送り状番号と返送用送り状番号をD-CATSへ手動登録する。
- APIアクセス認証キー、請求先コードなどの秘密・契約情報をpublic frontendへ保存しない。
- 最終価格、税、送料、在庫確保、注文状態の変更はすべてDB関数またはEdge Function内で確定する。
- frontend `v1.1.692`は、`get_customer_order_feature_status`が有効を返すまで注文機能を表示しない。

## 業務フロー

1. 得意先が商品カタログからリビルトまたは新品を注文内容へ追加する。
2. `preview_customer_order`で最新の販売価格、在庫、送料、コア返却条件を確認する。
3. `place_customer_order`が同じ条件を再検証し、注文作成と在庫引当を1トランザクションで行う。
4. 社内担当者が注文を受付し、出荷準備へ進める。
5. 対象注文を選択し、`get_sales_order_b2_export`からB2基本レイアウトCSVを出力する。
6. B2クラウドへCSVを取り込み、出荷用と、必要な場合はコア返送用の送り状を発行する。
7. `register_sales_order_shipping`で出荷・返送の送り状番号を別々に登録する。
8. 出荷、コア返却受付、完了まで履歴を残す。

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

- 得意先は自社注文以外を参照できない。
- ブラウザで価格や合計を改変しても、保存値へ反映されない。
- 二重クリック、通信再送、更新ボタン連打で注文が重複しない。
- 在庫不足時に注文と引当が一部だけ作成されない。
- 取消時に引当が確実に解除される。
- B2 CSVは95列で、出荷行と必要な返送行を識別できる。
- 出荷・返送の送り状番号を個別に検索・変更履歴確認できる。
- API認証キーはpublic frontend、Git、operation logへ残らない。
- Security Advisorに新しい未解決警告がない。

## リリース順序

1. DB migrationとRPCをprivate repositoryで実装・検証する。
2. `get_customer_order_feature_status`は初期状態で両機能をfalseにする。
3. frontend `v1.1.692`を本番反映する。
4. 社内管理だけを有効化し、テスト注文とB2 CSV取込みを確認する。
5. 得意先テストアカウントだけ注文を有効化する。
6. 受注、在庫引当、取消、出荷、返送番号、コア返却まで通しで確認後、対象を拡大する。

ロールバック時はfeature statusをfalseへ戻して画面入口を即時非表示にし、作成済み注文データは削除しない。
