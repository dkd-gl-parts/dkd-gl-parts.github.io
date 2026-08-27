const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function between(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

[
  'id="sales-pricing-manufacturing-cost"',
  'id="sales-pricing-ec-reference"',
  'id="sales-pricing-daiko-reference"',
  'data-i18n="sales_reference_title"'
].forEach((fragment) => {
  if (!html.includes(fragment)) throw new Error(`sales pricing reference panel is missing: ${fragment}`);
});

if (html.includes('id="sales-base-reference"')) {
  throw new Error("legacy single DKS guidance must not remain under the base price field");
}

[
  ".sales-pricing-references",
  ".sales-pricing-reference-grid",
  ".sales-pricing-reference-item",
  ".sales-pricing-reference-value",
  ".sales-pricing-reference-meta"
].forEach((fragment) => {
  if (!styles.includes(fragment)) throw new Error(`sales pricing reference style is missing: ${fragment}`);
});

[
  "sales_reference_title:",
  "sales_daiko_service_price:",
  "sales_ec_market_price:",
  "sales_ec_total_price:"
].forEach((key) => {
  if ((source.match(new RegExp(key, "g")) || []).length !== 3) {
    throw new Error(`sales pricing reference label must be translated for all languages: ${key}`);
  }
});

const dksSource = between("async function fetchSalesPricingDksReference", "function salesPricingEcMarketReference");
[
  'from("core_product_dks_links")',
  'from("dks_search_parts")',
  'select("id, price_jpy")',
  "result.dksPrice = dksPrice"
].forEach((fragment) => {
  if (!dksSource.includes(fragment)) throw new Error(`Daiko Service price lookup is missing: ${fragment}`);
});

const ecLoadSource = between("async function loadSalesPricingCurrentEcReference", "function calculateSalesPriceClient");
if (!ecLoadSource.includes("fetchEcMallLatestBest3ForProduct(currentProduct)")) {
  throw new Error("sales pricing must reuse the existing EC mall latest-price lookup");
}
if (!ecLoadSource.includes("currentSalesPricingEcRows")) {
  throw new Error("sales pricing must cache EC rows while switching product kinds");
}

const selectorSource = between("function salesPricingEcMarketReference", "function salesPricingEcReferenceMeta");
const sandbox = {
  normalizeProductKind(kind) {
    return ({ new: "aftermarket_new", aftermarket_new: "aftermarket_new" })[kind] || kind || "rebuilt";
  },
  parsePriceNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
};
vm.runInNewContext(`${selectorSource}
rebuilt = salesPricingEcMarketReference([
  { product_type: "rebuilt", rank_no: 2, price_jpy: 9000, total_price_jpy: 9700 },
  { product_type: "rebuilt", rank_no: 1, price_jpy: 9200, total_price_jpy: 9600 },
  { product_type: "new", rank_no: 1, price_jpy: 11000, total_price_jpy: 11700 }
], "rebuilt");
newProduct = salesPricingEcMarketReference([
  { product_type: "rebuilt", rank_no: 1, total_price_jpy: 9600 },
  { product_type: "new", rank_no: 1, total_price_jpy: 11700 }
], "aftermarket_new");`, sandbox);

if (!sandbox.rebuilt || sandbox.rebuilt.price !== 9600 || sandbox.rebuilt.row.rank_no !== 1) {
  throw new Error("rebuilt EC reference must use the lowest shipping-inclusive total");
}
if (!sandbox.newProduct || sandbox.newProduct.price !== 11700 || sandbox.newProduct.row.product_type !== "new") {
  throw new Error("aftermarket-new pricing must use the EC new-product result");
}

const openSource = between("async function openSalesPricingForCurrent", "async function saveSalesPricing");
[
  "loadSalesPricingCurrentManufacturingCost()",
  "loadSalesPricingCurrentEcReference()",
  "fetchSalesPricingDksReference(dkdId)",
  "Promise.all(["
].forEach((fragment) => {
  if (!openSource.includes(fragment)) throw new Error(`sales pricing reference load is missing: ${fragment}`);
});

console.log("sales pricing reference prices guard passed");
