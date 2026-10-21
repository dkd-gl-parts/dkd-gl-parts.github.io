const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const source = fs.readFileSync("app.js", "utf8");
const names = ["esc", "normalizeAsciiWidth", "norm", "normalizedContains", "sumProductionCoreEntryQty", "renderCoreManagementSummary", "beginCoreManagementLoad", "searchCoreCollectionWorkspace", "clearCoreCollectionFilters", "bindCoreManagementTabs", "setCoreListMode", "coreCollectionPriorityLabel", "coreCollectionStatusLabel", "coreCollectionSourceDetail", "coreCollectionStockQty", "coreCollectionShortageQty", "coreCollectionCategoryKey", "coreCollectionCategoryOrder", "coreCollectionStoredOrder", "compareCoreCollectionStoredOrder", "assignCoreCollectionCategoryRanks", "coreCollectionCategoryRank", "coreCollectionCategoryMatches", "applyCoreCollectionFilters", "loadCoreCollectionList", "loadCoreCollectionProducts", "loadCoreCollectionStock", "renderCoreCollectionStockBadge", "updateCoreCollectionLoadMoreButton", "renderCoreCollectionList", "bindCoreCollectionActions", "coreListSearchKey", "coreListRowMatches", "updateCoreListLoadMoreButton", "fetchCoreListRawPage", "loadCoreListMgmt", "loadCoreListProductMap", "renderCoreListMgmt"];
const ast = acorn.parse(source, { ecmaVersion: "latest" });
const functions = ast.body.filter(n => n.type === "FunctionDeclaration" && names.includes(n.id.name));
assert.equal(functions.length, names.length);
let checks = 0;
function fixture() {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { value: id === "core-collection-state" ? "all" : "", innerHTML: "", textContent: "", disabled: false, attributes: {}, listeners: {}, style: {}, classList: { toggle() {} }, setAttribute(k, v) { this.attributes[k] = v; }, addEventListener(k, v) { this.listeners[k] = v; }, focus() { context.focused = id; }, querySelectorAll() { return []; } });
    return elements.get(id);
  };
  const context = {
    document: { getElementById: get }, window: { matchMedia: () => ({ matches: true, addEventListener() {} }) }, console,
    t: key => key, productionCategoryLabel: p => p.category_code || "-", normalizeCoreProductFastRows: rows => rows,
    setCspStyle: (el, k, v) => { el.style[k] = v; }, canManageProductionRecords: () => true, canUploadCoreImages: () => true, isPC: () => true,
    coreListMode: "collection", coreManagementLoadSeq: 0, coreManagementDataReady: false,
    coreCollectionRows: [], coreCollectionFilteredRows: [], coreCollectionProductMap: {}, coreCollectionStockMap: {}, coreCollectionRenderLimit: 50,
    CORE_COLLECTION_RENDER_PAGE_SIZE: 50, CORE_COLLECTION_CATEGORY_ORDER: ["starter", "alternator", "ac_compressor", "distributor", "other"], CORE_PRODUCT_FAST_SELECT: "*",
    coreListMgmtRows: [], coreListProductMap: {}, coreListRawOffset: 0, coreListHasMore: true, coreListLoadingMore: false, coreListCurrentSearchKey: "", CORE_LIST_PAGE_SIZE: 50, CORE_LIST_SEARCH_SCAN_CHUNKS: 5,
    formatDateTime: value => value || "-"
  };
  context.respond = () => ({ data: [], error: null });
  context.sb = { from(table) { let columns; const query = { select(c) { columns = c; return query; }, order() { return query; }, in() { return query; }, limit() { return query; }, range() { return query; }, then(resolve, reject) { return Promise.resolve().then(() => context.respond(table, columns)).then(resolve, reject); } }; return query; } };
  vm.createContext(context);
  vm.runInContext(functions.map(n => source.slice(n.start, n.end)).join("\n"), context);
  return { c: context, get };
}
const rows = [{ id: 1, dkd_shohin_id: 1, target_quantity: 10, priority: "high", status: "collecting" }, { id: 2, dkd_shohin_id: 2, target_quantity: 4, priority: "normal", status: "completed" }];
const products = [{ dkd_shohin_id: 1, manufacturer_part_number: "TEST-123", category_code: "starter" }, { dkd_shohin_id: 2, manufacturer_part_number: "TEST-456", category_code: "alternator" }];
function ready(c) { c.respond = (table, columns) => ({ data: table === "core_collection_list_items" ? rows : table === "core_products" ? products : [{ id: 1, dkd_shohin_id: 1, quantity: 3, core_part_number: "CORE-123" }], error: null }); }
async function main() {
  {
    const { c, get } = fixture(); ready(c); await c.loadCoreCollectionList();
    assert.match(get("core-list-count").innerHTML, /14<small/); checks++;
    assert.match(get("core-list-count").innerHTML, /11<small/); checks++;
    assert.equal(get("btn-export-core-collection").disabled, false); checks++;
    c.coreCollectionRenderLimit = 1; c.renderCoreCollectionList();
    assert.match(get("core-list-count").innerHTML, /14<small/); checks++;
    get("core-collection-state").value = "needed"; c.applyCoreCollectionFilters(); c.renderCoreCollectionList();
    assert.equal(c.coreCollectionFilteredRows.length, 1); checks++;
    get("core-collection-category").value = "starter"; get("core-list-search").value = "inventory draft";
    c.clearCoreCollectionFilters(); assert.equal(c.coreCollectionFilteredRows.length, 2); checks++;
    assert.equal(get("core-list-search").value, "inventory draft"); checks++;
    get("core-collection-search").value = "ＴＥＳＴ１２３"; c.applyCoreCollectionFilters(); assert.equal(c.coreCollectionFilteredRows.length, 1); checks++;
    c.renderCoreManagementSummary([{ label: "<script>", value: 2, unit: "台" }], "<img>");
    assert.doesNotMatch(get("core-list-count").innerHTML, /<script>|<img>/); checks++;
  }
  {
    for (const manage of [true, false]) {
      const { c, get } = fixture(); ready(c); c.coreListMode = "inventory"; c.canManageProductionRecords = () => manage;
      await c.loadCoreListMgmt();
      assert.match(get("core-list-count").innerHTML, /core-summary-item/); checks++;
      assert.match(get("core-list-count").innerHTML, /3<small/); checks++;
    }
  }
  {
    const { c, get } = fixture(); ready(c); c.bindCoreManagementTabs();
    get("btn-core-list-mode-collection").listeners.keydown({ key: "ArrowRight", preventDefault() {} });
    assert.equal(c.focused, "btn-core-list-mode-inventory"); checks++;
    assert.equal(get("btn-core-list-mode-inventory").tabIndex, 0); checks++;
    assert.equal(get("core-management-panel").attributes["aria-labelledby"], "btn-core-list-mode-inventory"); checks++;
  }
  {
    const { c, get } = fixture(); ready(c); const normal = c.respond;
    c.respond = (table, columns) => table === "production_core_list_entries" ? { error: { message: "stock unavailable" } } : normal(table, columns);
    await c.loadCoreCollectionList(); assert.match(get("core-list-list").innerHTML, /stock unavailable/); checks++;
    assert.equal(get("core-list-count").innerHTML, ""); checks++;
    assert.equal(c.coreManagementDataReady, false); checks++;
    assert.equal(get("btn-export-core-collection").disabled, true); checks++;
    c.applyCoreCollectionFilters(); c.renderCoreCollectionList(); assert.match(get("core-list-list").innerHTML, /stock unavailable/); checks++;
    ready(c); await c.searchCoreCollectionWorkspace(); assert.equal(c.coreManagementDataReady, true); checks++;
  }
  {
    const { c, get } = fixture(); ready(c); let release; const pending = new Promise(r => { release = r; }); const normal = c.respond;
    c.coreListMode = "inventory"; c.respond = (table, columns) => table === "production_core_list_entries" ? pending : normal(table, columns);
    const old = c.loadCoreListMgmt(); await Promise.resolve(); await Promise.resolve();
    c.coreListMode = "collection"; ready(c); await c.loadCoreCollectionList(); const html = get("core-list-list").innerHTML;
    release({ data: [{ id: 90, dkd_shohin_id: 99, quantity: 99 }], error: null }); await old;
    assert.equal(get("core-list-list").innerHTML, html); checks++;
    assert.equal(c.coreListRawOffset, 0); checks++;
    assert.equal(c.coreListMgmtRows.length, 0); checks++;
  }
  {
    const { c } = fixture(); let release; const pending = new Promise(r => { release = r; }); c.respond = () => pending;
    const old = c.loadCoreCollectionStock(rows, 0); await Promise.resolve(); await Promise.resolve();
    c.coreManagementLoadSeq = 1; c.coreCollectionStockMap = { 1: { quantity: 5, parts: [], locations: [] } };
    release({ data: [{ dkd_shohin_id: 1, quantity: 99 }], error: null }); await old;
    assert.equal(c.coreCollectionStockMap[1].quantity, 5); checks++;
  }
  {
    const { c, get } = fixture(); c.coreListMode = "inventory"; c.respond = () => Promise.reject(new Error("network rejected"));
    await c.loadCoreListMgmt(); assert.match(get("core-list-list").innerHTML, /network rejected/); checks++;
    assert.equal(c.coreListLoadingMore, false); checks++;
  }
  console.log(`Core management workspace: ${checks} behavioral checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
