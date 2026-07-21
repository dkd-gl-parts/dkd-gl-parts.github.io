const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const start = source.indexOf("async function runProductSearch(options)");
const end = source.indexOf("async function fetchComponentUsageCountMap", start);

if (start < 0 || end < 0) {
  throw new Error("runProductSearch could not be isolated");
}

const searchSource = source.slice(start, end);
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

const aliasIndex = searchSource.indexOf("var aliasResult = await fetchSourceAliasProducts(q)");
const slIndex = searchSource.indexOf("var slResult = await fetchSlPartProducts(q");
const cardFlagsIndex = searchSource.indexOf("var cardFlags = await fetchProductSearchCardFlags");
const imageInfoIndex = searchSource.indexOf("var salesImageInfo = await fetchProductImageCountMapForContext");
const finalRenderIndex = searchSource.lastIndexOf("render();");

if (aliasIndex < 0 || slIndex < aliasIndex) {
  throw new Error("fallback searches must remain sequential");
}
if (cardFlagsIndex < 0 || imageInfoIndex < cardFlagsIndex || finalRenderIndex < imageInfoIndex) {
  throw new Error("initial enrichment must finish before the final result render");
}

console.log("search workload guard passed");
