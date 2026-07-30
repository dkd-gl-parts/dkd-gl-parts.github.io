const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

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
  },
  manufacturingCostComponentMap: {},
  manufacturingCostCoreCostForProduct() {
    return { amount: 1500, category: "starter", isCategorySpecific: true };
  }
};
vm.runInNewContext(`${helperSource}; result = { inputState: manufacturingCostComponentInputState, priceDiffers: manufacturingCostSnapshotUnitPriceDiffers, syncRow: manufacturingCostRowWithCurrentUnitPrices };`, sandbox);

const saved = [{ id: 10, component_manufacturer_part_number: "A-100", unit_price_jpy: 800, quantity: 1, replacement_rate: 100 }];
const currentSame = [{ id: 10, component_manufacturer_part_number: "A-100", unit_price_jpy: 800, quantity: 1, replacement_rate: 100 }];
const currentChanged = [{ id: 10, component_manufacturer_part_number: "A-100", unit_price_jpy: 950, quantity: 1, replacement_rate: 100 }];
if (sandbox.result.priceDiffers(saved, currentSame)) {
  throw new Error("matching saved and current unit prices must not show a snapshot warning");
}
if (!sandbox.result.priceDiffers(saved, currentChanged)) {
  throw new Error("a changed current unit price must show a snapshot warning");
}
if (sandbox.result.priceDiffers(saved, [{ id: 10, unit_price_jpy: null, quantity: 1, replacement_rate: 100 }])) {
  throw new Error("a missing current unit price must use the missing-price warning without clearing the saved price");
}

sandbox.manufacturingCostComponentMap["500"] = currentChanged;
const refreshed = sandbox.result.syncRow({
  productId: 500,
  product: { dkd_shohin_id: 500, category: "starter" },
  components: [Object.assign({ is_cost_snapshot: true }, saved[0])],
  savedSnapshotUnitPriceDiffers: true
}, { laborRate: 10, laborAmount: 100 });
if (refreshed.updatedCount !== 1 || refreshed.row.components[0].unit_price_jpy !== 950) {
  throw new Error("saving must replace a differing saved unit price with the current unit price");
}
if (refreshed.row.partsCost !== 950 || refreshed.row.laborCost !== 345 || refreshed.row.totalCost !== 2795 || refreshed.row.savedSnapshotUnitPriceDiffers) {
  throw new Error("saving a current unit price must recalculate costs and clear the difference warning");
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

const settingsSource = sourceBetween("function manufacturingCostSettings", "function manufacturingCostParseQty");
if (!source.includes("MANUFACTURING_COST_DEFAULT_LABOR_AMOUNT_JPY = 1000")) {
  throw new Error("manufacturing labor must default to 1000 yen");
}
if (!settingsSource.includes('manufacturingCostNumberFromInput("manufacturing-cost-labor-amount", MANUFACTURING_COST_DEFAULT_LABOR_AMOUNT_JPY)')) {
  throw new Error("manufacturing cost settings must use the 1000 yen labor default");
}
if (!html.includes('id="manufacturing-cost-labor-amount" type="number" min="0" step="1" value="1000"')) {
  throw new Error("manufacturing labor input must show 1000 yen by default");
}

const saveSource = sourceBetween("async function saveManufacturingCostList", "async function loadManufacturingCostList");
const syncSource = sourceBetween("async function syncManufacturingCostListItems", "async function saveManufacturingCostList");
const loadSource = sourceBetween("async function loadManufacturingCostList", "async function deleteManufacturingCostList");
[
  "loadManufacturingCostComponents",
  "loadManufacturingCostCorePolicies",
  "manufacturingCostRowWithCurrentUnitPrices",
  "var rowsToSave =",
  "syncManufacturingCostListItems",
  "manufacturingCostRows = rowsToSave",
  "manufacturingCostListItemSnapshotMap = manufacturingCostBuildSnapshotMap(items)",
  "manufacturing_cost_list_saved_current_prices"
].forEach((fragment) => {
  if (!saveSource.includes(fragment)) throw new Error(`manufacturing cost save refresh is missing: ${fragment}`);
});
if (!saveSource.includes("if (!manufacturingCostRows.length)") || saveSource.includes("!manufacturingCostRows.length && !selected")) {
  throw new Error("saving must reject an empty working list before changing its saved data");
}
[
  '.select("id,dkd_shohin_id")',
  '.upsert(items.slice(i, i + 200), { onConflict: "list_id,dkd_shohin_id" })',
  '.in("id", staleIds.slice(j, j + 200))'
].forEach((fragment) => {
  if (!syncSource.includes(fragment)) throw new Error(`safe manufacturing cost item sync is missing: ${fragment}`);
});
if (syncSource.indexOf(".upsert(") > syncSource.indexOf(".delete()")) {
  throw new Error("saved manufacturing cost items must be upserted before stale rows are deleted");
}
if (saveSource.includes('.delete().eq("list_id", listId)')) {
  throw new Error("saving must not delete all existing manufacturing cost items before replacement rows succeed");
}
if (!saveSource.includes("labor_amount_jpy: settings.laborAmount")) {
  throw new Error("the entered manufacturing labor amount must be saved on the list");
}
if (!loadSource.includes("selected.labor_amount_jpy == null ? MANUFACTURING_COST_DEFAULT_LABOR_AMOUNT_JPY : selected.labor_amount_jpy")) {
  throw new Error("loading a list must restore its saved manufacturing labor amount");
}
if (!loadSource.includes("if (!itemRows.length) throw new Error")) {
  throw new Error("an empty damaged saved list must not report a successful load");
}

async function verifySafeItemSync() {
  const operations = [];
  const syncSandbox = {
    t: (key) => key,
    sb: {
      from(table) {
        if (table !== "manufacturing_cost_list_items") throw new Error(`unexpected table: ${table}`);
        return {
          select() {
            return {
              async eq() {
                operations.push({ type: "select" });
                return { data: [{ id: 1, dkd_shohin_id: 101 }, { id: 2, dkd_shohin_id: 102 }], error: null };
              }
            };
          },
          async upsert(items, options) {
            operations.push({ type: "upsert", items, options });
            return { data: null, error: null };
          },
          delete() {
            return {
              eq() {
                return {
                  async in(column, ids) {
                    operations.push({ type: "delete", column, ids });
                    return { data: null, error: null };
                  }
                };
              }
            };
          }
        };
      }
    }
  };
  vm.runInNewContext(`${syncSource}; result = syncManufacturingCostListItems;`, syncSandbox);
  const items = [{ list_id: 4, dkd_shohin_id: 101 }, { list_id: 4, dkd_shohin_id: 103 }];
  const result = await syncSandbox.result(4, items);
  if (result.error || operations.map((operation) => operation.type).join(",") !== "select,upsert,delete") {
    throw new Error("safe item sync must read existing rows, upsert replacements, then delete stale rows");
  }
  if (operations[1].options.onConflict !== "list_id,dkd_shohin_id" || operations[2].column !== "id" || String(operations[2].ids) !== "2") {
    throw new Error("safe item sync must retain current products and delete only the stale row id");
  }
}

verifySafeItemSync().then(() => {
  console.log("manufacturing cost snapshot status guard passed");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
