const assert = require("assert");
const fs = require("fs");
const path = require("path");
const XLSX = require("../vendor/xlsx-0.20.3.full.min.js");

require("../manufacturing-cost-import.js");
const fakeElements = {
  "container-stock-results": { innerHTML: "" },
  "container-stock-apply": { disabled: true },
  "container-stock-status": { textContent: "", classList: { toggle() {} } },
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
const candidateRow = {
  category_code: "starter", part_number: "SM-760-01",
  candidates: [
    { dkd_shohin_id: 101, variant_active: true },
    { dkd_shohin_id: 102, variant_active: true }
  ]
};
receipt._state.costListId = "6";
receipt._state.costProductIds = ["102"];
assert.strictEqual(receipt._automaticTarget(candidateRow), "102", "saved cost-list product wins over other master candidates");
receipt._state.costProductIds = [];
assert.strictEqual(receipt._automaticTarget(candidateRow), "", "a product absent from the cost list stays unresolved");
receipt._state.costProductIds = ["101", "102"];
assert.strictEqual(receipt._automaticTarget(candidateRow), "", "multiple cost-list products require review");
receipt._state.costListId = "none";
assert.strictEqual(receipt._automaticTarget(candidateRow), "", "ordinary matching does not guess among multiple products");
receipt._state.costListId = "";
receipt._state.costProductIds = [];

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
assert.match(fakeElements["container-stock-results"].innerHTML, /照合完了・未解決あり（在庫未反映）/);
assert.match(fakeElements["container-stock-status"].textContent, /照合完了/);
assert.match(fakeElements["container-stock-results"].innerHTML, /一致なし 1件/);
assert.match(fakeElements["container-stock-results"].innerHTML, /エラー: 商品マスタに一致なし/);
assert.match(fakeElements["container-stock-results"].innerHTML, /照合品番: 31400-58J11/);
assert.strictEqual(fakeElements["container-stock-apply"].disabled, true);
receipt._state.editingKey = "alternator|31400-58J10";
receipt._renderPreview();
assert.match(fakeElements["container-stock-results"].innerHTML, /照合結果を修正中（在庫未反映）/);
assert.match(fakeElements["container-stock-results"].innerHTML, /照合を修正/);
assert.match(fakeElements["container-stock-results"].innerHTML, /この入庫だけの品番読み替え/);
assert.match(fakeElements["container-stock-results"].innerHTML, /修正理由/);
receipt._state.preview = null;
receipt._state.editingKey = "";

receipt._state.preview = {
  total_quantity: 13,
  rows: rows.map((row, index) => ({ ...row, candidates: [{
    dkd_shohin_id: 200 + index, genuine_part_number: row.part_number,
    stock_qty: 4, variant_active: true
  }] })),
  duplicate: null
};
receipt._state.selections = {};
receipt._renderPreview();
assert.match(fakeElements["container-stock-results"].innerHTML, /照合完了・未解決あり（在庫未反映）/);
assert.strictEqual(fakeElements["container-stock-apply"].disabled, true);
receipt._state.preview.rows.forEach((row, index) => {
  receipt._state.selections[`${row.category_code}|${row.part_number}`] = String(200 + index);
});
receipt._renderPreview();
assert.match(fakeElements["container-stock-results"].innerHTML, /照合完了・入庫可能（在庫未反映）/);
assert.match(fakeElements["container-stock-results"].innerHTML, /まだ在庫には反映していません/);
assert.strictEqual(fakeElements["container-stock-apply"].disabled, false);
receipt._state.editingKey = "alternator|31400-58J10";
receipt._renderPreview();
assert.match(fakeElements["container-stock-results"].innerHTML, /照合結果を修正中（在庫未反映）/);
assert.strictEqual(fakeElements["container-stock-apply"].disabled, true);
receipt._state.editingKey = "";
receipt._state.preview.duplicate = { id: 1, container_reference: "OTHER.xlsx", received_at: "2026-09-25" };
receipt._renderPreview();
assert.match(fakeElements["container-stock-results"].innerHTML, /照合完了・取込済み（再入庫不可）/);
assert.strictEqual(fakeElements["container-stock-apply"].disabled, true);
receipt._state.preview.duplicate = null;
receipt._state.working = true;
receipt._renderPreview();
assert.match(fakeElements["container-stock-results"].innerHTML, /入庫を登録中です/);
assert.strictEqual(fakeElements["container-stock-apply"].disabled, true);
receipt._state.applied = true;
receipt._renderPreview();
assert.match(fakeElements["container-stock-results"].innerHTML, /入庫完了（在庫反映済み）/);
assert.strictEqual(fakeElements["container-stock-apply"].disabled, true);
receipt._state.working = false;
receipt._state.applied = false;
receipt._state.preview = null;

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

// Exercise actual selection/file events: a saved list is visible without a workbook,
// but cannot supply inventory quantities or trigger a stock mutation.
(async function verifyCostListDisplay() {
  const vm = require("vm");
  const elements = {};
  function element(id) {
    return elements[id] || (elements[id] = {
      value: "", innerHTML: "", textContent: "", hidden: false, disabled: false,
      selectedOptions: [{ textContent: "コンテナ検証" }], files: [], listeners: {}, attrs: {},
      classList: { toggle() {} },
      setAttribute(key, value) { this.attrs[key] = value; },
      addEventListener(type, listener) { this.listeners[type] = listener; }
    });
  }
  let finishInit, response, pending;
  const queries = [];
  const context = {
    console, crypto: require("crypto").webcrypto,
    DcatsManufacturingCostImport: { ...parser, loadSpreadsheetLibrary: async () => XLSX },
    document: { readyState: "loading", getElementById: element,
      addEventListener(type, listener) { if (type === "DOMContentLoaded") finishInit = listener; } },
    canEditProductKindStockMgmt: () => true,
    sb: {
      from(table) {
        assert.strictEqual(table, "manufacturing_cost_list_items");
        return {
          select(columns) { queries.push(columns); return this; }, eq() { return this; }, order() { return this; },
          limit() { return pending || Promise.resolve(response); }
        };
      },
      rpc() { throw new Error("Selecting a list must not call a stock RPC"); }
    }
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../container-stock-import.js"), "utf8"), context);
  finishInit();
  const api = context.DcatsContainerStockImport;
  const products = element("container-stock-cost-products");
  const select = element("container-stock-cost-list");
  const quantityCells = () => [...products.innerHTML.matchAll(/<td class='container-stock-cost-quantity'>([^<]*)<\/td>/g)].map(match => match[1]);
  async function selectList(id) {
    select.value = id;
    select.listeners.change();
    await new Promise(resolve => setImmediate(resolve));
  }
  response = { data: [{ dkd_shohin_id: 102, import_part_numbers: ["SM-760-01", "<img src=x onerror=alert(1)>"],
    part_number_snapshot: "M001", genuine_part_number_snapshot: "G001", manufacturer_snapshot: "<script>",
    category_code_snapshot: "starter" }], count: 1 };
  await selectList("6");
  assert.match(products.innerHTML, /照合済み商品<\/span> <span>1件/);
  assert.match(products.innerHTML, /SM-760-01/);
  assert.match(products.innerHTML, /M001/);
  assert.match(products.innerHTML, /G001/);
  assert.match(products.innerHTML, /&lt;img/);
  assert.doesNotMatch(products.innerHTML, /<script>|<img /);
  assert.match(element("container-stock-status").textContent, /入庫数量/);
  assert.strictEqual(products.hidden, false);
  assert.strictEqual(products.attrs["aria-busy"], "false");
  assert.strictEqual(element("container-stock-preview").disabled, true);
  assert.strictEqual(element("container-stock-apply").disabled, true);
  assert.ok(queries[0].includes("part_number_snapshot"));
  assert.strictEqual(api._state.costLinkItems.length, 1);
  assert.match(products.innerHTML, /<th[^>]*>数量（取込）<\/th>/);
  assert.deepStrictEqual(quantityCells(), ["未読込"], "missing source quantity is not zero");

  const csv = Buffer.from("Parts No,Quantity\nSM-760-01,3\n");
  element("container-stock-file").files = [{ name: "STA-test.csv", size: csv.length,
    arrayBuffer: async () => csv.buffer.slice(csv.byteOffset, csv.byteOffset + csv.byteLength) }];
  await element("container-stock-file").listeners.change();
  assert.strictEqual(api._state.costListId, "6", "file selection preserves the saved list");
  assert.strictEqual(select.value, "6");
  assert.match(products.innerHTML, /SM-760-01/);
  element("container-stock-sheets").listeners.change({ target: {
    closest: () => ({ dataset: { sheetIndex: "0" } }), dataset: { sheetField: "category" }, value: "starter"
  } });
  assert.strictEqual(api._collectRows()[0].quantity, 3);
  assert.strictEqual(element("container-stock-preview").disabled, false);
  assert.strictEqual(element("container-stock-apply").disabled, true);

  assert.deepStrictEqual(quantityCells(), ["3"], "source quantity is rendered after file/category events");
  const originalSheet = api._state.sheets[0];
  const additionalSheet = sheet("STA extra", [["Parts No", "Quantity"], ["SM-760-01", 4], ["SM-760-01", 5]], "starter");
  api._state.sheets.push(additionalSheet);
  element("container-stock-reference").listeners.input();
  assert.deepStrictEqual(quantityCells(), ["12"], "duplicate parts and pallets are summed once");
  const changeSheet = (index, field, value, checked) => element("container-stock-sheets").listeners.change({ target: {
    closest: () => ({ dataset: { sheetIndex: String(index) } }), dataset: { sheetField: field }, value, checked
  } });
  changeSheet(1, "included", "", false);
  assert.deepStrictEqual(quantityCells(), ["3"], "excluded sheets do not contribute quantities");
  changeSheet(1, "included", "", true);
  additionalSheet.matrix[1][1] = "4 pcs";
  changeSheet(1, "quantityColumn", "1");
  assert.deepStrictEqual(quantityCells(), ["要確認"], "invalid quantity must not show a partial total");
  additionalSheet.matrix[1][1] = 4;
  changeSheet(1, "category", "alternator");
  assert.deepStrictEqual(quantityCells(), ["3"], "a different category is not added to the product");
  api._state.sheets = [originalSheet];
  const originalItem = api._state.costDisplayItems[0];
  api._state.costDisplayItems.push({ dkd_shohin_id: 103, import_part_numbers: ["SM-760-01"], category_code_snapshot: "starter" });
  element("container-stock-reference").listeners.input();
  assert.deepStrictEqual(quantityCells(), ["要照合", "要照合"], "ambiguous source cannot duplicate quantities into two products");
  api._state.costDisplayItems = [{ ...originalItem, import_part_numbers: ["SM-760-01", "SM-760-01"], part_number_snapshot: "SM-760-01" }];
  element("container-stock-reference").listeners.input();
  assert.deepStrictEqual(quantityCells(), ["3"], "repeated aliases on one product do not double count");
  api._state.costDisplayItems = [{ ...originalItem, import_part_numbers: [], part_number_snapshot: "SM-760-01" }];
  element("container-stock-reference").listeners.input();
  assert.deepStrictEqual(quantityCells(), ["3"], "legacy lists can use saved part-number snapshots");
  api._state.costDisplayItems = [{ ...originalItem, import_part_numbers: ["OTHER-001"] }];
  element("container-stock-reference").listeners.input();
  assert.deepStrictEqual(quantityCells(), ["対象なし"], "absent part is not falsely represented as zero");
  api._state.costDisplayItems = [originalItem];
  changeSheet(0, "quantityColumn", "0");
  assert.deepStrictEqual(quantityCells(), ["要確認"], "changing the quantity column refreshes the quantity state");
  changeSheet(0, "quantityColumn", "1");
  assert.deepStrictEqual(quantityCells(), ["3"]);
  changeSheet(0, "category", "");
  assert.deepStrictEqual(quantityCells(), ["要確認"]);
  changeSheet(0, "category", "starter");
  assert.deepStrictEqual(quantityCells(), ["3"]);

  let release;
  pending = new Promise(resolve => { release = resolve; });
  await selectList("7");
  assert.match(products.innerHTML, /読み込んでいます/);
  assert.doesNotMatch(products.innerHTML, /SM-760-01/);
  assert.strictEqual(element("container-stock-preview").disabled, true);
  pending = null;
  response = { data: [{ dkd_shohin_id: 103, part_number_snapshot: "NEW-LIST" }], count: 1 };
  await selectList("8");
  release({ data: [{ dkd_shohin_id: 104, part_number_snapshot: "STALE-LIST" }], count: 1 });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(products.innerHTML, /NEW-LIST/);
  assert.doesNotMatch(products.innerHTML, /STALE-LIST/);
  assert.strictEqual(api._state.costLinkItems.length, 1);

  response = { data: [] };
  await selectList("9");
  assert.match(products.innerHTML, /リストに商品がありません/);
  assert.doesNotMatch(products.innerHTML, /NEW-LIST/);
  assert.strictEqual(api._state.costListReady, false);
  response = { error: { message: "permission denied" } };
  await selectList("10");
  assert.match(products.innerHTML, /permission denied/);
  response = { data: [{ dkd_shohin_id: 1 }], count: 1001 };
  await selectList("11");
  assert.match(products.innerHTML, /上限/);
  await selectList("none");
  assert.strictEqual(products.hidden, true);
  assert.strictEqual(products.innerHTML, "");
  response = { data: [{ dkd_shohin_id: 102 }], count: 1 };
  await selectList("6");
  api._resetReceipt();
  assert.strictEqual(products.hidden, true);
  assert.strictEqual(api._state.costDisplayItems.length, 0);
  pending = new Promise(resolve => { release = resolve; });
  await selectList("6");
  context.canEditProductKindStockMgmt = () => false;
  api.enter();
  release(response);
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(element("container-stock-import").hidden, true);
  assert.strictEqual(products.innerHTML, "");
  assert.strictEqual(api._state.costListReady, false);
  context.canEditProductKindStockMgmt = () => true;
  context.currentUser = { id: "synthetic-user-a" };
  pending = new Promise(resolve => { release = resolve; });
  await selectList("6");
  context.currentUser = { id: "synthetic-user-b" };
  release(response);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(products.innerHTML, /ログイン状態が変わりました/);
  assert.strictEqual(api._state.costDisplayItems.length, 0);
  assert.strictEqual(api._state.costListReady, false);
  console.log("Container cost-list display, file continuity, stale/error/empty and role checks passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
