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

// Retained pilot tabs keep the native workspace while ordinary navigation resets it.
active = "sales-order-mgmt";
context.salesOrderDetailView = "history";
context.window.DcatsNineTabs = { hasTab: id => ["sales-order-mgmt", "claim-case-mgmt"].includes(id), screenChanged() {} };
let claimResets = 0;
context.claimCaseWorkspace = { reset() { claimResets += 1; } };
context.showScreen("shipping-document-mgmt");
assert.equal(context.salesOrderDetailView, "history", "Switching retained order tabs keeps the current detail view");
assert.equal(claimResets, 0, "The retained reception workspace survives tab and menu navigation");
context.showScreen("login");
assert.equal(claimResets, 1, "Sign-out clears a retained reception workspace");
assert.equal(context.salesOrderDetailView, "overview", "Sign-out resets retained order details");
delete context.window.DcatsNineTabs;
delete context.claimCaseWorkspace;


// Dynamic FIFO tabs use the real runtime and independent synthetic screens.
async function verifyDynamicScreenTabs() {
  const tabSource = fs.readFileSync(path.join(root, "assets/internal-tabs/nine-screen-tabs.js"), "utf8");
  async function makeTabs() {
    const ids = Array.from({length: 14}, (_, i) => "synthetic-menu-" + (i + 1));
    const parsed = parseHTML('<html><body><div id="screen-menu"><div class="menu-body"><div class="menu-welcome"></div></div></div>' + ids.map(id => '<div id="screen-' + id + '" class="screen"><input id="input-' + id + '" value=""></div>').join("") + '</body></html>');
    parsed.window.HTMLElement.prototype.focus = function () {};
    parsed.window.HTMLElement.prototype.getBoundingClientRect = function () { return {left: 0, right: 100, top: 0, bottom: 35, height: 35}; };
    const values = new Map(), allowed = new Set(ids), dirty = new Set(), released = [], listeners = new Map();
    let currentScreen = "menu", scope = "initial", busy = false, confirmResult = true, confirms = 0, selected = null;
    const w = {
      document: parsed.document, currentLang: "ja",
      DcatsNineTabsPolicy: {mode: "pilot", pilotUserIds: ["synthetic-owner"], pilotEmails: ["owner@example.invalid"]},
      sessionStorage: {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)},
      addEventListener(event, handler) { listeners.set(event, handler); },
      confirm(message) { assert.match(message, /入力内容の変更/); confirms += 1; return confirmResult; }
    };
    vm.runInNewContext(tabSource, {window: w, Promise, Set, Map, Array, JSON});
    const api = w.DcatsNineTabs;
    const show = id => { if (!api.beforeShow(id)) return false; if (id === "menu") api.willLeave(id); currentScreen = id; api.screenChanged(id); return true; };
    const open = id => { if (api.beforeEnter(id, false)) return false; selected = id; return show(id); };
    const options = {
      userId: () => "synthetic-owner", scope: () => scope, external: false,
      verify: async () => ({data: {user: {id: "synthetic-owner", email: "owner@example.invalid", email_confirmed_at: "2026-11-16"}}}),
      entries: () => ids.map(id => ({id, label: id})), canAccess: id => allowed.has(id),
      screen: () => currentScreen, show, home: () => show("menu"), enter: open,
      capture: () => ({selected}), restore: state => { selected = state.selected; },
      release: id => { released.push(id); dirty.delete(id); },
      resetControl: node => { node.value = ""; },
      closeState: id => ({dirty: dirty.has(id), busy})
    };
    await api.afterAuthenticated(options);
    const click = selector => parsed.document.querySelector(selector).dispatchEvent(new parsed.window.Event("click", {bubbles: true}));
    const setEnabled = value => {
      assert.equal(api.openProperties(), true);
      parsed.document.getElementById("dcats-nine-tabs-toggle").checked = value;
      click("#dcats-tab-properties-apply");
    };
    const enable = () => setEnabled(true);
    const select = id => click("#dcats-nine-tab-" + id);
    const close = id => click('[data-close-feature="' + id + '"]');
    const input = (id, value) => {
      const node = parsed.document.getElementById("input-" + id);
      node.dispatchEvent(new parsed.window.Event("focusin", {bubbles: true}));
      node.dispatchEvent(new parsed.window.Event("beforeinput", {bubbles: true}));
      node.value = value;
      node.dispatchEvent(new parsed.window.Event("input", {bubbles: true}));
      return node;
    };
    return {api, w, ids, options, values, allowed, dirty, released, listeners, show, open, enable, setEnabled, select, close, input,
      get screen() { return currentScreen; }, get confirms() { return confirms; }, get selected() { return selected; },
      set confirmResult(value) { confirmResult = value; }, set busy(value) { busy = value; }, set scope(value) { scope = value; },
      set selected(value) { selected = value; }};
  }
  const clean = await makeTabs();
  clean.enable(); clean.open(clean.ids[0]);
  const loadedInput = clean.w.document.getElementById("input-" + clean.ids[0]);
  loadedInput.dispatchEvent(new (loadedInput.ownerDocument.defaultView.Event)("focusin", {bubbles: true}));
  loadedInput.value = "server-loaded";
  assert.equal(clean.api.hasUnsaved(), false, "Programmatic server loading is not a user edit");
  clean.input(clean.ids[0], "edited");
  assert.equal(clean.api.hasUnsaved(), true);
  clean.input(clean.ids[0], "server-loaded");
  assert.equal(clean.api.hasUnsaved(), false, "Undo restores the loaded baseline");
  const t = await makeTabs();
  assert.equal(t.api.snapshot().enabled, true, "Verified eligible accounts default to ON with no saved choice");
  t.enable();
  const firstNine = t.ids.slice(0, 9);
  firstNine.forEach(t.open);
  assert.equal(t.api.retainedLimit, 9);
  assert.equal(Array.from(t.api.snapshot().tabs).join("|"), firstNine.join("|"));
  const strip = t.w.document.querySelector("[role=tablist]"), selectedNode = strip.querySelector(".is-active");
  const beforeResize = JSON.stringify(t.api.snapshot());
  strip.scrollLeft = 0;
  strip.getBoundingClientRect = () => ({left: 0, right: 100, width: 100});
  t.listeners.get("resize")();
  assert.equal(strip.scrollLeft, 0, "Narrow tab strips use pages instead of hidden scrollbars");
  assert.equal(selectedNode.hidden, false);
  assert.equal(Array.from(strip.children).filter(node => !node.hidden).length, 1);
  const previousPage = t.w.document.getElementById("dcats-tabs-previous");
  previousPage.dispatchEvent(new selectedNode.ownerDocument.defaultView.Event("click", {bubbles: true}));
  assert.equal(JSON.stringify(t.api.snapshot()), beforeResize, "Paging does not switch business screens or change FIFO order");
  strip.getBoundingClientRect = () => ({left: 0, right: 2000, width: 2000});
  t.listeners.get("resize")();
  assert.equal(Array.from(strip.children).filter(node => !node.hidden).length, 9, "Wider layouts reveal every tab without scrolling");
  assert.equal(previousPage.hidden, true);
  assert.equal(JSON.stringify(t.api.snapshot()), beforeResize);
  assert.equal(strip.querySelector(".is-active"), selectedNode, "Resizing preserves existing controls");
  t.select(firstNine[0]);
  assert.equal(Array.from(t.api.snapshot().tabs).join("|"), firstNine.join("|"), "Switching is FIFO, not LRU");
  t.open(t.ids[9]);
  assert.equal(Array.from(t.api.snapshot().tabs).join("|"), t.ids.slice(1, 10).join("|"), "Tenth replaces only the oldest");
  assert.deepEqual(t.released, [t.ids[0]]);
  t.select(t.ids[1]); t.selected = "per-screen-selection";
  t.select(t.ids[2]); t.select(t.ids[1]);
  assert.equal(t.selected, "per-screen-selection", "Shared presentation context follows each tab");

  t.show("menu");
  t.dirty.add(t.ids[1]); t.confirmResult = false;
  const before = JSON.stringify(t.api.snapshot()), stored = t.values.get("dcats-nine-tabs.v1:synthetic-owner"), released = t.released.length;
  assert.equal(t.open(t.ids[10]), false);
  assert.equal(JSON.stringify(t.api.snapshot()), before, "Cancel leaves order, active and count intact");
  assert.equal(t.values.get("dcats-nine-tabs.v1:synthetic-owner"), stored, "Cancel does not change saved tab metadata");
  assert.equal(t.released.length, released);
  assert.equal(t.confirms, 1);
  t.confirmResult = true; t.open(t.ids[10]);
  assert.equal(Array.from(t.api.snapshot().tabs).join("|"), t.ids.slice(2, 11).join("|"));
  assert.equal(t.confirms, 2);

  t.show("menu"); t.busy = true;
  const busyBefore = JSON.stringify(t.api.snapshot()), busyConfirms = t.confirms;
  t.open(t.ids[11]);
  assert.equal(JSON.stringify(t.api.snapshot()), busyBefore, "Saving/unknown outcomes must not be evicted");
  assert.equal(t.confirms, busyConfirms, "Busy operations cannot be discarded through a confirmation");
  t.busy = false; t.open(t.ids[11]);
  assert.equal(t.api.snapshot().tabs.length, 9);

  const oldest = t.api.snapshot().tabs[0];
  t.select(oldest);
  const node = t.input(oldest, "UNSAVED SYNTHETIC INPUT");
  assert.equal(t.api.hasUnsaved(), true);
  const reloadGuard = sourceBetween("function isAppSafeForAutoReload()", "function getAppUpdateBanner");
  assert.equal(vm.runInNewContext(reloadGuard + "; isAppSafeForAutoReload();", {window: {DcatsNineTabs: t.api}}), false, "Hidden draft tabs block automatic reload");
  t.show("menu"); t.confirmResult = false;
  const inputBefore = JSON.stringify(t.api.snapshot());
  t.open(t.ids[12]);
  assert.equal(JSON.stringify(t.api.snapshot()), inputBefore);
  assert.equal(node.value, "UNSAVED SYNTHETIC INPUT", "Declined eviction keeps the actual DOM draft");
  assert.equal(t.values.get("dcats-nine-tabs.v1:synthetic-owner").includes("UNSAVED"), false, "Draft values never enter tab storage");
  t.close(oldest);
  assert.equal(JSON.stringify(t.api.snapshot()), inputBefore, "Manual close has the same draft guard");
  t.setEnabled(false);
  assert.equal(t.api.snapshot().enabled, true, "Declining OFF keeps every tab enabled");
  t.select(oldest); t.input(oldest, "");
  assert.equal(t.api.hasUnsaved(), false, "Undoing an edit returns to the clean baseline");
  t.show("menu"); t.confirmResult = true; t.open(t.ids[12]);
  assert.equal(t.api.snapshot().tabs.length, 9);
  assert.equal(t.api.snapshot().tabs.includes(oldest), false);

  const newId = "menu-added-after-initialization";
  t.ids.push(newId); t.allowed.add(newId);
  const screen = t.w.document.createElement("div"); screen.id = "screen-" + newId; t.w.document.body.appendChild(screen);
  t.open(newId);
  assert.equal(t.api.snapshot().tabs.at(-1), newId, "A newly supplied menu screen needs no fixed tab whitelist");
  const deniedId = t.ids[13]; t.allowed.delete(deniedId); t.show("menu");
  const deniedBefore = JSON.stringify(t.api.snapshot());
  t.open(deniedId);
  assert.equal(JSON.stringify(t.api.snapshot()), deniedBefore, "Unauthorized new menus neither open nor evict another tab");

  const savedOrder = Array.from(t.api.snapshot().tabs), savedActive = t.api.snapshot().active;
  t.api.suspend(false);
  await t.api.afterAuthenticated(t.options);
  assert.equal(Array.from(t.api.snapshot().tabs).join("|"), savedOrder.join("|"), "Reload restores nine in original opening order");
  assert.equal(t.api.snapshot().active, savedActive);
  t.w.DcatsNineTabsPolicy.mode = "off";
  t.api.suspend(false); await t.api.afterAuthenticated(t.options);
  assert.equal(t.api.snapshot().enabled, false);
  assert.equal(t.w.document.getElementById("dcats-nine-tabs-toggle").disabled, true);
  assert.equal(t.api.openProperties(), false);
  assert.equal(t.api.beforeShow("screen-tab-properties"), false);
  t.w.DcatsNineTabsPolicy.mode = "pilot"; t.w.DcatsNineTabsPolicy.pilotUserIds = ["another-user"];
  t.api.suspend(false); await t.api.afterAuthenticated(t.options);
  assert.equal(t.api.snapshot().enabled, false, "Non-pilot accounts cannot enable tabs from a saved ON preference");
  t.w.DcatsNineTabsPolicy.pilotUserIds = ["synthetic-owner"];
  t.api.suspend(false); await t.api.afterAuthenticated(t.options);
  t.scope = "permission-scope-changed";
  assert.equal(t.api.snapshot().enabled, false, "Changed account scope invalidates retained tabs");
  t.api.authEvent("SIGNED_OUT");
  assert.equal(t.values.has("dcats-nine-tabs.v1:synthetic-owner"), false);
  const company = await makeTabs();
  company.w.DcatsNineTabsPolicy = {mode: "all"};
  const companyOptions = {...company.options, userId: () => "synthetic-company-user", verify: async () => ({data: {user: {id: "synthetic-company-user", email: "colleague@example.invalid", email_confirmed_at: "2026-11-17"}}})};
  company.api.suspend(false); await company.api.afterAuthenticated(companyOptions);
  assert.equal(company.api.isAvailable(), true);
  assert.equal(company.api.snapshot().enabled, true, "Every eligible company account defaults to ON");
  const companyPreferenceKey = "dcats-nine-tabs.v1:synthetic-company-user:enabled";
  assert.equal(company.values.has(companyPreferenceKey), false, "Default ON does not manufacture an explicit choice");
  company.setEnabled(false);
  assert.equal(company.values.get(companyPreferenceKey), "off");
  company.api.suspend(false); await company.api.afterAuthenticated(companyOptions);
  assert.equal(company.api.snapshot().enabled, false, "Explicit OFF survives authentication/reload");
  company.values.set(companyPreferenceKey, "on");
  company.api.suspend(false); await company.api.afterAuthenticated(companyOptions);
  assert.equal(company.api.snapshot().enabled, true, "Explicit ON is preserved");
  company.values.set(companyPreferenceKey, "invalid");
  company.api.suspend(false); await company.api.afterAuthenticated(companyOptions);
  assert.equal(company.api.snapshot().enabled, false, "Unknown stored preferences remain disabled");
  company.values.delete(companyPreferenceKey);
  company.api.suspend(false); await company.api.afterAuthenticated(companyOptions);
  assert.equal(company.api.snapshot().enabled, true, "Removing a stored choice restores default ON");
  company.enable(); company.open(company.ids[0]);
  company.api.openProperties();
  const settingInput = company.w.document.getElementById("dcats-nine-tabs-toggle");
  settingInput.dispatchEvent(new settingInput.ownerDocument.defaultView.Event("focusin", {bubbles: true}));
  settingInput.checked = false;
  settingInput.dispatchEvent(new settingInput.ownerDocument.defaultView.Event("change", {bubbles: true}));
  assert.equal(company.api.hasUnsaved(), false, "Preference edits are not business drafts");
  company.show("menu");
  const deniedCompanyMenu = company.ids[2]; company.allowed.delete(deniedCompanyMenu);
  const companyBeforeDenied = JSON.stringify(company.api.snapshot());
  assert.equal(company.open(deniedCompanyMenu), false);
  assert.equal(JSON.stringify(company.api.snapshot()), companyBeforeDenied, "Public tabs never grant an unauthorized menu");
  company.api.suspend(false);
  await company.api.afterAuthenticated({...companyOptions, external: true});
  assert.equal(company.api.isAvailable(), false, "External customers cannot enable company tabs");
  assert.equal(company.api.openProperties(), false);
  assert.equal(company.api.beforeShow("screen-tab-properties"), false);
  await company.api.afterAuthenticated({...companyOptions, verify: async () => ({error: new Error("expired")})});
  assert.equal(company.api.isAvailable(), false, "Unverified and expired sessions fail closed");
  assert.equal(company.api.openProperties(), false);
  assert.equal(company.api.canShowSettings("synthetic-company-user"), true, "A logged-in internal menu can offer a retry after verification fails");
  assert.equal(company.api.canShowSettings(null), false, "No settings card without a signed-in account");
  const savedScreen = company.ids[0];
  company.values.set("dcats-nine-tabs.v1:synthetic-company-user", JSON.stringify({version: 2, tabs: [savedScreen], active: savedScreen}));
  company.show("menu");
  await company.api.afterAuthenticated(companyOptions, false);
  assert.equal(company.api.isAvailable(), true);
  assert.equal(company.screen, "menu", "A settings retry should not navigate to the saved business screen");
  assert.equal(Array.from(company.api.snapshot().tabs).join("|"), savedScreen, "A settings retry still restores tab metadata");
  assert.equal(company.api.openProperties(), true, "Successful re-verification opens settings");
  company.api.authEvent("SIGNED_OUT");
  assert.equal(company.api.openProperties(), false);
  company.w.DcatsNineTabsPolicy.mode = "off";
  assert.equal(company.api.canShowSettings("synthetic-company-user"), false);
  company.w.DcatsNineTabsPolicy.mode = "pilot";
  assert.equal(company.api.canShowSettings("synthetic-company-user"), false, "Pilot settings are hidden before verified pilot enrollment");
  console.log("dynamic screen tabs passed (FIFO 9, dirty cancel/accept, busy, dynamic menus, reload, settings retry and pilot isolation)");
}
verifyDynamicScreenTabs().catch(error => { console.error(error); process.exitCode = 1; });

async function verifySearchCancelKeepsPreviewMode() {
  const entry = sourceBetween("async function enterSearch(options)", "async function enterProductionSearch");
  const state = {window: {DcatsNineTabs: {beforeEnter: () => true}}, customerPortalSearchActive: true, isCustomerViewer: () => false, canViewProductSearch: () => true};
  vm.runInNewContext(entry, state);
  await state.enterSearch();
  assert.equal(state.customerPortalSearchActive, true, "A cancelled direct entry must not alter the current customer-preview mode");
}
verifySearchCancelKeepsPreviewMode().catch(error => { console.error(error); process.exitCode = 1; });

// A retained private inbox survives ordinary switches, but never authentication exit.
active = "concierge-admin";
context.window.DcatsNineTabs = {hasTab: id => id === "concierge-admin", screenChanged() {}};
const retainedConciergeCloses = context.conciergeCloseCount;
context.showScreen("menu");
assert.equal(context.conciergeCloseCount, retainedConciergeCloses, "Retained same-account concierge is not disposed on a tab switch");
context.showScreen("login");
assert.equal(context.conciergeCloseCount, retainedConciergeCloses + 1, "Authentication exit always clears private concierge DOM");
delete context.window.DcatsNineTabs;
