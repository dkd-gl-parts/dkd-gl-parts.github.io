const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function between(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Could not isolate ${start}`);
  return source.slice(startIndex, endIndex);
}

for (const id of [
  "sales-order-b2-settings-open",
  "shipping-document-b2-settings-open",
  "sales-order-b2-preflight",
  "sales-order-b2-preflight-errors",
  "sales-order-b2-settings-overlay",
  "sales-order-b2-sender-phone",
  "sales-order-b2-sender-postal-code",
  "sales-order-b2-sender-address",
  "sales-order-b2-sender-name",
  "sales-order-b2-billing-customer-code",
  "sales-order-b2-fare-management-number"
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing B2 settings/preflight UI: ${id}`);
}

const timeout = between("function salesOrderB2RpcWithTimeout", "function renderSalesOrderB2SettingsAccess");
if (!timeout.includes("window.setTimeout") || !timeout.includes("DCATS_B2_TIMEOUT") || !timeout.includes("window.clearTimeout")) {
  throw new Error("B2 RPC calls must have a bounded timeout and clear their timer");
}

const settings = between("function renderSalesOrderB2SettingsAccess", "var DCATS_BUSINESS_WORKSPACE_URL");
for (const fragment of [
  "isSystemAdmin()",
  'sb.rpc("get_customer_order_b2_contract_settings")',
  'sb.rpc("save_customer_order_b2_contract_settings"',
  "validateSalesOrderB2SettingsForm",
  "renderSalesOrderB2Preflight"
]) {
  if (!settings.includes(fragment)) throw new Error(`Missing B2 settings contract: ${fragment}`);
}

const contractPreflightSource = between("function salesOrderB2PreflightNeedsContractSettings", "var DCATS_BUSINESS_WORKSPACE_URL");
const contractPreflightSandbox = { Array, String };
vm.createContext(contractPreflightSandbox);
vm.runInContext(contractPreflightSource, contractPreflightSandbox);
if (!contractPreflightSandbox.salesOrderB2PreflightNeedsContractSettings({
  errors: [{ messages: ["B2契約情報の発送元名称が未設定"] }]
})) {
  throw new Error("Missing B2 contract fields must route the operator to contract settings");
}
if (contractPreflightSandbox.salesOrderB2PreflightNeedsContractSettings({
  errors: [{ messages: ["お届け先電話番号が未設定"] }]
})) {
  throw new Error("Order-specific B2 errors must not open the global contract settings");
}

const issueSource = between("async function issueSalesOrderB2Export", "async function downloadSalesOrderB2Batch");
if (issueSource.includes("updateSalesOrderExportButton")) {
  throw new Error("The removed updateSalesOrderExportButton call would leave B2 issuance stuck");
}
const preflightIndex = issueSource.indexOf('sb.rpc("check_sales_order_b2_export"');
const createIndex = issueSource.indexOf('sb.rpc("create_sales_order_b2_export"');
if (preflightIndex < 0 || createIndex < 0 || preflightIndex >= createIndex) {
  throw new Error("B2 preflight must run before the atomic export mutation");
}
for (const fragment of [
  "finally",
  "salesOrderSaving = false",
  "salesOrderB2ExportSaving = false",
  "shippingDocumentSaving = false",
  "updateSalesOrderSelectionButtons()",
  "finalMessage",
  "setShippingDocumentMessage(finalMessage, finalMessageIsError)",
  "shouldOpenContractSettings",
  "await openSalesOrderB2Settings()"
]) {
  if (!issueSource.includes(fragment)) throw new Error(`Missing B2 issuance cleanup: ${fragment}`);
}

const targetSource = between("function salesOrderB2TargetIds", "function setSalesOrderBatchMessage");
const targetSandbox = {
  salesOrderCheckedIds: () => [],
  salesOrderSelectedId: 42,
  salesOrderRows: [{ id: 42 }],
  parseInt,
  isNaN
};
vm.createContext(targetSandbox);
vm.runInContext(targetSource, targetSandbox);
if (JSON.stringify(targetSandbox.salesOrderB2TargetIds()) !== "[42]") {
  throw new Error("B2 export must use the currently displayed order when no rows are checked");
}
targetSandbox.salesOrderCheckedIds = () => [7, 8];
if (JSON.stringify(targetSandbox.salesOrderB2TargetIds()) !== "[7,8]") {
  throw new Error("Checked orders must take precedence for batch B2 export");
}
targetSandbox.salesOrderCheckedIds = () => [];
targetSandbox.salesOrderSelectedId = null;
if (targetSandbox.salesOrderB2TargetIds().length !== 0) {
  throw new Error("B2 export must stay disabled when neither a displayed nor checked order exists");
}
targetSandbox.salesOrderSelectedId = 42;
targetSandbox.salesOrderRows = [{ id: 99 }];
if (targetSandbox.salesOrderB2TargetIds().length !== 0) {
  throw new Error("B2 export must not use a previously displayed order hidden by the current list filter");
}

const selectionSource = between("function updateSalesOrderSelectionButtons", "function salesOrderPrintStationStateLabel");
for (const fragment of [
  "var b2TargetIds = salesOrderB2TargetIds()",
  "exportButton.disabled = b2TargetIds.length === 0 || salesOrderSaving",
  "現在表示中の受注を発行します。"
]) {
  if (!selectionSource.includes(fragment)) throw new Error(`Missing selected-order B2 button behavior: ${fragment}`);
}

const exportWrapper = between("async function exportSalesOrdersB2", "function decodeSalesOrderB2Csv");
if (!exportWrapper.includes("var orderIds = salesOrderB2TargetIds()") || !exportWrapper.includes("exportSalesOrderIdsB2(orderIds)")) {
  throw new Error("B2 export button must issue the resolved displayed-or-checked target orders");
}

function makeSandbox(results) {
  const rpcCalls = [];
  const shippingMessages = [];
  let contractSettingsOpened = 0;
  const sandbox = {
    salesOrderSaving: false,
    salesOrderB2ExportSaving: false,
    shippingDocumentSaving: false,
    canManageSalesOrders: () => true,
    isSystemAdmin: () => true,
    salesOrderB2PreflightNeedsContractSettings: (preflight) => !!(preflight && preflight.needsContractSettings),
    openSalesOrderB2Settings: async () => { contractSettingsOpened += 1; },
    renderSalesOrderB2Preflight: () => {},
    setSalesOrderBatchMessage: () => {},
    setShippingDocumentMessage: (message, isError) => { shippingMessages.push({ message, isError }); },
    updateSalesOrderSelectionButtons: () => {},
    renderShippingDocumentDetail: () => {},
    salesOrderB2PreflightSummary: () => "事前検査エラー",
    downloadSalesOrderB2Payload: () => true,
    salesOrderB2RpcWithTimeout: (request) => Promise.resolve(request),
    sb: {
      rpc(name) {
        rpcCalls.push(name);
        const result = results.shift();
        return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
      }
    },
    Error,
    Promise
  };
  vm.createContext(sandbox);
  vm.runInContext(issueSource, sandbox);
  return { sandbox, rpcCalls, shippingMessages, contractSettingsOpened: () => contractSettingsOpened };
}

(async () => {
  const failed = makeSandbox([{ data: { ok: false, needsContractSettings: true, errors: [{ order_number: "DC1", messages: ["B2契約情報の発送元名称が未設定"] }] } }]);
  await failed.sandbox.issueSalesOrderB2Export([1], false, null);
  if (failed.rpcCalls.join(",") !== "check_sales_order_b2_export") {
    throw new Error("A failed preflight must not create an export batch");
  }
  if (failed.sandbox.salesOrderSaving || failed.sandbox.salesOrderB2ExportSaving || failed.sandbox.shippingDocumentSaving) {
    throw new Error("A failed preflight must always clear every issuing state");
  }
  if (failed.contractSettingsOpened() !== 1) {
    throw new Error("A failed B2 contract preflight must open the contract settings for a system administrator");
  }
  if (!failed.shippingMessages.length || failed.shippingMessages[failed.shippingMessages.length - 1].message !== "事前検査エラー") {
    throw new Error("The final B2 preflight error must remain visible after the detail screen rerenders");
  }

  const succeeded = makeSandbox([
    { data: { ok: true, errors: [] } },
    { data: { rows: [{}], file_name: "b2.csv" } }
  ]);
  await succeeded.sandbox.issueSalesOrderB2Export([1], false, null);
  if (succeeded.rpcCalls.join(",") !== "check_sales_order_b2_export,create_sales_order_b2_export") {
    throw new Error("B2 export must run preflight and mutation exactly once in order");
  }
  if (succeeded.sandbox.salesOrderSaving || succeeded.sandbox.salesOrderB2ExportSaving || succeeded.sandbox.shippingDocumentSaving) {
    throw new Error("A successful export must clear every issuing state");
  }
  if (!succeeded.shippingMessages.length || succeeded.shippingMessages[succeeded.shippingMessages.length - 1].message !== "B2 CSVを発行しました。ダウンロードフォルダを確認してください。") {
    throw new Error("The final B2 success message must remain visible after the detail screen rerenders");
  }

  const shipmentUi = between("function shippingDocumentShipmentDocumentsHtml", "function shippingDocumentReturnWaybillHtml");
  for (const fragment of ["data-shipping-document-b2-settings", "B2契約設定", "発送方法設定"]) {
    if (!shipmentUi.includes(fragment)) throw new Error(`Missing shipping-document B2 recovery action: ${fragment}`);
  }
  const detailUi = between("function renderShippingDocumentDetail", "function bindShippingDocumentDetailActions");
  if (detailUi.indexOf("shipping-document-message") >= detailUi.indexOf("shippingDocumentStageHtml(order)")) {
    throw new Error("Shipping-document messages must render above the detail workflow without scrolling");
  }

  for (const fragment of [".sales-order-b2-preflight", ".sales-order-b2-settings-grid", "@media (max-width: 560px)"]) {
    if (!css.includes(fragment)) throw new Error(`Missing responsive B2 style: ${fragment}`);
  }
  console.log("Customer-order B2 settings, preflight, and issuance-state verification passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
