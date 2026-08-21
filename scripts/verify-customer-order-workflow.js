const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const headersFile = fs.readFileSync(path.join(root, "_headers"), "utf8");
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
  "customer-order-submit",
  "customer-order-history-list",
  "customer-order-development-preview",
  "customer-order-address-search",
  "customer-order-address-search-button",
  "customer-order-address-results",
  "customer-order-address-new",
  "customer-order-postal-lookup",
  "customer-order-postal-results",
  "customer-order-postal-test",
  "customer-order-postal-local-status",
  "customer-catalog-order-preview-guide",
  "screen-sales-order-mgmt",
  "sales-order-list",
  "sales-order-detail",
  "sales-order-export-b2"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) throw new Error(`order workflow UI is missing: ${id}`);
});
if (html.includes('id="customer-order-preview-button"')) {
  throw new Error("price and stock confirmation must be included in the order action");
}
if (!css.includes(".customer-order-submit-actions { display: grid; grid-template-columns: 1fr;")) {
  throw new Error("the combined order action must use the full action width");
}

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
const internalRegistrationAccess = sourceBetween("function canRegisterInternalCustomerOrder", "function canOpenCustomerOrdering");
if (!internalRegistrationAccess.includes("canPreviewCustomerOrdering()") ||
    !internalRegistrationAccess.includes('customerOrderFeatureEnabled("internal_management")') ||
    !internalRegistrationAccess.includes('"sales_order.manage"')) {
  throw new Error("internal customer-order registration must require preview context, backend readiness, and sales-order permission");
}
function evaluateInternalRegistrationAccess(options) {
  return vm.runInNewContext(`${internalRegistrationAccess}\ncanRegisterInternalCustomerOrder();`, {
    canPreviewCustomerOrdering: () => options.preview,
    customerOrderFeatureEnabled: () => options.featureEnabled,
    isExternalViewer: () => options.externalViewer,
    userPermissionAllowed: () => options.permission,
    hasAccessRole: () => false,
    userProfile: {}
  });
}
if (!evaluateInternalRegistrationAccess({ preview: true, featureEnabled: true, externalViewer: false, permission: true }) ||
    evaluateInternalRegistrationAccess({ preview: false, featureEnabled: true, externalViewer: false, permission: true }) ||
    evaluateInternalRegistrationAccess({ preview: true, featureEnabled: false, externalViewer: false, permission: true }) ||
    evaluateInternalRegistrationAccess({ preview: true, featureEnabled: true, externalViewer: true, permission: true }) ||
    evaluateInternalRegistrationAccess({ preview: true, featureEnabled: true, externalViewer: false, permission: false })) {
  throw new Error("internal customer-order registration access must fail closed");
}

[
  "list_customer_orders",
  "search_customer_delivery_addresses",
  "list_sales_orders",
  "get_sales_order_detail",
  "update_sales_order_status",
  "create_sales_order_b2_export",
  "get_sales_order_b2_export_batch",
  "list_sales_order_b2_exports",
  "register_sales_order_shipping"
].forEach((rpc) => {
  if (!source.includes(`sb.rpc("${rpc}"`)) throw new Error(`required order RPC is missing: ${rpc}`);
});
[
  "preview_customer_order",
  "preview_internal_customer_order",
  "place_customer_order",
  "place_internal_customer_order"
].forEach((rpc) => {
  if (!source.includes(`"${rpc}"`)) throw new Error(`required order RPC is missing: ${rpc}`);
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
if (!submitSource.includes('window.confirm(t("customer_order_internal_confirm"))') ||
    !submitSource.includes("submitParams.target_sales_customer_id = customerPortalPreviewContext.sales_customer_id") ||
    !submitSource.includes("await enterSalesOrderMgmt()") ||
    !submitSource.includes("await loadSalesOrderDetail(registeredOrderId)")) {
  throw new Error("internal registration must confirm, bind the selected customer, and open the registered order in management");
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
const orderFlowPreviewLaunch = sourceBetween("async function openCustomerOrderDevelopmentPreview", "function renderCustomerAccessDetail");
if (!orderFlowPreviewLaunch.includes('await enterCustomerCatalog({ query: "" })') ||
    orderFlowPreviewLaunch.includes("enterCustomerOrders")) {
  throw new Error("internal order-flow preview must start from customer part-number search");
}
const catalogShell = sourceBetween("function renderCustomerCatalogShell", "function customerCatalogImageForProduct");
if (!catalogShell.includes('orderPreviewGuide.hidden = !canPreviewCustomerOrdering()')) {
  throw new Error("customer catalog must identify the internal order-flow preview");
}
const availabilityRenderer = sourceBetween("function customerCatalogAvailabilityKindHtml", "function renderCustomerCatalogDetailBase");
function renderAvailability(stockQty, price) {
  return vm.runInNewContext(`${availabilityRenderer}\ncustomerCatalogAvailabilityKindHtml({ dkd_shohin_id: 1 }, "rebuilt", stockQty, price, true, []);`, {
    stockQty,
    price,
    formatYen: (value) => String(value),
    t: (key) => key,
    customerOrderCartKey: () => "1:rebuilt",
    productDkdId: () => 1,
    customerOrderCart: [],
    canOpenCustomerOrdering: () => true,
    esc: (value) => String(value),
    productKindClass: () => "rebuilt",
    customerProductKindLabel: () => "rebuilt",
    renderCoreReturnPolicyHtml: () => ""
  });
}
const inStockAvailability = renderAvailability(2, 1000);
const outOfStockAvailability = renderAvailability(0, 1000);
const unknownStockAvailability = renderAvailability(null, 1000);
const missingPriceAvailability = renderAvailability(2, null);
if (inStockAvailability.includes(" disabled") || !inStockAvailability.includes("customer_order_add") ||
    !outOfStockAvailability.includes(" disabled") || !outOfStockAvailability.includes("customer_order_out_of_stock") ||
    !unknownStockAvailability.includes(" disabled") || !unknownStockAvailability.includes("customer_order_stock_unavailable") ||
    !missingPriceAvailability.includes(" disabled") || !missingPriceAvailability.includes("customer_order_price_unavailable")) {
  throw new Error("only in-stock, price-ready product types may continue to the order screen");
}
const catalogOrderEntry = sourceBetween("async function loadCustomerCatalogAvailability", "async function loadCustomerCatalogVehicles");
if (!catalogOrderEntry.includes("addCustomerCatalogProductToOrder") ||
    !catalogOrderEntry.includes('await enterCustomerOrders({ view: "cart", preview: false })')) {
  throw new Error("catalog order action must set the selected product before opening the order screen");
}
const addOrderItem = sourceBetween("function addCustomerCatalogProductToOrder", "function customerOrderPayloadItems");
if (!addOrderItem.includes("if (!existing)") || addOrderItem.includes("existing.quantity")) {
  throw new Error("an already selected product must open the order screen without silently increasing quantity");
}
const orderPreviewRequest = sourceBetween("async function previewCustomerOrder", "function customerOrderIdempotencyKey");
const orderSubmitRequest = sourceBetween("async function submitCustomerOrder", "function renderCustomerOrderHistory");
const orderHistoryRequest = sourceBetween("async function loadCustomerOrderHistory", "function returnToCustomerPortalFromOrders");
if (!orderPreviewRequest.includes('internalRegistration ? "preview_internal_customer_order" : "preview_customer_order"') ||
    !orderPreviewRequest.includes("previewParams.target_sales_customer_id = customerPortalPreviewContext.sales_customer_id")) {
  throw new Error("internal preview must use the server RPC for the selected customer");
}
if (!orderPreviewRequest.includes('result.error.message || t("customer_order_preview_error")')) {
  throw new Error("order preview must show the server validation reason");
}
if (!orderSubmitRequest.includes("await previewCustomerOrder({ silent: true })") ||
    orderSubmitRequest.indexOf("await previewCustomerOrder({ silent: true })") > orderSubmitRequest.indexOf("await sb.rpc(submitRpc, submitParams)")) {
  throw new Error("the order action must validate price, stock, and shipping before registration");
}
if (orderSubmitRequest.includes("customerOrderPreview.valid !== true || !customerOrderPreview.preview_token) return")) {
  throw new Error("the order button must not require a separate preview action");
}
if (!orderSubmitRequest.includes('internalRegistration ? "place_internal_customer_order" : "place_customer_order"')) {
  throw new Error("internal submission must use the server-side proxy-registration RPC");
}
const historyGuardIndex = orderHistoryRequest.indexOf("if (canPreviewCustomerOrdering())");
const historyRpcIndex = orderHistoryRequest.indexOf('sb.rpc("list_customer_orders"');
if (historyGuardIndex < 0 || historyRpcIndex < 0 || historyGuardIndex > historyRpcIndex) {
  throw new Error("development preview must not read customer-owned order history");
}

const addressSearchRequest = sourceBetween("async function searchCustomerOrderAddresses", "function clearCustomerOrderAddress");
const addressPreviewGuard = addressSearchRequest.indexOf("if (canPreviewCustomerOrdering())");
const addressRpc = addressSearchRequest.indexOf('sb.rpc("search_customer_delivery_addresses"');
if (addressPreviewGuard < 0 || addressRpc < 0 || addressPreviewGuard > addressRpc) {
  throw new Error("internal development preview must exit before saved-address search RPC");
}
if (!addressSearchRequest.includes("target_query: query") || !addressSearchRequest.includes("target_limit: 8")) {
  throw new Error("saved delivery address search must use a bounded server-side phone/name query");
}
if (!addressSearchRequest.includes("} finally {") ||
    !addressSearchRequest.includes("customerOrderAddressSearching = false;")) {
  throw new Error("saved delivery address search must restore controls after network failure");
}
const postalApiLookup = sourceBetween("async function lookupCustomerOrderPostalApi", "function configureCustomerOrderPostalTest");
if (!postalApiLookup.includes("https://zipcloud.ibsnet.co.jp/api/search?zipcode=") ||
    !postalApiLookup.includes('credentials: "omit"') ||
    !postalApiLookup.includes("customerOrderPostalFetch")) {
  throw new Error("postal API lookup must send only the postal code without credentials and use a bounded request");
}
const postalLocalLookup = sourceBetween("async function loadCustomerOrderPostalManifest", "async function lookupCustomerOrderPostalApi");
if (!postalLocalLookup.includes("CUSTOMER_ORDER_POSTAL_MANIFEST_CACHE") ||
    !postalLocalLookup.includes("CUSTOMER_ORDER_POSTAL_DATA_CACHE_PREFIX") ||
    !postalLocalLookup.includes("cache.match(url)") ||
    !postalLocalLookup.includes("cache.put(url, response.clone())")) {
  throw new Error("postal local lookup must retain the versioned Japan Post data in Cache Storage");
}
const postalLookup = sourceBetween("async function lookupCustomerOrderPostalCode", "function configureCustomerOrderAddressTools");
if (!postalLookup.includes("postalCode.length !== 7") ||
    !postalLookup.includes('canPreviewCustomerOrdering() ? customerOrderPostalLookupMode : "auto"') ||
    !postalLookup.includes("lookupCustomerOrderPostalApi(postalCode)") ||
    !postalLookup.includes("lookupCustomerOrderPostalLocal(postalCode)")) {
  throw new Error("postal lookup must validate seven digits, expose preview modes, and force automatic fallback for customers");
}
const postalPreparation = sourceBetween("async function prepareCustomerOrderPostalLocalData", "function customerOrderPostalSetStatus");
if (!postalPreparation.includes("manifest.shards.length") ||
    !postalPreparation.includes("requestIdleCallback") ||
    !postalPreparation.includes('customerOrderPostalPrepareState = "ready"')) {
  throw new Error("postal data must be prepared in the background without blocking the order screen");
}
if (!source.includes('"customer-order-prefecture", "customer-order-address1", "customer-order-address2"') ||
    !source.includes("customerOrderPreview = null;")) {
  throw new Error("changing a delivery address must invalidate the confirmed order preview");
}
if (!html.includes("https://zipcloud.ibsnet.co.jp") || !headersFile.includes("https://zipcloud.ibsnet.co.jp")) {
  throw new Error("postal lookup host must be allowed by both document and deployment CSP");
}

[
  ".customer-order-workspace",
  ".customer-order-shipping-pane",
  ".sales-order-workspace",
  ".sales-order-tracking-grid",
  ".customer-order-publication",
  ".customer-order-publication-slider",
  ".customer-order-development-preview-band",
  ".customer-catalog-order-preview-guide",
  ".customer-order-address-book",
  ".customer-order-address-result",
  ".customer-order-postal-row",
  ".customer-order-postal-test",
  ".customer-order-postal-mode",
  "@media (max-width: 820px)"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`responsive order style is missing: ${fragment}`);
});

const postalFieldStart = html.indexOf('class="customer-order-form-field customer-order-postal-field"');
const postalFieldEnd = html.indexOf("</div>", postalFieldStart);
const postalTestStart = html.indexOf('class="customer-order-postal-test"');
const prefectureStart = html.indexOf('id="customer-order-prefecture"');
if (postalFieldStart < 0 || postalFieldEnd < postalFieldStart || prefectureStart < postalFieldEnd || postalTestStart < prefectureStart) {
  throw new Error("postal search-mode controls must occupy a full form-grid row after the postal and prefecture fields");
}
if (!/\.customer-order-postal-test\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s.test(css) ||
    !/\.customer-order-postal-mode\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s.test(css)) {
  throw new Error("postal search-mode controls must distribute all three labels across the available row width");
}

if ((source.match(/customer_order_title:/g) || []).length !== 3 || (source.match(/sales_order_mgmt_title:/g) || []).length !== 3) {
  throw new Error("order screen titles must be translated for all supported languages");
}
if ((source.match(/customer_access_order_publication:/g) || []).length !== 3 ||
    (source.match(/customer_access_order_hidden:/g) || []).length !== 3 ||
    (source.match(/customer_access_order_visible:/g) || []).length !== 3) {
  throw new Error("customer ordering publication controls must be translated for all supported languages");
}
if ((source.match(/customer_order_development_preview_title:/g) || []).length !== 3 ||
    (source.match(/customer_order_flow_preview_title:/g) || []).length !== 3 ||
    (source.match(/customer_order_out_of_stock:/g) || []).length !== 3 ||
    (source.match(/customer_order_submit_disabled:/g) || []).length !== 3 ||
    (source.match(/customer_access_order_preview:/g) || []).length !== 3) {
  throw new Error("internal order development preview must be translated for all supported languages");
}
if ((source.match(/customer_order_address_saved_title:/g) || []).length !== 3 ||
    (source.match(/customer_order_address_search_placeholder:/g) || []).length !== 3 ||
    (source.match(/customer_order_postal_lookup:/g) || []).length !== 3 ||
    (source.match(/customer_order_postal_mode_auto:/g) || []).length !== 3 ||
    (source.match(/customer_order_postal_mode_api:/g) || []).length !== 3 ||
    (source.match(/customer_order_postal_mode_local:/g) || []).length !== 3) {
  throw new Error("delivery address search and postal lookup must be translated for all supported languages");
}

[
  "API直接連携は、有料・大口契約向けのため導入を見送る",
  "target_idempotency_key",
  "customer_ordering_enabled boolean not null default false",
  "注文RPCも拒否",
  "注文履歴RPCを呼び出さない",
  "受注導線をプレビュー",
  "search_customer_delivery_addresses(target_query text, target_limit int)",
  "氏名で検索",
  "郵便番号検索が失敗しても",
  "出力列数: 95列",
  "feature statusをfalse"
].forEach((fragment) => {
  if (!contract.includes(fragment)) throw new Error(`DB handoff contract is incomplete: ${fragment}`);
});

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicates.length) throw new Error(`duplicate HTML ids: ${duplicates.join(", ")}`);

console.log("customer order and manual B2 workflow guard passed");
