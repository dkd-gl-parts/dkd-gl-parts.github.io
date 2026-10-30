"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const { parseHTML } = require("linkedom");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

function requireFragment(block, fragment, message) {
  if (!block.includes(fragment)) throw new Error(message || `Missing screen-state contract: ${fragment}`);
}

const screenManagement = sourceBetween("var screenInitialControlState", "function isScreenActive");
for (const fragment of [
  "function captureInitialScreenControlState",
  "function resetScreenControlState",
  "function resetScreenRuntimeStateForMenu",
  "function resetScreenStateForMenu",
  'previousScreenId === "sales-order-mgmt" && id !== previousScreenId',
  'setSalesOrderDetailView("overview", false)',
  'id === "menu" && previousScreenId)',
  "resetScreenStateForMenu(previousScreenId)",
  'screen.querySelectorAll("input, select, textarea")',
  'screen.querySelectorAll("details[open]")',
  "element.scrollTop = 0",
  'screenId === "sales-pricing-mgmt"',
  'screenId === "rakuten-price"'
]) requireFragment(screenManagement, fragment);

const showScreenSource = sourceBetween("function showScreen(id)", "captureInitialScreenControlState();");
const calls = [];
let active = "production-search";
const screens = [{ classList: { remove() {} } }];
const target = { classList: { add() {} }, querySelectorAll: () => [] };
const context = {
  closeConciergeAdmin() { context.conciergeCloseCount = (context.conciergeCloseCount || 0) + 1; },
  salesOrderDetailView: "history",
  activeAppScreenName: () => active,
  resetScreenStateForMenu: (id) => calls.push(id),
  setSalesOrderDetailView(view) { context.salesOrderDetailView = view; },
  syncInstallAppAccess() {},
  document: {
    querySelectorAll: () => screens,
    getElementById: () => target
  },
  window: { scrollTo() {} },
  logScreenOpen() {}
};
vm.runInNewContext(`${showScreenSource}; this.showScreen = showScreen;`, context);
context.showScreen("menu");
if (calls.join(",") !== "production-search") {
  throw new Error("A normal screen must be reset when returning to the menu");
}
active = "search";
context.showScreen("menu");
if (calls.join(",") !== "production-search,search") {
  throw new Error("Sales management must reset its screen state when returning to the menu");
}
active = "sales-order-mgmt";
context.showScreen("shipping-document-mgmt");
if (calls.length !== 2) {
  throw new Error("The order and shipping-document handoff must not be treated as a menu reset");
}
if (context.salesOrderDetailView !== "overview") {
  throw new Error("Leaving order management must reset its detail tab to the default billing and delivery view");
}
if (context.conciergeCloseCount !== 3) throw new Error("Leaving the concierge inbox must clear private detail DOM");
context.showScreen("concierge-admin");
if (context.conciergeCloseCount !== 3) throw new Error("Opening the inbox must not destroy the newly mounted view");

const productReturn = sourceBetween("function returnFromProductSearch()", "function shippingPrefectureLabel");
for (const fragment of ["clearAppRestoreState();", "showAuthenticatedHome();"]) requireFragment(productReturn, fragment);
if (productReturn.includes("window.location.reload()")) {
  throw new Error("Sales management must reset locally without reloading the application");
}
requireFragment(screenManagement, 'if (screenId === "search") resetProductSearchForMenu();');
const enterSearch = sourceBetween("async function enterSearch(options)", "async function enterProductionSearch");
requireFragment(enterSearch, 'resetScreenStateForMenu("search");');
if (enterSearch.indexOf('resetScreenStateForMenu("search");') > enterSearch.indexOf('showScreen("search");')) {
  throw new Error("Sales management must reset before its old detail can become visible");
}
if (enterSearch.indexOf('resetScreenStateForMenu("search");') < enterSearch.indexOf("if (!canViewProductSearch())")) {
  throw new Error("Unauthorized navigation must not reset a different active workflow");
}

const openShippingDocuments = sourceBetween("async function openSalesOrderShippingDocuments", "async function issueSalesOrderDispatch");
requireFragment(openShippingDocuments, "enterShippingDocumentMgmt({ order: selectedOrder })");
const openSalesOrder = sourceBetween("async function openShippingDocumentOrderInSalesOrderMgmt", "function shippingDocumentLatestB2Export");
requireFragment(openSalesOrder, "enterSalesOrderMgmt({ order: order })");
if (openSalesOrder.includes("detailView")) {
  throw new Error("Returning from shipping documents must use the default order-detail tab");
}

async function verifySalesSearchReset() {
  const { document, window } = parseHTML(fs.readFileSync(path.join(root, "index.html"), "utf8"));
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get() { const option = this.querySelector("option[selected]") || this.querySelector("option"); return option ? option.value : ""; },
    set(value) { for (const option of this.options) option.selected = option.value === value; }
  });
  const functions = acorn.parse(source, { ecmaVersion: "latest" }).body.filter(node => node.type === "FunctionDeclaration");
  const functionSource = name => {
    const node = functions.find(fn => fn.id.name === name);
    assert.ok(node, name);
    return source.slice(node.start, node.end);
  };
  let catalogCount = 0;
  let initCount = 0;
  let deniedCount = 0;
  let fetchCount = 0;
  const state = {
    document, window: { scrollTo() {} }, Promise,
    currentUser: { id: "synthetic-user" }, currentFilter: "all", currentProduct: null,
    currentSalesDetailTab: "basic", currentSelectedProductKind: "rebuilt", customerPortalSearchActive: false,
    searchRequestSeq: 10, productAuxSeq: 20, detailSecondaryRequestSeq: 30, detailCustomerPriceSeq: 40,
    dataLoaded: true, SEARCH_INITIAL_LIMIT: 100, SEARCH_RENDER_LIMIT: 100, allProducts: [],
    t: key => key, esc: String,
    setCspStyle(element, property, value) { if (element) element.setAttribute("data-test-" + property, value); },
    configureSalesProductAddButton() {}, configureCustomerSearchShell() {}, closeConciergeAdmin() {},
    syncInstallAppAccess() {}, logScreenOpen() {}, isCustomerViewer: () => false,
    canViewProductSearch: () => true, isSalesHiddenDaikoProduct: () => false,
    productDkdId: product => String(product && (product.dkd_shohin_id || product.id) || ""),
    normalizeCoreProductFastRows: rows => rows,
    activeAppScreenName: () => (document.querySelector(".screen.active") || {}).id?.replace("screen-", "") || "menu",
    initSearch: async () => { initCount++; },
    enterCustomerCatalog: async () => { catalogCount++; },
    showPermissionDenied: () => { deniedCount++; },
    clearAppRestoreState() {},
    showAuthenticatedHome: () => state.showScreen("menu"),
    renderCustomerPortal() {}
  };
  const names = ["resetProductSearchForMenu", "closePanel", "activateSalesDetailTab", "syncSearchFilterControls",
    "syncSearchClearButtonState", "render", "enterSearch", "runProductSearch", "openProductByDkdId",
    "loadProductVariantsForCurrent", "loadProductSearchAuxiliaryData", "returnFromProductSearch"];
  vm.createContext(state);
  vm.runInContext(names.map(functionSource).join("\n") + "\n" + screenManagement, state);
  function dirty() {
    document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
    document.getElementById("screen-search").classList.add("active");
    document.getElementById("q").value = "31400-58J10";
    Object.assign(state, { currentFilter: "cat:alternator", searchSlOnly: true, productSearchLimit: 500,
      productSearchFetchedCount: 200, productSearchTotalCount: 400, productSearchHasMore: true, productSearchPageKey: "category:alternator",
      allProducts: [{ id: 1 }], currentProduct: { id: 1 }, currentCoreDkdShohinId: 1,
      currentProductVariants: [{ id: 1 }], currentProductSpecs: [{ id: 1 }], currentProductNominalSpec: { id: 1 },
      currentVehicleApplicationRows: [{ id: 1 }], currentImages: [{ id: 1 }], currentSlPartIds: [1],
      currentSelectedProductKind: "aftermarket_new", detailSelectedSalesCustomerId: "old-customer",
      salesShippingProfile: { id: 1 }, salesShippingProfileDkdId: 1, salesShippingPrefectureCode: "27",
      salesShippingCarrierName: "old-carrier", salesShippingServiceName: "old-service", salesShippingPackageKeyValue: "old-size"
    });
    document.getElementById("panel-inner").setAttribute("data-test-display", "grid");
    document.getElementById("panel-body").innerHTML = "old product detail";
    document.getElementById("panel").classList.add("show");
    document.getElementById("overlay").classList.add("show");
    state.activateSalesDetailTab("images");
  }
  function expectReset() {
    assert.equal(document.getElementById("q").value, "");
    assert.equal(state.currentFilter, "all");
    assert.equal(state.searchSlOnly, false);
    assert.equal(state.productSearchLimit, 100);
    assert.equal(state.productSearchFetchedCount, 0);
    assert.equal(state.productSearchTotalCount, null);
    assert.equal(state.productSearchHasMore, false);
    assert.equal(state.productSearchPageKey, "");
    for (const name of ["allProducts", "currentProductVariants", "currentProductSpecs", "currentImages", "currentSlPartIds", "currentVehicleApplicationRows"]) assert.equal(state[name].length, 0, name);
    assert.equal(state.currentProduct, null);
    assert.equal(state.currentCoreDkdShohinId, null);
    assert.equal(state.currentSalesDetailTab, "basic");
    assert.equal(state.currentSelectedProductKind, "rebuilt");
    assert.equal(state.detailSelectedSalesCustomerId, "");
    assert.equal(state.salesShippingProfile, null);
    assert.equal(state.salesShippingProfileDkdId, null);
    for (const name of ["salesShippingPrefectureCode", "salesShippingCarrierName", "salesShippingServiceName", "salesShippingPackageKeyValue"]) assert.equal(state[name], "", name);
    assert.equal(document.getElementById("panel-body").innerHTML, "");
    assert.equal(document.getElementById("panel-inner").getAttribute("data-test-display"), "none");
    assert.equal(document.getElementById("panel-welcome").getAttribute("data-test-display"), "");
    assert.equal(document.getElementById("panel").classList.contains("show"), false);
    assert.equal(document.getElementById("overlay").classList.contains("show"), false);
    assert.equal(document.getElementById("count-bar").textContent, "hint_search");
    assert.equal(document.getElementById("clear-btn").disabled, true);
  }
  dirty();
  state.returnFromProductSearch();
  expectReset();
  assert.equal(document.getElementById("screen-menu").classList.contains("active"), true);
  assert.equal(state.searchRequestSeq, 11);
  assert.equal(state.productAuxSeq, 21);
  assert.equal(state.detailSecondaryRequestSeq, 31);
  assert.equal(state.detailCustomerPriceSeq, 41);
  dirty();
  await state.enterSearch();
  expectReset();
  assert.equal(initCount, 0, "reopening must not refetch the category master");
  state.dataLoaded = false;
  await state.enterSearch();
  assert.equal(initCount, 1);
  assert.equal(state.dataLoaded, true);
  dirty();
  const selected = state.currentProduct;
  state.showScreen("components");
  state.showScreen("search");
  assert.equal(state.currentProduct, selected, "child return preserves selection");
  assert.equal(document.getElementById("q").value, "31400-58J10");
  state.canViewProductSearch = () => false;
  await state.enterSearch();
  assert.equal(deniedCount, 1);
  assert.equal(state.currentProduct, selected, "denied entry must not mutate the current view");
  state.canViewProductSearch = () => true;
  await state.enterSearch({ fromCustomerPortal: true });
  assert.equal(catalogCount, 1);
  assert.equal(state.currentProduct, selected, "customer-catalog routing remains separate");
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  for (const failed of [false, true]) {
    dirty();
    state.currentFilter = "all";
    const pending = deferred();
    state.fetchCoreProductMasterMatches = () => { fetchCount++; return pending.promise; };
    const search = state.runProductSearch();
    state.returnFromProductSearch();
    await state.enterSearch();
    pending.resolve(failed ? { error: { message: "synthetic failure" } } : { data: [{ id: 1 }] });
    await search;
    expectReset();
  }
  dirty();
  state.allProducts = [];
  const pending = deferred();
  const query = { select() { return this; }, eq() { return this; }, maybeSingle() { fetchCount++; return pending.promise; } };
  state.sb = { from: () => query };
  state.openPanel = () => { throw new Error("stale selected product must not reopen"); };
  const open = state.openProductByDkdId(1);
  state.returnFromProductSearch();
  pending.resolve({ data: { id: 1 } });
  await open;
  expectReset();
  let openedId = null;
  state.openPanel = id => { openedId = id; };
  query.maybeSingle = () => { fetchCount++; return Promise.resolve({ data: { id: 2 } }); };
  await state.openProductByDkdId(2);
  assert.equal(openedId, 2, "a current explicit product lookup still opens normally");
  dirty();
  const detail = deferred();
  state.fetchProductVariantsByDkdId = () => { fetchCount++; return detail.promise; };
  const load = state.loadProductVariantsForCurrent(state.detailSecondaryRequestSeq);
  state.returnFromProductSearch();
  detail.resolve([{ id: 1 }]);
  await load;
  expectReset();
  dirty();
  const auxiliary = deferred();
  state.customerCanShowCompatibleParts = () => false;
  state.canSeeComponentInfo = () => false;
  state.canSeeCoreStockInfo = () => false;
  state.fetchProductVariantSummaryMap = () => { fetchCount++; return auxiliary.promise; };
  const enrich = state.loadProductSearchAuxiliaryData(state.searchRequestSeq, [state.currentProduct]);
  state.returnFromProductSearch();
  auxiliary.resolve({ old: { rebuilt: 1 } });
  await enrich;
  expectReset();
  assert.equal(Object.keys(state.productVariantSummaryMap).length, 0, "stale auxiliary maps must stay cleared");
  assert.equal(fetchCount, 6, "only explicit synthetic reads are started, never a reset write");
  console.log("screen state policy verification passed (sales reset, entry guards, child return and stale reads)");
}
verifySalesSearchReset().catch(error => { console.error(error); process.exitCode = 1; });
