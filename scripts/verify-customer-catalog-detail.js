const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

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

const compatibleSource = functionSource("loadCustomerCatalogCompatible", "async function openCustomerCatalogProduct");
if (!compatibleSource.includes("await hydrateSalesDaikoVisibility(rows)") ||
    !compatibleSource.includes("rows = filterSalesVisibleProducts(rows)")) {
  throw new Error("customer catalog compatible products must exclude Daiko products");
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
