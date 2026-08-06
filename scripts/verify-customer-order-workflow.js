const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const contract = fs.readFileSync(path.join(root, "docs", "customer-order-b2-manual-contract.md"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

[
  "screen-customer-orders",
  "customer-order-cart-list",
  "customer-order-preview-button",
  "customer-order-submit",
  "customer-order-history-list",
  "customer-order-development-preview",
  "screen-sales-order-mgmt",
  "sales-order-list",
  "sales-order-detail",
  "sales-order-export-b2"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) throw new Error(`order workflow UI is missing: ${id}`);
});

const featureStatus = sourceBetween("async function refreshCustomerOrderFeatureStatus", "function showAuthenticatedHome");
if (!featureStatus.includes('sb.rpc("get_customer_order_feature_status")')) {
  throw new Error("order feature readiness must be controlled by an RPC");
}
if (!source.includes('var customerOrderFeatureStatus = { loaded: false, customer_ordering: false, internal_management: false')) {
  throw new Error("order features must default to disabled");
}
const displayDefaults = sourceBetween("function defaultCustomerDisplaySettings", "function normalizeCustomerShippingChargeRule");
if (!displayDefaults.includes("customer_ordering_enabled: false")) {
  throw new Error("customer ordering publication must default to hidden");
}

const customerOrderAccess = sourceBetween("function canUseCustomerOrdering", "function canManageSalesOrders");
if (!customerOrderAccess.includes("isCustomerViewer()") ||
    !customerOrderAccess.includes('customerOrderFeatureEnabled("customer_ordering")') ||
    !customerOrderAccess.includes("customerOrderingPublishedForViewer()")) {
  throw new Error("customer ordering must require the customer role, backend readiness, and per-customer publication");
}
const publicationAccess = sourceBetween("function customerOrderingPublishedForViewer", "function canUseCustomerOrdering");
if (!publicationAccess.includes('customerViewerSetting("customer_ordering_enabled", false)')) {
  throw new Error("customer ordering publication must fail closed for missing settings");
}
function evaluateCustomerOrderingAccess(options) {
  return vm.runInNewContext(`${publicationAccess}\n${customerOrderAccess}\ncanUseCustomerOrdering();`, {
    isCustomerViewer: () => options.customerViewer,
    customerOrderFeatureEnabled: (key) => key === "customer_ordering" && options.featureEnabled,
    customerViewerSetting: (key, fallback) => key === "customer_ordering_enabled" ? options.published : fallback,
    canViewProductSearch: () => options.productSearch
  });
}
if (!evaluateCustomerOrderingAccess({ customerViewer: true, featureEnabled: true, published: true, productSearch: true }) ||
    evaluateCustomerOrderingAccess({ customerViewer: true, featureEnabled: true, published: false, productSearch: true }) ||
    evaluateCustomerOrderingAccess({ customerViewer: true, featureEnabled: false, published: true, productSearch: true }) ||
    evaluateCustomerOrderingAccess({ customerViewer: false, featureEnabled: true, published: true, productSearch: true }) ||
    evaluateCustomerOrderingAccess({ customerViewer: true, featureEnabled: true, published: true, productSearch: false })) {
  throw new Error("customer ordering access must fail closed unless every access condition is true");
}
const previewOrderAccess = sourceBetween("function canPreviewCustomerOrdering", "function canManageSalesOrders");
function evaluatePreviewOrderingAccess(options) {
  return vm.runInNewContext(`${previewOrderAccess}\n({ preview: canPreviewCustomerOrdering(), open: canOpenCustomerOrdering() });`, {
    canPreviewCustomerPortal: () => options.internalPreviewRole,
    customerPortalPreviewContext: options.context,
    canUseCustomerOrdering: () => options.customerOrdering
  });
}
const validPreviewAccess = evaluatePreviewOrderingAccess({
  internalPreviewRole: true,
  customerOrdering: false,
  context: { sales_customer_id: 10, customer: { id: 10, is_active: true } }
});
const inactivePreviewAccess = evaluatePreviewOrderingAccess({
  internalPreviewRole: true,
  customerOrdering: false,
  context: { sales_customer_id: 10, customer: { id: 10, is_active: false } }
});
const externalPreviewAccess = evaluatePreviewOrderingAccess({
  internalPreviewRole: false,
  customerOrdering: false,
  context: { sales_customer_id: 10, customer: { id: 10, is_active: true } }
});
const liveCustomerAccess = evaluatePreviewOrderingAccess({ internalPreviewRole: false, customerOrdering: true, context: null });
if (!validPreviewAccess.preview || !validPreviewAccess.open || inactivePreviewAccess.preview ||
    externalPreviewAccess.preview || !liveCustomerAccess.open) {
  throw new Error("internal order preview must require an internal preview role and an active selected customer");
}
const internalOrderAccess = sourceBetween("function canManageSalesOrders", "function canViewManagementScreen");
if (!internalOrderAccess.includes('customerOrderFeatureEnabled("internal_management")') || !internalOrderAccess.includes('"sales_order.manage"')) {
  throw new Error("internal order management must require backend readiness and a dedicated permission");
}

[
  "preview_customer_order",
  "place_customer_order",
  "list_customer_orders",
  "list_sales_orders",
  "get_sales_order_detail",
  "update_sales_order_status",
  "get_sales_order_b2_export",
  "register_sales_order_shipping"
].forEach((rpc) => {
  if (!source.includes(`sb.rpc("${rpc}"`)) throw new Error(`required order RPC is missing: ${rpc}`);
});

if (source.includes('.from("customer_orders")') || source.includes('.from("customer_order_items")')) {
  throw new Error("the browser must not mutate or read order tables directly");
}

const submitSource = sourceBetween("async function submitCustomerOrder", "function renderCustomerOrderHistory");
if (!submitSource.includes("target_preview_token") || !submitSource.includes("target_idempotency_key")) {
  throw new Error("order submission must use a server preview token and idempotency key");
}
if (!submitSource.includes("customerOrderSaving")) {
  throw new Error("order submission must block duplicate clicks");
}

const trackingSource = sourceBetween("async function registerSalesOrderTracking", "function b2ExportField");
[
  "target_outbound_tracking_number",
  "target_return_tracking_number",
  "target_expected_version"
].forEach((field) => {
  if (!trackingSource.includes(field)) throw new Error(`tracking registration is missing: ${field}`);
});

const headerMatch = source.match(/var B2_BASIC_LAYOUT_HEADERS = (\[[\s\S]*?\n\]);/);
if (!headerMatch) throw new Error("B2 basic layout headers are missing");
const headers = vm.runInNewContext(headerMatch[1]);
if (!Array.isArray(headers) || headers.length !== 95) {
  throw new Error(`B2 basic layout must contain 95 columns, found ${headers.length}`);
}
if (!source.includes('new Blob(["\\ufeff" + csv], { type: "text/csv;charset=utf-8" })')) {
  throw new Error("B2 CSV must be exported with a UTF-8 BOM");
}

const menuSource = sourceBetween("function renderMenu", "function customerPortalValue");
if (!menuSource.includes('action: "sales-order-mgmt"') || !menuSource.includes("canManageSalesOrders()")) {
  throw new Error("internal order management must be permission-gated in the menu");
}
const portalRender = sourceBetween("function renderCustomerPortal", "async function loadCustomerPortalPreviewContext");
if (!portalRender.includes('orderGuide.hidden = !canOpenCustomerOrdering()')) {
  throw new Error("customer order entry must allow only live customer ordering or internal development preview");
}
const customerAccessRender = sourceBetween("function renderCustomerAccessDetail", "function renderCustomerAccessRuleForm");
if (!customerAccessRender.includes("data-customer-setting='customer_ordering_enabled'") ||
    !customerAccessRender.includes("role='switch'") ||
    !customerAccessRender.includes("customer_access_order_hidden") ||
    !customerAccessRender.includes("id='btn-customer-order-preview'")) {
  throw new Error("customer management must render ordering publication and internal preview controls");
}
const customerAccessSave = sourceBetween("async function saveCustomerAccessSettings", "async function setCustomerAccessActive");
if (!customerAccessSave.includes('.from("customer_display_settings").upsert(data')) {
  throw new Error("customer ordering publication must be saved with customer display settings");
}
const orderPreviewRequest = sourceBetween("async function previewCustomerOrder", "function customerOrderIdempotencyKey");
const orderSubmitRequest = sourceBetween("async function submitCustomerOrder", "function renderCustomerOrderHistory");
const orderHistoryRequest = sourceBetween("async function loadCustomerOrderHistory", "function returnToCustomerPortalFromOrders");
[
  [orderPreviewRequest, 'sb.rpc("preview_customer_order"', "preview"],
  [orderSubmitRequest, 'sb.rpc("place_customer_order"', "submit"],
  [orderHistoryRequest, 'sb.rpc("list_customer_orders"', "history"]
].forEach(([block, rpc, label]) => {
  const guardIndex = block.indexOf("if (canPreviewCustomerOrdering())");
  const rpcIndex = block.indexOf(rpc);
  if (guardIndex < 0 || rpcIndex < 0 || guardIndex > rpcIndex) {
    throw new Error(`development preview must exit before the ${label} RPC`);
  }
});

[
  ".customer-order-workspace",
  ".customer-order-shipping-pane",
  ".sales-order-workspace",
  ".sales-order-tracking-grid",
  ".customer-order-publication",
  ".customer-order-publication-slider",
  ".customer-order-development-preview-band",
  "@media (max-width: 820px)"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`responsive order style is missing: ${fragment}`);
});

if ((source.match(/customer_order_title:/g) || []).length !== 3 || (source.match(/sales_order_mgmt_title:/g) || []).length !== 3) {
  throw new Error("order screen titles must be translated for all supported languages");
}
if ((source.match(/customer_access_order_publication:/g) || []).length !== 3 ||
    (source.match(/customer_access_order_hidden:/g) || []).length !== 3 ||
    (source.match(/customer_access_order_visible:/g) || []).length !== 3) {
  throw new Error("customer ordering publication controls must be translated for all supported languages");
}
if ((source.match(/customer_order_development_preview_title:/g) || []).length !== 3 ||
    (source.match(/customer_order_submit_disabled:/g) || []).length !== 3 ||
    (source.match(/customer_access_order_preview:/g) || []).length !== 3) {
  throw new Error("internal order development preview must be translated for all supported languages");
}

[
  "API連携は保留",
  "target_idempotency_key",
  "customer_ordering_enabled boolean not null default false",
  "注文RPCも拒否",
  "注文履歴RPCを呼び出さない",
  "出力列数: 95列",
  "feature statusをfalse"
].forEach((fragment) => {
  if (!contract.includes(fragment)) throw new Error(`DB handoff contract is incomplete: ${fragment}`);
});

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicates.length) throw new Error(`duplicate HTML ids: ${duplicates.join(", ")}`);

console.log("customer order and manual B2 workflow guard passed");
