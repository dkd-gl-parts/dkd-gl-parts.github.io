const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const i18n = fs.readFileSync(path.join(root, "legacy-i18n.js"), "utf8");

function between(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Could not isolate ${start}`);
  return source.slice(startIndex, endIndex);
}

[
  "sales-order-import-b2",
  "sales-order-import-b2-file",
  "sales-order-b2-import",
  "sales-order-b2-import-table",
  "sales-order-import-b2-confirm",
  "sales-order-b2-import-guide-overlay",
  "sales-order-b2-import-guide-title",
  "sales-order-b2-import-guide-yamato",
  "sales-order-b2-import-guide-search-step",
  "sales-order-b2-import-guide-search-conditions-toggle",
  "sales-order-b2-import-guide-search-conditions",
  "sales-order-b2-import-guide-date-from",
  "sales-order-b2-import-guide-date-to",
  "sales-order-b2-import-guide-select-file",
  "sales-order-b2-import-guide-settings-reference",
  "sales-order-b2-import-guide-settings-reference-title",
  "sales-order-b2-import-guide-status",
  "sales-order-b2-import-guide-cancel"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) throw new Error(`B2 issued-data import UI is missing: ${id}`);
});

[
  "発行済データの検索",
  "外部ファイル出力",
  "ログインページを開く",
  "送り状発行システム B2クラウド",
  "検索条件を表示",
  "ヤマトB2に入力する検索条件",
  "おすすめ：出荷予定日で絞る",
  "初期値は本日です。別日の送り状を出力する場合は、発送する日付へ変更してください。",
  "開始日",
  "終了日",
  "条件なしでも取込できます",
  "同じ送り状番号は再登録せず",
  "別の有効なD-CATS受注に一致する行は同時に反映され",
  "CSVが1,000行を超えると取り込めない",
  "削除済のデータのみ表示する",
  "1行目に見出しを出力する",
  "CSVを選択",
  "「各種設定の変更」で確認できる内容",
  "プリンタ・送り状レイアウト",
  "A5マルチ用紙（レーザー専用）",
  "マルチ用紙設定・印刷位置調整",
  "各種初期値",
  "電話番号・枝番・名称",
  "品名コード1・品名1",
  "用紙サイズ「A5」・印刷の向き「横」",
  "うまく進まない場合",
  "認証情報を、D-CATSへ入力・送信・保存することはありません。"
].forEach((fragment) => {
  if (!html.includes(fragment)) throw new Error(`B2 download guidance is missing: ${fragment}`);
});
if (html.includes('id="sales-order-b2-import-guide-b2-menu"') ||
    html.includes('id="sales-order-b2-import-guide-issued-search"')) {
  throw new Error("B2 guide must not show buttons that only return to an already-open Yamato tab");
}
const settingsReference = html.slice(
  html.indexOf('id="sales-order-b2-import-guide-settings-reference"'),
  html.indexOf('id="sales-order-b2-import-guide-status"')
);
if (!settingsReference || settingsReference.includes("<button")) {
  throw new Error("B2 settings reference must present information without a non-assisting button");
}
if (!source.includes('var SALES_ORDER_B2_PORTAL_URL = "https://bmypage.kuronekoyamato.co.jp/bmypage/";')) {
  throw new Error("B2 download guidance must open the official Yamato portal");
}
if (html.includes("newb2web.kuronekoyamato.co.jp/issue_search.html") ||
    source.includes("newb2web.kuronekoyamato.co.jp/issue_search.html")) {
  throw new Error("B2 download guidance must not deep-link into Yamato's session-bound screens");
}
[
  "ログイン後のマイページで、次の項目を押します。",
  "B2クラウドのメインメニューで、次の項目を押します。",
  "B2の内部画面は直接URLで開けません。強調表示された項目名を、手順1で開いたヤマト画面から順に選択してください。",
  "ブラウザでポップアップを許可し、手順1をもう一度押してください。",
  "セッション切れです。再ログインし、「送り状発行システム B2クラウド」から続けてください。"
].forEach((fragment) => {
  if (!html.includes(fragment)) throw new Error(`B2 session-safe navigation guidance is missing: ${fragment}`);
});

const openGuide = between("function openSalesOrderB2ImportGuide", "function closeSalesOrderB2ImportGuide");
if (!openGuide.includes("canManageSalesOrders()") ||
    !openGuide.includes('classList.add("show")') ||
    !openGuide.includes("salesOrderB2GuideWindowAvailable()") ||
    !openGuide.includes('conditionsStep.classList.remove("conditions-open")') ||
    !openGuide.includes('dateFrom.value = ""') ||
    !openGuide.includes('dateTo.value = ""') ||
    !openGuide.includes("action.focus()")) {
  throw new Error("B2 import action must open and focus the download guide");
}
const openPortal = between("function openSalesOrderB2Portal", "function syncSalesOrderB2GuideDateRange");
if (!openPortal.includes('window.open(SALES_ORDER_B2_PORTAL_URL, "dcats-yamato-b2")') ||
    !openPortal.includes("popup.opener = null") ||
    !openPortal.includes("ポップアップを許可")) {
  throw new Error("B2 guide must open the official portal in a reusable tab and explain popup failures");
}
const syncDateRange = between("function syncSalesOrderB2GuideDateRange", "function showSalesOrderB2SearchConditions");
const syncDateFrom = { value: "2026-09-12" };
const syncDateTo = { value: "2026-09-11" };
const syncDateSandbox = {
  document: {
    getElementById(id) {
      if (id === "sales-order-b2-import-guide-date-from") return syncDateFrom;
      if (id === "sales-order-b2-import-guide-date-to") return syncDateTo;
      return null;
    }
  }
};
vm.runInNewContext(`${syncDateRange}; syncSalesOrderB2GuideDateRange(document.getElementById("sales-order-b2-import-guide-date-from"));`, syncDateSandbox);
if (syncDateTo.value !== "2026-09-12") {
  throw new Error("Changing the B2 guide start date must keep the end date in a valid range");
}
const showConditions = between("function showSalesOrderB2SearchConditions", "function openSalesOrderB2ImportGuide");
if (!showConditions.includes('panel.hidden = false') ||
    !showConditions.includes('button.setAttribute("aria-expanded", "true")') ||
    !showConditions.includes("salesOrderTokyoTodayValue()") ||
    !showConditions.includes('step.classList.add("conditions-open")') ||
    !showConditions.includes("setSalesOrderB2GuideStep(3)") ||
    !showConditions.includes("ヤマトB2へ同じ内容を入力してください")) {
  throw new Error("Issued Data Search guidance must reveal the recommended search conditions");
}
const conditionsPanel = { hidden: true, focused: false, focus() { this.focused = true; } };
const conditionsButton = { expanded: "false", setAttribute(name, value) { if (name === "aria-expanded") this.expanded = value; } };
const conditionsStep = { expanded: false, classList: { add(name) { if (name === "conditions-open") conditionsStep.expanded = true; } } };
const conditionsDateFrom = { value: "" };
const conditionsDateTo = { value: "" };
const conditionsObserved = {};
const conditionsSandbox = {
  document: {
    getElementById(id) {
      if (id === "sales-order-b2-import-guide-search-conditions") return conditionsPanel;
      if (id === "sales-order-b2-import-guide-search-conditions-toggle") return conditionsButton;
      if (id === "sales-order-b2-import-guide-search-step") return conditionsStep;
      if (id === "sales-order-b2-import-guide-date-from") return conditionsDateFrom;
      if (id === "sales-order-b2-import-guide-date-to") return conditionsDateTo;
      return null;
    }
  },
  window: { requestAnimationFrame(callback) { callback(); } },
  salesOrderTokyoTodayValue() { return "2026-09-11"; },
  setSalesOrderB2GuideStep(step) { conditionsObserved.step = step; },
  setSalesOrderB2GuideStatus(message, isError) { conditionsObserved.status = { message, isError }; }
};
vm.runInNewContext(`${showConditions}; showSalesOrderB2SearchConditions();`, conditionsSandbox);
if (conditionsPanel.hidden || !conditionsPanel.focused || conditionsButton.expanded !== "true" || !conditionsStep.expanded ||
    conditionsDateFrom.value !== "2026-09-11" || conditionsDateTo.value !== "2026-09-11" ||
    conditionsObserved.step !== 3 || conditionsObserved.status?.isError ||
    !conditionsObserved.status?.message.includes("同じ内容を入力")) {
  throw new Error("Issued Data Search condition panel must expand, receive focus, and announce the next action");
}
const closeGuide = between("function closeSalesOrderB2ImportGuide", "function selectSalesOrderB2ImportFile");
if (!closeGuide.includes('classList.remove("show")') || !closeGuide.includes('getElementById("sales-order-import-b2")')) {
  throw new Error("B2 download guide must close and restore focus to its trigger");
}
const selectFile = between("function selectSalesOrderB2ImportFile", "function salesOrderB2ImportFileValidationMessage");
if (!selectFile.includes('getElementById("sales-order-import-b2-file")') ||
    !selectFile.includes('input.value = ""') || !selectFile.includes("input.click()")) {
  throw new Error("B2 download guide must continue to the existing CSV file picker");
}
[
  'document.getElementById("sales-order-import-b2").addEventListener("click", openSalesOrderB2ImportGuide)',
  'document.getElementById("sales-order-b2-import-guide-yamato").addEventListener("click", openSalesOrderB2Portal)',
  'document.getElementById("sales-order-b2-import-guide-search-conditions-toggle").addEventListener("click", showSalesOrderB2SearchConditions)',
  'document.getElementById("sales-order-b2-import-guide-date-from").addEventListener("change"',
  'document.getElementById("sales-order-b2-import-guide-date-to").addEventListener("change"',
  'document.getElementById("sales-order-b2-import-guide-select-file").addEventListener("click", selectSalesOrderB2ImportFile)',
  'if (e.key === "Escape") closeSalesOrderB2ImportGuide()',
  "closeSalesOrderB2ImportGuide(false);"
].forEach((fragment) => {
  if (!source.includes(fragment)) throw new Error(`B2 download guide behavior is missing: ${fragment}`);
});

[
  ".sales-order-b2-import-guide-steps > li.conditions-open",
  ".sales-order-b2-import-guide-date-range",
  ".sales-order-b2-import-guide-date-fields",
  ".sales-order-b2-import-guide-no-filter",
  ".sales-order-b2-import-guide-settings-reference",
  ".sales-order-b2-import-guide-settings-groups",
  ".sales-order-b2-import-guide-printer-note"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`B2 search-condition layout is missing: ${fragment}`);
});
[
  "Recommended: Filter by planned shipping date",
  "You can import without search conditions",
  "What you can review under Change Settings",
  "Printer and waybill layout",
  "建议：按预计发货日期筛选",
  "也可以不指定搜索条件直接导入",
  "可在“更改各项设置”中确认的内容",
  "打印机和运单布局"
].forEach((fragment) => {
  if (!i18n.includes(fragment)) throw new Error(`B2 guide translation is missing: ${fragment}`);
});

const validationFunction = between("function salesOrderB2ImportFileValidationMessage", "function salesOrderB2ImportFriendlyError");
const validationSandbox = {};
vm.runInNewContext(`${validationFunction}; validate = salesOrderB2ImportFileValidationMessage;`, validationSandbox);
if (validationSandbox.validate({ name: "issued-data.txt", size: 100 }) !== "CSVファイルを選択してください。" ||
    !validationSandbox.validate({ name: "issued-data.csv", size: 0 }).includes("空です") ||
    !validationSandbox.validate({ name: "issued-data.csv", size: 6 * 1024 * 1024 }).includes("大きすぎます") ||
    validationSandbox.validate({ name: "issued-data.csv", size: 100 })) {
  throw new Error("B2 file picker must reject wrong, empty, and oversized files before upload");
}

const csvFunctions = between("function parseSalesOrderB2Csv", "async function salesOrderB2FileSha256");
const sandbox = {};
vm.runInNewContext(`${csvFunctions}; result = { parseSalesOrderB2Csv, salesOrderB2RowsFromCsv };`, sandbox);
const parsed = sandbox.result.parseSalesOrderB2Csv(
  'お客様管理番号,送り状種類,クール区分,伝票番号,出荷予定日\r\n' +
  '"DC20260807-000001-O",0,0,490714955706,2026/08/05\r\n'
);
const rows = sandbox.result.salesOrderB2RowsFromCsv(parsed);
if (rows.length !== 1 || rows[0].customer_management_number !== "DC20260807-000001-O" ||
    rows[0].tracking_number !== "490714955706" || rows[0].planned_ship_date !== "2026-08-05" ||
    rows[0].source_row_number !== 2) {
  throw new Error("B2 issued-data CSV must be parsed by Japanese header name and normalized safely");
}
if (!source.includes('new TextDecoder("shift_jis")') || !source.includes('new TextDecoder("utf-8", { fatal: true })')) {
  throw new Error("B2 import must support both Yamato Shift-JIS and D-CATS UTF-8 CSV files");
}
if (!source.includes('window.crypto.subtle.digest("SHA-256", buffer)')) {
  throw new Error("B2 import must calculate a file hash for idempotent imports");
}

const renderImport = between("function renderSalesOrderB2Import", "function closeSalesOrderB2Import");
[
  "row.replaces_existing === true",
  "row.superseded_by_later_row === true",
  "更新可能",
  "旧データ",
  "後発データを採用"
].forEach((fragment) => {
  if (!renderImport.includes(fragment)) throw new Error(`B2 reissue preview state is missing: ${fragment}`);
});

const previewImport = between("async function previewSalesOrderB2ImportFile", "async function importSalesOrderB2Shipments");
if (!previewImport.includes('sb.rpc("preview_sales_order_b2_shipments"') ||
    !previewImport.includes("target_rows: parsedRows")) {
  throw new Error("B2 CSV must be matched on the server before the confirm action is enabled");
}
const commitImport = between("async function importSalesOrderB2Shipments", "function returnFromProductSearch");
[
  'sb.rpc("import_sales_order_b2_shipments"',
  "target_file_name",
  "target_file_sha256",
  "target_rows",
  "replacement_count",
  "superseded_by_later_row",
  "再発行後の更新",
  "後発データを反映しました",
  "print_job_count",
  "print_warning_count",
  "コア返却シート・保証書",
  "注文詳細から再送してください"
].forEach((fragment) => {
  if (!commitImport.includes(fragment)) throw new Error(`B2 import mutation is missing: ${fragment}`);
});
if (source.includes('.from("customer_order_b2_imports")') || source.includes('.from("customer_order_shipments")')) {
  throw new Error("The browser must not write shipment or B2 import audit tables directly");
}

const defaults = between("function defaultCustomerDisplaySettings", "function normalizeCustomerShippingChargeRule");
[
  'default_outbound_carrier_name: "ヤマト運輸"',
  'default_outbound_service_name: "宅急便"',
  'default_core_return_carrier_name: "佐川急便"',
  'default_core_return_service_name: "飛脚宅配便"'
].forEach((fragment) => {
  if (!defaults.includes(fragment)) throw new Error(`Customer default shipping setting is missing: ${fragment}`);
});
const accessRender = between("function renderCustomerAccessDetail", "function renderCustomerAccessRuleForm");
if (!accessRender.includes("customer-default-outbound-shipping") ||
    !accessRender.includes("customer-default-core-return-shipping")) {
  throw new Error("Customer settings must expose separate outbound and core-return defaults");
}
const accessCollect = between("function collectCustomerDisplaySettings", "function collectCustomerAccessCategoryVisibility");
if (!accessCollect.includes("default_outbound_carrier_name") ||
    !accessCollect.includes("default_core_return_service_name") ||
    !accessCollect.includes("customerOrderDeliveryServiceFromKey")) {
  throw new Error("Customer default shipping methods must be saved with display settings");
}
const serviceLoad = between("async function loadCustomerOrderDeliveryServices", "function customerOrderCartKey");
if (!serviceLoad.includes('customerOrderDefaultShippingKey("outbound")') ||
    !serviceLoad.includes('customerOrderDefaultShippingKey("core_return")')) {
  throw new Error("The order screen must select the customer's two default services");
}

const detailRender = between("function renderSalesOrderDetail", "async function loadSalesOrderDetail");
if (!detailRender.includes("salesOrderShipmentHistoryHtml(order.shipment_history)")) {
  throw new Error("Order detail must show immutable shipment history");
}

[
  ".sales-order-b2-import",
  ".sales-order-b2-import-row",
  ".sales-order-b2-import-guide-card",
  ".sales-order-b2-import-guide-steps",
  ".sales-order-b2-import-guide-field",
  ".sales-order-b2-import-guide-search-conditions",
  ".sales-order-b2-import-guide-export-steps",
  ".sales-order-b2-import-guide-status",
  ".sales-order-b2-import-guide-help",
  ".sales-order-b2-import-guide-warning",
  ".sales-order-shipment-history-row",
  ".customer-default-shipping-grid",
  "@media (max-width: 560px)"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`Responsive B2/default-shipping style is missing: ${fragment}`);
});

console.log("Customer order B2 issued-data import verification passed.");
