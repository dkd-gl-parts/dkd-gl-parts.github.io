const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const source = fs.readFileSync(path.join(root,'product-data-research.js'),'utf8');
const app = fs.readFileSync(path.join(root,'app.js'),'utf8');
const stock = fs.readFileSync(path.join(root,'container-stock-import.js'),'utf8');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const build = fs.readFileSync(path.join(root,'scripts/build-static-site.js'),'utf8');
const context = { window:{} };
vm.runInNewContext(source,context);
const api = context.window.DcatsProductResearch;
const good = {category_code:'starter',manufacturer:'DENSO',genuine_part_number:'31100-TEST-001',manufacturer_part_number:'228000-TEST1',
  research_registration_evidence:{input_part_number:'31100-TEST-001',source_type:'document',source_reference:'原票確認 p.1',identity_confirmed:true}};
assert.equal(api.missingFields(good).length,0);
for (const p of [
  {...good,category_code:''}, {...good,manufacturer:'不明'}, {...good,genuine_part_number:'',manufacturer_part_number:''},
  {...good,manufacturer_part_number:'31100TEST001'},
  {...good,research_registration_evidence:{...good.research_registration_evidence,identity_confirmed:false}},
  {...good,research_registration_evidence:{...good.research_registration_evidence,identity_confirmed:'true'}},
  {...good,research_registration_evidence:{...good.research_registration_evidence,source_reference:''}},
  {...good,research_registration_evidence:{...good.research_registration_evidence,input_part_number:'OTHER-001'}}
]) assert(api.missingFields(p).length>0,'incomplete/unconfirmed research must stay blocked');
assert.equal(api.matchKey('A001T-123'),'A1T123');
const groups = [
  {token:'IMPORTED-1',matchCount:2,candidates:[{dkd_shohin_id:1},{dkd_shohin_id:2}]},
  {token:'IMPORTED-2',matchCount:1,candidates:[{dkd_shohin_id:3}]},
  {token:'MISSING-1',matchCount:0,candidates:[]}
];
const sandbox = {
  manufacturingCostCandidateMode:'import',manufacturingCostCandidateGroups:groups,
  manufacturingCostCandidateRows:[{dkd_shohin_id:1},{dkd_shohin_id:2},{dkd_shohin_id:3}],
  manufacturingCostCurrentProductIdMap:()=>({1:true}),productDkdId:p=>p.dkd_shohin_id,
  esc:s=>String(s),tf:(k,o)=>JSON.stringify(o),
  renderManufacturingCostCandidateRow:p=>`CANDIDATE_${p.dkd_shohin_id}`
};
function isolate(start,end) {return app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)+1));}
vm.runInNewContext(isolate('function pendingManufacturingCostCandidateProducts','async function openManufacturingCostProductResearch') +
  isolate('function renderManufacturingCostImportCandidateGroups','function pendingManufacturingCostCandidateProducts'),sandbox);
assert.equal(sandbox.pendingManufacturingCostCandidateProducts().length,1,'hide entire group after an adopted candidate');
let rendered = sandbox.renderManufacturingCostImportCandidateGroups(groups,false,{1:true});
assert(!rendered.includes('CANDIDATE_1') && !rendered.includes('CANDIDATE_2'));
assert(rendered.includes('CANDIDATE_3') && rendered.includes('紐づけ済み 1'));
assert(rendered.includes('MISSING-1：不足データを探す') && rendered.includes('要調査'));
sandbox.manufacturingCostCurrentProductIdMap=()=>({});
assert.equal(sandbox.pendingManufacturingCostCandidateProducts().length,3,'removal restores candidate group');
assert(app.includes('manufacturingCostRows = previousRows') && app.includes('import_part_numbers:'),'preserve resolved rows on failure and original part mapping on save');
assert(stock.includes('root.DcatsProductResearch.open') && stock.includes('再照合できませんでした'));
for (const asset of ['product-data-research.js','product-data-research.css']) {assert(html.includes(asset));assert(build.includes(asset));}
assert(!/\.from\(["']core_products["']\)\s*\.insert/.test(source),'research cannot perform unvalidated browser master insert');
assert(source.includes('register_researched_product') && source.includes('current.searchOK = false'));
assert(source.includes('seq !== state.seq') && source.includes('identity_confirmed: byId'));
console.log('Product research: missing-information gate, adoption/undo, provenance, stale/error and atomic registration contracts verified.');
