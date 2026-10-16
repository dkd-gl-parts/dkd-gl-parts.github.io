"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const ast = acorn.parse(source, { ecmaVersion: "latest" });
const names = ["resetManufacturingCostWorkingList", "clearManufacturingCostQueryInput", "manufacturingCostTokens",
  "setManufacturingCostImportSearchContext", "clearManufacturingCostImportSearchContext",
  "activeManufacturingCostImportSearchContext", "searchManufacturingCostCandidates", "manufacturingCostImportPartNumbersForRow", "manufacturingCostImportQuantitiesForRow", "captureManufacturingCostImportQuantities", "saveManufacturingCostList", "loadManufacturingCostList"];
const code = names.map(name => {
  const node = ast.body.find(n => n.type === "FunctionDeclaration" && n.id.name === name);
  assert(node, name);
  return source.slice(node.start, node.end);
}).join("\n");
const listeners = ast.body.filter(n => n.type === "ExpressionStatement" && /^(document\.getElementById\("(?:manufacturing-cost-query|btn-manufacturing-cost-new-list|btn-manufacturing-cost-query-clear)"\)|document\.addEventListener\("dcats:manufacturing-cost-import-search")/.test(source.slice(n.start, n.end))).map(n => source.slice(n.start, n.end)).join("\n");
function element() {
  return { value: "", innerHTML: "candidates with manual checks", textContent: "", disabled: false, open: false, handlers: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener(type, fn) { this.handlers[type] = fn; }, click() { this.handlers.click?.(); }, focus() { this.focused = true; } };
}
async function verify() {
  const elements = {};
  const get = id => elements[id] ||= element();
  const events = {}, calls = [];
  let allowed = true;
  const context = {
    window: {}, MutationObserver: class { observe() {} },
    document: { readyState: "complete", documentElement: {}, getElementById: get,
      addEventListener(type, fn) { events[type] = fn; }, dispatchEvent(event) { events[event.type]?.(event); } },
    normalizeAsciiWidth: x => x.normalize("NFKC"), normalizePartQuery: x => x.toUpperCase().replace(/[-\s]/g, ""),
    manufacturingCostImportSearchContext: null, manufacturingCostOperation: null, manufacturingCostActiveListId: 9,
    manufacturingCostListItemSnapshotMap: { 1: { import_part_numbers: ["ORIGINAL"] } },
    manufacturingCostImportedQuantityByProduct: {},
    manufacturingCostRows: [{ productId: 1 }], manufacturingCostCandidateRows: [{ dkd_shohin_id: 1 }],
    manufacturingCostCandidateGroups: [{ token: "PALLET-1", candidates: [{ dkd_shohin_id: 1 }] }],
    manufacturingCostCandidateMode: "import", manufacturingCostCandidateStatusMap: {}, manufacturingCostCandidateRequestSeq: 0,
    manufacturingCostImportHistory: { byToken: {} }, productDkdId: p => p.dkd_shohin_id,
    manufacturingCostCurrentProductIdMap: () => Object.fromEntries(context.manufacturingCostRows.map(row => [String(row.productId), true])),
    canViewManufacturingCostMgmt: () => allowed, alert() { calls.push("denied"); }, t: key => key,
    tf: (key, values) => key + JSON.stringify(values), esc: x => x, console: { warn() {} },
    setManufacturingCostListStatus() {},
    beginManufacturingCostOperation() { context.manufacturingCostOperation = {}; return context.manufacturingCostOperation; },
    finishManufacturingCostOperation() { context.manufacturingCostOperation = null; }, updateManufacturingCostOperation() {},
    fetchManufacturingCostProducts: async (tokens, category, options) => { calls.push({ tokens: Array.from(tokens), options }); return { data: [], groups: [] }; },
    loadManufacturingCostCandidateStatuses: async () => {}, loadManufacturingCostImportHistory: async () => ({ byToken: {} }),
    renderManufacturingCostCandidates() {}, renderManufacturingCostEmpty() { throw Error("Working content must survive"); }
  };
  context.window.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  vm.createContext(context);
  vm.runInContext(code + "\n" + listeners, context);
  get("btn-manufacturing-cost-calc").handlers.click = () => context.searchManufacturingCostCandidates();
  vm.runInContext(fs.readFileSync(path.join(root, "manufacturing-cost-import.js"), "utf8"), context);
  const state = context.window.DcatsManufacturingCostImport._state;
  const parts = Array.from({ length: 200 }, (_, i) => "PALLET-" + (i + 1));
  state.sheets = [{ key: "sheet-0", name: "Pallet", matrix: [["Parts No", "Quantity"], ...parts.map(p => [p, 1])] }];
  state.selectedParts = Object.fromEntries(parts.map(p => [p, true]));
  get("manufacturing-cost-query").value = "STALE-MANUAL-QUERY";
  get("btn-manufacturing-cost-import-search").click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(get("manufacturing-cost-query").value, "", "Import must not fill the editable query with 200 parts");
  assert.deepEqual(calls[0].tokens, parts, "Only the selected pallet parts form the new import");
  assert.equal(calls[0].options.exactOnly, true);
  assert.equal(context.manufacturingCostImportSearchContext.quantities.length, 200);
  assert.equal(context.manufacturingCostImportSearchContext.quantities[0].quantity, 1);
  context.manufacturingCostCandidateMode = "import";
  context.manufacturingCostCandidateGroups = [{ token: "PALLET-1", candidates: [{ dkd_shohin_id: 1 }] }];
  context.captureManufacturingCostImportQuantities();
  assert.equal(context.manufacturingCostImportQuantitiesForRow({ productId: 1 })[0].quantity, 1);
  context.captureManufacturingCostImportQuantities();
  assert.equal(context.manufacturingCostImportQuantitiesForRow({ productId: 1 }).length, 1, "recalculation replaces same source instead of adding twice");
  context.manufacturingCostImportedQuantityByProduct = {};
  context.manufacturingCostListItemSnapshotMap[1].import_quantities_snapshot = [{ part_number: "SAVED-1", quantity: 12 }];
  assert.equal(context.manufacturingCostImportQuantitiesForRow({ productId: 1 })[0].quantity, 12, "loaded snapshot survives without import context");
  context.captureManufacturingCostImportQuantities();
  assert.equal(context.manufacturingCostImportQuantitiesForRow({ productId: 1 }).length, 2, "additional imports preserve earlier sources");
  context.manufacturingCostRows.push({ productId: 2 });
  context.manufacturingCostCandidateGroups[0].candidates.push({ dkd_shohin_id: 2 });
  context.captureManufacturingCostImportQuantities();
  assert.equal(context.manufacturingCostImportQuantitiesForRow({ productId: 1 }).find(q => q.part_number === "PALLET-1").quantity, null, "ambiguous source cannot duplicate a quantity across products");
  context.manufacturingCostRows.pop();
  context.manufacturingCostCandidateGroups[0].candidates.pop();
  context.manufacturingCostImportedQuantityByProduct = {};
  delete context.manufacturingCostListItemSnapshotMap[1].import_quantities_snapshot;
  get("manufacturing-cost-candidates").innerHTML = "candidates with manual checks";
  const imported = context.manufacturingCostImportSearchContext;
  const before = [context.manufacturingCostCandidateRows, context.manufacturingCostCandidateGroups, context.manufacturingCostRows, context.manufacturingCostListItemSnapshotMap];
  get("manufacturing-cost-query").value = "EXTRA-1";
  get("manufacturing-cost-query").handlers.input?.();
  assert.equal(context.manufacturingCostImportSearchContext, imported);
  get("btn-manufacturing-cost-query-clear").click();
  assert.equal(get("manufacturing-cost-query").value, "");
  get("manufacturing-cost-saved-list").value = "9";
  get("manufacturing-cost-list-name").value = "Old saved list";
  get("btn-manufacturing-cost-new-list").click();
  assert.equal(context.manufacturingCostActiveListId, null);
  assert.equal(get("manufacturing-cost-saved-list").value, "");
  assert.equal(get("manufacturing-cost-list-name").value, "");
  assert(get("manufacturing-cost-list-name").focused);
  assert.equal(context.manufacturingCostImportSearchContext, imported);
  [context.manufacturingCostCandidateRows, context.manufacturingCostCandidateGroups, context.manufacturingCostRows, context.manufacturingCostListItemSnapshotMap].forEach((value, i) => assert.equal(value, before[i]));
  assert.equal(get("manufacturing-cost-candidates").innerHTML, "candidates with manual checks", "Editing/clearing/new list preserve the actual check state without re-render");
  assert.deepEqual(Array.from(context.manufacturingCostImportPartNumbersForRow({ productId: 1 })), ["ORIGINAL", "PALLET-1"]);
  get("manufacturing-cost-query").value = "PALLET-1 EXTRA-1";
  await context.searchManufacturingCostCandidates();
  assert.deepEqual(calls[1].tokens, parts.concat("EXTRA-1"), "Additional search preserves all original parts and deduplicates");
  assert.deepEqual(Array.from(imported.tokens), parts.concat("EXTRA-1"), "Research and later searches retain the added part as well");
  context.manufacturingCostOperation = {};
  context.manufacturingCostActiveListId = 9;
  get("btn-manufacturing-cost-new-list").click();
  assert.equal(context.manufacturingCostActiveListId, 9, "Busy work cannot be reset");
  events["dcats:manufacturing-cost-import-search"]({ detail: { parts: ["REPLACEMENT"] } });
  assert.equal(context.manufacturingCostImportSearchContext, imported);
  context.manufacturingCostOperation = null;
  allowed = false;
  events["dcats:manufacturing-cost-import-search"]({ detail: { parts: ["REPLACEMENT"] } });
  assert.equal(context.manufacturingCostImportSearchContext, imported);
  await context.searchManufacturingCostCandidates();
  assert.equal(calls.at(-1), "denied");
  allowed = true;
  const savedList = { id: 9, list_name: "Persisted", category_code: null, product_kind: "rebuilt", core_cost_jpy: 0,
    labor_amount_jpy: 0, transport_cost_jpy: 0, packaging_cost_jpy: 0, included_documents_cost_jpy: 0, core_return_shipping_cost_jpy: 0 };
  let storedItems;
  Object.assign(context, {
    currentUser: { id: "synthetic" }, canEditManufacturingCostMgmt: () => true, console,
    manufacturingCostSelectedCategory: () => "", selectedManufacturingCostList: () => savedList,
    manufacturingCostSettings: () => ({}), loadManufacturingCostComponents: async () => ({}),
    manufacturingCostRowWithCurrentUnitPrices: row => ({ row, updatedCount: 0 }),
    manufacturingCostCoreCostForCategory: () => 0, manufacturingCostRowComponentSnapshots: () => [],
    syncManufacturingCostListItems: async (id, items) => { storedItems = JSON.parse(JSON.stringify(items)); return {}; },
    manufacturingCostBuildSnapshotMap: rows => Object.fromEntries(rows.map(row => [String(row.dkd_shohin_id), row])),
    refreshManufacturingCostSavedLists: async () => {}, renderManufacturingCostRows() {},
    renderManufacturingCostLoading: () => "", renderManufacturingCostDetailLoading() {},
    manufacturingCostNumberFromInput: () => 0,
    MANUFACTURING_COST_DEFAULT_LABOR_AMOUNT_JPY: 1000, MANUFACTURING_COST_DEFAULT_PACKAGING_COST_JPY: 500,
    MANUFACTURING_COST_DEFAULT_DOCUMENTS_COST_JPY: 10,
    renderManufacturingCostCandidateEmpty() { context.manufacturingCostImportSearchContext = null; },
    fetchManufacturingCostProductsByIds: async ids => ({ data: ids.map(id => ({ dkd_shohin_id: id })) }),
    buildAndRenderManufacturingCostProducts: async (products, settings, options) => {
      context.manufacturingCostListItemSnapshotMap = options.snapshotMap;
      context.manufacturingCostRows = products.map(product => ({ productId: product.dkd_shohin_id, product }));
    },
    sb: { from(table) { return { update() { return this; }, eq() { return this; }, select() { return this; },
      single: async () => ({ data: savedList }), order: async () => ({ data: storedItems }) }; } }
  });
  get("manufacturing-cost-list-name").value = "Persisted";
  context.manufacturingCostRows = [{ productId: 1, product: { dkd_shohin_id: 1 } }];
  context.manufacturingCostImportedQuantityByProduct = { 1: [{ part_number: "PALLET-1", quantity: 7 }] };
  await context.saveManufacturingCostList();
  assert.equal(storedItems[0].import_quantities_snapshot[0].quantity, 7, "actual save payload includes imported quantity");
  context.manufacturingCostImportedQuantityByProduct = { 1: [{ part_number: "STALE", quantity: 999 }] };
  await context.loadManufacturingCostList();
  assert.equal(context.manufacturingCostOperation, null);
  assert.equal(context.manufacturingCostImportQuantitiesForRow({ productId: 1 })[0].quantity, 7, "actual load restores saved quantity and discards earlier working quantities");
  await context.saveManufacturingCostList();
  assert.equal(storedItems[0].import_quantities_snapshot[0].quantity, 7, "saving again without a file preserves the saved quantity");
  console.log("Manufacturing retention: 200-part import, real event handoff, query edit/clear, new-list metadata, checks, snapshots, provenance, extra search and busy/permission guards passed");
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
