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
if (!/id="manufacturing-ranking-end"[^>]*value="200"/.test(html)) {
  throw new Error("manufacturing ranking default end rank must be 200");
}

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
  { id: 2, supplier_catalog_item_id: 11, dkd_shohin_id: 100, status: "inactive" },
  { id: 3, supplier_catalog_item_id: 12, dkd_shohin_id: 100, status: "active" },
  { id: 4, supplier_catalog_item_id: 13, dkd_shohin_id: 100, status: "active" }
], [
  { id: 10, supplier_id: 1, supplier_pn: "SL-200", genuine_part_number: "27060-2000", manufacturer_part_number: "ALT-200", manufacturer: "DENSO", is_active: true },
  { id: 11, supplier_id: 1, supplier_pn: "SL-INACTIVE", is_active: true },
  { id: 12, supplier_id: 3, supplier_pn: "ST-100", genuine_part_number: "27060-1000", manufacturer_part_number: "ALT-100", is_active: true },
  { id: 13, supplier_id: 1, supplier_pn: "SL-200", genuine_part_number: "27060-1000", manufacturer_part_number: "ALT-100", manufacturer: "DENSO", is_active: true }
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
const daikoRow = row("R3", "100", "28100-28053", "STDK87538");
const alternatorDaikoRow = row("R4", "100", "27060-37020", "ALDK00079");
const linkedResult = { row: linkedRow, group: [linkedRow], rank: 1, shipment: 50, score: 50 };
const unlinkedResult = { row: unlinkedRow, group: [unlinkedRow], rank: 2, shipment: 40, score: 40 };
const daikoResult = { row: daikoRow, group: [daikoRow], rank: 3, shipment: 30, score: 30 };
const alternatorDaikoResult = { row: alternatorDaikoRow, group: [alternatorDaikoRow], rank: 4, shipment: 20, score: 20 };
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
if (linkedItems.length !== 2 || !linkedItems.some((item) => item.supplier_pn === "SL-200") || !linkedItems.some((item) => item.supplier_pn === "ST-100")) {
  throw new Error("direct, compatible, and duplicate catalog rows must resolve to one supplier part number");
}
if (linkedItems.filter((item) => item.supplier_pn === "SL-200").length !== 1) {
  throw new Error("the same supplier and supplier part number must not be duplicated");
}
if (api.supplierItemsForResult(unlinkedResult, options).length !== 0) {
  throw new Error("unlinked ranking rows must remain unavailable");
}
if ([daikoResult, alternatorDaikoResult].some((result) => api.supplierItemsForResult(result, options).length !== 0)) {
  throw new Error("Daiko manufacturer part numbers must not resolve supplier products even with cached master links");
}

const available = api.filterSupplierResults([linkedResult, unlinkedResult], { ...options, supplierStatus: "available" });
const unavailable = api.filterSupplierResults([linkedResult, unlinkedResult], { ...options, supplierStatus: "unavailable" });
if (available.length !== 1 || available[0] !== linkedResult || unavailable.length !== 1 || unavailable[0] !== unlinkedResult) {
  throw new Error("supplier availability filters must preserve the original ranking rows");
}
const supplierResults = api.filterSupplierResults([linkedResult, daikoResult, alternatorDaikoResult], options);
if (supplierResults.length !== 1 || supplierResults[0] !== linkedResult) {
  throw new Error("Daiko manufacturer rows must be excluded from the supplier report");
}
const daikoUnavailable = api.filterSupplierResults([daikoResult, alternatorDaikoResult], { ...options, supplierStatus: "unavailable" });
if (daikoUnavailable.length !== 0) {
  throw new Error("STDK and ALDK manufacturer rows must not appear as unavailable supplier rows");
}

const printHtml = api.buildPrintHtml([linkedResult, unlinkedResult], options);
if (!printHtml.includes("仕入先商品照合リスト") || !printHtml.includes(">仕入先名称</th>") || !printHtml.includes(">仕入先品番</th>")) {
  throw new Error("supplier report must include separate supplier name and part-number fields");
}
if (!printHtml.includes("class='supplier-name'>Stronghold</td>") || !printHtml.includes("class='supplier-part'>SL-200</td>") || !printHtml.includes("rowspan='2'")) {
  throw new Error("supplier name and supplier part number must render in separate cells");
}
if ((printHtml.match(/class='supplier-part'>SL-200<\/td>/g) || []).length !== 1) {
  throw new Error("the supplier report must print a duplicate supplier part number only once");
}
if (/<th[^>]*>出荷数<\/th>/.test(printHtml) || /<th[^>]*>コア在庫<\/th>/.test(printHtml)) {
  throw new Error("supplier report must not output shipment or core-stock columns");
}
if (!printHtml.includes("is-available'>あり") || !printHtml.includes("is-unavailable'>なし")) {
  throw new Error("supplier report must show both availability states");
}

console.log("manufacturing ranking supplier report guard passed");
