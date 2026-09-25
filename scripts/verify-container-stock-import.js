const assert = require("assert");
const fs = require("fs");
const path = require("path");
const XLSX = require("../vendor/xlsx-0.20.3.full.min.js");

require("../manufacturing-cost-import.js");
const fakeElements = {
  "container-stock-results": { innerHTML: "" },
  "container-stock-apply": { disabled: true },
  "container-stock-reference": { value: "" }
};
globalThis.document = {
  readyState: "loading",
  addEventListener() {},
  getElementById(id) { return fakeElements[id] || null; }
};
require("../container-stock-import.js");

const parser = globalThis.DcatsManufacturingCostImport;
const receipt = globalThis.DcatsContainerStockImport;
assert.ok(parser && receipt, "shared parser and receipt module must load");
assert.strictEqual(receipt._useFileNameAsReference("GLTEK完品2ed.xlsx"), true);
assert.strictEqual(fakeElements["container-stock-reference"].value, "GLTEK完品2ed.xlsx");
assert.strictEqual(receipt._useFileNameAsReference("other.xlsx"), false, "existing identifier must not be overwritten");
fakeElements["container-stock-reference"].value = "";
assert.strictEqual(receipt._useFileNameAsReference("L".repeat(110) + ".xlsx"), false);
assert.strictEqual(fakeElements["container-stock-reference"].value, "");

function sheet(name, matrix, category) {
  return { name, matrix, category, included: true, overrides: {} };
}
const header = [
  ["パレット", "", "品番", "", "数量"],
  ["CAGE NO", "ITEM", "Parts No", "Parts Weight", "Quantity"]
];
receipt._state.sheets = [
  sheet("ALT 完品", header.concat([
    ["A-1", "ALT", "31400-58J10", 4, 4],
    ["", "", "31400-58J10", 4, 6],
    ["A-2", "ALT", "27060-B2030", 4, 2]
  ]), "alternator"),
  sheet("STA 完品", header.concat([
    ["GL-S-1", "STA", "SM-760-01", 3, 1]
  ]), "starter")
];
let rows = receipt._collectRows();
assert.strictEqual(rows.length, 3);
assert.strictEqual(rows.reduce((sum, row) => sum + row.quantity, 0), 13);
assert.strictEqual(rows.find((row) => row.part_number === "31400-58J10").quantity, 10);
assert.deepStrictEqual(rows.find((row) => row.part_number === "31400-58J10").sources[0].rows, [3, 4]);
assert.strictEqual(rows.find((row) => row.part_number === "31400-58J10").match_part_number, "31400-58J10");

receipt._state.corrections["alternator|31400-58J10"] = "31400-58J11";
receipt._state.correctionReasons["alternator|31400-58J10"] = "現物ラベルで確認済み";
rows = receipt._collectRows();
assert.strictEqual(rows.find((row) => row.part_number === "31400-58J10").match_part_number, "31400-58J11");
assert.strictEqual(rows.find((row) => row.part_number === "31400-58J10").match_reason, "現物ラベルで確認済み");
assert.strictEqual(rows.find((row) => row.part_number === "31400-58J10").quantity, 10);
assert.strictEqual(rows.reduce((sum, row) => sum + row.quantity, 0), 13);
delete receipt._state.corrections["alternator|31400-58J10"];
delete receipt._state.correctionReasons["alternator|31400-58J10"];
assert.strictEqual(receipt._validPartNumber("SM-760-01"), true);
assert.strictEqual(receipt._validPartNumber("xx"), false);

receipt._state.preview = {
  total_quantity: 13,
  rows: [
    { ...rows.find((row) => row.part_number === "31400-58J10"), candidates: [], match_part_number: "31400-58J11" },
    { ...rows.find((row) => row.part_number === "27060-B2030"), candidates: [{ dkd_shohin_id: 123, genuine_part_number: "27060-B2030",
      stock_qty: 4, variant_active: true }] }
  ]
};
receipt._state.selections = {};
receipt._renderPreview();
assert.match(fakeElements["container-stock-results"].innerHTML, /一致なし 1件/);
assert.match(fakeElements["container-stock-results"].innerHTML, /エラー: 商品マスタに一致なし/);
assert.match(fakeElements["container-stock-results"].innerHTML, /照合品番: 31400-58J11/);
assert.strictEqual(fakeElements["container-stock-apply"].disabled, true);
receipt._state.editingKey = "alternator|31400-58J10";
receipt._renderPreview();
assert.match(fakeElements["container-stock-results"].innerHTML, /照合を修正/);
assert.match(fakeElements["container-stock-results"].innerHTML, /この入庫だけの品番読み替え/);
assert.match(fakeElements["container-stock-results"].innerHTML, /修正理由/);
receipt._state.preview = null;
receipt._state.editingKey = "";

receipt._state.sheets[0].category = "";
assert.throws(() => receipt._collectRows(), /区分を選択/);
receipt._state.sheets[0].category = "alternator";
receipt._state.sheets[0].matrix[2][4] = 1.5;
assert.throws(() => receipt._collectRows(), /数量を確認/);
receipt._state.sheets[0].matrix[2][4] = 4;
receipt._state.sheets[0].matrix[3][4] = "6 pcs";
assert.throws(() => receipt._collectRows(), /数量を確認/, "invalid second pallet must not be skipped");

if (process.argv[2]) {
  const source = path.resolve(process.argv[2]);
  const book = XLSX.read(fs.readFileSync(source), { type: "buffer" });
  receipt._state.sheets = parser.workbookSheets(book, XLSX).map((entry) => ({
    ...entry,
    category: /ALT/i.test(entry.name) ? "alternator" : /STA/i.test(entry.name) ? "starter" : "",
    included: parser.analyzeMatrix(entry.matrix).rows.length > 0,
    overrides: {}
  })).filter((entry) => entry.included);
  rows = receipt._collectRows();
  assert.strictEqual(rows.length, 43);
  assert.strictEqual(rows.reduce((sum, row) => sum + row.quantity, 0), 1398);
  assert.strictEqual(rows.find((row) => row.part_number === "31400-58J10").quantity, 307);
  assert.strictEqual(rows.find((row) => row.part_number === "27060-B2030").quantity, 190);
  assert.strictEqual(rows.find((row) => row.part_number === "SM-760-01").quantity, 15);
  console.log("Container workbook: 43 parts, 1398 units, duplicate pallets aggregated");
} else {
  console.log("Container receipt parser checks passed");
}
