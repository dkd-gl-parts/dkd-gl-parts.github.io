const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "manufacturing-cost-import.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const build = fs.readFileSync(path.join(root, "scripts", "build-static-site.js"), "utf8");

const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: "manufacturing-cost-import.js" });
const api = sandbox.window.DcatsManufacturingCostImport;
if (!api) throw new Error("manufacturing cost import test API is missing");

const attachedLayout = [
  ["パレットNO", "", "品　番", "単位重量", "数　量", "合計", "重　量"],
  ["CAGE NO", "ITEM", "Parts No", "Parts Weight", "Quantity", "Total Amount", "Weight(gross)"],
  ["", "", "", "", "", 918, ""],
  ["A-1", "ALT", "31400-75F02", 4, 9, 139, 36],
  ["", "", "31400-73H01", 4, 10, "", 40],
  ["", "", "21400-58J10", 4.14, 120, "", 496.8],
  ["", "", "", "", "", "", ""],
  ["A-2", "ALT", "27060-B2030", 4.14, 154, 154, 637.56],
  ["A-3", "ALT", "31400-75F02", 4, 11, 11, 44]
];
const attached = api.analyzeMatrix(attachedLayout);
if (attached.mapping.headerRow !== 1 || attached.mapping.partColumn !== 2 || attached.mapping.quantityColumn !== 4) {
  throw new Error(`attached workbook mapping failed: ${JSON.stringify(attached.mapping)}`);
}
if (attached.rows.length !== 4) throw new Error(`attached workbook rows failed: ${attached.rows.length}`);
const duplicate = attached.rows.find((row) => row.part === "31400-75F02");
if (!duplicate || duplicate.quantity !== 20 || duplicate.sourceRows.length !== 2) {
  throw new Error("duplicate part quantities must be merged with source evidence");
}

const shiftedLayout = [
  ["CONTAINER 18", "", "", ""],
  ["2026-09-15", "", "", ""],
  ["note", "", "", ""],
  ["Item", "OEM No.", "Description", "PCS"],
  [1, "SM-760-01", "STARTER", 15],
  [2, "28100-B5030", "STARTER", 42]
];
const shifted = api.analyzeMatrix(shiftedLayout);
if (shifted.mapping.headerRow !== 3 || shifted.mapping.partColumn !== 1 || shifted.mapping.quantityColumn !== 3 || shifted.rows.length !== 2) {
  throw new Error(`shifted workbook mapping failed: ${JSON.stringify(shifted.mapping)}`);
}

const noHeader = api.analyzeMatrix([
  ["CGH82", 9],
  ["MD362184", 24],
  ["CSD73", ""]
]);
if (noHeader.mapping.headerRow !== -1 || noHeader.mapping.partColumn !== 0 || noHeader.rows.length !== 3) {
  throw new Error(`headerless mapping failed: ${JSON.stringify(noHeader.mapping)}`);
}
if (noHeader.rows.find((row) => row.part === "CSD73").quantity !== null) {
  throw new Error("missing quantity must remain unavailable instead of becoming zero");
}

const pdfMatrix = api.matrixFromPdfItems([
  { str: "Parts No", transform: [1, 0, 0, 1, 100, 700], width: 45 },
  { str: "Quantity", transform: [1, 0, 0, 1, 300, 700], width: 42 },
  { str: "31400-75F02", transform: [1, 0, 0, 1, 100, 680], width: 70 },
  { str: "9", transform: [1, 0, 0, 1, 300, 680], width: 7 },
  { str: "SM-760-01", transform: [1, 0, 0, 1, 100, 660], width: 55 },
  { str: "15", transform: [1, 0, 0, 1, 300, 660], width: 14 }
]);
const pdf = api.analyzeMatrix(pdfMatrix);
if (pdf.rows.length !== 2 || pdf.mapping.partColumn === pdf.mapping.quantityColumn) {
  throw new Error(`PDF position reconstruction failed: ${JSON.stringify(pdf.mapping)}`);
}

const combined = api.combineAnalyses([
  { sheet: { name: "ALT" }, rows: [{ key: "31400-75F02", part: "31400-75F02", quantity: 9, sourceRows: [4], confidence: "high" }], ignoredRows: 0 },
  { sheet: { name: "STA" }, rows: [{ key: "31400-75F02", part: "31400-75F02", quantity: 11, sourceRows: [8], confidence: "medium" }], ignoredRows: 1 }
]);
if (combined.rows.length !== 1 || combined.rows[0].quantity !== 20 || combined.duplicateCount !== 1 || combined.rows[0].confidence !== "medium") {
  throw new Error("cross-sheet duplicate aggregation failed");
}

[
  "btn-manufacturing-cost-import-open",
  "manufacturing-cost-import-overlay",
  "manufacturing-cost-import-file",
  "manufacturing-cost-import-sheet",
  "manufacturing-cost-import-header-row",
  "manufacturing-cost-import-part-column",
  "manufacturing-cost-import-quantity-column",
  "manufacturing-cost-import-preview",
  "btn-manufacturing-cost-import-search"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) throw new Error(`missing manufacturing cost import control: ${id}`);
});

if (!html.includes('manufacturing-cost-import.js?v=') || !build.includes('"manufacturing-cost-import.js"')) {
  throw new Error("manufacturing cost import asset must be loaded and included in the static build");
}
if (!styles.includes(".form-card.manufacturing-cost-import-card") || !styles.includes(".manufacturing-cost-import-confidence.high")) {
  throw new Error("manufacturing cost import desktop and confidence styles are missing");
}
if ((app.match(/manufacturing_cost_import_open:/g) || []).length !== 3 ||
    (app.match(/manufacturing_cost_import_pdf_no_text:/g) || []).length !== 3 ||
    (app.match(/manufacturing_cost_import_search_selected_n:/g) || []).length !== 3) {
  throw new Error("manufacturing cost import translations must cover all supported languages");
}
if (!source.includes("file.arrayBuffer()") || source.includes("fetch(file") || source.includes("FormData")) {
  throw new Error("pallet files must be parsed locally without uploading the file");
}

console.log("manufacturing cost variable-layout import guard passed");
