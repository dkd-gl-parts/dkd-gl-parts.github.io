const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

const checks = [
  { value: "101", checked: true },
  { value: "102", checked: false }
];
const overlay = { classList: { remove: () => { sandbox.closed = true; } } };
const deleteList = {
  querySelectorAll: (selector) => selector.includes(":checked") ? checks.filter((check) => check.checked) : checks
};
const removeSource = sourceBetween("function setManufacturingCostTargetDeleteStatus", "function renderManufacturingCostRows");
const sandbox = {
  manufacturingCostRows: [
    { productId: 101, product: { manufacturer_part_number: "A-101" } },
    { productId: 102, product: { manufacturer_part_number: "A-102" } }
  ],
  manufacturingCostListItemSnapshotMap: { "101": { saved: true }, "102": { saved: true } },
  manufacturingCostCandidateRows: [],
  manufacturingCostCandidateMode: "",
  canEditManufacturingCostMgmt: () => true,
  t: (key) => key,
  tf: (key, values) => `${key}:${values.n}`,
  confirm: () => true,
  alert: () => { throw new Error("permission alert must not be shown"); },
  document: {
    getElementById: (id) => {
      if (id === "manufacturing-cost-target-delete-list") return deleteList;
      if (id === "manufacturing-cost-target-delete-overlay") return overlay;
      return null;
    }
  },
  renderManufacturingCostRows: () => { sandbox.rendered = true; },
  renderManufacturingCostCandidates: () => {},
  setManufacturingCostListStatus: (message, isError) => { sandbox.status = { message, isError }; }
};
vm.runInNewContext(`${removeSource}; result = removeSelectedManufacturingCostTargets;`, sandbox);
sandbox.result();
if (sandbox.manufacturingCostRows.length !== 1 || sandbox.manufacturingCostRows[0].productId !== 102) {
  throw new Error("batch removal must preserve unselected manufacturing cost targets");
}
if (sandbox.manufacturingCostListItemSnapshotMap["101"] || !sandbox.manufacturingCostListItemSnapshotMap["102"]) {
  throw new Error("batch removal must delete only selected pending snapshots");
}
if (!sandbox.closed || !sandbox.rendered || !sandbox.status || sandbox.status.isError) {
  throw new Error("batch removal must close the dialog, rerender the list, and show a save-required status");
}

const rowRenderer = sourceBetween("function renderManufacturingCostRows", "function manufacturingCostExportFileName");
if (rowRenderer.includes("data-manufacturing-cost-remove-id") || rowRenderer.includes("manufacturing-cost-target-actions")) {
  throw new Error("the manufacturing cost table must not contain per-row remove controls");
}
const saveSource = sourceBetween("async function saveManufacturingCostList", "async function loadManufacturingCostList");
if (!saveSource.includes("!manufacturingCostRows.length && !selected")) {
  throw new Error("an existing saved list must allow its final target row to be removed and saved");
}
[
  "btn-manufacturing-cost-remove-open",
  "manufacturing-cost-target-delete-overlay",
  "manufacturing-cost-target-delete-list",
  "btn-manufacturing-cost-remove-selected"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) throw new Error(`missing manufacturing cost removal dialog control: ${id}`);
});
if (!source.includes('querySelectorAll("[data-manufacturing-cost-delete-check]:checked")')) {
  throw new Error("the removal dialog must collect checked targets");
}
if (!source.includes('addEventListener("click", openManufacturingCostTargetDelete)')) {
  throw new Error("the manufacturing cost removal dialog must open from its dedicated button");
}
if (!styles.includes(".manufacturing-cost-target-delete-card") || styles.includes(".manufacturing-cost-target-actions")) {
  throw new Error("the removal dialog must have dedicated layout without legacy row-action styles");
}
if ((source.match(/manufacturing_cost_remove_open:/g) || []).length !== 3 ||
    (source.match(/manufacturing_cost_remove_selected:/g) || []).length !== 3) {
  throw new Error("the manufacturing cost removal dialog must be translated for all supported languages");
}

console.log("manufacturing cost target removal guard passed");
