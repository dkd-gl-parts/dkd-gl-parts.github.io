const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "manufacturing-cost-import.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const build = fs.readFileSync(path.join(root, "scripts", "build-static-site.js"), "utf8");

function sourceBetween(startText, endText) {
  const start = app.indexOf(startText);
  const end = app.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return app.slice(start, end);
}

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
    (app.match(/manufacturing_cost_import_search_selected_n:/g) || []).length !== 3 ||
    (app.match(/manufacturing_cost_import_unregistered_title:/g) || []).length !== 3 ||
    (app.match(/manufacturing_cost_import_result_summary:/g) || []).length !== 3) {
  throw new Error("manufacturing cost import translations must cover all supported languages");
}
if (!source.includes("file.arrayBuffer()") || source.includes("fetch(file") || source.includes("FormData")) {
  throw new Error("pallet files must be parsed locally without uploading the file");
}
if (!source.includes('dcats:manufacturing-cost-import-search') || !source.includes("parts: values.slice()")) {
  throw new Error("imported part numbers must be handed to the candidate search with their source context");
}
if (!styles.includes(".manufacturing-cost-import-result-group") ||
    !styles.includes(".manufacturing-cost-import-unregistered")) {
  throw new Error("grouped candidates and unregistered imported parts must have dedicated layouts");
}

const masterSearchSource = sourceBetween("async function fetchCoreProductMasterMatches", "async function runProductSearch");
if (!masterSearchSource.includes("options.exactOnly") ||
    masterSearchSource.indexOf("options.exactOnly") > masterSearchSource.indexOf("search_core_products_by_prefix_fast")) {
  throw new Error("imported part matching must stop after exact product-master lookup before prefix search");
}

const groupedFetchSource = sourceBetween("async function fetchManufacturingCostProducts", "async function fetchManufacturingCostProductsByIds");
const fetchCalls = [];
const fetchSandbox = {
  fetchCoreProductMasterMatches: async (token, category, limit, options) => {
    fetchCalls.push({ token, category, limit, options });
    if (token === "MISSING") return { data: [], error: null };
    return { data: [
      { dkd_shohin_id: 101, genuine_part_number: token },
      { dkd_shohin_id: 102, genuine_part_number: token }
    ], error: null };
  },
  fetchCategoryProducts: async () => ({ data: [], error: null }),
  normalizeCoreProductFastRows: (rows) => rows,
  filterVisibleProducts: (rows) => rows,
  productDkdId: (row) => row.dkd_shohin_id
};
vm.runInNewContext(`${groupedFetchSource}; result = fetchManufacturingCostProducts;`, fetchSandbox);

const groupedRenderSource = sourceBetween("function renderManufacturingCostCandidateRow", "function selectedManufacturingCostCandidateProducts");
const candidateWrap = { innerHTML: "" };
const renderSandbox = {
  manufacturingCostCandidateRows: [],
  manufacturingCostCandidateMode: "",
  manufacturingCostCandidateGroups: [],
  document: { getElementById: (id) => id === "manufacturing-cost-candidates" ? candidateWrap : null },
  productDkdId: (row) => row.dkd_shohin_id,
  renderManufacturingCostCandidateStatusLabels: () => "",
  manufacturingCostProductTitle: (row) => row.genuine_part_number,
  manufacturingCostCurrentProductIdMap: () => ({}),
  renderManufacturingCostCandidateEmpty: () => { throw new Error("grouped zero-match imports must not collapse to the generic empty state"); },
  esc: (value) => String(value),
  tCat: (value) => value,
  t: (key) => ({
    manufacturing_cost_candidate_badge: "候補",
    manufacturing_cost_candidate_title: "候補品番",
    manufacturing_cost_import_exact_note: "完全一致",
    manufacturing_cost_select_all: "全選択",
    manufacturing_cost_clear_selection: "全解除",
    manufacturing_cost_calc_selected: "計算",
    manufacturing_cost_import_unregistered_note: "完全一致なし",
    manufacturing_cost_import_result_limit: "一部省略"
  })[key] || key,
  tf: (key, values) => `${key}:${Object.values(values).join("/")}`
};
vm.runInNewContext(`${groupedRenderSource}; result = renderManufacturingCostCandidates;`, renderSandbox);

(async () => {
  const result = await fetchSandbox.result(["31100-76G10", "MISSING"], "starter", {
    groupByToken: true,
    exactOnly: true
  });
  if (result.data.length !== 2 || result.groups.length !== 2 ||
      result.groups[0].token !== "31100-76G10" || result.groups[0].matchCount !== 2 ||
      result.groups[1].token !== "MISSING" || result.groups[1].matchCount !== 0) {
    throw new Error("import candidates must retain exact per-input grouping, including zero-match parts");
  }
  if (fetchCalls.length !== 2 || fetchCalls.some((call) => !call.options || call.options.exactOnly !== true)) {
    throw new Error("every imported part must use exact-only product-master matching");
  }
  renderSandbox.result([], "import", [{ token: "NOT-IN-MASTER", candidates: [], matchCount: 0, truncated: false }]);
  if (!candidateWrap.innerHTML.includes("manufacturing-cost-import-unregistered") ||
      !candidateWrap.innerHTML.includes("NOT-IN-MASTER")) {
    throw new Error("zero-match imported parts must remain visible as product-master registrations missing");
  }
  renderSandbox.result(result.data, "import", result.groups);
  if (!candidateWrap.innerHTML.includes("manufacturing-cost-import-result-group") ||
      !candidateWrap.innerHTML.includes("31100-76G10") ||
      !candidateWrap.innerHTML.includes("MISSING")) {
    throw new Error("matched and unregistered imported part numbers must render in separate grouped sections");
  }
  console.log("manufacturing cost variable-layout import guard passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
