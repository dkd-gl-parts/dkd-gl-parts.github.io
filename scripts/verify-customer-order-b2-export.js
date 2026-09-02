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
  "updateSalesOrderSelectionButtons()"
]) {
  if (!issueSource.includes(fragment)) throw new Error(`Missing B2 issuance cleanup: ${fragment}`);
}

function makeSandbox(results) {
  const rpcCalls = [];
  const sandbox = {
    salesOrderSaving: false,
    salesOrderB2ExportSaving: false,
    shippingDocumentSaving: false,
    canManageSalesOrders: () => true,
    renderSalesOrderB2Preflight: () => {},
    setSalesOrderBatchMessage: () => {},
    setShippingDocumentMessage: () => {},
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
  return { sandbox, rpcCalls };
}

(async () => {
  const failed = makeSandbox([{ data: { ok: false, errors: [{ order_number: "DC1", messages: ["必須項目不足"] }] } }]);
  await failed.sandbox.issueSalesOrderB2Export([1], false, null);
  if (failed.rpcCalls.join(",") !== "check_sales_order_b2_export") {
    throw new Error("A failed preflight must not create an export batch");
  }
  if (failed.sandbox.salesOrderSaving || failed.sandbox.salesOrderB2ExportSaving || failed.sandbox.shippingDocumentSaving) {
    throw new Error("A failed preflight must always clear every issuing state");
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

  for (const fragment of [".sales-order-b2-preflight", ".sales-order-b2-settings-grid", "@media (max-width: 560px)"]) {
    if (!css.includes(fragment)) throw new Error(`Missing responsive B2 style: ${fragment}`);
  }
  console.log("Customer-order B2 settings, preflight, and issuance-state verification passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
