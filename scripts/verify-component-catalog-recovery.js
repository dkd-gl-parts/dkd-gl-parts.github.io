const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const recoveryStart = source.indexOf("function catalogComponentRowsNeedDkdRecovery");
const fetchStart = source.indexOf("async function fetchCatalogComponentRowsByDkd", recoveryStart);
const loadStart = source.lastIndexOf("async function loadAssemblyComponentsForCurrent");

if (recoveryStart < 0 || fetchStart < recoveryStart || loadStart < fetchStart) {
  throw new Error("catalog component recovery functions could not be isolated");
}

const recoverySource = source.slice(recoveryStart, fetchStart);
const fetchSource = source.slice(fetchStart, loadStart);
const loadSource = source.slice(loadStart);

if (!recoverySource.includes('selectedKind !== "catalog_spec"') ||
    !recoverySource.includes("rows.length !== 1") ||
    !recoverySource.includes("componentIsCurrentProductSelfReference")) {
  throw new Error("catalog recovery must remain limited to a single catalog self row");
}

if (!fetchSource.includes('.eq("dkd_shohin_id", dkdId)') ||
    !fetchSource.includes('.eq("is_catalog_evidence", true)') ||
    !fetchSource.includes("!genuinePartKey || !genuinePartKeys.length")) {
  throw new Error("catalog recovery must stay scoped to the current DKD product and catalog evidence");
}

const guardIndex = loadSource.indexOf("catalogComponentRowsNeedDkdRecovery(rpcRows, selectedKind)");
const fetchIndex = loadSource.indexOf("await fetchCatalogComponentRowsByDkd(dkdId, loadRequestId)", guardIndex);
const replaceIndex = loadSource.indexOf("recovery.rows.length > rpcRows.length", fetchIndex);

if (guardIndex < 0 || fetchIndex < guardIndex || replaceIndex < fetchIndex) {
  throw new Error("catalog recovery must run only after a suspicious RPC result and keep the larger result set");
}

const resolveIndex = loadSource.indexOf("await resolveCurrentCoreDkdShohinId()");
const illustrationIndex = loadSource.indexOf("loadCatalogIllustrationsForCurrent(dkdId, selectedKind)", resolveIndex);
const componentRpcIndex = loadSource.indexOf('sb.rpc("get_variant_catalog_components_for_ui"', illustrationIndex);

if (resolveIndex < 0 || illustrationIndex < resolveIndex || componentRpcIndex < illustrationIndex) {
  throw new Error("catalog illustrations must start immediately after resolving the DKD product");
}
if (loadSource.indexOf("loadCatalogIllustrationsForCurrent(dkdId, selectedKind)", illustrationIndex + 1) >= 0) {
  throw new Error("catalog illustration loading must not be duplicated after component queries");
}

console.log("component catalog recovery guard passed");

const assert = require("node:assert/strict");
const vm = require("node:vm");
const normalize = value => String(value || "").replace(/[-\s\u3000]/g, "").toUpperCase();
const row = (id, key, extra = {}) => Object.assign({
  id, dkd_component_id: 333, dkd_shohin_id: 30844, is_catalog_evidence: true,
  assy_manufacturer: "DENSO", assy_manufacturer_part_number: "128000-1862",
  normalized_assy_manufacturer_part_number: "1280001862", assy_genuine_part_number: null,
  normalized_assy_genuine_part_number: "", source_code: "catalog_denso",
  source_table: "TBLPARTSLIST", source_record_key: key, component_position: "002", quantity: "1C"
}, extra);
const originals = [
  row(1, "self", { assy_genuine_part_number: "G-1", normalized_assy_genuine_part_number: "G1", source_table: "TBLPARTSLIST_ILL_CODE_REPAIR" }),
  row(2, "1280001860|006|0282007700"), row(3, "1280001860|007|0282007700"),
  row(4, "different-period", { effective_start: "2001" }),
  row(5, "different-position", { component_position: "003" }),
  row(6, "unknown-source", { source_table: "unverified" }),
  row(7, null),
  row(8, "other-genuine", { assy_genuine_part_number: "G-2", normalized_assy_genuine_part_number: "G2" }),
  row(9, "other-maker", { assy_manufacturer: "OTHER" }),
  row(10, "other-part", { normalized_assy_manufacturer_part_number: "OTHER" })
];
const selected = originals.filter(r => [2, 4, 5].includes(r.id)).map(r => Object.assign({}, r, {
  parent_assy_manufacturer: "DENSO", parent_assy_manufacturer_part_number: "128000-1862",
  catalog_match_basis: "catalog_manufacturer_part_blank_genuine"
}));
function harness(options = {}) {
  const calls = [], filters = [];
  let kind = "catalog_spec";
  const context = {
    componentLoadRequestId: 1,
    currentProduct: { manufacturer: options.manufacturer || "DENSO", manufacturer_part_number: "128000-1862" },
    selectedProductKind: () => kind,
    componentAssyLookupKeys: () => ["1280001862"],
    componentCurrentProductGenuineKeys: () => ["G1"],
    normalizedPartKey: normalize,
    normalizeComponentTreeRow: r => Object.assign({}, r),
    sb: {
      from(name) {
        assert.equal(name, "assembly_component_usage_details");
        const query = {
          select(columns) { assert(columns.includes("source_table, source_record_key")); return query; },
          eq(k, v) { filters.push([k, v]); return query; }, order() { return query; },
          then(resolve, reject) { return Promise.resolve(options.raw || { data: originals }).then(value => { if (options.afterRaw) options.afterRaw(context); return value; }).then(resolve, reject); }
        };
        return query;
      },
      async rpc(name, args) {
        calls.push({ name, args });
        if (options.duringSelection) options.duringSelection(context, value => { kind = value; });
        if (options.throwSelection) throw new Error("network failure");
        return options.selection === undefined ? { data: selected } : options.selection;
      }
    }
  };
  vm.createContext(context);vm.runInContext(fetchSource, context);
  return { context, calls, filters, run: () => context.fetchCatalogComponentRowsByDkd(30844) };
}
async function verifyRecovery() {
  let checks = 0;
  const h = harness(), result = await h.run();
  assert.deepEqual(Array.from(result.rows, r => r.id), [1, 2, 4, 5, 6, 7]); checks++;
  assert.equal(result.rows[1].quantity, "1C"); checks++;
  assert.deepEqual(h.filters, [["dkd_shohin_id", 30844], ["is_catalog_evidence", true]]); checks++;
  assert.equal(h.calls[0].name, "get_catalog_assembly_components_by_part"); checks++;
  assert.equal(h.calls[0].args.target_genuine_part_number, null); checks++;
  assert.equal(h.calls[0].args.max_rows, 5000); checks++;
  const allSources = harness({ selection: { data: selected.concat([Object.assign({}, selected[0], { source_record_key: originals[2].source_record_key })]) } });
  assert.equal((await allSources.run()).rows.length, 7, "server keeps changed/unverified conditions"); checks++;
  const nonDenso = harness({ manufacturer: "OTHER", raw: { data: originals.map(r => Object.assign({}, r, { assy_manufacturer: "OTHER" })) } });
  await nonDenso.run();assert.equal(nonDenso.calls.length, 0); checks++;
  const unknown = harness({ raw: { data: [originals[5], originals[6]] } });
  assert.equal((await unknown.run()).rows.length, 2);assert.equal(unknown.calls.length, 0); checks++;
  for (const selection of [null, { data: [] }, { data: {} }, { data: [null] }, { data: Array(5000).fill(selected[0]) }, { error: { message: "denied" } }, { data: [Object.assign({}, selected[0], { parent_assy_manufacturer_part_number: "OTHER" })] }]) {
    const value = await harness({ selection }).run();assert(value.error);assert.equal(value.rows.length, 0); checks++;
  }
  assert((await harness({ throwSelection: true }).run()).error); checks++;
  const staleRaw = harness({ afterRaw: c => { c.currentProduct = {}; } });
  assert((await staleRaw.run()).stale);assert.equal(staleRaw.calls.length, 0); checks++;
  for (const change of [(c) => { c.currentProduct = {}; }, (c) => { c.currentProduct = null; }, (c, setKind) => setKind("rebuilt")]) {
    const stale = await harness({ duringSelection: change }).run();assert(stale.stale);assert.equal(stale.rows.length, 0); checks++;
  }
  assert(loadSource.includes("if (recovery.stale || componentLoadIsStale()) return;")); checks++;
  assert(loadSource.includes("currentProduct !== componentLoadProduct")); checks++;
  const overlapping = harness({ duringSelection: c => { c.componentLoadRequestId++; } });
  assert((await overlapping.run()).stale); checks++;
  const overlappingRaw = harness({ afterRaw: c => { c.componentLoadRequestId++; } });
  assert((await overlappingRaw.run()).stale);assert.equal(overlappingRaw.calls.length, 0); checks++;
  assert(loadSource.includes("var loadRequestId = ++componentLoadRequestId")); checks++;
  assert(loadSource.includes("loadRequestId !== componentLoadRequestId")); checks++;
  await verifyOverlappingLoads(); checks++;
  console.log(JSON.stringify({ componentRecoveryCases: checks, passed: true }));
}
async function verifyOverlappingLoads() {
  const loadFunction = source.slice(loadStart, source.indexOf("async function loadParallelCandidatesForCurrent", loadStart));
  let firstSelectionResolve, firstSelectionStarted;
  const selectionStarted = new Promise(resolve => { firstSelectionStarted = resolve; });
  const deferredSelection = new Promise(resolve => { firstSelectionResolve = resolve; });
  const wrap = { innerHTML: "" };
  let rawCalls = 0, selectionCalls = 0, renders = 0;
  const freshRows = [row(2, "a", { quantity: "99" }), row(4, "b"), row(5, "c")];
  const representative = r => Object.assign({}, r, {
    parent_assy_manufacturer: "DENSO", parent_assy_manufacturer_part_number: "128000-1862",
    catalog_match_basis: "catalog_manufacturer_part_blank_genuine"
  });
  const c = {
    console, document: { getElementById: () => wrap },
    currentProduct: { manufacturer: "DENSO", manufacturer_part_number: "128000-1862" },
    componentLoadRequestId: 0, componentIllustrationRequestId: 0, componentTreeRpcAvailable: true,
    selectedProductKind: () => "catalog_spec", selectedComponentVariantId: () => null,
    componentAssyLookupKeys: () => ["1280001862"], componentCurrentProductGenuineKeys: () => ["G1"],
    normalizedPartKey: normalize, normalizeComponentTreeRow: r => Object.assign({}, r),
    loadComponentDisplayNameTranslations: async () => {}, componentCatalogCategoryCode: () => "starter",
    resolveCurrentCoreDkdShohinId: async () => 30844,
    loadCatalogIllustrationsForCurrent: () => { c.componentIllustrationRequestId++; },
    renderComponentIllustrationSlot: () => {}, updateComponentTargetSummary: () => {},
    renderAssemblyComponentRows: () => { renders++; }, loadComponentAlternativesForRows: async () => {},
    catalogComponentRowsNeedDkdRecovery: rows => rows.length === 1, t: key => key,
    sb: {
      from() {
        const rows = ++rawCalls === 1 ? freshRows.slice(0, 2).map(r => Object.assign({}, r, { quantity: "1" })) : freshRows;
        const q = { select: () => q, eq: () => q, order: () => q, then: (resolve, reject) => Promise.resolve({ data: rows }).then(resolve, reject) };
        return q;
      },
      async rpc(name) {
        if (name === "get_variant_catalog_components_for_ui") return { data: [{ id: 0, has_child_catalog_components: true }] };
        assert.equal(name, "get_catalog_assembly_components_by_part");
        if (++selectionCalls === 1) { firstSelectionStarted();return deferredSelection; }
        return { data: freshRows.map(representative) };
      }
    }
  };
  vm.createContext(c);vm.runInContext(fetchSource + "\n" + loadFunction, c);
  const oldLoad = c.loadAssemblyComponentsForCurrent();
  await selectionStarted;
  await c.loadAssemblyComponentsForCurrent();
  const published = JSON.stringify(c.assemblyComponentRows), renderCount = renders;
  assert.equal(c.assemblyComponentRows.length, 3);assert.equal(c.assemblyComponentRows[0].quantity, "99");
  firstSelectionResolve({ data: freshRows.slice(0, 2).map(representative) });
  await oldLoad;
  assert.equal(JSON.stringify(c.assemblyComponentRows), published, "older recovery must not overwrite the newer same-product result");
  assert.equal(renders, renderCount, "stale recovery must not render");
}
verifyRecovery().catch(error => { console.error(error); process.exitCode = 1; });
