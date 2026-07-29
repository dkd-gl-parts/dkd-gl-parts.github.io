const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

const removeSource = sourceBetween("function removeManufacturingCostTarget", "function renderManufacturingCostRows");
const sandbox = {
  manufacturingCostRows: [
    { productId: 101, product: { manufacturer_part_number: "A-101" } },
    { productId: 102, product: { manufacturer_part_number: "A-102" } }
  ],
  manufacturingCostListItemSnapshotMap: { "101": { saved: true }, "102": { saved: true } },
  manufacturingCostCandidateRows: [],
  manufacturingCostCandidateMode: "",
  canEditManufacturingCostMgmt: () => true,
  manufacturingCostProductTitle: (product) => product.manufacturer_part_number,
  t: (key) => key,
  tf: (key, values) => `${key}:${values.part}`,
  confirm: () => true,
  alert: () => { throw new Error("permission alert must not be shown"); },
  renderManufacturingCostRows: () => { sandbox.rendered = true; },
  renderManufacturingCostCandidates: () => {},
  setManufacturingCostListStatus: (message, isError) => { sandbox.status = { message, isError }; }
};
vm.runInNewContext(`${removeSource}; result = removeManufacturingCostTarget;`, sandbox);
sandbox.result("101");
if (sandbox.manufacturingCostRows.length !== 1 || sandbox.manufacturingCostRows[0].productId !== 102) {
  throw new Error("removing a manufacturing cost target must preserve all other rows");
}
if (sandbox.manufacturingCostListItemSnapshotMap["101"] || !sandbox.manufacturingCostListItemSnapshotMap["102"]) {
  throw new Error("removing a target must remove only its pending saved snapshot");
}
if (!sandbox.rendered || !sandbox.status || sandbox.status.isError) {
  throw new Error("removing a target must rerender the working list and show a save-required status");
}

const rowRenderer = sourceBetween("function renderManufacturingCostRows", "function manufacturingCostExportFileName");
if (!rowRenderer.includes("data-manufacturing-cost-remove-id") || !rowRenderer.includes("canEditManufacturingCostMgmt()")) {
  throw new Error("editable manufacturing cost rows must provide a per-product remove action");
}
const saveSource = sourceBetween("async function saveManufacturingCostList", "async function loadManufacturingCostList");
if (!saveSource.includes("!manufacturingCostRows.length && !selected")) {
  throw new Error("an existing saved list must allow its final target row to be removed and saved");
}
if (!source.includes('closest("[data-manufacturing-cost-remove-id]")')) {
  throw new Error("the manufacturing cost remove action must be delegated from the result list");
}
if (!styles.includes(".manufacturing-cost-target-actions")) {
  throw new Error("the manufacturing cost remove action must keep a stable layout");
}
if ((source.match(/manufacturing_cost_remove_target:/g) || []).length !== 3) {
  throw new Error("the manufacturing cost remove action must be translated for all supported languages");
}

console.log("manufacturing cost target removal guard passed");
