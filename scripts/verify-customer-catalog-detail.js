const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");

if (!source.includes('customer_catalog_price_none: "価格はお問い合わせください"')) {
  throw new Error("customer catalog must present missing prices as a customer inquiry");
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
    !availabilitySource.includes("fetchCustomerCatalogPriceInfo(product, kind)")) {
  throw new Error("customer catalog detail must show rebuilt and aftermarket-new stock with kind-specific prices");
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
const customerStockIndex = searchSource.indexOf("await fetchProductAvailableStockMap(products)");
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
if (!compatibleStockSource.includes('from("core_product_variants")') ||
    !compatibleStockSource.includes('.in("dkd_shohin_id", ids)') ||
    !compatibleStockSource.includes('.in("product_kind", ["rebuilt", "aftermarket_new"])')) {
  throw new Error("customer catalog compatible stock must be loaded in one batched query");
}
if (!styles.includes(".customer-catalog-compatible-stock-item.rebuilt") &&
    !styles.includes(".customer-catalog-compatible-stock-item {")) {
  throw new Error("customer catalog compatible stock styles are missing");
}

const availabilityHtmlSource = functionSource("customerCatalogAvailabilityKindHtml", "function renderCustomerCatalogDetailBase");
if (!availabilityHtmlSource.includes("customerProductKindLabel(kind)")) {
  throw new Error("customer catalog must use the customer-facing product-kind label");
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

console.log("customer catalog detail guard passed");
