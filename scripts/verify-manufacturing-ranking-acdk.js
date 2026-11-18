const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert/strict");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "manufacturing-ranking-report.js"), "utf8");
const queries = [];
const context = {
  window: {}, document: { getElementById() { return null; }, querySelectorAll() { return []; } },
  console, Intl, Date, setTimeout, encodeURIComponent,
  sb: { from(table) { return { select(columns) { return { in(field, values) {
    queries.push({ table, columns, field, values });
    return Promise.resolve({ data: [{ dkd_shohin_id: 12, manufacturer_part_number: "OEM-1000" }, { dkd_shohin_id: 99, manufacturer_part_number: "ACDK1000" }] });
  } }; } }; } }
};
vm.runInNewContext(source.replace("window.DCatsManufacturingRankingReport = {", "window.DCatsManufacturingRankingReport = { displayMaker: reportManufacturerPartNumber, replacementIds: fetchAcdkReplacementProductIds, renderPreview: renderPreviewTable,"), context);
const api = context.window.DCatsManufacturingRankingReport;
const row = (id, maker, genuine = "88310-10000", genuine2 = "") => ({ id, sheet: "AC", productName: "ACコンプレッサ", productCode: id, maker, genuine, genuine2, body: "BODY-1000", clutch: "", shipment: 30, substitute: 2, masterCacheReady: true, masterProductIds: ["99"], missingMasterParts: [{ label: "メーカー", value: maker }] });
const products = [
  { id: "12", manufacturer_part_number: "OEM-1000", genuine_part_number: "88310-10000", coreStockQty: 3 },
  { id: "13", manufacturer_part_number: "OEM-2000", genuine_part_number: "88310-20000", coreStockQty: 4 },
  { id: "14", manufacturer_part_number: "OEM-2001", genuine_part_number: "88310-20000", coreStockQty: 5 },
  { id: "15", manufacturer_part_number: "3800", coreStockQty: 6 },
  { id: "16", manufacturer_part_number: "WRONG-1000", genuine_body_part_number: "88310-30000", coreStockQty: 50 },
  { id: "99", manufacturer_part_number: "ACDK1000", genuine_part_number: "88310-10000", coreStockQty: 100 }
];
api.setMasterProducts(products, { registered: ["12", "99"] });
const unique = row("unique", "ＡＣＤＫ１０００");
const ambiguous = row("ambiguous", "ACDK2000", "88310-20000");
const alternate = row("alternate", "ACDK03800", "", "3800");
const missing = row("missing", "ACDK4000", "88310-40000");
const bodyOnly = row("body", "ACDK3000", "88310-30000");
const noIdentity = row("none", "ACDK5000", "", "-");
const result = r => ({ row: r, group: [r], rank: 1, shipment: r.shipment, substitute: r.substitute, score: r.shipment });
assert.equal(api.displayMaker(unique), "OEM-1000", "stale cached ACDK must be rematched by an exact primary identity");
assert.equal(api.displayMaker(alternate), "3800", "an exact source alternate identity can confirm the maker");
for (const r of [ambiguous, missing, bodyOnly, noIdentity]) assert.equal(api.displayMaker(r), "", "ambiguous or missing makers must remain unresolved");
assert.equal(api.coreStockDetails(result(unique)).currentTotal, 3, "ACDK stock must not count as the current product");
assert.equal(api.coreStockDetails(result(unique)).compatibleTotal, 0, "registered ACDK stock must not enter compatibility totals");
assert.equal(api.coreStockDetails(result(bodyOnly)).matched, false, "body-only matches cannot identify an assembly");
assert.equal(api.coreStockDetails(result(noIdentity)).matched, false, "ACDK suffixes cannot invent a maker");
assert.equal(api.coreStockDetails(result(missing)).matched, false, "old cached links are not proof without exact primary evidence");
const normal = { ...row("normal", "OEM-1000"), masterProductIds: ["12", "99"] };
assert.equal(api.coreStockDetails(result(normal)).currentTotal, 3, "normal AC rows must also discard cached ACDK candidates");
assert(!api.compatibilityDetails(result(normal), true).join(" ").includes("ACDK"));
for (const r of [unique, ambiguous, missing]) assert(!api.missingMasterPartNumbers(result(r), "all").some(x => /ACDK/i.test(x.value)), "excluded ACDK aliases must not become missing-master recommendations");
const rows = [unique, ambiguous, alternate, missing, bodyOnly, noIdentity];
const options = { categories: ["AC"], reportType: "ranking", metric: "shipment", rankScope: "overall", startRank: 1, endRank: 100, minShipment: 0, compatibilityMode: "all", compatibilityBasis: "maker_genuine", query: "", showCoreStock: true, showMissingMaster: true, showVehicleClassification: false, orientation: "portrait" };
const before = JSON.stringify(rows);
const ranked = api.buildRanking(rows, options);
assert.equal(ranked.results.length, rows.length, "source product rows must be retained");
assert.equal(ranked.results.reduce((sum, r) => sum + r.shipment, 0), 180, "shipment counts must be retained");
const csv = api.buildExcelCsv(ranked.results, options);
const print = api.buildPrintHtml(ranked.results, options, "synthetic", { sourceRowCount: rows.length, omittedRows: 0, compatibleGroupCount: 0 });
assert(!/ACDK/i.test(csv), "CSV and Excel must not adopt ACDK aliases");
assert(!/ACDK/i.test(print), "PDF HTML must not adopt ACDK aliases");
assert(csv.includes("OEM-1000") && csv.includes("88310-20000"));
assert.equal(JSON.stringify(rows), before, "report resolution must never mutate source data");
const aliasOnly = [row("a", "ACDK6000", "G-1000"), row("b", "ACDK6000", "G-2000")];
const separate = api.buildRanking(aliasOnly, { ...options, compatibilityMode: "consolidated", compatibilityBasis: "maker" });
assert.equal(separate.results.length, 2, "shared ACDK aliases cannot merge distinct products");
(async () => {
  const ids = await api.replacementIds([unique, alternate, noIdentity]);
  assert.equal(JSON.stringify(ids), '["12"]');
  assert.equal(queries.length, 3);
  for (const query of queries) {
    assert.equal(query.table, "core_products");
    assert(query.values.every(value => value && !/ACDK/i.test(value)));
    assert(!query.values.includes("BODY1000"));
  }
  assert(queries.every(query => query.values.includes("3800") && query.values.includes("8831010000")));
  console.log("ACDK report relinking: exact identities, stale cache, ambiguity, no guesses, stock, compatibility, source counts, CSV/PDF and bounded lookups passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
