const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");

if (!source.includes('customer_catalog_price_none: "価格はお問い合わせください"')) {
  throw new Error("customer catalog must present missing prices as a customer inquiry");
}
if (!source.includes('price == null ? t("customer_catalog_price_none") : customerOrderCurrency(price)')) {
  throw new Error("customer catalog order prices must use the shared yen display format");
}

function functionSource(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const asyncStart = source.indexOf(`async function ${name}`);
  const actualStart = start >= 0 && asyncStart >= 0 ? Math.min(start, asyncStart) : Math.max(start, asyncStart);
  const end = source.indexOf(nextName, actualStart + 1);
  if (actualStart < 0 || end < actualStart) throw new Error(`${name} could not be isolated`);
  return source.slice(actualStart, end);
}

const imageSource = functionSource("loadCustomerCatalogImages", "async function loadCustomerCatalogAvailability");
if (!imageSource.includes('fetchAllCoreProductImagesForContext(parseInt(productDkdId(product), 10), "sales")')) {
  throw new Error("customer catalog detail must use the same complete sales image set as its result card");
}

const availabilitySource = functionSource("loadCustomerCatalogAvailability", "async function loadCustomerCatalogVehicles");
if (!availabilitySource.includes('var kinds = ["rebuilt", "aftermarket_new"]') ||
    !availabilitySource.includes('from("core_product_variants")') ||
    !availabilitySource.includes("fetchCustomerOrderStockAvailabilityMap([product], kinds)") ||
    !availabilitySource.includes("fetchCustomerCatalogPriceInfo(product, kind)")) {
  throw new Error("customer catalog detail must show reservation-aware rebuilt and aftermarket-new availability with kind-specific prices");
}

const searchSource = functionSource("runCustomerCatalogSearch", "function customerCatalogFact");
if (!searchSource.includes("await hydrateSalesDaikoVisibility(products)") ||
    !searchSource.includes("products = filterSalesVisibleProducts(products)")) {
  throw new Error("customer catalog search must exclude Daiko products with the sales visibility rules");
}
if (!searchSource.includes("includeDksProductCode: false") ||
    !searchSource.includes("preferPrefix: true")) {
  throw new Error("customer catalog search must exclude DKS codes and prefer indexed prefix matches");
}
const shortQueryGuardIndex = searchSource.indexOf("normalizePartQuery(query).length <= CUSTOMER_CATALOG_SHORT_QUERY_MAX && !category");
const customerMasterSearchIndex = searchSource.indexOf("fetchCoreProductMasterMatches(query, category");
if (!source.includes("var CUSTOMER_CATALOG_SHORT_QUERY_MAX = 5;") ||
    shortQueryGuardIndex < 0 || customerMasterSearchIndex < shortQueryGuardIndex ||
    !searchSource.slice(shortQueryGuardIndex, customerMasterSearchIndex).includes("return;") ||
    !searchSource.includes('t("customer_catalog_short_query_category_required")') ||
    !searchSource.includes('searchFeedback.hidden = false') ||
    !searchSource.includes('categoryEl.setAttribute("aria-invalid", "true")') ||
    !searchSource.includes("categoryEl.focus()") ||
    !searchSource.includes("categoryEl.showPicker()")) {
  throw new Error("customer catalog must require a category before searching part numbers of five characters or fewer");
}
if (!source.includes('sb.rpc("search_customer_catalog_products_by_prefix_fast"') ||
    !source.includes("target_sales_customer_id: customerId") ||
    !searchSource.includes("query && category && normalizedQueryLength <= CUSTOMER_CATALOG_SHORT_QUERY_MAX") ||
    !searchSource.includes("result = await fetchCustomerCatalogPrefixMatches(query, category, candidateScanLimit)") ||
    !searchSource.includes("else if (query)") ||
    !searchSource.includes("fetchCoreProductMasterMatches(query, category, candidateScanLimit") ||
    !searchSource.includes("filterSalesVisibleProducts(products).slice(0, candidateScanLimit)")) {
  throw new Error("categorized short customer searches must apply customer eligibility inside the indexed prefix query");
}
if (!html.includes('id="customer-catalog-search-feedback"') ||
    !html.includes('aria-describedby="customer-catalog-search-feedback"')) {
  throw new Error("short customer catalog searches must show guidance beside the category selector");
}
const categoryPosition = html.indexOf('id="customer-catalog-category"');
const queryPosition = html.indexOf('id="customer-catalog-q"');
if (categoryPosition < 0 || queryPosition < 0 || categoryPosition > queryPosition ||
    !source.includes('document.getElementById("customer-catalog-category").addEventListener("change", handleCustomerCatalogCategoryChange)') ||
    !source.includes('function handleCustomerCatalogCategoryChange()') ||
    !source.includes('if (input && input.value.trim())') ||
    !source.includes('if (input) input.focus()')) {
  throw new Error("customer catalog must guide category-first entry and rerun a pending part-number search");
}
if (!source.includes('document.getElementById("customer-catalog-q").addEventListener("keydown"') ||
    !source.includes('if (e.key !== "Enter") return;') ||
    !source.includes('e.preventDefault();')) {
  throw new Error("customer catalog part-number entry must run the search with Enter");
}
if ((source.match(/customer_catalog_short_query_category_required:/g) || []).length !== 3) {
  throw new Error("short customer catalog search guidance must be localized in Japanese, English, and Chinese");
}
const customerStockIndex = searchSource.indexOf("await fetchCustomerOrderAvailableStockMap(products)");
const customerStockSortIndex = searchSource.indexOf("sortProductsByAvailableStock(products, stockPriorityResult.map)");
const customerResultLimitIndex = searchSource.indexOf("CUSTOMER_CATALOG_RESULT_LIMIT");
if (customerStockIndex < 0 || customerStockSortIndex < customerStockIndex || customerResultLimitIndex < customerStockSortIndex) {
  throw new Error("customer catalog search must place stocked products first before applying its result limit");
}

const masterSearchSource = functionSource("fetchCoreProductMasterMatches", "async function runProductSearch");
if (!masterSearchSource.includes('if (options.includeDksProductCode !== false) directExactFields.unshift("dks_shohin_cd")') ||
    !masterSearchSource.includes("var exactNormalizedFields = options.preferPrefix ? [] : normalizedFields")) {
  throw new Error("core product search options must preserve internal DKS lookup while allowing customer prefix-first lookup");
}

const compatibleSource = functionSource("loadCustomerCatalogCompatible", "async function openCustomerCatalogProduct");
if (!compatibleSource.includes("await hydrateSalesDaikoVisibility(rows)") ||
    !compatibleSource.includes("rows = filterSalesVisibleProducts(rows)")) {
  throw new Error("customer catalog compatible products must exclude Daiko products");
}
if (!compatibleSource.includes("await fetchCustomerCatalogCompatibleStockMap(rows)") ||
    !compatibleSource.includes("customer-catalog-compatible-stock-item") ||
    !compatibleSource.includes('customerProductKindLabel("rebuilt")') ||
    !compatibleSource.includes('customerProductKindLabel("aftermarket_new")') ||
    !compatibleSource.includes("rebuiltQty") ||
    !compatibleSource.includes("newQty")) {
  throw new Error("customer catalog compatible products must show rebuilt and new stock quantities");
}
if (compatibleSource.includes('t("customer_catalog_stock_qty")')) {
  throw new Error("customer catalog compatible stock badges must omit the stock quantity label");
}
if (!source.includes('customer_product_kind_rebuilt: "リビルト品"') ||
    !source.includes('customer_product_kind_new: "新品"') ||
    !source.includes('if (kind === "rebuilt") return t("customer_product_kind_rebuilt")')) {
  throw new Error("customer-facing product kinds must be labeled as rebuilt product and new product");
}

const compatibleStockSource = functionSource("fetchCustomerCatalogCompatibleStockMap", "async function loadCustomerCatalogCompatible");
if (!compatibleStockSource.includes('fetchCustomerOrderStockAvailabilityMap(rows, ["rebuilt", "aftermarket_new"])') ||
    !compatibleStockSource.includes("stock.exact_available_qty")) {
  throw new Error("customer catalog compatible stock must use each part's reservation-aware exact availability");
}
if (!styles.includes(".customer-catalog-compatible-stock-item.rebuilt") &&
    !styles.includes(".customer-catalog-compatible-stock-item {")) {
  throw new Error("customer catalog compatible stock styles are missing");
}

const availabilityHtmlSource = functionSource("customerCatalogAvailabilityKindHtml", "function renderCustomerCatalogDetailBase");
if (!availabilityHtmlSource.includes("customerProductKindLabel(kind)") ||
    !availabilityHtmlSource.includes("availability.total_available_qty") ||
    !availabilityHtmlSource.includes('tf("customer_catalog_stock_breakdown"')) {
  throw new Error("customer catalog must show the customer-facing kind and support the compatible-stock breakdown");
}

if (!source.includes('customer_catalog_stock_unit: "台"')) {
  throw new Error("Japanese catalog stock quantities must use 台");
}
const stockSandbox = {
  t: (key) => key === "customer_catalog_stock_unit" ? "台" : key,
  tf: (key, values) => `自品番 ${values.exact} / 互換 ${values.compatible}`,
  esc: (value) => String(value),
  productDkdId: () => 1,
  customerOrderCartKey: () => "1:rebuilt",
  customerOrderCart: [],
  canOpenCustomerOrdering: () => true,
  customerOrderCurrency: (value) => "¥" + value,
  productKindClass: (kind) => kind,
  customerProductKindLabel: (kind) => kind,
  renderCoreReturnPolicyHtml: () => ""
};
vm.runInNewContext(`${availabilityHtmlSource}; result = customerCatalogAvailabilityKindHtml;`, stockSandbox);
for (const [exact, compatible, showBreakdown] of [[3, 0, false], [3, 2, false], [0, 0, false], [0, 2, true]]) {
  const markup = stockSandbox.result({}, "rebuilt", { exact_available_qty: exact, compatible_available_qty: compatible, total_available_qty: exact + compatible }, 15500, true, []);
  if (markup.includes("customer-catalog-stock-breakdown") !== showBreakdown || !markup.includes("<small>台</small>")) {
    throw new Error(`Catalog stock display is incorrect for exact=${exact}, compatible=${compatible}`);
  }
}
const unavailableMarkup = stockSandbox.result({}, "rebuilt", null, null, true, []);
if (!unavailableMarkup.includes("customer_order_stock_unavailable") || !unavailableMarkup.includes(" disabled")) {
  throw new Error("Failed stock lookup must preserve the unavailable message and disable ordering");
}

const customerKindLabelSource = functionSource("customerProductKindLabel", "function productKindClass");
if (!customerKindLabelSource.includes('kind === "aftermarket_new" ? t("customer_product_kind_new")')) {
  throw new Error("customer catalog must label aftermarket-new products as new");
}

const openSource = functionSource("openCustomerCatalogProduct", "async function openCustomerCatalogProductById");
if (!openSource.includes("bindCustomerCatalogVehicleDisclosure(product, seq)") ||
    !openSource.includes("isSalesHiddenDaikoProduct(product)") ||
    openSource.includes("loads.push(loadCustomerCatalogVehicles")) {
  throw new Error("customer catalog detail access or vehicle loading rules are incomplete");
}

if (!searchSource.includes("await filterCustomerCatalogProductsByPrice(products)") ||
    compatibleSource.includes("filterCustomerCatalogProductsByPrice") ||
    compatibleSource.includes("fetchCustomerCatalogPriceMap")) {
  throw new Error("Search and detail opens must share the price rule without removing compatible list entries");
}

const byIdSource = functionSource("openCustomerCatalogProductById", "async function enterCustomerCatalog");
const priceRuleSource = functionSource("customerCatalogRequiresRegisteredPrice", "async function populateCustomerCatalogCategories");
const priceMapSource = functionSource("fetchCustomerCatalogPriceMap", "async function filterCustomerCatalogProductsByPrice");
const priceFilterSource = functionSource("filterCustomerCatalogProductsByPrice", "async function fetchCustomerCatalogPriceInfo");
const feedbackSource = functionSource("showCustomerCatalogOpenFeedback", "async function openCustomerCatalogProductById");

function openFixture(settings, options = {}) {
  const previous = { dkd_shohin_id: 1 };
  const target = { dkd_shohin_id: 2, default_product_kind: "rebuilt", ...options.product };
  let activeContext = { sales_customer_id: 161, customer: { id: 161 }, settings };
  const feedback = { hidden: true, textContent: "", scrollIntoView() {} };
  const opened = [];
  const warnings = [];
  const state = {
    userProfile: {}, customerCatalogOpenSeq: 0, customerCatalogRequestSeq: 0, customerCatalogDetailSeq: 0,
    CORE_PRODUCT_FAST_SELECT: "dkd_shohin_id,default_product_kind",
    customerCatalogSelectedProduct: previous, customerCatalogProducts: options.cached ? [target] : [],
    customerCatalogContext: () => activeContext,
    defaultCustomerDisplaySettings: () => ({ priced_products_only: false, show_parts_without_price: true }),
    customerViewerSetting: (key, fallback) => activeContext.settings[key] ?? fallback,
    isCustomerViewer: () => true, canViewProductSearch: () => options.authorized !== false,
    canPreviewCustomerPortal: () => false, isScreenActive: () => options.active !== false,
    productDkdId: product => product.dkd_shohin_id,
    customerCatalogProductKind: product => product.default_product_kind || "rebuilt",
    normalizeCoreProductFastRows: rows => rows,
    hydrateSalesDaikoVisibility: async () => {},
    filterSalesVisibleProducts: rows => rows.filter(product => !product.hidden),
    sb: {
      from(table) {
        assert.equal(table, "core_products");
        const query = { select: () => query, eq: () => query,
          maybeSingle: async () => options.lookup || { data: target, error: null } };
        return query;
      },
      rpc: async (name, args) => {
        assert.equal(name, "get_customer_product_sales_price");
        return options.priceLookup ? options.priceLookup(args) : { data: [{ sales_price_jpy: options.price ?? null }], error: null };
      }
    },
    document: { getElementById: () => feedback }, t: key => key,
    console: { warn: (message, error) => warnings.push(error.message) },
    openCustomerCatalogProduct: async product => {
      opened.push(product.dkd_shohin_id);
      state.customerCatalogSelectedProduct = product;
      state.customerCatalogDetailSeq += 1;
    }
  };
  vm.runInNewContext(`${priceRuleSource}\n${priceMapSource}\n${priceFilterSource}\n${feedbackSource}\n${byIdSource}`, state);
  return { state, opened, previous, feedback, target, warnings, changeContext: () => { activeContext = { ...activeContext }; } };
}

async function checkCatalogOpenRules() {
  const hiddenPrice = { show_parts_without_price: false, show_zero_price: false };
  for (const test of [
    { name: "missing-price", settings: hiddenPrice, price: null, allowed: false },
    { name: "cached-missing-price", settings: hiddenPrice, price: null, cached: true, allowed: false },
    { name: "registered-price", settings: hiddenPrice, price: 9500, allowed: true },
    { name: "priced-only", settings: { priced_products_only: true, show_parts_without_price: true }, price: null, allowed: false },
    { name: "unpriced-permitted", settings: { show_parts_without_price: true }, price: null, allowed: true },
    { name: "zero-hidden", settings: hiddenPrice, price: 0, allowed: false },
    { name: "zero-shown", settings: { ...hiddenPrice, show_zero_price: true }, price: 0, allowed: true },
    { name: "hidden-product", settings: { show_parts_without_price: true }, product: { hidden: true }, allowed: false },
    { name: "unauthorized", settings: hiddenPrice, price: 9500, authorized: false, allowed: false },
    { name: "inactive-screen", settings: hiddenPrice, price: 9500, active: false, allowed: false },
    { name: "missing-product", settings: hiddenPrice, lookup: { data: null, error: null }, allowed: false },
    { name: "product-load-error", settings: hiddenPrice, lookup: { data: null, error: { message: "offline" } }, allowed: false },
    { name: "price-load-error", settings: hiddenPrice, priceLookup: async () => ({ error: { message: "offline" } }), allowed: false },
    { name: "price-exception", settings: hiddenPrice, priceLookup: async () => { throw new Error("offline"); }, allowed: false }
  ]) {
    const fixture = openFixture(test.settings, test);
    await fixture.state.openCustomerCatalogProductById(2);
    assert.equal(fixture.opened.length, test.allowed ? 1 : 0, test.name);
    if (!test.allowed) assert.equal(fixture.state.customerCatalogSelectedProduct, fixture.previous, test.name);
    if (test.name === "missing-price") assert.equal(fixture.feedback.textContent, "customer_catalog_product_unavailable", fixture.warnings.join(", "));
    if (test.name === "price-exception") assert.equal(fixture.feedback.textContent, "customer_catalog_load_error");
  }
  for (const change of ["customer", "search", "detail", "newer-click", "logout"]) {
    let releasePrice, priceStarted;
    const started = new Promise(resolve => { priceStarted = resolve; });
    const price = new Promise(resolve => { releasePrice = resolve; });
    const fixture = openFixture(hiddenPrice, { priceLookup: async () => { priceStarted(); return price; } });
    const opening = fixture.state.openCustomerCatalogProductById(2);
    await started;
    if (change === "customer") fixture.changeContext();
    if (change === "search") fixture.state.customerCatalogRequestSeq += 1;
    if (change === "detail") fixture.state.customerCatalogDetailSeq += 1;
    if (change === "newer-click") fixture.state.customerCatalogOpenSeq += 1;
    if (change === "logout") fixture.state.userProfile = null;
    releasePrice({ data: [{ sales_price_jpy: 9500 }], error: null });
    await opening;
    assert.equal(fixture.opened.length, 0, `stale ${change}`);
  }
}

checkCatalogOpenRules().then(() => console.log("customer catalog detail and conditional open guard passed")).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
