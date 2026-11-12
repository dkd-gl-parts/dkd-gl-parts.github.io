"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert/strict");
const root = path.resolve(__dirname, "..");
const report = fs.readFileSync(path.join(root, "manufacturing-ranking-report.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
new vm.Script(app);
new vm.Script(report);
function row(id, count, sheet = "全体集計") {
  return { id: String(id), sheet, isAggregate: sheet === "全体集計", productCode: String(id),
    maker: "PN-" + String(id).padStart(5, "0"), genuine: "", shipment: count, substitute: 0,
    masterProductIds: [String(id)] };
}
const sheets = [{ name: "全体集計", isAggregate: true }, { name: "オルタ", isAggregate: false }];
function context({ sourceRows, membership = [], denied = false, incomplete = false, fail = false, hold = null } = {}) {
  const calls = [];
  const rows = sourceRows || [row(1,100), row(2,80), row(9,40)];
  const database = rows.map((r, i) => ({ id: i + 1, dataset_id: "dataset",
    category_name: r.sheet, is_aggregate: r.isAggregate, product_code: r.productCode,
    manufacturer_part_number: r.maker, shipment_count: r.shipment, substitute_count: r.substitute,
    master_product_ids: r.masterProductIds, master_checked_at: "checked" }));
  const c = { window: {}, document: { getElementById: () => null }, console: { warn() {} },
    currentUser: { id: "qa" }, userProfile: { id: "qa" },
    canViewProductionFeatures: () => true, canViewManufacturingReport: () => !denied,
    sb: { from(table) {
      calls.push(table);
      const query = { field: "", ids: [],
        select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
        in(field, ids) { this.field = field; this.ids = Array.from(ids).map(String); return this; },
        async maybeSingle() {
          if (hold) await hold;
          return { data: { id: "dataset", report_year: 2025,
            row_count: database.length + (incomplete ? 1 : 0),
            sheet_manifest: sheets.map(s => ({ name: s.name, is_aggregate: s.isAggregate })) } };
        },
        async range(start, end) {
          calls.push({ table, start, field: this.field });
          if (fail) return { error: new Error("network failed") };
          const data = table === "manufacturing_report_rows" ? database :
            membership.filter(m => this.ids.includes(String(m[this.field])));
          return { data: data.slice(start, end + 1) };
        }
      };
      return query;
    } }
  };
  vm.createContext(c); vm.runInContext(report, c);
  return { c, api: c.window.DCatsManufacturingRankingReport, calls };
}
const members = [
  { id: 1, kikan_group_id: 10, dkd_gokan_id: 1 },
  { id: 2, kikan_group_id: 10, dkd_gokan_id: 2 },
  { id: 3, kikan_group_id: 20, dkd_gokan_id: 2 },
  { id: 4, kikan_group_id: 20, dkd_gokan_id: 3 },
  { id: 5, kikan_group_id: 30, dkd_gokan_id: 3 },
  { id: 6, kikan_group_id: 30, dkd_gokan_id: 1 }
];
(async () => {
  const { api } = context();
  const source = [row(1, 100), row(2,80), row(9,40), row(1,100,"オルタ"), { ...row(10,999), maker:"ＡＬＤＫ-001" }];
  const map = api.buildProductionRankMap(source, sheets, members);
  for (const id of ["1","2","3"]) assert.equal(map[id].rank, 1, "connected products share best source rank");
  assert.equal(map["9"].rank, 3, "unrelated rank retains the original overall sequence");
  assert.equal(map["10"], undefined, "ALDK never becomes a ranking source");
  assert.equal(map["4"], undefined, "unlinked products have no fabricated rank");
  assert.equal(map["2"].inherited, true);
  assert.equal(source[0].shipment, 100, "source shipment counts stay unchanged");
  const large = Array.from({length:260}, (_,i) => row(i+1, 300-i));
  assert.equal(api.buildProductionRankMap(large, sheets, [])["260"].rank, 260, "no top-200 or old top-100 cutoff");
  const equal = [row(2,100),row(1,100)];
  assert.equal(api.buildProductionRankMap(equal,sheets,[])["1"].rank,1,"ties follow report part-number ordering");
  const sourceCompat = [row(1,100),{...row(2,80),maker:row(1,100).maker},row(9,40)];
  assert.equal(api.buildProductionRankMap(sourceCompat,sheets,[])["2"].rank,1,"report-compatible part numbers inherit the same rank");

  const live = context({ membership: members });
  await Promise.all([live.api.loadProductionRanks(),live.api.loadProductionRanks()]);
  assert.equal(live.calls.filter(x=>x === "manufacturing_report_datasets").length,1,"concurrent loads share one request");
  assert.equal(live.api.productionRankFor({dkd_shohin_id:3}).rank,1,"transitive compatibility is loaded, including cycles");
  assert.equal(live.api.productionRankFor({dkd_shohin_id:9}).rank,3);
  await live.api.loadProductionRanks();
  assert.equal(live.calls.filter(x=>x === "manufacturing_report_datasets").length,1,"repeat loads reuse the current user's cache");
  live.c.currentUser = {id:"another"};
  assert.equal(live.api.productionRankFor({dkd_shohin_id:1}),null,"account switch hides cached ranks immediately");
  live.c.currentUser = {id:"qa"};
  live.c.canViewManufacturingReport = () => false;
  assert.equal(live.api.productionRankFor({dkd_shohin_id:1}),null,"permission loss hides cached data immediately");
  const denied = context({denied:true}); await denied.api.loadProductionRanks();
  assert.equal(denied.calls.length,0,"no reads without report permission");
  for (const options of [{fail:true},{incomplete:true}]) {
    const broken=context(options); await broken.api.loadProductionRanks();
    assert.equal(broken.api.productionRankStatus(),"error");
    assert.equal(broken.api.productionRankFor({dkd_shohin_id:1}),null,"no partial or legacy rank fallback");
  }
  const unlinked=context(); await unlinked.api.loadProductionRanks();
  assert.equal(unlinked.api.productionRankFor({dkd_shohin_id:999}),null);
  let release; const held=context({hold:new Promise(r=>{release=r;})});
  const request=held.api.loadProductionRanks(); held.api.resetProductionRanks(); release(); await request;
  assert.equal(held.api.productionRankStatus(),"idle","reset rejects late responses");
  const bigMembers=Array.from({length:1001},(_,i)=>({id:i+1,kikan_group_id:1,dkd_gokan_id:i+1}));
  const paged=context({membership:bigMembers}); await paged.api.loadProductionRanks();
  assert.equal(paged.api.productionRankFor({dkd_shohin_id:1001}).rank,1,"membership pagination includes row 1001");
  assert(paged.calls.some(x=>x.field==="kikan_group_id" && x.start===1000));

  const helperStart=app.indexOf("function productionReportRankFor(");
  const helperEnd=app.indexOf("function enrichProductionProduct(",helperStart);
  assert(helperStart>0 && helperEnd>helperStart);
  const ui={window:{DCatsManufacturingRankingReport:live.api},t:k=>k,tf:(k,v)=>k+v.year,esc:String};
  live.c.canViewManufacturingReport=()=>true;
  vm.createContext(ui);vm.runInContext(app.slice(helperStart,helperEnd),ui);
  assert(ui.renderProductionReportRank({dkd_shohin_id:2},false).includes("#1"));
  assert(ui.renderProductionReportRank({dkd_shohin_id:3},true).includes("#1"));
  assert(!ui.renderProductionReportRank({dkd_shohin_id:999},true).includes("#"));
  assert(app.includes("var rankHtml = renderProductionReportRank(row, false);"));
  assert(app.includes("var priorityHtml = renderProductionReportRank(row, true);"));
  const sortStart=app.indexOf("function sortProductionRows(");
  assert(app.slice(sortStart,app.indexOf("async function loadProductionSearch",sortStart)).includes("productionReportRankFor(a)"));
  console.log("Production report ranking: canonical overall shipment ranks, compatibility inheritance, pagination, permissions, cache ownership, late responses and badge integration passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});
