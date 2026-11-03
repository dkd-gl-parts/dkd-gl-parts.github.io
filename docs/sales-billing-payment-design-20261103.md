# D-CATS 売上・請求・入金/支払 組み込み設計 (2026-11-03)

販売王の業務設計を参考に、D-CATS に売上計上・請求・入金（消込）、および仕入支払を組み込むための設計書。
既存の受注基盤（`customer_orders` 系）の上に積み上げる前提でまとめている。

---

## 1. 現状アーキテクチャ

| 層 | 実体 |
|---|---|
| ホスティング | GitHub Pages（リポジトリ `dkd-gl-parts/dkd-gl-parts.github.io`、CNAME `dcats.daiko-denki.co.jp`） |
| フロントエンド | 単一SPA（`index.html` 431KB / `app.js` 約3.0MB、ビルドなしの素のJS） |
| **データベース** | **Supabase (PostgreSQL)** プロジェクト `jqoeqximtwfpqwzngutj` — RLS有効 |
| 会計・請求 | **販売王（外部）** に委譲。D-CATS から取込フォルダへ書き出して連携 |

> 注: 「DBはGitHub」ではなく、GitHub はコード置き場＋ホスティング。実データは Supabase。

### 販売王との現在の連携方式

`app.js` 内に `hanbaiou` 関連の実装が約430箇所。役割は次の3つ。

1. **売上データの書き出し** — `SalesAccountingExport` 系（`createSalesAccountingExport`、`confirmSalesAccountingExportRegistration` ほか）。File System Access API で販売王の取込フォルダへ出力（`dcatsHanbaiouExportDirectoryHandle`、`prepareDcatsHanbaiouExportDirectory`）。
2. **得意先マスタ連携** — `registerHanbaiouCustomer`、`normalizeHanbaiouCustomerCode`、`collectHanbaiouCustomerBillingSettings`、`validateHanbaiouCustomerBillingSettings`。
3. **商品マスタ取込** — `redownloadHanbaiouProductMaster`。

つまり現状は **D-CATS = 受注・在庫・出荷のフロント / 販売王 = 売上計上・請求・債権管理のバックエンド**。
今回の目的は、この後段を D-CATS 側に内製化すること。

---

## 2. 既存資産（そのまま土台に使える）

### 受注チェーン（実装済み）

```
customer_orders
 ├─ customer_order_items              明細（数量・単価・値引・税区分・コア charge）
 ├─ customer_order_stock_reservations 在庫引当
 ├─ customer_order_shipments          送り状（ヤマトB2連携）
 ├─ customer_order_dispatches         出荷指示
 │   ├─ customer_order_dispatch_items
 │   ├─ customer_order_dispatch_serials          製造シリアル割当
 │   └─ customer_order_dispatch_item_warranties  保証条件の凍結
 ├─ customer_order_events             イベント履歴
 └─ customer_order_b2_imports / _rows B2発行データ取込監査
```

**`customer_orders` の主要列**（金額はすべて `integer` の円）

`order_number` / `sales_customer_id` / `status` / `subtotal_jpy` / `shipping_fee_jpy` / `tax_jpy` / `total_jpy` / `order_discount_jpy` / `shipping_tax_rate_basis_points` / `shipping_tax_type` / `selling_company_code` / `sales_channel` / `scheduled_shipping_date` / `shipped_on` / `completed_at` / `version` / `idempotency_key`

**`customer_order_items` の主要列**

`quantity` / `unit_price_jpy` / `line_total_jpy` / `discount_jpy` / `tax_rate_basis_points`(既定1000=10%) / `tax_category_code`(既定 standard) / `core_return_required` / `core_charge_jpy` / `core_return_handling`

### 請求マスタ（販売王から取込済み。ここが重要）

`sales_customers` には**請求・回収の設定が既に揃っている**。

| 列 | 意味 |
|---|---|
| `source_code`（既定 `hanbaiou`） | マスタの出自 |
| `source_customer_code` / `billing_customer_code` | 得意先コード / **請求先**得意先コード（請求先集約に使う） |
| `closing_code` | **締めコード**（締め日グループ） |
| `collection_method_code` | 回収方法（振込/手形/現金 等） |
| `collection_month_offset` / `collection_day` | **回収月オフセット / 回収日**（例: 翌月末→+1/31） |
| `credit_limit_jpy` | 与信限度 |
| `latest_ar_balance_jpy` | 売掛残高（現状は販売王からのスナップショット値） |
| `tax_method` | 税計算方式（内税/外税） |
| `price_rank_code` / `customer_rate_multiplier` / `amount_adjustment_jpy` / `rounding_unit_jpy` / `rounding_method` | 単価決定・端数処理 |

価格ランクは `sales_price_ranks`（`rate_multiplier` / `rounding_unit_jpy` / `rounding_method`）、基準単価は `product_base_prices` + `product_base_price_history`。

### その他

- 在庫: `core_product_variants` / `core_product_variant_stock_movements`
- 製造: `finished_product_units` / `finished_product_shipments` / `manufacturing_cost_lists`
- 送料: `customer_shipping_rates`（846行、サービス×サイズ×都道府県）
- 監査: `user_activity_events` / `operation_logs` / `user_auth_events`

---

## 3. 欠落している機能（今回追加する対象）

| 機能 | 現状 |
|---|---|
| 売上伝票（売上計上） | **なし**（販売王へ出力して計上） |
| 請求（締め・請求書発行） | **なし**（マスタ設定のみ存在） |
| 入金・消込 | **なし**（`入金`/`消込` の実装が0件） |
| 売掛元帳・残高推移 | **なし**（`latest_ar_balance_jpy` のスナップショットのみ） |
| 仕入・支払 | **ほぼなし**（`支払` 2件、`発注` 2件） |
| 見積 | **なし** |

---

## 4. 追加設計

### 4.1 業務フロー

```
受注              出荷                 売上計上            締め                 回収
customer_orders → customer_order_    → sales_slips     → billing_statements → payment_receipts
                  dispatches(確定)     sales_slip_items   _lines               _allocations
                                            │                  │                    │
                                            └──────────────────▼────────────────────┘
                                                      ar_ledger_entries（売掛元帳）
```

設計原則（販売王の作りから採る要点）

1. **売上は出荷確定を起点に計上する**（`customer_order_dispatches` 確定時に `sales_slips` を生成）。分割納品に対応するため、受注1件に対し売上伝票は複数持てる。
2. **請求は締めコード単位で売上を束ねる**。請求先は `billing_customer_code` で集約（親子得意先の請求先集約に対応）。
3. **入金は請求に充当（消込）する**。一部入金・相殺・振込手数料差引を表現できるよう、入金と充当を分離する。
4. **売掛残高は元帳の積み上げで出す**。`latest_ar_balance_jpy` のような単一値は持たず、`ar_ledger_entries` から算出（スナップショットはキャッシュ扱い）。
5. **金額は既存慣習どおり `integer` の円**、税率は `tax_rate_basis_points`（1000 = 10%）を踏襲。
6. **確定後は不変（immutable）**。訂正は赤伝（マイナス伝票）で行い、UPDATE しない。既存の `customer_order_shipments` の `is_active`/`superseded_at` 方式と整合。

### 4.2 売上（sales_slips）

```sql
create table public.sales_slips (
  id                    bigserial primary key,
  slip_number           text not null unique,              -- 売上伝票番号
  sales_customer_id     bigint not null references public.sales_customers(id),
  billing_customer_code text,                              -- 計上時点の請求先を凍結
  order_id              bigint references public.customer_orders(id),
  dispatch_id           bigint references public.customer_order_dispatches(id),
  slip_type             text not null default 'sale',       -- sale | return | adjustment
  recorded_on           date not null,                      -- 売上計上日（出荷日基準）
  selling_company_code  text,
  sales_channel         text not null default 'standard',
  subtotal_jpy          integer not null,
  discount_jpy          integer not null default 0,
  shipping_fee_jpy      integer not null default 0,
  tax_jpy               integer not null default 0,
  total_jpy             integer not null,
  tax_method            text not null default 'excluded',   -- excluded | included
  closing_code          text,                               -- 計上時点の締めコードを凍結
  billing_statement_id  bigint,                              -- 請求確定時にセット
  status                text not null default 'recorded',    -- recorded | billed | cancelled
  note                  text,
  idempotency_key       text not null unique,
  created_by            uuid,
  created_at            timestamptz not null default now()
);

create table public.sales_slip_items (
  id                      bigserial primary key,
  slip_id                 bigint not null references public.sales_slips(id) on delete cascade,
  line_no                 integer not null,
  order_item_id           bigint references public.customer_order_items(id),
  dkd_shohin_id           bigint,
  product_variant_id      bigint,
  product_kind            text not null,
  category_code           text not null,
  genuine_part_number     text,
  manufacturer_part_number text,
  manufacturer            text,
  quantity                integer not null,
  unit_price_jpy          integer not null,
  discount_jpy            integer not null default 0,
  line_total_jpy          integer not null,
  tax_rate_basis_points   smallint not null default 1000,
  tax_category_code       text not null default 'standard',
  core_charge_jpy         integer,                          -- コア預り金
  core_return_required    boolean not null default false,
  unique (slip_id, line_no)
);
```

**ポイント**
- `closing_code` / `billing_customer_code` を**計上時点で凍結**する。マスタ変更が過去の請求に波及しないようにするため（販売王で運用上よく問題になる箇所）。
- 返品は `slip_type='return'` のマイナス伝票として起票。
- コア返却（リビルト品）は `core_charge_jpy` を売上明細に持たせ、返却時に `slip_type='return'` で戻す。

### 4.3 請求（billing_statements）

```sql
create table public.billing_statements (
  id                       bigserial primary key,
  statement_number         text not null unique,            -- 請求書番号
  billing_customer_code    text not null,                   -- 請求先（集約キー）
  sales_customer_id        bigint references public.sales_customers(id),
  closing_code             text,
  period_start             date not null,
  period_end               date not null,                   -- 締め日
  issued_on                date not null,
  due_on                   date not null,                   -- 回収予定日（collection_* から算出）
  carried_forward_jpy      integer not null default 0,      -- 前回繰越残高
  period_sales_jpy         integer not null default 0,      -- 当期売上
  period_payments_jpy      integer not null default 0,      -- 当期入金
  period_tax_jpy           integer not null default 0,
  billed_amount_jpy        integer not null,                -- 今回請求額
  balance_jpy              integer not null,                -- 請求後残高
  status                   text not null default 'open',    -- open | sent | settled | cancelled
  invoice_registration_no  text,                            -- 適格請求書発行事業者 登録番号(T+13桁)
  tax_breakdown            jsonb not null default '{}',      -- 税率別内訳(10%/8%/非課税)
  issued_by                uuid,
  created_at               timestamptz not null default now()
);

create table public.billing_statement_lines (
  id            bigserial primary key,
  statement_id  bigint not null references public.billing_statements(id) on delete cascade,
  line_no       integer not null,
  slip_id       bigint references public.sales_slips(id),
  line_kind     text not null,                              -- sale | return | carry_forward | payment | adjustment
  recorded_on   date not null,
  description   text,
  amount_jpy    integer not null,
  tax_jpy       integer not null default 0,
  unique (statement_id, line_no)
);
```

**ポイント**
- **インボイス制度対応**: `invoice_registration_no` と `tax_breakdown`（税率別の対価の額と消費税額）を請求書に必須で持たせる。これは販売王にもある要件で、自前化する際に最も漏れやすい。
- **繰越方式**: `carried_forward_jpy` → `period_sales_jpy` → `period_payments_jpy` → `billed_amount_jpy` → `balance_jpy` の積み上げ形式（販売王の請求書レイアウトと同じ構造）。
- `due_on` は `sales_customers.collection_month_offset` / `collection_day` / `closing_code` から導出する。

### 4.4 入金・消込（payment_receipts）

```sql
create table public.payment_receipts (
  id                     bigserial primary key,
  receipt_number         text not null unique,
  billing_customer_code  text not null,
  sales_customer_id      bigint references public.sales_customers(id),
  received_on            date not null,
  method_code            text not null,                     -- transfer | cash | note | offset | card
  gross_amount_jpy       integer not null,                  -- 入金総額
  bank_fee_jpy           integer not null default 0,        -- 振込手数料差引
  offset_amount_jpy      integer not null default 0,        -- 相殺額
  allocated_amount_jpy   integer not null default 0,        -- 充当済み合計
  unallocated_amount_jpy integer not null default 0,        -- 未充当（前受金）
  note                   text,
  recorded_by            uuid,
  created_at             timestamptz not null default now()
);

create table public.payment_receipt_allocations (
  id            bigserial primary key,
  receipt_id    bigint not null references public.payment_receipts(id) on delete cascade,
  statement_id  bigint references public.billing_statements(id),
  slip_id       bigint references public.sales_slips(id),    -- 伝票単位消込をする場合
  allocated_jpy integer not null,
  allocated_on  date not null default current_date,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
```

**ポイント**
- 入金（receipt）と充当（allocation）を分離することで、**一部入金・複数請求へのまとめ入金・前受金**を自然に表現できる。
- 手数料差引・相殺を独立列に持つ（実務で最も揉める差額要因）。

### 4.5 売掛元帳（ar_ledger_entries）

```sql
create table public.ar_ledger_entries (
  id                    bigserial primary key,
  billing_customer_code text not null,
  sales_customer_id     bigint references public.sales_customers(id),
  entry_date            date not null,
  entry_type            text not null,                      -- sale | return | payment | fee | offset | adjustment
  source_table          text not null,                      -- sales_slips | payment_receipts | ...
  source_id             bigint not null,
  debit_jpy             integer not null default 0,          -- 借方（売掛増）
  credit_jpy            integer not null default 0,          -- 貸方（売掛減）
  description           text,
  created_at            timestamptz not null default now()
);
create index on public.ar_ledger_entries (billing_customer_code, entry_date);
```

残高は `sum(debit_jpy - credit_jpy)` で算出。`sales_customers.latest_ar_balance_jpy` はこの集計のキャッシュとして更新する。

### 4.6 仕入・支払（買掛側／必要な場合）

「支払」が**仕入先への支払**を指す場合は、売上側と対称に構成する。

```
purchase_orders → purchase_receipts(仕入) → payable_statements → payment_disbursements
                                                                 _allocations
                                          ap_ledger_entries（買掛元帳）
```

既存の `suppliers` / `supplier_parts` / `internal_component_suppliers` / `manufacturing_cost_lists` を仕入マスタの土台に使える。

> 販売王は**入金(`NyknDnpy`)と支払(`ShharDnpy`)の両方**を持つ（第8章参照）。D-CATS でどちらを実装するかは要確認。

---

## 5. 実装上の要点

### 税計算
- 既存 `tax_rate_basis_points`（1000=10%、800=8%）を踏襲。
- **端数処理は伝票単位 × 税率別に1回**だけ行う（明細ごとに丸めると請求書と合わなくなる）。`sales_customers.rounding_unit_jpy` / `rounding_method` を適用。
- 内税/外税は `sales_customers.tax_method` に従い、伝票に凍結する。

### 締め処理
- `closing_code` ごとに締め日を定義するマスタが必要（現状は `closing_code` の値のみでルールが未定義）。`closing_rules` テーブルの追加を推奨。
- 締めは冪等に。再実行しても同じ請求書になるよう `idempotency_key` を使う。

### 整合性
- 売上計上は `customer_order_dispatches` 確定と**同一トランザクション**で行う（Supabase の RPC / Postgres 関数として実装）。
- 確定済み伝票は更新不可。RLS とトリガで `status` 遷移を制限する。
- 既存の `customer_order_events` と同様に、売上・請求・入金もイベント履歴を残す。

### 販売王との並行運用（移行期）
- 当面は **D-CATS で計上 → 販売王へも出力**の二重運用を維持し、金額が一致することを検証する。
- 既存 `SalesAccountingExport` はそのまま残し、`sales_slips` を出力元に切り替える形が安全。
- 検証が済んだ段階で販売王出力を停止する。

---

## 6. 推奨実装順序

| 段階 | 内容 | 根拠 |
|---|---|---|
| 1 | `closing_rules` + `sales_slips` / `sales_slip_items` | 売上計上がすべての起点。出荷確定との接続まで |
| 2 | `ar_ledger_entries` | 売上を元帳に流す。残高が見えるようになる |
| 3 | `billing_statements` / `_lines` + 請求書PDF | 締め→請求書発行。インボイス要件を満たす |
| 4 | `payment_receipts` / `_allocations` | 入金消込。ここまでで債権管理が自立 |
| 5 | 販売王出力の切替・停止 | 二重運用の検証後 |
| 6 | 買掛側（4.6） | 必要な場合 |

---

## 7. 未確定事項

1. 「支払」は**入金**（得意先回収）か**支払**（仕入先）か。
2. 締めルールの実体（`closing_code` ごとの締め日：月末／20日／都度 など）。
3. 請求書の出力形態（PDF／帳票レイアウト／郵送・メール）。
4. 適格請求書発行事業者の登録番号（T+13桁）。
5. 既存販売王データの移行範囲（過去の売掛残高・未収をどこまで持ち込むか）。
6. 現在の `customer_orders` は0行＝受注機能は稼働前か検証中か。実運用データの所在。

---

## 8. 販売王の実テーブル設計（参考元・実機確認済み）

### 8.1 環境

| 項目 | 値 |
|---|---|
| 製品 | 販売王２５ / ２４ 販売・仕入・在庫 |
| DBエンジン | **Microsoft SQL Server 2017**（14.0.2140）インスタンス `SORIMACHI2017` |
| データベース | `SSPR25MNGDB`(管理) / `SPR25DB01` / `SPR25DB02`（各120テーブル） |
| 接続 | Windows認証でローカル接続可（`localhost\SORIMACHI2017`） |

> 販売王のデータは**標準的なSQL Server**に格納されている。したがって自社データの構造把握・移行は**SQLで直接読める**（逆コンパイルは不要）。

### 8.2 命名規則

`<業務略称> + Dnpy`(伝票ヘッダ) / `+ DnpyMs`(明細)。列は**ハンガリアン記法**で型を接頭辞に持つ。

`i`=int / `c`=char,varchar / `m`=money / `d`=datetime、`EDPNo`=内部通番(PK)、`Ms`=明細、`Kb`=区分、`Nm`=名称、`Ttl`=合計、`Sry`=数量、`Tnk`=単価、`Kngk`=金額、`Zei/Znk`=税抜、`Zkm`=税込

### 8.3 伝票テーブル対応表

| 業務 | ヘッダ | 明細 | 備考 |
|---|---|---|---|
| 見積 | `Mtsmr` | `MtsmrMs` | |
| 受注 | `JchDnpy` | `JchDnpyMs` | |
| **売上** | `UrgDnpy` | `UrgDnpyMs` | `SPR25DB02` に実データ10件 |
| **請求締切** | `SkySmkr` | — | 得意先×請求書発行日がキー |
| **入金** | `NyknDnpy` | `NyknDnpyMs` | 明細に入金手段の内訳 |
| 発注 | `HtchDnpy` | `HtchDnpyMs` | |
| 仕入 | `ShirDnpy` | `ShirDnpyMs` | |
| **支払締切** | `ShharShmkr` | — | |
| **支払** | `ShharDnpy` | `ShharDnpyMs` | |
| 在庫振替 | `ZaikoFrkDnpy` | `ZaikoFrkDnpyMs` | |
| 組立 | `KmttDnpy` | `KmttDnpyMs` | 構成商品は `KouseiShhn` |
| 電帳連携 | `DnchRenkei` / `DnchJson` | `…Ms` | 電子帳簿保存法対応 |

**マスタ**: `Tksk`(得意先) / `Shirsk`(仕入先) / `Shhn`(商品) / `Souko`(倉庫) / `Bmn`(部門) / `Tntsh`(担当者) / `Kmk`(勘定科目) / `Tax`(税) / `Hsssk`(発送先) / `Bank`,`BankShtn`(銀行) / `TkskbtsShhnTnk`(得意先別単価) / `ShirskbtsShhnTnk`(仕入先別単価) / `SkbtsShhnZaiko`(倉庫別在庫) / `BlackList`(与信) / `KkoSwkSksJkn`(会計仕訳作成条件＝会計王連携)

### 8.4 `UrgDnpy`（売上伝票）の要点列

| 列 | 意味 |
|---|---|
| `iUrgEDPNo` | 内部通番(PK) |
| `cUrgDnpyNo` / `cInitUrgDnpyNo` | 伝票番号 / 当初伝票番号（訂正追跡） |
| `iUrgDnpyDay` | 売上日（**int型 YYYYMMDD**） |
| `iAkdnSht` / `iAkdnTaiouEDPNo` | **赤伝フラグ / 対応元伝票**（訂正は赤伝で行う） |
| `iMtsmrEDPNo` | 見積からの引継ぎ |
| `iTkskEDPNo` / `cTkskNm` | 得意先コード / **名称も保存**（凍結） |
| `iSkyTkskEDPNo` / `cSkyTkskNm` | **請求先得意先**（請求先集約） |
| `iHssskEDPNo` / `cHssskNm` | 発送先 |
| `iZuijiSkyKb` | **随時請求区分**（都度請求 / 締め請求） |
| `iSkyYoteiDay` / `iSkyshHkkDay` / `iSkyshHkkZumi` / `iSkySkkrTsks` | 請求予定日 / 請求書発行日 / 発行済 / 締切済 |
| `iKshDayShmkr` | 回収日締切 |
| `iHssYoteiDay` / `iHssZumi` / `iNhnshHkkZumi` | 発送予定 / 発送済 / 納品書発行済 |
| `iKshkm` / `iKshkmNyknEDPNo` | 現金区分 / **対応入金伝票**（現金売上の即時紐付け） |
| `mZnkTtl` / `mZkmTtl` / `mZeigaiTtl` / `mTtlKngk` | 税抜計 / 税込計 / 税外計 / 合計 |
| `mZnkTaxTtl` / `mZkmTaxTtl` / `mChsTaxTtl` / `mSmiktTax` | 税率別・調整・簡易課税の税額 |
| `cInvoiceRegNo` varchar(14) | **インボイス登録番号を伝票に凍結** |
| `*NKb1-5` `*NInt1-5` `*NMny1-5` `*NChr1-5` | ユーザー定義の**予備枠**（拡張用の空列） |

### 8.5 `UrgDnpyMs`（売上明細）の要点列

`iUrgEDPNo`+`iUrgMsNo`(複合キー) / `iSoukoEDPNo`(倉庫) / **`iJchEDPNo`+`iJchMsNo`(受注明細からの引継ぎ)** / `iShhnEDPNo`+`cShhnNm`(商品) / `cKikkKtbn`(規格型番) / `cColor` / `cSize` / `iKsnshkCd`+`mKsnch1-3`(入数換算) / `iHnbIriSu`+`iHakoSu`(販売入数・箱数) / `mSry`+`cSryTani`(数量・単位) / `mTnk`(単価) / **`mGntnk`(原価単価＝粗利計算用)** / `iTaxRateKbCd`+`iTaxKb`+`iKaniTaxJgyKb`(税) / `mKngk`(金額) / `cBikou`(備考)

### 8.6 `SkySmkr`（請求締切）— 請求の中核

キーは `iTkskEDPNo` × `iSkyshHkkDay`（得意先 × 請求書発行日）。

```
mZnkUrikkKrksh  前回売掛繰越
 + mKnkZnkUrgYn 今回税抜売上 / mKnkZkmUrgYn 今回税込売上 / mKnkZeigaiUrgYn 今回税外売上
 + mKnkZnkTaxYn / mKnkZkmTaxYn / mKnkChsTaxYn  今回税額
 − mKnkNyknYn   今回入金額
 = mKnkSkyYn    今回請求額
 → mZnSkyYn     残請求額
```
`iUrgDnpyMaiSu` / `iNyknDnpyMaiSu`（売上・入金の伝票枚数）、`iZnkSkyDay`(前回請求日)、`cMsShoNo`(明細書番号)。

→ **4.3 で設計した繰越方式（`carried_forward_jpy` → `period_sales_jpy` → `period_payments_jpy` → `billed_amount_jpy` → `balance_jpy`）は販売王と同一構造**であることが実機で裏付けられた。

### 8.7 販売王から採る点 / D-CATSで改善する点

**採るべき設計（優れている）**

1. **ヘッダ＋明細の2層**と複合キー（`EDPNo` + `MsNo`）
2. **コードと名称を両方保存**（`iTkskEDPNo` + `cTkskNm`）＝マスタ変更が過去伝票に波及しない
3. **赤伝方式**（`iAkdnSht` / `iAkdnTaiouEDPNo`）＝確定伝票を更新せず訂正を追跡
4. **前工程からの引継ぎを明細レベルで保持**（`iJchEDPNo` + `iJchMsNo`）＝**分割納品に対応できる**
5. **請求締切テーブルが繰越計算を保存**＝過去の請求書を再現できる
6. **インボイス登録番号を伝票に凍結**
7. **原価単価を明細に持つ**（`mGntnk`）＝伝票単位で粗利が出る
8. 随時請求 / 締め請求の区分（`iZuijiSkyKb`）

**D-CATSで改善できる点**

| 販売王の課題 | D-CATSでの改善 |
|---|---|
| 日付が **int型 YYYYMMDD**（`iUrgDnpyDay`）→ 日付演算ができない | `date` 型を使う |
| **予備枠カラムが大量**（`NKb1-5`/`NInt1-5`/`NMny1-5`/`NChr1-5`）→ 意味不明な空列 | `jsonb` で拡張（既存の `raw_payload`/`vehicle_information` と同方式） |
| **ローマ字略称の命名**（`mKnkZnkUrgYn` は解読困難） | 可読な snake_case |
| **`money` 型**（丸め挙動が暗黙） | `integer`（円）＝既存D-CATSの方式を踏襲 |
| **入金消込が粗い**（`iKshkmNyknEDPNo` の単一参照のみ） | `payment_receipt_allocations` で一部入金・複数請求充当・前受金を正確に表現 |
| **残高を集計値で保存**（`mZnSkyYn`） | `ar_ledger_entries` から算出（スナップショットはキャッシュ扱い） |
| 単位・入数・換算が明細に散在（`iKsnshkCd`/`mKsnch1-3`/`iHnbIriSu`/`iHakoSu`） | 商品マスタ側に集約 |
| コア返却（リビルト品）の概念がない | 既存 `core_charge_jpy` / `core_return_handling` で自社業務に適合 |

### 8.8 データ移行の実務メモ

- `iUrgDnpyDay` 等の int 日付は `to_date(x::text,'YYYYMMDD')` で変換。
- `iTkskEDPNo` ↔ `sales_customers.source_customer_code` で突合（`source_code='hanbaiou'` が既にその前提）。
- `SkySmkr` の繰越残高は、移行開始日時点の `ar_ledger_entries` の期首エントリとして1本投入する。
- 読み取りは SQL Server への参照接続のみ。販売王稼働中の書き込みは行わない。

---

## 付録: 現状の Supabase 主要テーブル（売上関連）

| 分類 | テーブル |
|---|---|
| 受注 | `customer_orders`, `customer_order_items`, `customer_order_stock_reservations`, `customer_order_events`, `customer_order_shipments`, `customer_order_dispatches`, `customer_order_dispatch_items`, `customer_order_dispatch_serials`, `customer_order_dispatch_item_warranties`, `customer_order_b2_imports`, `customer_order_b2_import_rows` |
| 得意先・価格 | `sales_customers`, `sales_price_ranks`, `product_base_prices`, `product_base_price_history`, `product_price_references`, `customer_shipping_rates`, `customer_product_visibility`, `customer_display_settings`, `customer_user_links` |
| 在庫 | `core_product_variants`, `core_product_variant_stock_movements` |
| 製造 | `finished_product_units`, `finished_product_shipments`, `finished_product_shipment_items`, `manufacturing_cost_lists`, `manufacturing_cost_list_items` |
| 仕入先 | `suppliers`, `supplier_parts`, `internal_component_suppliers`, `supplier_catalog_items` |
| 監査 | `user_activity_events`, `operation_logs`, `user_auth_events` |
