"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "manufacturing-cost-workspace.css"), "utf8");
const ast = acorn.parse(source, { ecmaVersion: "latest" });
const names = ["renderManufacturingCostLoading", "renderManufacturingCostDetailLoading", "updateManufacturingCostOperation",
  "beginManufacturingCostOperation", "finishManufacturingCostOperation", "searchManufacturingCostCandidates",
  "calculateSelectedManufacturingCost", "loadManufacturingCostList"];
const code = names.map(name => {
  const node = ast.body.find(n => n.type === "FunctionDeclaration" && n.id.name === name);
  assert(node, name);
  return source.slice(node.start, node.end);
}).join("\n");
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
function element(value = "") {
  return { innerHTML: "original", textContent: "", value, disabled: false, hidden: true, attributes: {},
    setAttribute(name, v) { this.attributes[name] = v; }, removeAttribute(name) { delete this.attributes[name]; } };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function harness() {
  const ids = ["screen-manufacturing-cost-mgmt", "manufacturing-cost-progress", "manufacturing-cost-list-status",
    "manufacturing-cost-candidates", "manufacturing-cost-list", "manufacturing-cost-detail", "manufacturing-cost-detail-heading",
    "manufacturing-cost-count", "manufacturing-cost-summary", "btn-manufacturing-cost-calc", "btn-manufacturing-cost-load-list",
    "btn-manufacturing-cost-export", "btn-manufacturing-cost-remove-open", "manufacturing-cost-query", "manufacturing-cost-category"];
  const elements = Object.fromEntries(ids.map(id => [id, element()]));
  elements["manufacturing-cost-query"].value = "PART-1 PART-2";
  elements["btn-manufacturing-cost-export"].disabled = true;
  const selectedButton = element();
  const controls = [elements["btn-manufacturing-cost-calc"], elements["btn-manufacturing-cost-load-list"],
    elements["btn-manufacturing-cost-export"], elements["manufacturing-cost-query"], selectedButton];
  const calls = { fetch: 0, statuses: 0, build: 0, refresh: 0, items: 0, rendered: 0, alerts: 0 };
  const products = [{ dkd_shohin_id: 1 }];
  const context = {
    document: { getElementById: id => elements[id] || null, querySelectorAll: () => controls, querySelector: () => selectedButton },
    console: { warn() {} }, esc: escape, t: key => key, tf: (key, data) => key + " " + Object.values(data).join(" "),
    canViewManufacturingCostMgmt: () => true, canEditManufacturingCostMgmt: () => true,
    alert: () => { calls.alerts++; }, manufacturingCostOperation: null, manufacturingCostCandidateRequestSeq: 0,
    manufacturingCostActiveListId: null, manufacturingCostRows: [], manufacturingCostComponentMap: {},
    manufacturingCostCandidateRows: products, manufacturingCostCandidateMode: "query", manufacturingCostCandidateStatusMap: {},
    manufacturingCostTokens: q => q.trim() ? q.trim().split(/\s+/) : [], activeManufacturingCostImportSearchContext: () => null,
    setManufacturingCostListStatus: (text, isError) => { elements["manufacturing-cost-list-status"].textContent = text; elements["manufacturing-cost-list-status"].isError = isError; },
    renderManufacturingCostCandidateEmpty: text => { elements["manufacturing-cost-candidates"].innerHTML = text; },
    renderManufacturingCostEmpty: () => { context.manufacturingCostRows = []; },
    fetchManufacturingCostProducts: async () => { calls.fetch++; return { data: products }; },
    loadManufacturingCostCandidateStatuses: async () => { calls.statuses++; },
    renderManufacturingCostCandidates: data => { calls.rendered++; elements["manufacturing-cost-candidates"].innerHTML = data.length ? "candidates" : "no_results"; },
    selectedManufacturingCostDuplicateCandidateProducts: () => [], selectedManufacturingCostCandidateProducts: () => products,
    mergeManufacturingCostProducts: p => p, manufacturingCostSettings: () => ({}),
    buildAndRenderManufacturingCostProducts: async p => { calls.build++; context.manufacturingCostRows = p; context.renderManufacturingCostRows(); },
    renderManufacturingCostRows: () => { elements["manufacturing-cost-list"].innerHTML = "rows"; },
    renderManufacturingCostProductDetail: () => { elements["manufacturing-cost-detail"].innerHTML = "empty"; },
    selectedManufacturingCostList: () => ({ id: 10 }),
    refreshManufacturingCostSavedLists: async () => { calls.refresh++; },
    manufacturingCostBuildSnapshotMap: items => items, fetchManufacturingCostProductsByIds: async () => ({ data: products }),
    sb: { from(table) { assert.equal(table, "manufacturing_cost_list_items"); calls.items++; return { select() { return this; }, eq() { return this; }, order: async () => ({ data: [{ dkd_shohin_id: 1 }] }) }; } }
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  function assertFinished() {
    assert.equal(context.manufacturingCostOperation, null);
    assert.equal(elements["manufacturing-cost-progress"].hidden, true);
    assert.equal(elements["manufacturing-cost-progress"].innerHTML, "");
    assert.equal(elements["screen-manufacturing-cost-mgmt"].attributes["data-cost-processing"], undefined);
    for (const id of ["manufacturing-cost-candidates", "manufacturing-cost-list", "manufacturing-cost-detail"]) assert.equal(elements[id].attributes["aria-busy"], "false");
    assert.equal(elements["btn-manufacturing-cost-calc"].disabled, false);
    assert.equal(elements["btn-manufacturing-cost-export"].disabled, true, "Preserve previously disabled permission controls");
    assert.equal(elements["manufacturing-cost-query"].disabled, false);
    assert.equal(elements["btn-manufacturing-cost-calc"].innerHTML, "original");
  }
  return { context, elements, calls, products, assertFinished };
}
async function verify() {
  {
    const h = harness(), fetch = deferred(), statuses = deferred();
    h.context.fetchManufacturingCostProducts = () => { h.calls.fetch++; return fetch.promise; };
    h.context.loadManufacturingCostCandidateStatuses = () => { h.calls.statuses++; return statuses.promise; };
    const pending = h.context.searchManufacturingCostCandidates();
    assert.equal(h.context.manufacturingCostOperation.kind, "search");
    assert.equal(h.elements["manufacturing-cost-progress"].hidden, false);
    assert.match(h.elements["manufacturing-cost-progress"].innerHTML, /manufacturing_cost_matching_parts 2/);
    assert.equal(h.elements["btn-manufacturing-cost-calc"].disabled, true);
    assert.equal(h.elements["btn-manufacturing-cost-calc"].textContent, "manufacturing_cost_busy_button");
    await h.context.searchManufacturingCostCandidates();
    await h.context.calculateSelectedManufacturingCost();
    await h.context.loadManufacturingCostList();
    assert.equal(h.calls.fetch, 1, "Prevent duplicate and conflicting operations while waiting");
    assert.equal(h.calls.build + h.calls.refresh, 0);
    fetch.resolve({ data: h.products });
    await new Promise(resolve => setImmediate(resolve));
    assert.match(h.elements["manufacturing-cost-progress"].innerHTML, /manufacturing_cost_checking_candidates/);
    assert.equal(h.calls.statuses, 1);
    statuses.resolve(); await pending;
    h.assertFinished();
    assert.equal(h.calls.rendered, 1);
    assert.equal(h.elements["manufacturing-cost-list-status"].textContent, "manufacturing_cost_search_done");
  }
  for (const result of ["empty", "returned-error", "rejected", "status-error", "stale"]) {
    const h = harness();
    if (result === "empty") h.context.fetchManufacturingCostProducts = async () => ({ data: [] });
    if (result === "returned-error") h.context.fetchManufacturingCostProducts = async () => ({ error: new Error("failed") });
    if (result === "rejected") h.context.fetchManufacturingCostProducts = async () => { throw new Error("failed"); };
    if (result === "status-error") h.context.loadManufacturingCostCandidateStatuses = async () => { throw new Error("failed"); };
    if (result === "stale") h.context.fetchManufacturingCostProducts = async () => { h.context.manufacturingCostCandidateRequestSeq++; return { data: h.products }; };
    await h.context.searchManufacturingCostCandidates(); h.assertFinished();
    if (result.includes("error") || result === "rejected") assert(h.elements["manufacturing-cost-list-status"].isError);
    if (result === "empty") assert.match(h.elements["manufacturing-cost-list"].innerHTML, /no_results/);
    if (result === "stale") assert.equal(h.calls.rendered, 0);
  }
  for (const fail of [false, true]) {
    const h = harness(), build = deferred(), oldRows = [{ productId: 99 }], oldComponents = { 99: [{}] };
    h.context.manufacturingCostRows = oldRows; h.context.manufacturingCostComponentMap = oldComponents;
    h.context.buildAndRenderManufacturingCostProducts = () => { h.calls.build++; h.context.manufacturingCostComponentMap = {}; return build.promise; };
    const pending = h.context.calculateSelectedManufacturingCost();
    assert.match(h.elements["manufacturing-cost-progress"].innerHTML, /manufacturing_cost_calculation_running/);
    assert.match(h.elements["manufacturing-cost-list"].innerHTML, /manufacturing-cost-spinner/);
    await h.context.calculateSelectedManufacturingCost(); assert.equal(h.calls.build, 1);
    if (fail) build.reject(new Error("failed")); else build.resolve();
    await pending; h.assertFinished();
    if (fail) { assert.equal(h.context.manufacturingCostRows, oldRows); assert.equal(h.context.manufacturingCostComponentMap, oldComponents); }
    assert.equal(h.elements["manufacturing-cost-list-status"].isError, fail);
  }
  for (const fail of ["none", "refresh", "items", "products", "build"]) {
    const h = harness();
    if (fail === "refresh") h.context.refreshManufacturingCostSavedLists = async () => { throw new Error("refresh failed"); };
    if (fail === "items") h.context.sb.from = () => ({ select() { return this; }, eq() { return this; }, order: async () => ({ error: new Error("items failed") }) });
    if (fail === "products") h.context.fetchManufacturingCostProductsByIds = async () => ({ error: new Error("products failed") });
    if (fail === "build") h.context.buildAndRenderManufacturingCostProducts = async () => { throw new Error("build failed"); };
    const pending = h.context.loadManufacturingCostList();
    assert.match(h.elements["manufacturing-cost-progress"].innerHTML, /manufacturing_cost_list_running/);
    await pending; h.assertFinished();
    assert.equal(h.elements["manufacturing-cost-list-status"].isError, fail !== "none");
    if (fail !== "none") assert.equal(h.elements["btn-manufacturing-cost-remove-open"].disabled, true);
  }
  {
    const h = harness(); h.elements["manufacturing-cost-query"].value = "";
    await h.context.searchManufacturingCostCandidates();
    assert.equal(h.calls.fetch, 0); assert.equal(h.context.manufacturingCostOperation, null);
    h.elements["manufacturing-cost-category"].value = "ST";
    const fetch = deferred(); h.context.fetchManufacturingCostProducts = () => fetch.promise;
    const pending = h.context.searchManufacturingCostCandidates();
    assert.match(h.elements["manufacturing-cost-progress"].innerHTML, /manufacturing_cost_matching_category/);
    fetch.resolve({data: []}); await pending; h.assertFinished();
  }
  {
    const h = harness(); h.context.canViewManufacturingCostMgmt = () => false;
    for (const name of ["searchManufacturingCostCandidates", "calculateSelectedManufacturingCost", "loadManufacturingCostList"]) await h.context[name]();
    assert.equal(h.context.manufacturingCostOperation, null); assert.equal(h.calls.fetch + h.calls.build + h.calls.refresh, 0); assert.equal(h.calls.alerts, 3);
  }
  {
    const h = harness(); h.context.canEditManufacturingCostMgmt = () => false;
    const operation = h.context.beginManufacturingCostOperation("search", "<img src=x onerror=bad>");
    assert(!h.elements["manufacturing-cost-progress"].innerHTML.includes("<img"));
    h.context.finishManufacturingCostOperation({}); assert.equal(h.context.manufacturingCostOperation, operation, "An old completion cannot clear another operation");
    h.context.finishManufacturingCostOperation(operation); h.assertFinished();
    assert.equal(h.elements["btn-manufacturing-cost-remove-open"].disabled, true);
    assert.match(h.context.renderManufacturingCostLoading("<b>unsafe</b>"), /&lt;b&gt;/);
  }
  assert(html.includes('id="manufacturing-cost-progress" role="status" aria-live="polite" aria-atomic="true" hidden'));
  assert(css.includes(".manufacturing-cost-progress[hidden] { display: none; }"));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.manufacturing-cost-spinner\s*\{\s*animation:\s*none;/, "Reduced-motion preference disables the spinner animation without hiding the status text");
  assert(!/aria-valuenow|role=['"]progressbar/.test(code), "Do not invent a numeric progress percentage");
  console.log("manufacturing cost loading: phases, completion, failure, stale, duplicate prevention, permission restoration, escaping and accessible motion passed");
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
