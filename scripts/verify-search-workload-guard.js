const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const masterStart = source.indexOf("async function fetchCoreProductMasterMatches");
const start = source.indexOf("async function runProductSearch(options)");
const deferredStart = source.indexOf("async function runDeferredProductSearchEnrichment", start);
const end = source.indexOf("async function fetchComponentUsageCountMap", deferredStart);

if (masterStart < 0 || start < 0 || deferredStart < 0 || end < 0) {
  throw new Error("product search workload functions could not be isolated");
}

const masterSource = source.slice(masterStart, start);
const searchSource = source.slice(start, deferredStart);
const deferredSource = source.slice(deferredStart, end);
const bannedPatterns = [
  "broadMatchPromise",
  "sourceAliasPromise",
  "slProductPromise",
  "loadProductSearchCardData"
];

bannedPatterns.forEach((pattern) => {
  if (searchSource.includes(pattern)) {
    throw new Error(`search workload guard rejected speculative work: ${pattern}`);
  }
});

const exactPartsIndex = masterSource.indexOf('return column + ".eq." + normalized');
const exactQueryIndex = masterSource.indexOf("var exact = await runCoreProductQuery(exactParts, 1)");
const prefixPartsIndex = masterSource.indexOf('return column + ".like." + normalized + "%"');
const prefixRpcIndex = masterSource.indexOf('var fast = normalized ? await sb.rpc("search_core_products_by_prefix_fast"');
const prefixFallbackIndex = masterSource.indexOf("fast = await runCoreProductQuery(prefixParts, 2)", prefixRpcIndex);

if (exactPartsIndex < 0 || exactQueryIndex < exactPartsIndex || prefixPartsIndex < exactQueryIndex || prefixRpcIndex < prefixPartsIndex) {
  throw new Error("indexed exact product-number lookup must run before prefix matching");
}
if (prefixFallbackIndex < prefixRpcIndex || !masterSource.slice(prefixRpcIndex, prefixFallbackIndex).includes("if (fast.error)")) {
  throw new Error("direct prefix lookup must remain an error fallback for the fast RPC");
}
if (!masterSource.includes('"dks_shohin_cd"') || !masterSource.includes('"gltek_part_number"')) {
  throw new Error("exact lookup must include DKS and GLTEK product numbers");
}
if (!source.includes("p.dks_shohin_cd, p.shohin_cd, p.gltek_part_number")) {
  throw new Error("visible search filtering must retain DKS and GLTEK exact matches");
}

const aliasIndex = searchSource.indexOf("var aliasResult = await fetchSourceAliasProducts(q)");
const slIndex = searchSource.indexOf("var slResult = await fetchSlPartProducts(q");
const cacheIndex = searchSource.indexOf("applyCachedSearchAuxiliaryMaps(auxiliaryProducts)");
const stockPriorityIndex = searchSource.indexOf("await fetchProductAvailableStockMap(auxiliaryProducts)");
const initialRenderIndex = searchSource.indexOf("render();", cacheIndex);
const detailSyncIndex = searchSource.indexOf("syncFirstSearchResultDetail();", initialRenderIndex);
const scheduleIndex = searchSource.indexOf("scheduleProductSearchEnrichment(", initialRenderIndex);

if (aliasIndex < 0 || slIndex < aliasIndex) {
  throw new Error("fallback searches must remain sequential");
}
if (stockPriorityIndex < 0 || cacheIndex < stockPriorityIndex || initialRenderIndex < cacheIndex || detailSyncIndex < initialRenderIndex || scheduleIndex < detailSyncIndex) {
  throw new Error("primary results must render before detail loading and deferred enrichment");
}
if (searchSource.includes("await fetchProductSearchCardFlags") || searchSource.includes("await fetchProductImageCountMapForContext")) {
  throw new Error("card and image enrichment must not block the primary result render");
}

const detailWaitIndex = deferredSource.indexOf("await waitForProductSearchDetailLoads");
const cardFlagsIndex = deferredSource.indexOf("var cardFlags = await fetchProductSearchCardFlags");
const imageInfoIndex = deferredSource.indexOf("var salesImageInfo = await fetchProductImageCountMapForContext");
const auxiliaryIndex = deferredSource.indexOf("await loadProductSearchAuxiliaryData");

if (detailWaitIndex < 0 || cardFlagsIndex < detailWaitIndex || imageInfoIndex < cardFlagsIndex || auxiliaryIndex < imageInfoIndex) {
  throw new Error("deferred enrichment must wait for detail data and remain sequential");
}
if (deferredSource.includes("Promise.all(")) {
  throw new Error("deferred card, image, and auxiliary enrichment must not run in parallel");
}
if (!source.includes('!isScreenActive("search")')) {
  throw new Error("deferred enrichment must stop after leaving product search");
}
if (!source.includes("productSearchDetailReadyPromise = Promise.allSettled(detailLoads)")) {
  throw new Error("detail requests must be tracked before deferred enrichment starts");
}

const stockFetchStart = source.indexOf("async function fetchProductAvailableStockMap");
const stockSortStart = source.indexOf("function sortProductsByAvailableStock", stockFetchStart);
const stockFetchSource = source.slice(stockFetchStart, stockSortStart);
if (stockFetchStart < 0 || stockSortStart < stockFetchStart ||
    !stockFetchSource.includes('select("dkd_shohin_id,stock_qty")') ||
    !stockFetchSource.includes('.in("dkd_shohin_id", chunk)') ||
    !stockFetchSource.includes('.in("product_kind", ["rebuilt", "aftermarket_new"])') ||
    !stockFetchSource.includes('.gt("stock_qty", 0)')) {
  throw new Error("stock priority must use a lightweight batched availability lookup");
}
if (!source.includes("productAvailableStockMap[productDkdId(p)]") || !source.includes("score += 1000000")) {
  throw new Error("sales product search must rank stocked products before existing priorities");
}

const searchPanel = html.slice(html.indexOf('<div class="search-header">'), html.indexOf('<div class="list-area">'));
const countRowIndex = searchPanel.indexOf('<div class="search-count-row">');
const countIndex = searchPanel.indexOf('id="count-bar"', countRowIndex);
const clearIndex = searchPanel.indexOf('id="clear-btn"', countIndex);
if (countRowIndex < 0 || countIndex < countRowIndex || clearIndex < countIndex) {
  throw new Error("search count and clear control must share the search-count-row utility bar");
}
if (searchPanel.slice(0, countRowIndex).includes('id="clear-btn"')) {
  throw new Error("search clear control must not create a standalone row below the query field");
}
if (!styles.includes(".search-count-row") || !styles.includes(".search-clear-btn:disabled")) {
  throw new Error("search utility row and disabled clear-control styles are required");
}
if (!source.includes("function syncSearchClearButtonState()") ||
    !source.includes('document.getElementById("q").addEventListener("input", syncSearchClearButtonState)')) {
  throw new Error("search clear control must reflect active query and filter conditions");
}

console.log("search workload guard passed");
