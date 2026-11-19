const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const source = fs.readFileSync("app.js", "utf8");
const names = ["coreCollectionVehicleSummaryHtml", "coreCollectionUiLabel", "renderCoreCollectionVehicleHtml", "coreCollectionVehicleClasses", "coreCollectionVehicleText", "fitCoreCollectionPage", "fitCoreManagementRows", "renderCoreManagementPager", "coreCollectionVehicleMatches", "esc", "normalizeAsciiWidth", "norm", "normalizedContains", "sumProductionCoreEntryQty", "renderCoreManagementSummary", "beginCoreManagementLoad", "searchCoreCollectionWorkspace", "clearCoreCollectionFilters", "bindCoreManagementTabs", "setCoreListMode", "coreCollectionPriorityLabel", "coreCollectionStatusLabel", "coreCollectionSourceDetail", "coreCollectionStockQty", "coreCollectionShortageQty", "coreCollectionCategoryKey", "coreCollectionCategoryOrder", "coreCollectionStoredOrder", "compareCoreCollectionStoredOrder", "assignCoreCollectionCategoryRanks", "coreCollectionCategoryRank", "coreCollectionCategoryMatches", "applyCoreCollectionFilters", "loadCoreCollectionList", "loadCoreCollectionProducts", "loadCoreCollectionStock", "renderCoreCollectionStockBadge", "updateCoreCollectionLoadMoreButton", "renderCoreCollectionList", "bindCoreCollectionActions", "enterCoreListMgmt", "resetCoreCollectionControls", "resetCoreInventoryFilters", "searchCoreInventoryWorkspace", "applyCoreInventoryFilters", "loadCoreListMgmt", "loadCoreListProducts", "fitCoreInventoryPage", "renderCoreListMgmt"];
const ast = acorn.parse(source, { ecmaVersion: "latest" });
const functions = ast.body.filter(n => n.type === "FunctionDeclaration" && names.includes(n.id.name));
assert.equal(functions.length, names.length);
let checks = 0;
function fixture() {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { value: id === "core-collection-state" ? "all" : "", innerHTML: "", textContent: "", disabled: false, attributes: {}, listeners: {}, style: {}, classList: { toggle() {}, remove() {} }, setAttribute(k, v) { this.attributes[k] = v; }, addEventListener(k, v) { this.listeners[k] = v; }, focus() { context.focused = id; }, querySelectorAll() { return []; } });
    return elements.get(id);
  };
  const context = {
    document: { getElementById: get, querySelector: () => null }, window: { matchMedia: () => ({ matches: true, addEventListener() {} }) }, console,
    t: key => key, productionCategoryLabel: p => p.category_code || "-", normalizeCoreProductFastRows: rows => rows,
    setCspStyle: (el, k, v) => { el.style[k] = v; }, canManageProductionRecords: () => true, canUploadCoreImages: () => true, isPC: () => true,
    canViewCoreManagement: () => true, showScreen: () => {},
    coreListMode: "collection", coreManagementLoadSeq: 0, coreManagementDataReady: false,
    coreCollectionRows: [], coreCollectionFilteredRows: [], coreCollectionProductMap: {}, coreCollectionStockMap: {}, coreCollectionRenderLimit: 50,
    CORE_COLLECTION_VEHICLE_CLASSES: [["kei","軽四"],["passenger","乗用車"],["truck","トラック"],["van","商用バン"],["bus","バス"],["machine","建機・農機"],["other","その他"]], coreCollectionPageStart: 0, coreCollectionPageSize: 1, coreCollectionPageHistory: [],
    CORE_COLLECTION_RENDER_PAGE_SIZE: 50, CORE_COLLECTION_CATEGORY_ORDER: ["starter", "alternator", "ac_compressor", "distributor", "other"], CORE_PRODUCT_FAST_SELECT: "*",
    coreListMgmtRows: [], coreListProductMap: {}, coreListVehicleMap: {}, coreListFilteredRows: [], coreListPageStart: 0, coreListPageSize: 0, coreListPageHistory: [], CORE_LIST_PAGE_SIZE: 50,
    formatDateTime: value => value || "-"
  };
  context.respond = () => ({ data: [], error: null });
  context.sb = { from(table) { let columns, bounds, ids; const query = { select(c) { columns = c; return query; }, order() { return query; }, in(key, values) { ids = values; return query; }, limit() { return query; }, range(start, end) { bounds = { start, end }; return query; }, then(resolve, reject) { return Promise.resolve().then(() => context.respond(table, columns, bounds, ids)).then(resolve, reject); } }; return query; } };
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
    assert.equal(c.coreManagementDataReady, false); checks++;
  }

  {
    const { c, get } = fixture();
    const all = Array.from({length:1078}, (_,i)=>({id:i+1,dkd_shohin_id:i+1,target_quantity:1,priority:"normal",status:"collecting"}));
    const ranges = [];
    c.respond = (table, columns, range) => {
      if (table !== "core_collection_list_items") return {data:[],error:null};
      ranges.push(range); return {data:all.slice(range.start,range.end+1),error:null};
    };
    await c.loadCoreCollectionList();
    assert.equal(c.coreCollectionRows.length,1078);checks++;
    assert.equal(c.coreCollectionFilteredRows.length,1078);checks++;
    assert.equal(ranges.length,3);checks++;
    assert.ok(ranges.every(r=>r.end-r.start===499));checks++;
    assert.match(get("core-list-count").innerHTML,/1078/);checks++;
  }
  {
    const { c, get } = fixture(); const original=[{id:99,dkd_shohin_id:99}]; c.coreCollectionRows=original;
    c.respond=(table, columns, range)=>table!=="core_collection_list_items"?{data:[],error:null}:range.start===0?{data:Array.from({length:500},(_,i)=>({id:i+1})),error:null}:{data:null,error:{message:"second page unavailable"}};
    await c.loadCoreCollectionList();
    assert.equal(c.coreManagementDataReady,false);checks++;
    assert.equal(c.coreCollectionRows,original);checks++;
    assert.equal(get("btn-export-core-collection").disabled,true);checks++;
    assert.match(get("core-list-list").innerHTML,/second page unavailable/);checks++;
  }

  {
    const { c, get } = fixture();
    const stock = [
      ...Array.from({ length: 50 }, (_, i) => ({ id: 100 - i, dkd_shohin_id: 1, quantity: 1 })),
      { id: 2, dkd_shohin_id: 2, quantity: 3, core_part_number: "TRUCK-200" },
      { id: 1, dkd_shohin_id: 3, quantity: 4, location: "A-1" },
      { id: 0, dkd_shohin_id: 4, quantity: 5, core_part_number: "PASS-400" }
    ];
    const lookups = [];
    c.respond = (table, columns, bounds, ids) => {
      if (table === "production_core_list_entries") return { data: stock.slice(bounds.start, bounds.end + 1) };
      if (table === "core_products") return { data: products.filter(row => ids.includes(row.dkd_shohin_id)) };
      lookups.push([...ids]);
      assert.equal(columns, "dkd_shohin_id,vehicle_classes");
      return { data: [
        { dkd_shohin_id: 1, vehicle_classes: ["kei", "passenger"] },
        { dkd_shohin_id: 2, vehicle_classes: ["truck"] },
        { dkd_shohin_id: 4, vehicle_classes: [] }
      ].filter(row => ids.includes(row.dkd_shohin_id)) };
    };
    await c.enterCoreListMgmt();
    assert.equal(c.coreListMode, "inventory"); checks++;
    assert.equal(c.coreListFilteredRows.length, 53); checks++;
    assert.deepEqual(lookups, [[1], [2, 3, 4]]); checks++;
    assert.match(get("core-list-list").innerHTML, /軽四.*乗用車/); checks++;
    get("core-inventory-vehicle").value = "passenger";
    c.searchCoreInventoryWorkspace();
    assert.equal(c.coreListFilteredRows.length, 50); checks++;
    get("core-inventory-vehicle").value = "truck";
    get("core-list-search").value = "ＴＲＵＣＫ２００";
    get("core-inventory-category").value = "alternator";
    c.searchCoreInventoryWorkspace();
    assert.deepEqual(Array.from(c.coreListFilteredRows, row => row.id), [2]); checks++;
    assert.match(get("core-list-count").innerHTML, /3<small/); checks++;
    assert.equal(get("core-inventory-filter-count").textContent, "(2)"); checks++;
    get("core-inventory-category").value = "starter";
    c.searchCoreInventoryWorkspace();
    assert.match(get("core-list-list").innerHTML, /no_results/); checks++;
    c.resetCoreInventoryFilters();
    get("core-inventory-vehicle").value = "unclassified";
    c.searchCoreInventoryWorkspace();
    assert.deepEqual(Array.from(c.coreListFilteredRows, row => row.id), [1, 0]); checks++;
    assert.match(get("core-list-count").innerHTML, /9<small/); checks++;
    const removed = [];
    c.window.innerHeight = 215;
    const row = id => ({ getBoundingClientRect: () => ({ height: 35 }), remove: () => removed.push(id) });
    assert.equal(c.fitCoreManagementRows({getBoundingClientRect: () => ({top: 55})}, [row(1), row(2), row(3)], {getBoundingClientRect: () => ({height: 10})}), 2); checks++;
    assert.deepEqual(removed, [3]); checks++;
    c.renderCoreManagementPager(2, 1, 3);
    assert.equal(get("core-collection-page-status").textContent, "3–3 / 3"); checks++;
    assert.equal(get("core-list-load-more").disabled, true); checks++;
  }
  {
    const { c, get } = fixture();
    c.coreListMode = "inventory";
    c.respond = table => table === "core_collection_list_items"
      ? { error: { message: "classification unavailable" } }
      : { data: [{ id: 1, dkd_shohin_id: 1, quantity: 3 }] };
    get("core-inventory-vehicle").value = "unclassified";
    await c.loadCoreListMgmt();
    assert.equal(c.coreManagementDataReady, false); checks++;
    assert.match(get("core-list-list").innerHTML, /classification unavailable/); checks++;
    assert.equal(get("core-list-count").innerHTML, ""); checks++;
  }

  console.log(`Core management workspace: ${checks} behavioral checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
