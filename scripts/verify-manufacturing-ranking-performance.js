const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "manufacturing-ranking-report.js"), "utf8");
const pageStart = source.indexOf("function fetchDatasetRowPage");
const rowsStart = source.indexOf("async function fetchDatasetRows", pageStart);
const rowsEnd = source.indexOf("function uniqueIds", rowsStart);

if (pageStart < 0 || rowsStart < 0 || rowsEnd < 0) {
  throw new Error("manufacturing ranking row loaders could not be isolated");
}

const pageSource = source.slice(pageStart, rowsStart);
const rowsSource = source.slice(rowsStart, rowsEnd);
const categoryOrder = pageSource.indexOf('.order("category_order"');
const sourceRowOrder = pageSource.indexOf('.order("source_row_number"');
const idOrder = pageSource.indexOf('.order("id"');

if (categoryOrder < 0 || sourceRowOrder < categoryOrder || idOrder < sourceRowOrder) {
  throw new Error("report rows must retain the indexed deterministic order");
}
if (!source.includes("var DATA_PAGE_CONCURRENCY = 4;")) {
  throw new Error("report page concurrency must remain explicitly bounded");
}
if (!rowsSource.includes("batchStart += DATA_PAGE_CONCURRENCY") ||
    !rowsSource.includes("offsets.slice(batchStart, batchStart + DATA_PAGE_CONCURRENCY)")) {
  throw new Error("known-size report pages must be loaded in bounded batches");
}
if (!rowsSource.includes("Promise.all(batchOffsets.map(function(offset)")) {
  throw new Error("each bounded report page batch must retain parallel loading");
}
if (rowsSource.includes("Promise.all(requests)") || rowsSource.includes("requests.push(fetchDatasetRowPage")) {
  throw new Error("report pages must not be requested with unbounded parallelism");
}

console.log("manufacturing ranking performance guard passed");
