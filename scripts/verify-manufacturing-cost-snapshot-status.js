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

const helperSource = sourceBetween("function manufacturingCostComponentCalc", "function manufacturingCostSnapshotNumber");
const sandbox = {
  manufacturingCostParseQty(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 1;
  },
  manufacturingCostParseRate(value) {
    if (value === null || value === undefined || String(value).trim() === "") return 100;
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 100;
  }
};
vm.runInNewContext(`${helperSource}; result = { inputState: manufacturingCostComponentInputState, priceDiffers: manufacturingCostSnapshotUnitPriceDiffers };`, sandbox);

const saved = [{ id: 10, component_manufacturer_part_number: "A-100", unit_price_jpy: 800, quantity: 1, replacement_rate: 100 }];
const currentSame = [{ id: 10, component_manufacturer_part_number: "A-100", unit_price_jpy: 800, quantity: 1, replacement_rate: 100 }];
const currentChanged = [{ id: 10, component_manufacturer_part_number: "A-100", unit_price_jpy: 950, quantity: 1, replacement_rate: 100 }];
if (sandbox.result.priceDiffers(saved, currentSame)) {
  throw new Error("matching saved and current unit prices must not show a snapshot warning");
}
if (!sandbox.result.priceDiffers(saved, currentChanged)) {
  throw new Error("a changed current unit price must show a snapshot warning");
}

const complete = sandbox.result.inputState(currentSame[0]);
if (!complete.hasUnit || !complete.hasQuantity || !complete.hasReplacementRate) {
  throw new Error("complete component cost inputs must not produce confirmation warnings");
}
const incomplete = sandbox.result.inputState({ unit_price_jpy: 800, quantity: "", replacement_rate: null });
if (!incomplete.hasUnit || incomplete.hasQuantity || incomplete.hasReplacementRate) {
  throw new Error("missing quantity and replacement rate must remain visible as confirmation warnings");
}

const rowRenderer = sourceBetween("function renderManufacturingCostRows", "function manufacturingCostExportFileName");
[
  "row.missingQuantityCount",
  "row.missingReplacementRateCount",
  "row.savedSnapshotUnitPriceDiffers",
  "notes.length ? \"<div class='manufacturing-cost-missing'"
].forEach((fragment) => {
  if (!rowRenderer.includes(fragment)) throw new Error(`manufacturing cost confirmation is missing: ${fragment}`);
});
if (rowRenderer.includes("manufacturing-cost-note'>-")) {
  throw new Error("a complete manufacturing cost row must leave the confirmation cell empty");
}
if (source.includes("manufacturing_cost_saved_snapshot_used")) {
  throw new Error("saved snapshot must not be shown without a current unit-price difference");
}
if ((source.match(/manufacturing_cost_snapshot_unit_price_changed:/g) || []).length !== 3) {
  throw new Error("snapshot unit-price difference must be translated for all supported languages");
}

console.log("manufacturing cost snapshot status guard passed");
