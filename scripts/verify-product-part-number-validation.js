const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

const normalizerSource = sourceBetween("function normalizeAsciiWidth", "function isPC");
const validationSource = sourceBetween("function normalizePartQuery", "function normalizedPartKey");
const normalizedKeySource = sourceBetween("function normalizedPartKey", "function uniqueTextValues");
const duplicateGuidanceSource = sourceBetween("function isCoreProductRegularPairConflict", "async function saveCoreProductForm");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${normalizerSource}\n${validationSource}\n${normalizedKeySource}\n${duplicateGuidanceSource}`, sandbox);

const validate = sandbox.validateProductPartNumberPair;
if (typeof validate !== "function") throw new Error("Product part-number pair validator is missing");

const cases = [
  ["", "", "required_part_number"],
  ["28100-B2150", "", ""],
  ["", "428000-5810", ""],
  ["28100-B2150", "28100-B2150", "duplicate_part_number"],
  ["２８１００－Ｂ２１５０", "28100-B2150", "duplicate_part_number"],
  ["28100 B2150", "28100-B2150", "duplicate_part_number"],
  ["28100-B2150", "428000-5810", ""]
];
for (const [genuine, manufacturer, expected] of cases) {
  const actual = validate(genuine, manufacturer);
  if (actual !== expected) {
    throw new Error(`Unexpected validation for ${genuine} / ${manufacturer}: ${actual}`);
  }
}

const legacySave = sourceBetween("async function savePartForm", "async function enterCoreListMgmt");
const coreSave = sourceBetween("async function saveCoreProductForm", "async function deletePart");
for (const [name, block] of [["parts", legacySave], ["core_products", coreSave]]) {
  if (!block.includes("validateProductPartNumberPair")) {
    throw new Error(`${name} save path does not enforce shared part-number validation`);
  }
}

for (const message of [
  "純正品番とメーカー品番に同じ品番は登録できません",
  "Genuine and manufacturer part numbers must be different.",
  "纯正品号与制造商品号不能相同。"
]) {
  if (!source.includes(message)) throw new Error(`Missing translated validation message: ${message}`);
}

async function verifyDuplicateGuidance() {
  const duplicateError = {
    code: "23505",
    message: 'duplicate key value violates unique constraint "core_products_unique_regular_pair"'
  };
  if (!sandbox.isCoreProductRegularPairConflict(duplicateError)) throw new Error("Regular-pair conflict was not recognized");
  if (sandbox.isCoreProductRegularPairConflict({ code: "23505", message: "another_unique_index" })) {
    throw new Error("Unrelated uniqueness conflict was misidentified");
  }

  const filters = [];
  let lookupRows = [{ dkd_shohin_id: 2639, manufacturer: "DENSO" }];
  sandbox.sb = {
    from(table) {
      if (table !== "core_products") throw new Error(`Unexpected lookup table: ${table}`);
      return {
        select(columns) {
          if (columns !== "dkd_shohin_id,manufacturer") throw new Error("Duplicate lookup selects unexpected columns");
          return this;
        },
        eq(column, value) { filters.push([column, value]); return this; },
        then(resolve) { resolve({ data: lookupRows, error: null }); }
      };
    }
  };
  sandbox.console = { warn() {} };
  const payload = {
    category_code: "alternator",
    genuine_part_number: "27060-30220",
    manufacturer_part_number: "104210-1870",
    manufacturer: "denso"
  };
  const found = await sandbox.findCoreProductRegularPair(payload);
  if (!found || found.dkd_shohin_id !== 2639) throw new Error("Existing DENSO product was not found");
  for (const [column, value] of [
    ["category_code", "alternator"],
    ["normalized_genuine_part_number", "2706030220"],
    ["normalized_manufacturer_part_number", "1042101870"]
  ]) {
    if (!filters.some(([actualColumn, actualValue]) => actualColumn === column && actualValue === value)) {
      throw new Error(`Missing duplicate lookup filter ${column}=${value}`);
    }
  }
  lookupRows = [{ dkd_shohin_id: 9999, manufacturer: "OTHER" }];
  if (await sandbox.findCoreProductRegularPair(payload)) throw new Error("Different manufacturer matched the existing product");
  filters.length = 0;
  if (await sandbox.findCoreProductRegularPair({ ...payload, category_code: "ac_compressor" })) {
    throw new Error("AC compressor incorrectly used the regular-pair constraint");
  }
  if (filters.length) throw new Error("AC compressor should not perform a regular-pair lookup");
  if (await sandbox.findCoreProductRegularPair({ ...payload, genuine_part_number: "かな" })) {
    throw new Error("An empty normalized key incorrectly matched a product");
  }
  if (filters.length) throw new Error("An empty normalized key should not trigger a lookup");

  const opened = [];
  const overlay = { classList: { remove(name) { if (name !== "show") throw new Error("Overlay was not closed"); } } };
  const search = { value: "" };
  sandbox.document = {
    createElement(tag) {
      if (tag !== "button") throw new Error(`Unexpected element: ${tag}`);
      return { addEventListener(event, listener) { this[event] = listener; } };
    },
    getElementById(id) { return id === "part-form-overlay" ? overlay : id === "parts-mgmt-search" ? search : null; }
  };
  sandbox.t = key => key;
  sandbox.tf = (key, vars) => `${key}:${vars.id}`;
  sandbox.openProductByDkdId = async id => opened.push(["sales", id]);
  sandbox.openProductionProductByDkdId = async id => opened.push(["production", id]);
  sandbox.loadPartsMgmt = async () => opened.push(["management", search.value]);
  for (const context of ["sales", "production", "management"]) {
    const error = { textContent: "", appendChild(button) { this.button = button; } };
    sandbox.showCoreProductRegularPairConflict(error, found, context);
    if (error.textContent !== "core_product_existing_pair:2639" || !error.button || error.button.type !== "button") {
      throw new Error(`Existing-product guidance missing in ${context}`);
    }
    await error.button.click();
  }
  if (JSON.stringify(opened) !== JSON.stringify([["sales", 2639], ["production", 2639], ["management", "2639"]])) {
    throw new Error("Existing-product button opened the wrong destination");
  }
  const unknownError = { textContent: "", appendChild() { throw new Error("Unknown product should not have a button"); } };
  sandbox.showCoreProductRegularPairConflict(unknownError, null, "sales");
  if (unknownError.textContent !== "core_product_existing_pair_unknown") throw new Error("Unknown duplicate guidance missing");

  const preflight = coreSave.indexOf("var existingProduct = await findCoreProductRegularPair(payload)");
  const insert = coreSave.indexOf('sb.from("core_products").insert(payload)');
  if (preflight < 0 || insert < 0 || preflight >= insert) throw new Error("Duplicate preflight must precede insertion");
  if (!coreSave.includes("if (isCoreProductRegularPairConflict(r.error))")) {
    throw new Error("Concurrent duplicate insert is not handled");
  }
}

verifyDuplicateGuidance().then(() => console.log("Product part-number validation and duplicate guidance verified.")).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
