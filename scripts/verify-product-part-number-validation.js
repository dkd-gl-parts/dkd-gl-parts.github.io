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
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${normalizerSource}\n${validationSource}`, sandbox);

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

console.log("Product part-number validation verified.");
