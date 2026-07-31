const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "manufacturing-ranking-report.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

[
  "manufacturing-ranking-report-type",
  "manufacturing-ranking-supplier",
  "manufacturing-ranking-supplier-status"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) throw new Error(`${id} control is missing`);
});

if (!source.includes('"supplier_catalog_item_links"') || !source.includes('"supplier_catalog_items"')) {
  throw new Error("supplier catalog tables must be used for ranking availability");
}
if (!source.includes('link.status !== "active"') || !source.includes("item.is_active === false")) {
  throw new Error("inactive supplier catalog records must be excluded");
}
if (!source.includes("REFERENCE_QUERY_CONCURRENCY = 4")) {
  throw new Error("supplier reference queries must remain concurrency-bounded");
}

const context = {
  window: {},
  document: {
    getElementById() { return null; },
    querySelectorAll() { return []; }
  },
  console,
  Intl,
  Date,
  encodeURIComponent,
  setTimeout
};
vm.runInNewContext(source, context, { filename: "manufacturing-ranking-report.js" });
const api = context.window.DCatsManufacturingRankingReport;
if (!api) throw new Error("manufacturing ranking test API is missing");

api.setMasterProducts([
  { id: "100", manufacturer_part_number: "ALT-100", genuine_part_number: "27060-1000" },
  { id: "200", manufacturer_part_number: "ALT-200", genuine_part_number: "27060-2000" },
  { id: "300", manufacturer_part_number: "ALT-300", genuine_part_number: "27060-3000" }
], { compatible: ["100", "200"] });

api.setSupplierCatalogData([
  { id: 1, supplier_catalog_item_id: 10, dkd_shohin_id: 200, status: "active" },
  { id: 2, supplier_catalog_item_id: 11, dkd_shohin_id: 100, status: "inactive" }
], [
  { id: 10, supplier_id: 1, supplier_pn: "SL-200", genuine_part_number: "27060-2000", manufacturer_part_number: "ALT-200", manufacturer: "DENSO", is_active: true },
  { id: 11, supplier_id: 1, supplier_pn: "SL-INACTIVE", is_active: true }
]);

function row(id, productId, genuine, maker) {
  return {
    id,
    productName: "オルタネータ",
    productCode: id,
    genuine,
    genuine2: "",
    maker,
    body: "",
    clutch: "",
    masterCacheReady: true,
    masterProductIds: [productId]
  };
}

const linkedRow = row("R1", "100", "27060-1000", "ALT-100");
const unlinkedRow = row("R2", "300", "27060-3000", "ALT-300");
const linkedResult = { row: linkedRow, group: [linkedRow], rank: 1, shipment: 50, score: 50 };
const unlinkedResult = { row: unlinkedRow, group: [unlinkedRow], rank: 2, shipment: 40, score: 40 };
const options = {
  reportType: "supplier_availability",
  supplierId: "all",
  supplierStatus: "all",
  compatibilityMode: "all",
  categories: ["オルタネータ"],
  startRank: 1,
  endRank: 100,
  metric: "shipment",
  rankScope: "overall",
  orientation: "portrait",
  showCoreStock: false,
  showMissingMaster: false
};

const linkedItems = api.supplierItemsForResult(linkedResult, options);
if (linkedItems.length !== 1 || linkedItems[0].supplier_pn !== "SL-200") {
  throw new Error("supplier products linked through registered compatibility must be resolved once");
}
if (api.supplierItemsForResult(unlinkedResult, options).length !== 0) {
  throw new Error("unlinked ranking rows must remain unavailable");
}

const available = api.filterSupplierResults([linkedResult, unlinkedResult], { ...options, supplierStatus: "available" });
const unavailable = api.filterSupplierResults([linkedResult, unlinkedResult], { ...options, supplierStatus: "unavailable" });
if (available.length !== 1 || available[0] !== linkedResult || unavailable.length !== 1 || unavailable[0] !== unlinkedResult) {
  throw new Error("supplier availability filters must preserve the original ranking rows");
}

const printHtml = api.buildPrintHtml([linkedResult, unlinkedResult], options);
if (!printHtml.includes("仕入先商品照合リスト") || !printHtml.includes("Stronghold / SL-200")) {
  throw new Error("supplier report must include its title and linked supplier product");
}
if (/<th[^>]*>出荷数<\/th>/.test(printHtml) || /<th[^>]*>コア在庫<\/th>/.test(printHtml)) {
  throw new Error("supplier report must not output shipment or core-stock columns");
}
if (!printHtml.includes("is-available'>あり") || !printHtml.includes("is-unavailable'>なし")) {
  throw new Error("supplier report must show both availability states");
}

console.log("manufacturing ranking supplier report guard passed");
