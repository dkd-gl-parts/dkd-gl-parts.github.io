const assert = require("assert");
const fs = require("fs");
const path = require("path");
const XLSX = require("../vendor/xlsx-0.20.3.full.min.js");

require("../manufacturing-cost-import.js");
require("../container-stock-import.js");

const parser = globalThis.DcatsManufacturingCostImport;
const receipt = globalThis.DcatsContainerStockImport;
assert.ok(parser && receipt, "shared parser and receipt module must load");

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
