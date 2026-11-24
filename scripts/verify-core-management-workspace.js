const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const source = fs.readFileSync("app.js", "utf8");
const names = ["readCoreVehicleFilterSelection", "setCoreVehicleFilterSelection", "showCoreListDeleteConfirmation", "openCoreListDeleteConfirmation", "deleteCoreListRow", "closeCoreListForm", "coreInventoryPendingProduct", "updateCorePendingOutputs", "renderCoreInventoryPendingRow", "loadCorePendingStock","corePendingStockSearch","moveCorePendingStockPage","renderCorePendingStock"].concat(["coreCollectionVehicleSummaryHtml", "coreCollectionUiLabel", "renderCoreCollectionVehicleHtml", "coreCollectionVehicleClasses", "coreCollectionVehicleText", "fitCoreManagementRows", "renderCoreManagementPager", "coreCollectionVehicleMatches", "esc", "normalizeAsciiWidth", "norm", "normalizedContains", "sumProductionCoreEntryQty", "renderCoreManagementSummary", "clearCoreManagementCache", "getCoreManagementCache", "readCoreInventorySnapshot", "beginCoreManagementLoad", "searchCoreCollectionWorkspace", "clearCoreCollectionFilters", "resetCoreCollectionFilters", "bindCoreManagementTabs", "setCoreListMode", "coreCollectionStatusLabel", "coreCollectionRank", "coreCollectionDisplayProduct", "buildCoreCollectionRankingRows", "isCoreReplenishmentRow", "coreCollectionStockQty", "coreCollectionShortageQty", "coreCollectionCategoryKey", "coreCollectionStoredOrder", "compareCoreCollectionStoredOrder", "assignCoreCollectionCategoryRanks", "coreCollectionCategoryRank", "coreCollectionCategoryMatches", "applyCoreCollectionFilters", "getCoreCollectionSearchTerms", "indexCoreCollectionRows", "loadCoreCollectionList", "loadCoreCollectionItems", "loadCoreCollectionProducts", "resolveCoreCollectionRankingCodes", "readCoreCollectionStock", "renderCoreCollectionStockBadge", "renderCoreCollectionList", "renderCoreCollectionClassifyButton", "coreCollectionEditAttributes", "renderCoreCollectionQuantity", "renderCoreCollectionRow", "appendCoreCollectionRows", "loadMoreCoreCollectionRowsOnScroll", "enterCoreListMgmt", "resetCoreCollectionControls", "resetCoreInventoryFilters", "submitCoreInventorySearch", "isKoreanCoreInventoryEntry", "coreInventoryVehicleClasses", "applyCoreInventoryFilters", "loadCoreListMgmt", "loadCoreListProducts", "renderCoreListMgmt", "renderCoreInventoryRow", "appendCoreInventoryRows", "loadMoreCoreInventoryRowsOnScroll"]);
const ast = acorn.parse(source, { ecmaVersion: "latest" });
const functions = ast.body.filter(n => n.type === "FunctionDeclaration" && names.includes(n.id.name));
assert.equal(functions.length, names.length);
let checks = 0;
function fixture() {
  const elements = new Map();
  const vehicleFilters = ["kei", "truck", "unclassified"].map(value => ({value, checked: false}));
  const inventoryVehicleFilters = ["kei", "truck", "unclassified", "passenger"].map(value => ({value, checked: false}));
  const get = id => {
    if (!elements.has(id)) elements.set(id, { scrollTop: 0, scrollHeight: 900, clientHeight: 300, value: id === "core-collection-state" ? "all" : "", innerHTML: "", textContent: "", disabled: false, attributes: {}, listeners: {}, style: {}, classList: { toggle() {}, remove() {} }, setAttribute(k, v) { this.attributes[k] = v; }, addEventListener(k, v) { this.listeners[k] = v; }, focus() { context.focused = id; }, querySelectorAll() { return []; }, querySelector(selector) {
      const rowAttribute = selector.slice(1, -1);
      if (!["data-core-collection-rows", "data-core-inventory-rows"].includes(rowAttribute) || !this.innerHTML.includes(rowAttribute)) return null;
      return { tagName: this.innerHTML.includes("<tbody " + rowAttribute + ">") ? "TBODY" : "DIV",
        insertAdjacentHTML: (_, html) => { this.innerHTML += html; } };
    }, getBoundingClientRect() { return { top: 0, height: 24 }; } });
    return elements.get(id);
  };
  const context = {
    document: { getElementById: get, querySelector: () => null, querySelectorAll(selector) {
      const group = selector.startsWith("#core-inventory-vehicle-filters ") ? inventoryVehicleFilters : vehicleFilters;
      return selector.endsWith(":checked") ? group.filter(input => input.checked) : group;
    } }, window: { innerHeight: 900, innerWidth: 1440, matchMedia: () => ({ matches: true, addEventListener() {} }) }, console,
    t: key => key, productionCategoryLabel: p => p.category_code || "-", normalizeCoreProductFastRows: rows => rows,
    setCspStyle: (el, k, v) => { el.style[k] = v; }, canManageProductionRecords: () => true, canUploadCoreImages: () => true, isPC: () => true,
    canViewCoreManagement: () => true, canViewManufacturingReport: () => false, showScreen: () => {},
    coreCollectionReportRank: null, coreInventoryRenderedCount: 0,
    currentUser: { id: "test-user" }, userProfile: {}, coreManagementCache: null, CORE_MANAGEMENT_CACHE_MS: 30000,
    coreListMode: "collection", coreManagementLoadSeq: 0, coreManagementDataReady: false,
    corePendingStockRows: [], corePendingStockFiltered: [], corePendingStockPage: 0, corePendingStockSize: 0, corePendingStockHistory: [],
    coreCollectionRows: [], coreCollectionRankingRows: [], coreCollectionCategoryRanks: new Map(), coreCollectionFilteredRows: [], coreCollectionProductMap: {}, coreCollectionStockMap: {}, coreCollectionRenderedCount: 0, coreCollectionOrderedRows: [], coreCollectionSearchTerms: new WeakMap(),
    CORE_COLLECTION_VEHICLE_CLASSES: [["kei","軽四"],["passenger","乗用車"],["truck","トラック"],["van","商用バン"],["bus","バス"],["machine","建機・農機"],["other","その他"]],
    CORE_MANAGEMENT_RENDER_BATCH_SIZE: 50, CORE_COLLECTION_CATEGORY_ORDER: ["starter", "alternator", "ac_compressor", "distributor", "other"], CORE_PRODUCT_FAST_SELECT: "*",
    coreInventoryFilters: { keyword: "", vehicles: [], category: "", memo: "", korea: "exclude" },
    coreListMgmtRows: [], coreInventoryPendingRows: [], inventoryPendingFixture: [],
    coreListProductMap: {}, coreListVehicleMap: {}, coreListFilteredRows: [], CORE_LIST_PAGE_SIZE: 50,
    formatDateTime: value => value || "-"
  };
  context.respond = () => ({ data: [], error: null });
  context.sb = {
    async rpc(name) {
      assert.equal(name, "read_core_inventory_snapshot");
      const result = await context.respond("production_core_list_entries", "*", { start: 0, end: 999 });
      if (result.error) return result;
      return { data: { linked: (result.data || []).filter(row => !row.replaced_at), pending: context.inventoryPendingFixture } };
    },
    from(table) { let columns, bounds, ids; const query = { select(c) { columns = c; return query; }, order() { return query; }, eq() { return query; }, in(key, values) { ids = values; return query; }, limit() { return query; }, range(start, end) { bounds = { start, end }; return query; }, then(resolve, reject) { return Promise.resolve().then(() => context.respond(table, columns, bounds, ids)).then(resolve, reject); } }; return query; } };
  vm.createContext(context);
  vm.runInContext(functions.map(n => source.slice(n.start, n.end)).join("\n"), context);
  return { c: context, get, vehicleFilters, inventoryVehicleFilters };
}
const rows = [{ id: 1, dkd_shohin_id: 1, target_quantity: 10, priority: "high", status: "collecting" }, { id: 2, dkd_shohin_id: 2, target_quantity: 4, priority: "normal", status: "completed" }];
const products = [{ dkd_shohin_id: 1, manufacturer_part_number: "TEST-123", category_code: "starter" }, { dkd_shohin_id: 2, manufacturer_part_number: "TEST-456", category_code: "alternator" }];
function ready(c) { c.respond = (table, columns) => ({ data: table === "core_collection_list_items" ? rows : table === "core_products" ? products : [{ id: 1, dkd_shohin_id: 1, quantity: 3, core_part_number: "CORE-123" }], error: null }); }
async function main() {
  {
    const { c, get, vehicleFilters, inventoryVehicleFilters } = fixture();
    const settings = [
      { id: 1, dkd_shohin_id: 1, vehicle_classes: ["kei", "passenger"] },
      { id: 2, dkd_shohin_id: 2, vehicle_classes: ["truck"] }
    ];
    c.respond = table => ({
      data: table === "core_collection_list_items" ? settings : table === "core_products" ? products : [
        { id: 41, dkd_shohin_id: 1, quantity: 1 },
        { id: 42, dkd_shohin_id: 2, quantity: 2 },
        { id: 43, dkd_shohin_id: 3, quantity: 3 }
      ]
    });
    await c.setCoreListMode("collection");
    vehicleFilters[0].checked = true;
    vehicleFilters[1].checked = true;
    get("core-workspace-filter-options").open = true;
    await c.searchCoreCollectionWorkspace();
    assert.equal(get("core-workspace-filter-options").open, false); checks++;
    assert.equal(c.focused, "btn-core-collection-search"); checks++;
    assert.deepEqual(inventoryVehicleFilters.filter(input => input.checked).map(input => input.value), ["kei", "truck"]); checks++;
    await c.setCoreListMode("inventory");
    assert.deepEqual(Array.from(c.coreListFilteredRows, row => row.id), [41, 42]); checks++;
    assert.match(get("core-list-list").innerHTML, /軽四.*乗用車/); checks++;
    assert.match(get("core-list-list").innerHTML, /トラック/); checks++;
    c.resetCoreInventoryFilters();
    await c.submitCoreInventorySearch();
    assert.deepEqual(Array.from(c.coreListFilteredRows, row => row.id), [41, 42, 43]); checks++;
  }
  {
    const { c, get } = fixture();
    get("core-workspace-filter-options").open = true;
    let reloaded = false;
    c.loadCoreCollectionList = () => {
      reloaded = true;
      assert.equal(get("core-workspace-filter-options").open, false); checks++;
    };
    c.searchCoreCollectionWorkspace();
    assert.equal(reloaded, true); checks++;
  }

  {
    const { c, get } = fixture();
    const sources = [];
    let stockQty = 2;
    c.respond = table => {
      sources.push(table);
      return { data: table === "production_core_list_entries"
        ? Array.from({ length: 55 }, (_, i) => ({ id: i + 1, dkd_shohin_id: 1, core_part_number: "CORE-STOCK-" + String(i + 1).padStart(2, "0"), quantity: stockQty }))
        : table === "core_collection_list_items" ? rows : products };
    };
    await c.enterCoreListMgmt();
    assert.equal(c.coreListFilteredRows.length, 55); checks++;
    assert.match(get("core-list-count").innerHTML, /110<small>台/); checks++;
    assert.match(get("core-list-list").innerHTML, /CORE-STOCK-50/); checks++;
    assert.doesNotMatch(get("core-list-list").innerHTML, /CORE-STOCK-55/); checks++;
    get("core-list-list").scrollTop = 600;
    c.loadMoreCoreInventoryRowsOnScroll();
    assert.match(get("core-list-list").innerHTML, /CORE-STOCK-55/); checks++;
    get("core-list-search").value = "CORE-STOCK-55";
    await c.submitCoreInventorySearch();
    assert.equal(c.coreInventoryRenderedCount, 1); checks++;
    assert.match(get("core-list-list").innerHTML, /CORE-STOCK-55/); checks++;
    c.resetCoreInventoryFilters();
    await c.setCoreListMode("collection");
    assert.equal(sources.filter(table => table === "production_core_list_entries").length, 1); checks++;
    sources.length = 0;
    await c.setCoreListMode("inventory");
    await c.setCoreListMode("collection");
    assert.deepEqual(sources, []); checks++;
    stockQty = 3;
    c.clearCoreManagementCache();
    await c.setCoreListMode("inventory");
    assert.match(get("core-list-count").innerHTML, /165<small>台/); checks++;
    assert.equal(sources.filter(table => table === "production_core_list_entries").length, 1); checks++;
    stockQty = 4;
    c.currentUser = { id: "second-test-user" };
    await c.setCoreListMode("inventory");
    assert.match(get("core-list-count").innerHTML, /220<small>台/); checks++;
    c.coreManagementCache.inventory = c.coreManagementCache.stock.expiresAt = 0;
    stockQty = 5;
    await c.setCoreListMode("inventory");
    assert.match(get("core-list-count").innerHTML, /275<small>台/); checks++;
  }
  {
    const { c } = fixture();
    const p = (id, part, oem) => ({ dkd_shohin_id:id, category_code:"alternator", manufacturer_part_number:part, genuine_part_number:oem });
    const parts={2586:p(2586,"102211-7150","27060-B2160"),77:p(77,"PART77","OEM77"),78:p(78,"PART77","OEM77"),88:p(88,"PART88","OEM88")};
    const d = (id, code, part, oem) => ({dkd_shohin_id:id,dks_search_parts:{dks_shohin_cd:code,manufacturer_part_number:part,genuine_part_number:oem}});
    const ranks={28801:{rank:13,maker:"102211-7150",genuine:"27060-B2160"},77:{rank:14,maker:"PART77",genuine:"OEM77"},88:{rank:15,maker:"PART88",genuine:"OEM88"}};
    c.respond=(table, cols, range, ids)=>{
      assert.equal(table,"core_product_dks_links");assert.equal(ids.length,4);
      return {data:[d(2586,28801,"1022117150","27060B2160"),d(77,77,"PART77","OEM77"),d(78,77,"PART77","OEM77"),d(88,88,"PART88","OTHER")],error:null};
    };
    await c.resolveCoreCollectionRankingCodes(parts,{forProduct:r=>ranks[r.dks_shohin_cd]},()=>{});
    assert.equal(parts[2586].dks_shohin_cd,"28801"); checks++;
    assert.equal(parts[77].dks_shohin_cd,undefined); checks++;
    assert.equal(parts[78].dks_shohin_cd,undefined); checks++;
    assert.equal(parts[88].dks_shohin_cd,undefined); checks++;
  }
  {
    const entry = ast.body.flatMap(node => node.declarations || []).find(node => node.id.name === "corePalletEntry");
    const adapter = entry.init.arguments[0].properties.find(node => node.key.name === "search").value;
    const lookupCalls = [];
    const candidate = { dkd_shohin_id: 42, genuine_part_number_2: "TEST-OEM2" };
    const search = vm.runInNewContext("(" + source.slice(adapter.start, adapter.end) + ")", {
      fetchCoreProductMasterMatches: async (...args) => {
        lookupCalls.push(args);
        return { data: [candidate], error: null };
      }
    });
    assert.deepEqual((await search("TEST-OEM2")).data, [candidate]); checks++;
    assert.deepEqual(lookupCalls, [["TEST-OEM2", null, 20]]); checks++;
  }
  {
    const { c, get } = fixture(); ready(c); c.coreListMode = "inventory";
    c.inventoryPendingFixture = [
      { entry_key: "legacy:1", revision: 0, source_sheet: "セルモーター", source_part_number: "RAW-123", pallet_no: "PALLET-A", quantity: 5 },
      { entry_key: "manual:1", revision: 1, source_part_number: "UNLINK-321", pallet_no: "PALLET-B", source_remarks: "ABC-MEMO", quantity: 2 }
    ];
    await c.loadCoreListMgmt();
    assert.deepEqual(Array.from(c.coreListFilteredRows, row => row.quantity), [3, 5, 2]); checks++;
    assert.match(get("core-list-count").innerHTML, /core_inventory_physical.*10<small>台/); checks++;
    assert.match(get("core-list-count").innerHTML, /core_pending_tab.*7<small>台/); checks++;
    assert.match(get("core-list-list").innerHTML, /data-inventory-pending-match/); checks++;
    c.coreInventoryFilters.matchState = "pending"; c.applyCoreInventoryFilters(); c.renderCoreListMgmt();
    assert.equal(c.coreListFilteredRows.length, 2); checks++;
    assert.doesNotMatch(get("core-list-list").innerHTML, /data-core-edit|data-core-del/); checks++;
    c.coreInventoryFilters.keyword = "palletb"; c.applyCoreInventoryFilters();
    assert.equal(c.coreListFilteredRows[0].core_part_number, "UNLINK-321"); checks++;
    c.coreInventoryFilters.keyword = ""; c.coreInventoryFilters.korea = "only"; c.applyCoreInventoryFilters();
    assert.equal(c.coreListFilteredRows.length, 0); checks++;
    c.coreInventoryFilters.korea = "exclude"; c.coreInventoryFilters.matchState = "linked"; c.applyCoreInventoryFilters();
    assert.deepEqual(Array.from(c.coreListFilteredRows, row => row.quantity), [3]); checks++;
  }
  {
    const { c, get } = fixture();
    const rows = Array.from({ length: 51 }, (_, i) => ({ entry_key: "test:" + i, revision: 0, source_sheet: i === 50 ? null : "セルモーター", source_row: i === 50 ? null : i + 5, pallet_no: "PLT-" + i, source_part_number: i === 50 ? "PN-50<&" : "OTHER", quantity: 2 }));
    const sources = [];
    c.respond = (table, columns, range) => {
      sources.push(table);
      if (table === "production_core_pending_stock") return { data: rows.slice(range.start, range.end + 1) };
      if (table === "production_core_list_entries") return { data: [{ id: 1, dkd_shohin_id: 1, quantity: 0, replaced_at: "2026-11-19" }, { id: 2, dkd_shohin_id: 2, quantity: 3 }] };
      return { data: [] };
    };
    await c.enterCoreListMgmt();
    assert.equal(c.coreListMode, "inventory"); checks++;
    assert.equal(get("btn-core-list-mode-inventory").attributes["aria-selected"], "true"); checks++;
    assert.equal(get("core-management-panel").attributes["aria-labelledby"], "btn-core-list-mode-inventory"); checks++;
    assert.equal(get("core-pending-outputs").hidden, true); checks++;
    assert.match(get("core-list-count").innerHTML, /3<small>台/); checks++;
    assert.ok(sources.includes("production_core_list_entries")); checks++;
    assert.ok(!sources.includes("production_core_pending_stock")); checks++;
    sources.length = 0;
    await c.setCoreListMode("pending");
    assert.equal(get("core-pending-outputs").hidden, false); checks++;
    assert.equal(get("btn-core-pending-excel").disabled, false); checks++;
    assert.deepEqual(sources, ["production_core_pending_stock", "production_core_pending_stock"]); checks++;
    assert.equal(c.corePendingStockFiltered.length, 51); checks++;
    assert.match(get("core-list-count").innerHTML, /102<small>台/); checks++;
    get("core-pending-search").value = "ＰＬＴ５０";
    c.corePendingStockSearch();
    assert.equal(c.corePendingStockFiltered.length, 1); checks++;
    assert.match(get("core-list-list").innerHTML, /PN-50&amp;lt;|PN-50&lt;&amp;/); checks++;
    assert.doesNotMatch(get("core-list-list").innerHTML, /data-core-edit|data-core-del/); checks++;
    assert.match(get("core-list-list").innerHTML, /core_pallet_manual/); checks++;
    assert.match(get("core-list-list").innerHTML, /data-core-pending-match/); checks++;
    assert.doesNotMatch(get("core-list-list").innerHTML, /pending-detail/); checks++;
    get("core-pending-search").value = "ABSENT";
    c.corePendingStockSearch();
    assert.equal(get("btn-core-pending-print").disabled, true); checks++;
    assert.equal(get("btn-core-pending-excel").disabled, true); checks++;
    get("core-pending-search").value = "";
    c.corePendingStockSearch();
    c.canManageProductionRecords = () => false;
    c.renderCorePendingStock();
    assert.doesNotMatch(get("core-list-list").innerHTML, /data-core-pending-match/); checks++;
    c.canManageProductionRecords = () => true;
    await c.setCoreListMode("inventory");
    assert.equal(c.coreListMgmtRows.length, 1); checks++;
    assert.match(get("core-list-count").innerHTML, /3<small>台/); checks++;
  }
  {
    const { c, get } = fixture(); ready(c); await c.loadCoreCollectionList();
    assert.match(get("core-list-count").innerHTML, /14<small/); checks++;
    assert.match(get("core-list-count").innerHTML, /11<small/); checks++;
    assert.equal(get("btn-export-core-collection").disabled, false); checks++;
    c.CORE_MANAGEMENT_RENDER_BATCH_SIZE = 1; c.renderCoreCollectionList();
    const list = get("core-list-list");
    assert.equal(c.coreCollectionRenderedCount, 1); checks++;
    assert.match(list.innerHTML, /コアあり 3/); checks++;
    assert.match(list.innerHTML, /aria-label='必要数を編集' data-core-classify='1'/); checks++;
    assert.doesNotMatch(list.innerHTML, /TEST-456/); checks++;
    c.loadMoreCoreCollectionRowsOnScroll();
    assert.equal(c.coreCollectionRenderedCount, 1); checks++;
    list.scrollTop = 600;
    c.loadMoreCoreCollectionRowsOnScroll(); c.loadMoreCoreCollectionRowsOnScroll();
    assert.equal(c.coreCollectionRenderedCount, 2); checks++;
    assert.equal((list.innerHTML.match(/TEST-456/g) || []).length, 1); checks++;
    assert.equal(list.scrollTop, 600); checks++;
    assert.match(list.innerHTML, /在庫なし/); checks++;
    assert.match(get("core-list-count").innerHTML, /14<small/); checks++;
    get("core-collection-state").value = "needed"; c.applyCoreCollectionFilters(); c.renderCoreCollectionList();
    assert.equal(c.coreCollectionFilteredRows.length, 2); checks++;
    get("core-collection-category").value = "starter"; get("core-list-search").value = "inventory draft";
    c.clearCoreCollectionFilters(); assert.equal(c.coreCollectionFilteredRows.length, 2); checks++;
    assert.equal(get("core-list-search").value, "inventory draft"); checks++;
    get("core-collection-search").value = "ＴＥＳＴ１２３"; c.applyCoreCollectionFilters(); assert.equal(c.coreCollectionFilteredRows.length, 1); checks++;
    c.renderCoreManagementSummary([{ label: "<script>", value: 2, unit: "台" }], "<img>");
    assert.doesNotMatch(get("core-list-count").innerHTML, /<script>|<img>/); checks++;
  }
  {
    const { c, get, vehicleFilters } = fixture();
    const collection = [
      { id: 1, dkd_shohin_id: 1, target_quantity: 5, status: "collecting", source_type: "ranking" },
      { id: 2, dkd_shohin_id: 2, target_quantity: 2, status: "collecting", source_type: "production" },
      { id: 3, dkd_shohin_id: 3, target_quantity: 1, status: "paused", source_type: "ranking" },
      { id: 4, dkd_shohin_id: 4, target_quantity: 1, status: "collecting", source_type: "ranking" },
      { id: 5, dkd_shohin_id: 5, target_quantity: 4, status: "collecting", source_type: "ranking", vehicle_classes: ["kei", "truck"] }
    ];
    c.canViewManufacturingReport = () => true;
    c.window.DCatsManufacturingRankingReport = {
      async loadCoreCollectionRanking2025(checkCurrent) {
        checkCurrent();
        return { rows: [], forProduct: p => p && p.rank ? { rank: p.rank, shipment: 10 } : null };
      }
    };
    c.inventoryPendingFixture = [{ dkd_shohin_id: 1, quantity: 99 }];
    c.respond = table => ({ data: table === "core_collection_list_items" ? collection : table === "core_products"
      ? collection.map(row => ({ dkd_shohin_id: row.id, rank: { 1: 9, 2: 3, 3: 7, 5: 5 }[row.id] }))
      : [{ dkd_shohin_id: 1, quantity: 1 }, { dkd_shohin_id: 1, quantity: 1 }, { dkd_shohin_id: 2, quantity: 2 },
        { dkd_shohin_id: 1, quantity: 99, note: "韓国コア現存在庫 / QA" }, { dkd_shohin_id: 1, quantity: 99, replaced_at: "2026-11-19" }] });
    await c.loadCoreCollectionList();
    const ids = () => Array.from(c.coreCollectionFilteredRows, x => x.id);
    assert.deepEqual(ids(), [2, 5, 3, 1, 4]); checks++;
    assert.equal(c.coreCollectionShortageQty(collection[0]), 3); checks++;
    assert.equal(get("btn-export-core-replenishment").disabled, false); checks++;
    get("core-collection-state").value = "replenishment";
    c.applyCoreCollectionFilters();
    assert.deepEqual(ids(), [5, 3, 1]); checks++;
    get("core-collection-source").value = "production";
    c.applyCoreCollectionFilters();
    assert.deepEqual(ids(), []); checks++;
    get("core-collection-source").value = "ranking";
    vehicleFilters[1].checked = true;
    c.applyCoreCollectionFilters();
    assert.deepEqual(ids(), [5]); checks++;
    vehicleFilters[2].checked = true;
    c.applyCoreCollectionFilters();
    assert.deepEqual(ids(), [5, 3, 1]); checks++;
    vehicleFilters[0].checked = true;
    c.applyCoreCollectionFilters();
    assert.deepEqual(ids(), [5, 3, 1]); checks++;
    c.renderCoreCollectionList();
    assert.doesNotMatch(get("core-list-list").innerHTML, /優先度/); checks++;
    c.clearCoreCollectionFilters();
    assert.ok(vehicleFilters.every(input => !input.checked)); checks++;
    assert.deepEqual(ids(), [2, 5, 3, 1, 4]); checks++;
    c.window.DCatsManufacturingRankingReport.loadCoreCollectionRanking2025 = async () => { throw Error("report unavailable"); };
    await c.loadCoreCollectionList();
    assert.equal(get("btn-export-core-replenishment").disabled, true); checks++;
    assert.equal(get("btn-export-core-collection").disabled, false); checks++;
    assert.match(get("core-list-count").innerHTML, /2025年の順位を取得できません/); checks++;
  }
  {
    const { c, get, vehicleFilters } = fixture();
    const ranked = [
      { rank: 1, productCode: "QA-RANK-1", maker: "REPORT-ONLY<&", productName: "スタータ" },
      { rank: 2, productCode: "QA-RANK-2", maker: "STOCK-ONLY", productName: "大型オルタネータ" },
      { rank: 3, productCode: "QA-RANK-3", maker: "SAVED", productName: "スタータ" },
      { rank: 4, productCode: "QA-RANK-4", maker: "AMBIGUOUS", productName: "オルタネータ" },
      { rank: 5, productCode: "QA-RANK-5", maker: "ANOTHER-CATEGORY", productName: "ACコンプレッサ" }
    ];
    const saved = [{ id: 9, dkd_shohin_id: 9, target_quantity: 3, status: "collecting", source_type: "manual" }];
    const stock = [{ dkd_shohin_id: 5, quantity: 4 }, { dkd_shohin_id: 7, quantity: 15 }, { dkd_shohin_id: 8, quantity: 20 }];
    const products = [{ dkd_shohin_id: 5, rank: 2 }, { dkd_shohin_id: 7, rank: 4 }, { dkd_shohin_id: 8, rank: 4 },
      { dkd_shohin_id: 9, rank: 3, category_code: "starter", manufacturer_part_number: "SAVED-CATALOG" }];
    c.canViewManufacturingReport = () => true;
    c.window.DCatsManufacturingRankingReport = {
      async loadCoreCollectionRanking2025() {
        return { rows: ranked, forProduct: p => p ? ranked[p.rank - 1] : null };
      }
    };
    c.respond = table => ({ data: table === "core_collection_list_items" ? saved : table === "core_products" ? products : stock });
    c.coreListMode = "inventory";
    get("core-collection-state").value = "replenishment";
    get("core-collection-search").value = "absent";
    get("core-collection-source").value = "gltek";
    vehicleFilters[0].checked = true;
    await c.setCoreListMode("collection");
    const ranks = () => Array.from(c.coreCollectionFilteredRows, row => c.coreCollectionRank(row).rank);
    assert.deepEqual(ranks(), [1, 2, 5, 3, 4]); checks++;
    assert.deepEqual(Array.from(c.coreCollectionFilteredRows, row => c.coreCollectionCategoryRank(row)), [1, 1, 1, 2, 2]); checks++;
    assert.equal(get("core-workspace-filter-count").textContent, ""); checks++;
    assert.deepEqual(Array.from(c.coreCollectionRows, row => row.id), [9]); checks++;
    assert.equal(c.coreCollectionRankingRows[1].dkd_shohin_id, "5"); checks++;
    assert.equal(c.coreCollectionStockQty(c.coreCollectionRankingRows[1]), 4); checks++;
    assert.equal(c.coreCollectionRankingRows[2].dkd_shohin_id, null); checks++;
    assert.match(get("core-list-list").innerHTML, /REPORT-ONLY&lt;&amp;/); checks++;
    assert.match(get("core-list-list").innerHTML, /在庫なし/); checks++;
    assert.doesNotMatch(get("core-list-list").innerHTML, /未照合/); checks++;
    assert.doesNotMatch(get("core-list-list").innerHTML, /data-core-collection-edit='undefined'/); checks++;
    get("core-collection-state").value = "replenishment"; c.applyCoreCollectionFilters();
    assert.deepEqual(ranks(), [3]); checks++;
    get("core-collection-state").value = "sufficient"; c.applyCoreCollectionFilters();
    assert.deepEqual(ranks(), []); checks++;
    get("core-collection-state").value = "unregistered"; c.applyCoreCollectionFilters();
    assert.deepEqual(ranks(), [1, 2, 5, 4]); checks++;
    get("core-collection-category").value = "alternator"; c.applyCoreCollectionFilters();
    assert.deepEqual(ranks(), [2, 4]); checks++;
    assert.deepEqual(Array.from(c.coreCollectionFilteredRows, row => c.coreCollectionCategoryRank(row)), [1, 2]); checks++;
    get("core-collection-search").value = "QA-RANK-4"; c.applyCoreCollectionFilters();
    assert.deepEqual(ranks(), [4]); checks++;
    assert.equal(c.coreCollectionCategoryRank(c.coreCollectionFilteredRows[0]), 2); checks++;
    c.clearCoreCollectionFilters();
    get("core-collection-search").value = "QA-RANK-1"; c.applyCoreCollectionFilters();
    assert.deepEqual(ranks(), [1]); checks++;
    c.respond = table => ({ data: table === "core_collection_list_items" ? [] : table === "core_products" ? products : stock });
    await c.loadCoreCollectionList();
    assert.match(get("core-list-list").innerHTML, /REPORT-ONLY/); checks++;
    await c.setCoreListMode("inventory");
    await c.setCoreListMode("collection");
    assert.deepEqual(ranks(), [1, 2, 5, 3, 4]); checks++;
    assert.deepEqual(Array.from(c.coreCollectionFilteredRows, row => c.coreCollectionCategoryRank(row)), [1, 1, 1, 2, 2]); checks++;
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
    const latest = c.setCoreListMode("collection");
    release({ data: [{ id: 90, dkd_shohin_id: 99, quantity: 99 }], error: null });
    await latest;
    const html = get("core-list-list").innerHTML;
    await old;
    assert.equal(get("core-list-list").innerHTML, html); checks++;
    assert.equal(c.coreListMgmtRows.length, 0); checks++;
  }
  {
    const { c } = fixture(); let release; const pending = new Promise(r => { release = r; }); c.respond = () => pending;
    const old = c.readCoreCollectionStock(c.getCoreManagementCache(), () => {
      if (c.coreManagementLoadSeq !== 0) throw new Error("superseded");
    });
    const rejected = assert.rejects(old, /superseded/);
    c.coreManagementLoadSeq = 1; c.coreCollectionStockMap = { 1: { quantity: 5, parts: [], locations: [] } };
    release({ data: [{ dkd_shohin_id: 1, quantity: 99 }], error: null }); await rejected;
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
      ranges.push(range); return {data:all.slice(range.start,range.end+1),count:all.length,error:null};
    };
    await c.loadCoreCollectionList();
    assert.equal(c.coreCollectionRows.length,1078);checks++;
    assert.equal(c.coreCollectionFilteredRows.length,1078);checks++;
    assert.equal(ranges.length,2);checks++;
    assert.ok(ranges.every(r=>r.end-r.start===999));checks++;
    assert.match(get("core-list-count").innerHTML,/1078/);checks++;
  }
  {
    const { c, get } = fixture(); const original=[{id:99,dkd_shohin_id:99}]; c.coreCollectionRows=original;
    c.respond=(table, columns, range)=>table!=="core_collection_list_items"?{data:[],error:null}:range.start===0?{data:Array.from({length:1000},(_,i)=>({id:i+1})),count:1200,error:null}:{data:null,error:{message:"second page unavailable"}};
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
      { id: 2, dkd_shohin_id: 2, quantity: 3, core_part_number: "TRUCK-200", note: "回収済 ＡＢＣ－１２３" },
      { id: 1, dkd_shohin_id: 3, quantity: 4, location: "A-1", core_part_number: "ABC123" },
      { id: 0, dkd_shohin_id: 4, quantity: 5, core_part_number: "PASS-400", note: "回収待ち" }
    ];
    const lookups = [];
    c.respond = (table, columns, bounds, ids) => {
      if (table === "production_core_list_entries") return { data: stock.slice(bounds.start, bounds.end + 1) };
      if (table === "core_products") return { data: products.map(row => row.dkd_shohin_id === 2 ? { ...row, body_type: "Kei car" } : row).filter(row => ids.includes(row.dkd_shohin_id)) };
      lookups.push([...ids]);
      assert.equal(columns, "dkd_shohin_id,vehicle_classes");
      return { data: [
        { dkd_shohin_id: 1, vehicle_classes: ["kei", "passenger"] },
        { dkd_shohin_id: 2, vehicle_classes: ["truck"] },
        { dkd_shohin_id: 4, vehicle_classes: [] }
      ].filter(row => ids.includes(row.dkd_shohin_id)) };
    };
    await c.setCoreListMode("inventory");
    assert.equal(c.coreListMode, "inventory"); checks++;
    assert.equal(c.coreListFilteredRows.length, 53); checks++;
    assert.equal((get("core-list-list").innerHTML.match(/<tbody data-core-inventory-rows>/g) || []).length, 1); checks++;
    get("core-list-list").scrollTop = 600;
    c.loadMoreCoreInventoryRowsOnScroll();
    assert.match(get("core-list-list").innerHTML, /PASS-400/); checks++;
    assert.equal(get("core-list-list").tabIndex, 0); checks++;
    get("core-list-list").scrollTop = 100;
    assert.deepEqual(lookups, [[1, 2, 3, 4]]); checks++;
    assert.match(get("core-list-list").innerHTML, /軽四.*乗用車/); checks++;
    get("core-inventory-filter-options").open = true;
    c.setCoreVehicleFilterSelection("core-inventory-vehicle-filters", ["passenger"]);
    assert.equal(c.coreListFilteredRows.length, 53); checks++;
    await c.submitCoreInventorySearch();
    assert.equal(get("core-inventory-filter-options").open, false); checks++;
    assert.equal(c.focused, "btn-core-list-search"); checks++;
    assert.equal(c.coreListFilteredRows.length, 50); checks++;
    assert.equal(get("core-list-list").scrollTop, 0); checks++;
    get("core-inventory-memo").value = "abc123";
    c.setCoreVehicleFilterSelection("core-inventory-vehicle-filters", []);
    await c.submitCoreInventorySearch();
    assert.deepEqual(Array.from(c.coreListFilteredRows, row => row.id), [2]); checks++;
    assert.equal(get("core-inventory-filter-count").textContent, "(1)"); checks++;
    c.resetCoreInventoryFilters();
    assert.equal(get("core-inventory-memo").value, ""); checks++;
    c.setCoreVehicleFilterSelection("core-inventory-vehicle-filters", ["truck"]);
    get("core-list-search").value = "ＴＲＵＣＫ２００";
    get("core-inventory-category").value = "alternator";
    await c.submitCoreInventorySearch();
    assert.deepEqual(Array.from(c.coreListFilteredRows, row => row.id), [2]); checks++;
    assert.match(get("core-list-count").innerHTML, /3<small/); checks++;
    assert.equal(get("core-inventory-filter-count").textContent, "(2)"); checks++;
    get("core-inventory-category").value = "starter";
    await c.submitCoreInventorySearch();
    assert.match(get("core-list-list").innerHTML, /no_results/); checks++;
    c.resetCoreInventoryFilters();
    c.setCoreVehicleFilterSelection("core-inventory-vehicle-filters", ["unclassified"]);
    await c.submitCoreInventorySearch();
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
    c.setCoreVehicleFilterSelection("core-inventory-vehicle-filters", ["unclassified"]);
    await c.loadCoreListMgmt();
    assert.equal(c.coreManagementDataReady, false); checks++;
    assert.match(get("core-list-list").innerHTML, /classification unavailable/); checks++;
    assert.equal(get("core-list-count").innerHTML, ""); checks++;
  }

  {
    const { c } = fixture();
    const cases = [
      [{ body_type: "Ｋｅｉ car" }, ["kei"]],
      [{ body_type: "sedan/minivan" }, ["passenger"]],
      [{ vehicle_manufacturer: "HYUNDAI", compatible_car_models: "Porter2Intercooler TCI" }, ["truck"]],
      [{ vehicle_manufacturer: "MITSUBISHI FUSO", body_type: "track", compatible_car_models: "Canter/Canter Guts" }, ["truck"]],
      [{ vehicle_manufacturer: "KIA", compatible_car_models: "Bongo3 CRDI" }, ["truck"]],
      [{ vehicle_manufacturer: "MAZDA", compatible_car_models: "Bongo3 CRDI" }, []],
      [{ vehicle_manufacturer: "HYUNDAI / KIA", compatible_car_models: "YFSonata/K5" }, ["passenger"]],
      [{ vehicle_manufacturer: "HYUNDAI", compatible_car_models: "Sonata / Porter2" }, ["truck", "passenger"]],
      [{ vehicle_manufacturer: "KIA", compatible_car_models: "K50" }, []],
      [{ vehicle_manufacturer: "SUZUKI", body_type: "Kei car", compatible_car_models: "WAGON R SOLIO", model: "MA64S" }, ["passenger"]],
      [{ vehicle_manufacturer: "SUZUKI", body_type: "Kei car", compatible_car_models: "EVERY/EVERY WAGON" }, ["kei"]],
      [{ vehicle_manufacturer: "HYUNDAI", compatible_car_models: "New model" }, []]
    ];
    for (const [product, expected] of cases) {
      assert.deepEqual(Array.from(c.coreInventoryVehicleClasses(product)), expected); checks++;
    }
  }
  {
    const { c, get } = fixture();
    const inventory = [
      { id: 3, dkd_shohin_id: 1, quantity: 4, note: "韓国コア現存在庫 / 2026-09-04登録 / 原票 ABC" },
      { id: 2, dkd_shohin_id: 1, quantity: 5, note: "点検時に韓国コア現存在庫と比較 ABC" },
      { id: 1, dkd_shohin_id: 2, quantity: 6, note: null }
    ];
    c.respond = table => ({
      data: table === "production_core_list_entries" ? inventory : table === "core_products" ? products : [],
      error: null
    });
    const ids = () => Array.from(c.coreListFilteredRows, row => row.id);
    c.resetCoreInventoryFilters();
    await c.setCoreListMode("inventory");
    assert.deepEqual(ids(), [2, 1]); checks++;
    assert.equal(get("core-inventory-korea").value, "exclude"); checks++;
    assert.match(get("core-list-count").innerHTML, /11<small/); checks++;
    get("core-inventory-korea").value = "include";
    assert.deepEqual(ids(), [2, 1]); checks++;
    await c.submitCoreInventorySearch();
    assert.deepEqual(ids(), [3, 2, 1]); checks++;
    get("core-inventory-korea").value = "only";
    get("core-inventory-memo").value = "ABC";
    await c.submitCoreInventorySearch();
    assert.deepEqual(ids(), [3]); checks++;
    assert.equal(get("core-inventory-filter-count").textContent, "(2)"); checks++;
    c.resetCoreInventoryFilters();
    c.applyCoreInventoryFilters();
    assert.deepEqual(ids(), [2, 1]); checks++;
    assert.equal(get("core-inventory-korea").value, "exclude"); checks++;
    assert.equal(c.isKoreanCoreInventoryEntry({ note: "韓国コア現存在庫の数量を照合した" }), false); checks++;
  }
  {
    const { c, get } = fixture();
    const row = { id: 5, dkd_shohin_id: 42, core_part_number: "CORE-5", quantity: 21, location: "PALLET-A", updated_at: "2026-11-20T01:00:00Z" };
    c.coreListMgmtRows = [row];
    c.coreListFormMode = "edit";
    c.coreListMode = "inventory";
    c.coreManagementDataReady = true;
    c.coreListFilteredRows = [row];
    c.renderCoreListMgmt();
    assert.doesNotMatch(get("core-list-list").innerHTML, /data-core-del/); checks++;
    assert.match(get("core-list-list").innerHTML, /<td class='core-inventory-quantity'><span class='core-qty-pill'>21<\/span><\/td><\/tr>/); checks++;
    get("clf-id").value = "5";
    c.openCoreListDeleteConfirmation();
    assert.equal(get("core-list-delete-part").textContent, "CORE-5"); checks++;
    assert.equal(get("core-list-delete-pallet").textContent, "PALLET-A"); checks++;
    assert.equal(get("core-list-delete-quantity").textContent, 21); checks++;
    let filterCalls = [];
    let deleteResult = [];
    const query = {
      delete() { filterCalls.push(["delete"]); return this; },
      eq(column, value) { filterCalls.push([column, value]); return this; },
      is(column, value) { filterCalls.push([column, value]); return this; },
      async select() { return { data: deleteResult }; }
    };
    c.sb.from = () => query;
    c.loadCoreListMgmt = async () => {};
    let history = [];
    c.writeLog = async (...args) => history.push(args);
    await c.deleteCoreListRow();
    assert.equal(filterCalls.length, 0); checks++;
    get("core-list-delete-ack").checked = true;
    get("btn-core-list-delete-confirm").disabled = false;
    await c.deleteCoreListRow();
    assert.deepEqual(filterCalls, [["delete"], ["id", 5], ["replaced_at", null], ["updated_at", row.updated_at]]); checks++;
    assert.equal(get("core-list-delete-error").textContent, "core_inventory_delete_changed"); checks++;
    assert.equal(get("btn-core-list-delete-confirm").disabled, true); checks++;
    assert.equal(history.length, 0); checks++;
    deleteResult = [{ id: 5 }];
    get("core-list-delete-ack").checked = true;
    get("btn-core-list-delete-confirm").disabled = false;
    await c.deleteCoreListRow();
    assert.equal(history[0][2], 5); checks++;
    assert.equal(get("core-list-delete-panel").hidden, true); checks++;
  }
  assert.match(fs.readFileSync("index.html", "utf8"), /id="btn-core-list-delete-back" data-i18n="core_inventory_delete_back"/); checks++;
  console.log(`Core management workspace: ${checks} behavioral checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
