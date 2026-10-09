const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "manufacturing-ranking-report.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

[
  "manufacturing-ranking-report-type",
  "manufacturing-ranking-supplier",
  "manufacturing-ranking-supplier-status",
  "manufacturing-ranking-excel"
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
    sheet: "alternator",
    productName: "オルタネータ",
    productCode: id,
    genuine,
    genuine2: "",
    maker,
    body: "",
    clutch: "",
    shipment: 1,
    substitute: 0,
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

const supplierRankingOptions = { ...options, categories: ["alternator"], minShipment: 0, compatibilityBasis: "maker_genuine" };
const supplierRanking = api.buildRanking([linkedRow, unlinkedRow, daikoRow, alternatorDaikoRow], supplierRankingOptions);
if (supplierRanking.results.length !== 2 || supplierRanking.results.some((result) => /^(?:AL|ST)DK/.test(result.row.maker))) {
  throw new Error("Daiko manufacturer rows must be excluded before supplier compatibility grouping and ranking");
}
const manufacturingRanking = api.buildRanking([daikoRow], { ...supplierRankingOptions, reportType: "manufacturing" });
if (manufacturingRanking.results.length !== 1 || manufacturingRanking.results[0].row !== daikoRow) {
  throw new Error("Daiko manufacturer rows must remain available to the normal manufacturing ranking");
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

const supplierExcelRows = api.buildExcelRows([linkedResult, unlinkedResult, daikoResult, alternatorDaikoResult], options);
const supplierExcelHeader = supplierExcelRows[0];
const supplierNameColumn = supplierExcelHeader.indexOf("仕入先名称");
const supplierPartColumn = supplierExcelHeader.indexOf("仕入先品番");
if (supplierNameColumn < 0 || supplierPartColumn < 0 || supplierNameColumn === supplierPartColumn) {
  throw new Error("Excel supplier name and supplier part number must use separate columns");
}
if (supplierExcelHeader.includes("出荷数") || supplierExcelHeader.includes("コア在庫")) {
  throw new Error("supplier Excel output must not include shipment or core-stock columns");
}
if (supplierExcelRows.length !== 4 || JSON.stringify(supplierExcelRows).includes("ALDK00079") || JSON.stringify(supplierExcelRows).includes("STDK87538")) {
  throw new Error("supplier Excel output must include linked and unlinked rows without Daiko manufacturer records");
}
if (supplierExcelRows.filter((row) => row[supplierPartColumn] === "SL-200").length !== 1) {
  throw new Error("supplier Excel output must not duplicate the same supplier part number");
}

const manufacturingExcelRows = api.buildExcelRows([linkedResult], { ...options, reportType: "manufacturing", showCoreStock: false, showMissingMaster: false });
if (!manufacturingExcelRows[0].includes("出荷数") || manufacturingExcelRows[0].includes("仕入先名称") || manufacturingExcelRows[1][0] !== 1) {
  throw new Error("manufacturing Excel output must contain ranking and shipment columns");
}
const supplierCsv = api.buildExcelCsv([linkedResult, unlinkedResult], options);
if (!supplierCsv.includes("仕入先名称") || !supplierCsv.includes("SL-200") || !source.includes('manufacturing-ranking-excel").addEventListener("click", exportRankingExcel)')) {
  throw new Error("manufacturing ranking Excel download must be wired to the export button");
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

// Whole-sheet shipment totals must be filtered using detail-sheet membership,
// before compatibility grouping or rank slicing, without replacing their totals.
const aggregateSheet = "商品別出荷実績集計";
const detailRows = [
  { ...linkedRow, id: "D1", sheet: "オルタ", productCode: "1", shipment: 3 },
  { ...linkedRow, id: "D2", sheet: "オルタ", productCode: "2", maker: "ALT-002", shipment: 2 },
  { ...linkedRow, id: "D3", sheet: "セル", productCode: "3", productName: "スタータ", shipment: 9 },
  { ...linkedRow, id: "D4", sheet: "部品", productCode: "4", productName: "オルタネータ用部品", maker: "PART-004", shipment: 4 },
  { ...linkedRow, id: "D5", sheet: "オルタ", productCode: "5", maker: "ALT-005", shipment: 1 },
  { ...linkedRow, id: "D6", sheet: "セル", productCode: "5", maker: "ST-005", shipment: 1 }
];
const aggregateRows = detailRows.slice(0, 4).map((row, i) => ({
  ...row, id: "A" + (i + 1), sheet: aggregateSheet, isAggregate: true, shipment: [100, 80, 300, 200][i]
}));
const unknownRow = { ...aggregateRows[0], id: "A-unknown", productCode: "99", maker: "UNKNOWN-099" };
const ambiguousRow = { ...aggregateRows[0], id: "A-ambiguous", productCode: "5", maker: "ALT-005" };
const categoryRows = [...aggregateRows, unknownRow, ambiguousRow, ...detailRows];
const categoryOptions = {
  ...supplierRankingOptions, categories: [aggregateSheet], reportType: "manufacturing",
  productCategory: "オルタ", startRank: 1, endRank: 100, compatibilityBasis: "maker_genuine"
};
const alternatorRanking = api.buildRanking(categoryRows, categoryOptions);
if (alternatorRanking.results.length !== 2 || alternatorRanking.sourceRowCount !== 2 ||
    alternatorRanking.results[0].row.id !== "A1" || alternatorRanking.results[0].shipment !== 100 ||
    alternatorRanking.results[1].row.id !== "A2" || alternatorRanking.results[1].shipment !== 80 ||
    alternatorRanking.results[0].rank !== 1 || alternatorRanking.results[1].rank !== 2) {
  throw new Error("aggregate alternator filtering must keep aggregate totals and recompute ranks");
}
if (alternatorRanking.unclassifiedRowCount !== 2) {
  throw new Error("unknown and ambiguous category membership must be excluded and counted");
}
const starterRanking = api.buildRanking(categoryRows, { ...categoryOptions, productCategory: "セル" });
if (starterRanking.results.length !== 1 || starterRanking.results[0].row.id !== "A3" || starterRanking.results[0].rank !== 1) {
  throw new Error("aggregate starter filtering must exclude alternators and parts");
}
const rangeRanking = api.buildRanking(categoryRows, { ...categoryOptions, startRank: 2, endRank: 2 });
if (rangeRanking.results.length !== 1 || rangeRanking.results[0].row.id !== "A2") {
  throw new Error("rank slicing must run after product-category filtering");
}
const consolidated = api.buildRanking(categoryRows, { ...categoryOptions, compatibilityMode: "consolidated" });
if (consolidated.results.length !== 1 || consolidated.results[0].shipment !== 180 ||
    consolidated.results[0].group.some((row) => row.productCode === "3")) {
  throw new Error("excluded categories must not enter compatibility-group totals");
}
const detailRanking = api.buildRanking(categoryRows, { ...categoryOptions, categories: ["オルタ"] });
if (detailRanking.results.length !== 3 || detailRanking.results[0].shipment !== 3) {
  throw new Error("detail-sheet filtering must continue to use that sheet's totals");
}
const noCodeRanking = api.buildRanking([
  { ...aggregateRows[0], productCode: "" }, detailRows[0]
], categoryOptions);
if (noCodeRanking.results.length !== 1) {
  throw new Error("missing product codes may resolve through an exact matching item identity");
}
const allRanking = api.buildRanking(categoryRows, { ...categoryOptions, productCategory: "all" });
const legacyRanking = api.buildRanking(categoryRows, { ...categoryOptions, productCategory: undefined });
if (allRanking.results.length !== 6 || JSON.stringify(allRanking) !== JSON.stringify(legacyRanking)) {
  throw new Error("all categories must preserve the previous ranking behavior including unknown rows");
}
if (api.buildRanking(categoryRows, { ...categoryOptions, productCategory: "存在しないカテゴリ" }).results.length) {
  throw new Error("an unmatched category must return an empty ranking");
}
const categoryCsv = api.buildExcelCsv(alternatorRanking.results, categoryOptions);
const categoryPrint = api.buildPrintHtml(alternatorRanking.results, categoryOptions);
if (categoryCsv.includes("スタータ") || categoryCsv.includes("オルタネータ用部品") || !categoryCsv.includes(",100,")) {
  throw new Error("Excel output must include only filtered aggregate totals");
}
if (!categoryPrint.includes("商品カテゴリ: オルタ") || categoryPrint.includes("スタータ") || categoryPrint.includes("オルタネータ用部品")) {
  throw new Error("PDF output must state the filter and include only the filtered rows");
}
if (!api.printFileTitle([aggregateSheet], 1, 100, new Date(2026, 9, 9), "manufacturing", "オルタ").includes("（オルタ）")) {
  throw new Error("filtered report filenames must identify the product category");
}
const mappedAggregate = api.mapDatabaseRow({ category_name: aggregateSheet, is_aggregate: true });
if (mappedAggregate.isAggregate !== true || !html.includes('id="manufacturing-ranking-product-category"') ||
    !source.includes('byId("manufacturing-ranking-product-category").addEventListener("change", updatePreview)')) {
  throw new Error("database aggregate flags and the automatic product-category filter must be wired");
}
const escapedCategoryPrint = api.buildPrintHtml([], { ...categoryOptions, productCategory: "<script>" });
if (escapedCategoryPrint.includes("商品カテゴリ: <script>")) {
  throw new Error("category names must be escaped in PDF output");
}

console.log("manufacturing ranking supplier and product-category report guards passed");
