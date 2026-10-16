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
  "activeManufacturingCostImportSearchContext", "searchManufacturingCostCandidates", "manufacturingCostImportPartNumbersForRow"];
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
    manufacturingCostRows: [{ productId: 1 }], manufacturingCostCandidateRows: [{ dkd_shohin_id: 1 }],
    manufacturingCostCandidateGroups: [{ token: "PALLET-1", candidates: [{ dkd_shohin_id: 1 }] }],
    manufacturingCostCandidateMode: "import", manufacturingCostCandidateStatusMap: {}, manufacturingCostCandidateRequestSeq: 0,
    manufacturingCostImportHistory: { byToken: {} }, productDkdId: p => p.dkd_shohin_id,
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
  console.log("Manufacturing retention: 200-part import, real event handoff, query edit/clear, new-list metadata, checks, snapshots, provenance, extra search and busy/permission guards passed");
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
