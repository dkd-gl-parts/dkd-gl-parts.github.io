"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "partsfan-research.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const context = {window: {currentLang: "ja", canManageProductSpecs: () => false, canImportPartsfanFitments: () => false}, URL, Date};
vm.runInNewContext(source, context);
const api = context.window.PartsfanResearch;
assert.equal(api.buttonHtml(), "");
assert.equal(api.open({}), false, "unauthorized callers cannot open the research dialog");
context.window.canManageProductSpecs = () => true;
assert.equal(api.buttonHtml(), "", "non-administrators cannot start the local collector");
context.window.canImportPartsfanFitments = () => true;
assert(api.buttonHtml().includes("適合車両を更新"));
assert.equal(api.stopLabel({state: "blocked", reason: "cloudflare_verification_pending"}), "Cloudflareの検証が自動通過しませんでした。専用Chromeで状態を確認し、閉じてから再開してください。");
assert(api.stopLabel({state: "blocked", reason: "captcha_or_daily_limit"}).includes("CAPTCHA"));
assert(api.stopLabel({state: "paused_budget", reason: "page_budget_reached"}).includes("続き"));
assert(api.importErrorLabel({message: "reviewed_chassis_conflict_requires_manual_resolution"}).includes("要確認"));
assert(api.importErrorLabel({message: "legacy_application_match_ambiguous"}).includes("一意"));
assert(api.importErrorLabel({message: "network error"}).includes("押し直して"));
assert(!source.includes("pfr-download") && !source.includes("pfr-review-file"), "the update screen must not require CSV or JSON upload");
assert(source.includes('bridgeBase = "http://127.0.0.1:37644"'));
assert(source.includes('bridgeRequest("/current")'), "reopening the update dialog must attach the completed local result without revisiting PARTS FAN");
const clean = api.details({grade: "G", transmission: "AT", chassis_range: "0001 - 9999", source_url: "https://partsfan.com/nissan/jp/pnodetail/TEST/23300AX000/", collected_at: "2026-09-29T01:00:00Z", password: "SHOULD_NOT_APPEAR"});
assert.equal(clean.grade, "G");
assert(!Object.hasOwn(clean, "password"));
for (const source_url of ["javascript:alert(1)", "https://partsfan.com.evil.test/x", "https://partsfan.com/login/", "https://partsfan.com/nissan/jp/pnodetail/x/?token=SECRET"]) assert.equal(api.details({source_url}).source_url, "");
assert.equal(api.details({collected_at: "invalid", grade: "x".repeat(301)}).grade, "");
const reviewRow = {
  source_code: "partsfan", source_table: "genuine_applications", part_role: "partsfan_genuine_application",
  is_catalog_evidence: true, catalog_manufacturer: "NISSAN", genuine_part_number: "23300-AX000",
  normalized_genuine_part_number: "23300AX000", source_record_key: "a".repeat(64),
  vehicle_manufacturer: "ニッサン", vehicle_type: "キューブ", model: "BZ11", engine: "CR14DE",
  raw_payload: {source_url: "https://partsfan.com/nissan/jp/pnodetail/ONE/23300AX000", collected_at: "2026-10-02T00:00:00Z", chassis_range: null}
};
const review = {format: "dcats.partsfan.review.v1", items: [{part: "23300-AX000", maker: "nissan", status: "completed", records: [reviewRow]}]};
assert.equal(api.reviewRows(review, "23300-AX000", "ニッサン").length, 1);
const largeReview = {format: review.format, items: [{...review.items[0], records: Array.from({length: 289}, (_, index) => ({
  ...reviewRow, source_record_key: index.toString(16).padStart(64, "0")
}))}]};
assert.equal(api.reviewRows(largeReview, "23300-AX000", "ニッサン").length, 289);
assert.throws(() => api.reviewRows({...largeReview, items: [{...largeReview.items[0], records: Array.from({length: 501}, (_, index) => ({
  ...reviewRow, source_record_key: index.toString(16).padStart(64, "0")
}))}]}, "23300-AX000", "ニッサン"));
for (const bad of [
  {items: [{...review.items[0], status: "blocked"}]},
  {items: [{...review.items[0], maker: "toyota"}]},
  {items: [{...review.items[0], records: [{...reviewRow, raw_payload: {...reviewRow.raw_payload, source_url: "https://partsfan.com.evil.test/x"}}]}]},
  {items: [{...review.items[0], records: [{...reviewRow, raw_payload: {...reviewRow.raw_payload, chassis_range_review: "vehicle_list_vs_detail_conflict"}}]}]}
]) assert.throws(() => api.reviewRows({...review, ...bad}, "23300-AX000", "ニッサン"));
const html = api.sourceHtml({partsfan_details: {...clean, representative_model_note: "<img onerror=alert(1)>"}});
assert(html.includes("noopener noreferrer") && !html.includes("<img"));
assert(!api.sourceHtml({partsfan_details: {source_url: "javascript:alert(1)"}}).includes("href="));
function isolate(start, end) { const from = app.indexOf(start); assert(from >= 0); const to = app.indexOf(end, from + 1); assert(to > from); return app.slice(from, to); }
const rows = [{id: 1, source_code: "partsfan", model: "CBA-K12"}, {id: 2, source_code: "denso", model: "OTHER"}];
let failure = false, selections = 0;
const fetchContext = {window: context.window, console: {warn() {}}, sb: {
  rpc: async () => ({data: rows.map(row => ({...row}))}),
  from: table => {
    assert.equal(table, "catalog_vehicle_applications");
    return {select: columns => {
      assert.equal(columns, "id,raw_payload");
      return {eq: (column, value) => {
        assert.equal(column, "source_code"); assert.equal(value, "partsfan");
        return {in: async (idColumn, ids) => {
          selections++; assert.equal(idColumn, "id"); assert.equal(String(ids), "1");
          return failure ? {error: {message: "unavailable"}} : {data: [{id: 1, raw_payload: clean}]};
        }};
      }};
    }};
  }
}};
vm.runInNewContext(isolate("async function fetchCatalogVehicleApplications", "function vehicleMakerLabel"), fetchContext);
const vehicleHeadings = {f_vehicle_mfr: "車メーカー", f_vehicle_usage: "車種/用途", f_machine_model: "機種/型式", f_engine: "エンジン", f_period: "期間", f_chassis_number: "車体番号", f_part_number: "品番", component_name: "部品名"};
const renderContext = {window: context.window, currentLang: "ja", t: value => vehicleHeadings[value] || value, tf: () => "no results", esc: value => String(value).replace(/</g, "&lt;"), vehicleMakerLabel: value => value, renderVehicleApplicationText: value => String(value), vehicleApplicationPartNameLabel: value => value};
vm.runInNewContext(isolate("function hasVehicleApplicationDetail", "function openVehicleApplicationsDialog"), renderContext);
(async () => {
  const fetched = await fetchContext.fetchCatalogVehicleApplications({id: 1});
  assert.equal(fetched[0].partsfan_details.grade, "G");
  assert(!fetched[1].partsfan_details);
  failure = true;
  const basic = await fetchContext.fetchCatalogVehicleApplications({id: 1});
  assert.equal(basic.length, 2, "supplement failure retains basic application rows");
  assert(!basic[0].partsfan_details);
  assert.equal(selections, 2);
  const vehicleHtml = renderContext.renderVehicleApplicationsTable(fetched);
  assert.deepEqual(Array.from(vehicleHtml.matchAll(/<th>(.*?)<\/th>/g), match => match[1]), Object.values(vehicleHeadings), "fitment list must show separate period and chassis headings");
  assert.equal((vehicleHtml.match(/<td>/g) || []).length, 16, "PARTS FAN details must not add table columns");
  assert(vehicleHtml.includes("<details class='partsfan-vehicle-details'>"));
  assert(vehicleHtml.includes("グレード") && vehicleHtml.includes("0001 - 9999") && vehicleHtml.includes("PARTS FAN ↗"), "expanded detail and chassis column must retain source values");
  const capa = {source_code: "partsfan", model: "GF-GA4", production_period_text: "1300001-1399999", effective_start: "1300001", effective_end: "1399999", partsfan_details: {chassis_range: "1300001 - 1399999"}};
  const capaCells = Array.from(renderContext.renderVehicleApplicationsTable([capa]).matchAll(/<td>(.*?)<\/td>/g), match => match[1]);
  assert.equal(capaCells[4], "-", "chassis serials must not be shown as a calendar period");
  assert.equal(capaCells[5], "1300001 - 1399999");
  const legacy = {...capa, production_period_text: null, effective_start: null, effective_end: null, partsfan_details: {vehicle_list_chassis_range: "1000001-1999999（代表）"}};
  assert(renderContext.renderVehicleApplicationsTable([legacy]).includes("<td>1000001-1999999（代表）</td>"), "legacy chassis range must survive database cleanup");
  const conflict = {...capa, partsfan_details: {chassis_range_review: true, vehicle_list_chassis_range: "3300001-3399999", detail_chassis_range: "3400001 - 3499999"}};
  const conflictHtml = renderContext.renderVehicleApplicationsTable([conflict]);
  assert(conflictHtml.includes("<td>-<div class='component-sub'>"), "conflicting ranges must not appear as verified chassis numbers");
  assert(conflictHtml.includes("3300001-3399999") && conflictHtml.includes("3400001 - 3499999"), "both conflicting source ranges must remain available in details");
  const dated = {...capa, production_period_text: "2010/11", effective_start: null, effective_end: null, partsfan_details: {}};
  assert(renderContext.renderVehicleApplicationsTable([dated]).includes("<td>2010/11</td>"), "verified calendar periods must remain visible");
  assert(!renderContext.renderVehicleApplicationsTable([rows[1]]).includes("グレード"));
  assert(renderContext.renderVehicleApplicationsTable([]).length > 0);
  let resolveVehicles;
  const pendingVehicles = new Promise(resolve => { resolveVehicles = resolve; });
  const product = {dkd_shohin_id: 18720, genuine_part_number: "31100-PEJ-004"};
  const vehicleTab = {innerHTML: "読み込み中...", querySelectorAll: () => []};
  const makerValue = {textContent: ""};
  const vehicleContext = {
    window: {PartsfanResearch: {buttonHtml: () => "", bind: () => {}}},
    console: {warn() {}},
    currentProduct: product,
    detailSecondaryRequestSeq: 7,
    currentVehicleApplicationRows: [],
    customerCanShowVehicleInfo: () => true,
    fetchCatalogVehicleApplications: () => pendingVehicles,
    hasVehicleApplicationDetail: row => !!row.model,
    productDkdId: value => value && value.dkd_shohin_id,
    updateSalesDetailTabCount: () => {},
    renderVehicleApplicationsTable: values => "fitments: " + values.length,
    representativeVehicleMaker: () => "HONDA",
    t: key => key,
    esc: value => String(value),
    document: {getElementById: id => id === "detail-vehicle-tab-content" ? vehicleTab : null}
  };
  vm.runInNewContext(isolate("async function loadCatalogVehicleSummary", "function renderGltekPartNumberRow"), vehicleContext);
  const panelRoot = {querySelector: () => makerValue, querySelectorAll: () => []};
  const loading = vehicleContext.loadCatalogVehicleSummary(panelRoot, product, 7);
  vehicleContext.currentProduct = {...product, shipping_size: "M"};
  resolveVehicles([{id: 347601, source_code: "partsfan", model: "GF-EK2"}]);
  await loading;
  assert.equal(vehicleTab.innerHTML, "fitments: 1", "shipping profile replacement must not strand the vehicle tab on loading");
  assert.equal(vehicleContext.currentVehicleApplicationRows.length, 1);
  vehicleTab.innerHTML = "newer product state";
  vehicleContext.fetchCatalogVehicleApplications = async () => [{id: 347601, model: "GF-EK2"}];
  await vehicleContext.loadCatalogVehicleSummary(panelRoot, product, 6);
  assert.equal(vehicleTab.innerHTML, "newer product state", "an older detail request must not replace the current tab");
  vehicleContext.currentProduct = product;
  await vehicleContext.loadCatalogVehicleSummary(panelRoot, product, 6);
  assert.equal(vehicleTab.innerHTML, "newer product state", "an older request for the same product must remain stale");
  vehicleContext.currentProduct = {...product, shipping_size: "M"};
  vehicleContext.fetchCatalogVehicleApplications = async () => { throw new Error("network unavailable"); };
  await vehicleContext.loadCatalogVehicleSummary(panelRoot, product, 7);
  assert(vehicleTab.innerHTML.includes("vehicle_info_load_error"), "a failed request must replace the loading state");
  vehicleTab.innerHTML = "読み込み中...";
  vehicleContext.fetchCatalogVehicleApplications = async () => [{id: 347601, model: "GF-EK2"}];
  vehicleContext.renderVehicleApplicationsTable = () => { throw new Error("invalid display data"); };
  await vehicleContext.loadCatalogVehicleSummary(panelRoot, product, 7);
  assert(vehicleTab.innerHTML.includes("vehicle_info_load_error"), "a rendering failure must replace the loading state");
  for (const file of ["index.html", "scripts/build-static-site.js"]) {
    const value = fs.readFileSync(path.join(root, file), "utf8");
    for (const asset of ["partsfan-research.js", "partsfan-research.css"]) assert(value.includes(asset));
  }
  assert(!/\.insert\(|\.update\(|\.delete\(|\.rpc\(/.test(source), "research dialog must only use the app's restricted import entry point");
  assert(app.includes('sb.rpc("import_partsfan_vehicle_applications"'), "app must use the server-validated import RPC");
  assert(!/dpapi|login_id|storageState|service_role/.test(source));
  console.log("PARTS FAN update: local bridge, explicit maker, stop feedback, authorization, provenance, supplemental failure and existing table behavior verified.");
})().catch(error => { console.error(error); process.exitCode = 1; });
