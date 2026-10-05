"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const ast = acorn.parse(source, { ecmaVersion: "latest" });
const names = ["manufacturingCostBuildImportHistory", "loadManufacturingCostImportHistory",
  "manufacturingCostCandidateSelectionKey", "renderManufacturingCostCandidateRow",
  "renderManufacturingCostImportCandidateGroups", "renderManufacturingCostCandidates", "searchManufacturingCostCandidates"];
const code = names.map(name => {
  const node = ast.body.find(n => n.type === "FunctionDeclaration" && n.id.name === name);
  assert(node, name);
  return source.slice(node.start, node.end);
}).join("\n");
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const products = [1, 2, 3].map(id => ({ dkd_shohin_id: id, genuine_part_number: "PART-1", category_code: "ST" }));
const groups = [{ token: "PART-1", candidates: products.slice(0, 2), matchCount: 2 },
  { token: "OTHER-2", candidates: products.slice(2), matchCount: 1 }, { token: "MISSING-3", candidates: [], matchCount: 0 }];
const saved = { id: 1, dkd_shohin_id: 2, import_part_numbers: ["ＰＡＲＴ－１"], part_number_snapshot: "UNRELATED" };
function harness(items = [saved]) {
  const calls = [], inputs = [];
  const wrap = { innerHTML: "", querySelectorAll: () => inputs };
  const context = {
    console: { warn() {} }, canViewManufacturingCostMgmt: () => true,
    normalizePartQuery: s => String(s).normalize("NFKC").toUpperCase().replace(/[-\s]/g, ""),
    productDkdId: p => p.dkd_shohin_id, esc: escape, t: key => key, tCat: key => key,
    tf: key => key, manufacturingCostProductTitle: p => p.genuine_part_number,
    renderManufacturingCostCandidateStatusLabels: () => "", manufacturingCostCurrentProductIdMap: () => ({}),
    pendingManufacturingCostCandidateProducts: () => products,
    manufacturingCostImportHistory: { byToken: {}, unavailable: false },
    manufacturingCostCandidateRows: [], manufacturingCostCandidateGroups: groups, manufacturingCostCandidateMode: "import",
    document: { getElementById: id => id === "manufacturing-cost-candidates" ? wrap : null },
    sb: { from(table) {
      assert.equal(table, "manufacturing_cost_list_items");
      const call = {}; calls.push(call);
      return {
        select(fields, options) { assert(!fields.includes("cost_jpy")); assert.match(fields, /manufacturing_cost_lists!inner/); assert.equal(options.count, "exact"); return this; },
        in(field, ids) { assert.equal(field, "dkd_shohin_id"); assert(ids.length <= 100); call.ids = ids; return this; },
        eq(field, value) { assert.equal(field, "manufacturing_cost_lists.is_active"); assert.equal(value, true); return this; },
        order(field, options) { assert.equal(field, "id"); assert.equal(options.ascending, true); return this; },
        async range(start, end) {
          assert.equal(end, start + 499); call.offset = start;
          const matching = items.filter(i => call.ids.includes(String(i.dkd_shohin_id))).sort((a, b) => a.id - b.id);
          // Simulate a server page cap smaller than the requested size.
          return { data: matching.slice(start, start + 1), count: matching.length };
        }
      };
    } }
  };
  vm.createContext(context); vm.runInContext(code, context);
  return { context, calls, wrap, inputs };
}
function checkbox(html, id) { return html.match(new RegExp("<input[^>]*value='" + id + "'[^>]*>"))[0]; }
async function verify() {
  const h = harness(), c = h.context;
  c.manufacturingCostImportHistory = await c.loadManufacturingCostImportHistory(groups);
  assert.equal(c.manufacturingCostImportHistory.byToken.PART1.productId, "2");
  c.renderManufacturingCostCandidates(products, "import", groups);
  assert.match(checkbox(h.wrap.innerHTML, 2), / checked/);
  assert.doesNotMatch(checkbox(h.wrap.innerHTML, 1), / checked/);
  assert.doesNotMatch(checkbox(h.wrap.innerHTML, 3), / checked/, "No history must not select even a single candidate");
  assert.match(h.wrap.innerHTML, /manufacturing-cost-previous-link/);
  assert.match(h.wrap.innerHTML, /MISSING-3/);
  h.inputs.push({ value: "2", checked: false, dataset: { costImportToken: "PART-1" } });
  c.renderManufacturingCostCandidates(products, "import", groups);
  assert.doesNotMatch(checkbox(h.wrap.innerHTML, 2), / checked/, "Preserve manual uncheck through rerenders");
  h.inputs[0].checked = true;
  c.renderManufacturingCostCandidates(products, "import", groups);
  assert.match(checkbox(h.wrap.innerHTML, 2), / checked/);
  assert.equal(c.manufacturingCostBuildImportHistory(groups, [saved, { ...saved, id: 2 }]).byToken.PART1.productId, "2", "Repeated lists with same product are not ambiguous");
  const ambiguous = harness([saved, { ...saved, id: 2, dkd_shohin_id: 1 }]);
  ambiguous.context.manufacturingCostImportHistory = await ambiguous.context.loadManufacturingCostImportHistory(groups);
  assert.equal(ambiguous.calls.length, 2, "Load all pages before determining uniqueness");
  assert.equal(ambiguous.calls[1].offset, 1);
  assert.equal(ambiguous.context.manufacturingCostImportHistory.byToken.PART1.ambiguous, true);
  ambiguous.context.renderManufacturingCostCandidates(products, "import", groups);
  assert.doesNotMatch(checkbox(ambiguous.wrap.innerHTML, 1), / checked/);
  assert.doesNotMatch(checkbox(ambiguous.wrap.innerHTML, 2), / checked/);
  assert.match(ambiguous.wrap.innerHTML, /manufacturing_cost_import_history_conflict/);
  const old = c.manufacturingCostBuildImportHistory(groups, [{ dkd_shohin_id: 1, import_part_numbers: [], genuine_part_number_snapshot: "part1" }]);
  assert.equal(old.byToken.PART1.productId, "1", "Legacy saved snapshots support existing links");
  assert.equal(c.manufacturingCostBuildImportHistory(groups, [{ ...saved, import_part_numbers: ["DIFFERENT"], genuine_part_number_snapshot: "PART-1" }]).byToken.PART1.productId, null, "Explicit import provenance must not be overridden by snapshots");
  assert.equal(c.manufacturingCostBuildImportHistory(groups, [{ ...saved, dkd_shohin_id: 99 }]).byToken.PART1.productId, null, "History outside current candidates cannot add products");
  const denied = harness(); denied.context.canViewManufacturingCostMgmt = () => false;
  assert.equal((await denied.context.loadManufacturingCostImportHistory(groups)).unavailable, true);
  assert.equal(denied.calls.length, 0);
  const empty = harness();
  assert.equal((await empty.context.loadManufacturingCostImportHistory([])).unavailable, false);
  assert.equal(empty.calls.length, 0);
  const batches = harness();
  await batches.context.loadManufacturingCostImportHistory([{ token: "PART-1", candidates: Array.from({ length: 101 }, (_, i) => ({ dkd_shohin_id: i + 1 })) }]);
  assert.equal(batches.calls.length, 2, "Batch product IDs rather than querying each imported part");
  const partial = harness();
  partial.context.sb.from = () => ({ select() { return this; }, in() { return this; }, eq() { return this; }, order() { return this; },
    range: async start => start === 0 ? { data: [saved], count: 2 } : { error: new Error("second page failed") } });
  assert.equal((await partial.context.loadManufacturingCostImportHistory(groups)).unavailable, true, "Partial history must never preselect a candidate");
  for (const response of [{ error: new Error("denied") }, { data: [saved], count: null }, { data: [], count: 1 }, { data: [], count: 10001 }]) {
    const failing = harness();
    failing.context.sb.from = () => ({ select() { return this; }, in() { return this; }, eq() { return this; }, order() { return this; }, range: async () => response });
    const result = await failing.context.loadManufacturingCostImportHistory(groups);
    assert.equal(result.unavailable, true);
    assert.equal(Object.keys(result.byToken).length, 0, "Failure discards partial history");
    failing.context.manufacturingCostImportHistory = result;
    failing.context.renderManufacturingCostCandidates(products, "import", groups);
    assert.doesNotMatch(checkbox(failing.wrap.innerHTML, 2), / checked/);
    assert.match(failing.wrap.innerHTML, /manufacturing_cost_import_history_unavailable/);
  }
  c.manufacturingCostCurrentProductIdMap = () => ({ "2": true });
  c.renderManufacturingCostCandidates(products, "import", groups);
  assert.doesNotMatch(h.wrap.innerHTML, /value='2'/, "Resolved import groups stay removed");
  const escaped = c.renderManufacturingCostCandidateRow(products[0], true, {}, { token: "' onclick='evil" });
  assert.match(escaped, /&#39; onclick=&#39;evil/);
  // Actual search must await history and discard a stale response without applying it.
  const stale = harness(), s = stale.context;
  let resolveHistory;
  Object.assign(s, { manufacturingCostOperation: null, manufacturingCostCandidateRequestSeq: 0, manufacturingCostRows: [],
    manufacturingCostTokens: () => ["PART-1"], activeManufacturingCostImportSearchContext: () => ({}),
    beginManufacturingCostOperation: () => ({}), updateManufacturingCostOperation() {}, finishManufacturingCostOperation() {},
    fetchManufacturingCostProducts: async () => ({ data: products, groups }), loadManufacturingCostCandidateStatuses: async () => {},
    loadManufacturingCostImportHistory: () => new Promise(resolve => { resolveHistory = resolve; }), setManufacturingCostListStatus() {},
    renderManufacturingCostCandidates: () => { throw new Error("Stale history must not render candidates"); } });
  const search = s.searchManufacturingCostCandidates();
  await new Promise(resolve => setImmediate(resolve));
  assert(resolveHistory, "Search must read history before render");
  s.manufacturingCostCandidateRequestSeq++;
  resolveHistory({ byToken: { PART1: { productId: "2" } }, unavailable: false });
  await search;
  assert.equal(Object.keys(s.manufacturingCostImportHistory.byToken).length, 0);
  let rendered = false;
  s.renderManufacturingCostCandidates = (rows, mode) => { assert.equal(mode, "import"); assert.equal(rows.length, 3); rendered = true; };
  const successfulSearch = s.searchManufacturingCostCandidates();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(rendered, false);
  resolveHistory({ byToken: { PART1: { productId: "2" } }, unavailable: false });
  await successfulSearch;
  assert.equal(rendered, true);
  assert.equal(s.manufacturingCostImportHistory.byToken.PART1.productId, "2");
  for (const key of ["manufacturing_cost_previous_link", "manufacturing_cost_import_history_note", "manufacturing_cost_import_history_conflict", "manufacturing_cost_import_history_unavailable", "manufacturing_cost_checking_import_history"]) {
    assert.equal((source.match(new RegExp(key + ":", "g")) || []).length, 3, key + " must be translated in all languages");
  }
  console.log("manufacturing cost import history default-check guard passed");
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
