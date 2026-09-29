"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "partsfan-research.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const context = {window: {currentLang: "ja", canManageProductSpecs: () => false}, URL, Date};
vm.runInNewContext(source, context);
const api = context.window.PartsfanResearch;
assert.equal(api.inputCsv("23300-AX000", "ニッサン"), '\ufeff品番,メーカー\r\n"23300-AX000","ニッサン"\r\n');
for (const [part, maker] of [["23300-AX000", ""], ["23300-AX000", "DENSO"], ["=CMD()", "ニッサン"], ["A\nB", "ニッサン"]]) assert.throws(() => api.inputCsv(part, maker));
assert.equal(api.buttonHtml(), "");
assert.equal(api.open({}), false, "unauthorized callers cannot open the research dialog");
context.window.canManageProductSpecs = () => true;
assert(api.buttonHtml().includes("適合車両を調べる"));
const clean = api.details({grade: "G", transmission: "AT", chassis_range: "0001 - 9999", source_url: "https://partsfan.com/nissan/jp/pnodetail/TEST/23300AX000/", collected_at: "2026-09-29T01:00:00Z", password: "SHOULD_NOT_APPEAR"});
assert.equal(clean.grade, "G");
assert(!Object.hasOwn(clean, "password"));
for (const source_url of ["javascript:alert(1)", "https://partsfan.com.evil.test/x", "https://partsfan.com/login/", "https://partsfan.com/nissan/jp/pnodetail/x/?token=SECRET"]) assert.equal(api.details({source_url}).source_url, "");
assert.equal(api.details({collected_at: "invalid", grade: "x".repeat(301)}).grade, "");
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
const renderContext = {window: context.window, currentLang: "ja", t: value => value, tf: () => "no results", esc: value => String(value).replace(/</g, "&lt;"), vehicleMakerLabel: value => value, renderVehicleApplicationText: value => String(value), vehicleApplicationPartNameLabel: value => value};
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
  assert(renderContext.renderVehicleApplicationsTable(fetched).includes("グレード"));
  assert(!renderContext.renderVehicleApplicationsTable([rows[1]]).includes("グレード"));
  assert(renderContext.renderVehicleApplicationsTable([]).length > 0);
  for (const file of ["index.html", "scripts/build-static-site.js"]) {
    const value = fs.readFileSync(path.join(root, file), "utf8");
    for (const asset of ["partsfan-research.js", "partsfan-research.css"]) assert(value.includes(asset));
  }
  assert(!/\.insert\(|\.update\(|\.delete\(|\.rpc\(/.test(source), "research dialog must not mutate or import data");
  assert(!/dpapi|login_id|storageState|service_role/.test(source));
  console.log("PARTS FAN research: explicit maker, CSV, authorization, provenance, supplemental failure and existing table behavior verified.");
})().catch(error => { console.error(error); process.exitCode = 1; });
