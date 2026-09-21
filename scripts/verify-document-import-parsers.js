"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const costSource = fs.readFileSync(path.join(root, "manufacturing-cost-import.js"), "utf8");
const rankingSource = fs.readFileSync(path.join(root, "manufacturing-ranking-report.js"), "utf8");
const inventory = JSON.parse(fs.readFileSync(path.join(root, "vendor/parser-inventory.json"), "utf8"));
const XLSX = require(path.join(root, "vendor/xlsx-0.20.3.full.min.js"));
assert.equal(XLSX.version, "0.20.3");
assert.equal(inventory.libraries.find((item) => item.name === "PDF.js").version, "6.3.289");
assert.equal(inventory.libraries.find((item) => item.name === "PDF.js").build, "legacy");
function filesBelow(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesBelow(directory + "/" + entry.name) : [directory + "/" + entry.name]);
}
assert.deepEqual(inventory.files.map((item) => item.path).sort(), filesBelow("vendor").filter((name) => /^vendor\/(xlsx-0\.20\.3|pdfjs-6\.3\.289)/.test(name)).sort());
for (const item of inventory.files) {
  assert.match(item.path, /^vendor\/(?:xlsx-0\.20\.3|pdfjs-6\.3\.289)[\w./-]+$/);
  assert(!item.path.includes(".."));
  const bytes = fs.readFileSync(path.join(root, item.path));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), item.sha256, item.path);
  assert.equal("sha384-" + crypto.createHash("sha384").update(bytes).digest("base64"), item.integrity, item.path);
}
assert(!fs.readdirSync(path.join(root, "vendor")).some((name) => /^(xlsx-0\.18\.5|pdfjs-3\.11\.174)/.test(name)));
for (const value of ['type: "module"', 'script.integrity = asset.integrity;', 'script.crossOrigin = "anonymous";', 'root[globalName].version === asset.version', 'delete scriptPromises[asset.src]']) assert(costSource.includes(value));
assert(rankingSource.includes('await window.DcatsManufacturingCostImport.loadSpreadsheetLibrary();'));
assert(!/unsafe-eval|unsafe-inline|wasm-unsafe-eval/.test(fs.readFileSync(path.join(root, "_headers"), "utf8")));

function costContext(pdfjsLib) {
  const context = { window: { XLSX, pdfjsLib }, console, Uint8Array };
  // Instrument only the VM copy; the production API remains unchanged.
  vm.runInNewContext(costSource.replace("root.DcatsManufacturingCostImport = api;", "api.readFile = readFile; root.DcatsManufacturingCostImport = api;"), context);
  return context.window.DcatsManufacturingCostImport;
}
function rankingContext(xlsx = XLSX) {
  const context = { window: { XLSX: xlsx }, XLSX: xlsx, console, Intl, Date, document: { getElementById: () => null, querySelectorAll: () => [] } };
  vm.runInNewContext(rankingSource.replace("window.DCatsManufacturingRankingReport = {", "window.DCatsManufacturingRankingReport = { parseWorkbook: parseWorkbook,"), context);
  return context.window.DCatsManufacturingRankingReport;
}
function file(name, bytes, size = bytes.length) {
  return { name, size, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}
function rows(analysis) { return Array.from(analysis.rows, (row) => [row.part, row.quantity]); }
const matrix = [
  ["パレットNO", "品番", "数量", "商品名", "商品CD", "出荷数計", "代替台数", "純正品番"],
  ["A-1", "27060-TEST01", 9, "オルタネータ", "000100", 9, 2, "27060-TEST01"],
  ["A-2", "28100-TEST02", 15, "スタータ", "000200", 15, 0, "28100-TEST02"],
  ["A-3", "27060-TEST01", 11, "オルタネータ", "000100", 11, 1, "27060-TEST01"]
];
(async () => {
  let cases = 0;
  const cost = costContext(), ranking = rankingContext(), workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(matrix), "日本語明細");
  for (const bookType of ["xlsx", "xls", "xlsm", "csv"]) {
    const bytes = XLSX.write(workbook, { bookType, type: "buffer" });
    const sheets = await cost.readFile(file("合成パレット." + bookType, bytes));
    assert.deepEqual(rows(cost.analyzeMatrix(sheets[0].matrix)), [["27060-TEST01", 20], ["28100-TEST02", 15]]);
    if (bookType !== "csv") {
      const parsed = ranking.parseWorkbook(bytes, "合成ランキング." + bookType);
      assert.equal(parsed.rows.length, 3);
      assert.equal(parsed.rows[0].productName, "オルタネータ");
      assert.equal(parsed.rows[0].productCode, "000100");
      assert.equal(parsed.rows.reduce((sum, row) => sum + row.shipment, 0), 35);
      assert.equal(parsed.rows.reduce((sum, row) => sum + row.substitute, 0), 3);
    }
    cases++;
  }
  assert.throws(() => rankingContext({ version: "0.18.5" }).parseWorkbook(new Uint8Array(), "old.xlsx"));
  await assert.rejects(cost.readFile(file("large.xlsx", Buffer.alloc(0), 30 * 1024 * 1024 + 1)));
  await assert.rejects(cost.readFile(file("unsupported.txt", Buffer.alloc(0))));
  await assert.rejects(cost.readFile(null));
  cases += 4;
  let destroyed = 0, options;
  const pdf = costContext({ version: "6.3.289", GlobalWorkerOptions: {}, getDocument(value) {
    options = value;
    return { promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [
      { str: "品番", transform: [1,0,0,1,100,700], width: 40 }, { str: "数量", transform: [1,0,0,1,300,700], width: 40 },
      { str: "27060-TEST01", transform: [1,0,0,1,100,680], width: 90 }, { str: "9", transform: [1,0,0,1,300,680], width: 10 }
    ] }) }) }), destroy: async () => { destroyed++; } };
  } });
  const sheets = await pdf.readFile(file("合成.pdf", Buffer.from("stub; actual PDF parsing is tested in the browser")));
  assert.deepEqual(rows(pdf.analyzeMatrix(sheets[0].matrix)), [["27060-TEST01", 9]]);
  assert.equal(options.isEvalSupported, false);
  assert.equal(options.useWasm, false);
  assert.equal(options.cMapUrl, "vendor/pdfjs-6.3.289-cmaps/");
  assert.equal(options.standardFontDataUrl, "vendor/pdfjs-6.3.289-standard-fonts/");
  assert.equal(destroyed, 1);
  const broken = costContext({ version: "6.3.289", GlobalWorkerOptions: {}, getDocument() { return { promise: Promise.reject(new Error("invalid PDF")), destroy: async () => { destroyed++; } }; } });
  await assert.rejects(broken.readFile(file("broken.pdf", Buffer.from("bad"))), /invalid PDF/);
  assert.equal(destroyed, 2);
  cases += 2;
  console.log(`Document import parsers passed (${cases} cases; real XLSX/XLS/XLSM/CSV, both consumers, PDF lifecycle/options, ${inventory.files.length} byte-exact vendor files)`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
