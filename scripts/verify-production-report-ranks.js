"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert/strict");
const root=path.resolve(__dirname,"..");
const report=fs.readFileSync(path.join(root,"manufacturing-ranking-report.js"),"utf8");
const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
new vm.Script(report);new vm.Script(app);
function row(code,shipment,maker="M-"+code){return {id:code,sheet:"全体集計",isAggregate:true,productCode:String(code),maker,genuine:"G-SHARED",shipment,substitute:0,masterProductIds:["1","2","3","99"]};}
const sheets=[{name:"全体集計",isAggregate:true}];
function product(id,code=id){return {dkd_shohin_id:id,dks_shohin_cd:code};}
function context({rows=[row(1,100),row(2,80),row(9,40)],members=[],products=[product(1),product(2),product(3),product(9),product(99)],denied=false,fail=false,incomplete=false,hold=null}={}){
 const calls=[],queries=[],db=rows.map((r,i)=>({id:i+1,dataset_id:"dataset",category_name:r.sheet,is_aggregate:true,category_order:1,source_row_number:i+1,product_code:r.productCode,manufacturer_part_number:r.maker,genuine_part_number:r.genuine,shipment_count:r.shipment}));
 const c={window:{},document:{getElementById:()=>null},console:{warn(){}},currentUser:{id:"qa"},userProfile:{id:"qa"},canViewProductionFeatures:()=>true,canViewManufacturingReport:()=>!denied,
 sb:{from(table){calls.push(table);const q={table,field:"",ids:[],select(columns){this.columns=columns;return this},eq(){return this},in(field,ids){this.field=field;this.ids=Array.from(ids,String);return this},order(){return this},limit(){return this},
 async maybeSingle(){if(hold)await hold;return {data:{id:"dataset",report_year:2025,row_count:db.length*2,sheet_manifest:[{name:"全体集計",is_aggregate:true,count:db.length+(incomplete?1:0)},{name:"明細",is_aggregate:false,count:db.length}]}}},
 async range(start,end){queries.push({table,field:this.field,ids:this.ids,columns:this.columns,start});if(fail)return {error:Error("network failure")};let list=table==="manufacturing_report_rows"?db:table==="core_products"?products:members;if(this.field)list=list.filter(r=>this.ids.includes(String(r[this.field])));return {data:list.slice(start,end+1)}}};return q;}}};
 vm.createContext(c);vm.runInContext(report,c);return {c,api:c.window.DCatsManufacturingRankingReport,calls,queries};
}
(async()=>{
 const {api}=context();
 const rows=[row(7235,100,"102211-7100"),row(30652,20,"102211-7101"),row(20510,5,"ZADK17101"),row(43376,10,"ALDK27100")];
 const records=[product(2583,7235),product(31631,30652),product(36152,20510),product(28757,43376),product(2585,10918),product(999,null)];
 const members=[{id:1,kikan_group_id:7235,dkd_gokan_id:2583},{id:2,kikan_group_id:7235,dkd_gokan_id:31631},{id:3,kikan_group_id:7235,dkd_gokan_id:2585}];
 const result=api.buildProductionRankMap(rows,sheets,members,records);
 assert.equal(result[2583].rank,1);
 assert.equal(result[31631].rank,2,"own source rank wins even when a compatible product ranks higher");
 assert.equal(result[31631].inherited,false);
 assert.equal(result[2585].rank,1,"an unlisted registered member still inherits the best source rank");
 assert.equal(result[36152].rank,3,"same genuine number outside group keeps its own source-code rank");
 assert.equal(result[28757],undefined,"excluded ALDK product outside group has no rank");
 assert.equal(result[999],undefined,"part-match candidates never establish rank identity");
 const ownFirst=api.buildProductionRankMap([],[],[{id:1,kikan_group_id:33,dkd_gokan_id:1},{id:2,kikan_group_id:33,dkd_gokan_id:2},{id:3,kikan_group_id:33,dkd_gokan_id:3}],[product(1),product(2),product(3,null)],{"1":488,"2":25});
 assert.equal(ownFirst[1].rank,488,"ranked product must not inherit compatible rank 25");
 assert.equal(ownFirst[1].inherited,false);
 assert.equal(ownFirst[2].rank,25);
 assert.equal(ownFirst[3].rank,25,"only unlisted member inherits rank 25");
 assert.equal(ownFirst[3].sourceProductId,"2");
 const independent=api.buildProductionRankMap([row(1,100,"SAME"),row(2,80,"SAME")],sheets,[],[product(1),product(2)]);
 assert.equal(independent[2].rank,2,"same manufacturer or genuine number is not compatibility");
 const chain=[{id:1,kikan_group_id:1,dkd_gokan_id:1},{id:2,kikan_group_id:1,dkd_gokan_id:2},{id:3,kikan_group_id:2,dkd_gokan_id:2},{id:4,kikan_group_id:2,dkd_gokan_id:3}];
 const chained=api.buildProductionRankMap([row(1,100),row(3,20)],sheets,chain,[product(1),product(2,null),product(3)]);
 assert.equal(chained[3].rank,2,"no rank crosses an indirect group chain");
 const large=Array.from({length:260},(_,i)=>row(i+1,300-i));
 assert.equal(api.buildProductionRankMap(large,sheets,[],[product(260)])[260].rank,260);
 const live=context({rows,members,products:records});
 const targets=records.map(p=>({dkd_shohin_id:p.dkd_shohin_id}));
 await Promise.all([live.api.loadProductionRanks(targets),live.api.loadProductionRanks(targets)]);
 assert.equal(live.calls.filter(x=>x==="manufacturing_report_datasets").length,1,"simultaneous requests share source cache");
 assert.equal(live.api.productionRankFor(product(2583)).rank,1);
 assert.equal(live.api.productionRankFor(product(31631)).rank,2);
 assert.equal(live.api.productionRankFor(product(36152)).rank,3);
 assert.equal(live.api.productionRankFor(product(28757)),null);
 assert.equal(live.api.productionRankStatus(product(28757)),"ready","known rankless differs from loading or failure");
 assert(live.queries.filter(q=>q.table==="manufacturing_report_rows").every(q=>q.field==="category_name"&&q.ids.join()==="全体集計"));
 assert(live.queries.filter(q=>q.table==="manufacturing_report_rows").every(q=>!q.columns.includes("master_product_ids")&&!q.columns.includes("vehicle_classification")));
 assert.equal(live.queries.filter(q=>q.field==="dkd_gokan_id").length,1,"only requested products drive membership reads");
 const before=live.calls.length;await live.api.loadProductionRanks(targets);
 assert.equal(live.calls.length,before,"warm target lookup makes zero reads");
 live.c.currentUser={id:"other"};assert.equal(live.api.productionRankFor(product(2583)),null);
 live.c.currentUser={id:"qa"};live.c.canViewManufacturingReport=()=>false;assert.equal(live.api.productionRankFor(product(2583)),null);
 const denied=context({denied:true});await denied.api.loadProductionRanks([product(1)]);assert.equal(denied.calls.length,0);
 for(const options of [{fail:true},{incomplete:true}]){const broken=context(options);await broken.api.loadProductionRanks([product(1)]);assert.equal(broken.api.productionRankStatus(product(1)),"error");assert.equal(broken.api.productionRankFor(product(1)),null);}
 let release;const held=context({hold:new Promise(r=>release=r)});const pending=held.api.loadProductionRanks([product(1)]);await Promise.resolve();held.api.resetProductionRanks();release();await pending;assert.equal(held.api.productionRankStatus(product(1)),"idle");
 const many=Array.from({length:1001},(_,i)=>({id:i+1,kikan_group_id:7,dkd_gokan_id:i+1}));
 const paged=context({members:many,products:many.map(m=>product(m.dkd_gokan_id,m.dkd_gokan_id===1?1:null))});
 await paged.api.loadProductionRanks([product(1001)]);
 assert.equal(paged.api.productionRankFor(product(1001)).rank,1);
 assert(paged.queries.some(q=>q.field==="kikan_group_id"&&q.start===1000));
 const reads=paged.calls.length;await paged.api.loadProductionRanks([product(2)]);
 assert.equal(paged.api.productionRankFor(product(2)).rank,1);
 assert.equal(paged.calls.length-reads,1,"new member in cached group needs just its direct membership lookup");
 assert.equal(paged.queries.filter(q=>q.table==="manufacturing_report_rows").length,1,"aggregate source fetched once across searches");
 const aux=app.slice(app.indexOf("async function loadProductionAuxiliaryData"),app.indexOf("function productionMatchesQuery",app.indexOf("async function loadProductionAuxiliaryData")));
 const fast=aux.slice(aux.indexOf("var fast ="),aux.indexOf("if (auxSeq !=="));
 assert(!fast.includes("loadProductionReportRanks"),"rank data never blocks other auxiliary data");
 assert(aux.includes("loadProductionReportRanks(products).then("));
 const enter=app.slice(app.indexOf("async function enterProductionSearch"),app.indexOf("function resetProductionSearchView"));
 assert(!enter.includes("resetProductionReportRanks"),"re-entering the screen preserves the current user's short-lived cache");
 const helper=app.slice(app.indexOf("function productionReportRankFor("),app.indexOf("function enrichProductionProduct("));
 assert(helper.includes("productionRankStatus(row)"));

 const auxStart=app.indexOf("async function loadProductionAuxiliaryData"),auxEnd=app.indexOf("function productionMatchesQuery",auxStart);
 let resolveRank,rankRefreshes=0;
 const auxiliary={productionAuxRequestSeq:0,productionRows:[product(1)],currentProductionRow:null,productVariantSummaryCache:{},
 loadProductionReportRanks:()=>new Promise(resolve=>{resolveRank=resolve}),refreshProductionReportRankViews:()=>{rankRefreshes++},
 fetchProductionPartRegistrationCountMap:async()=>({total:{1:7},byKind:{}}),fetchCoreStockQtyMap:async()=>({1:2}),
 fetchProductVariantSummaryMap:async()=>({}),fetchProductSearchCardFlags:async()=>[],fetchProductImageCountMapForContext:async()=>({}),
 applyProductSearchCardFlags(){},applyProductImageCountMapForContext(){},enrichProductionProduct:p=>p,sortProductionRows(){},renderProductionList(){},console};
 vm.createContext(auxiliary);vm.runInContext(app.slice(auxStart,auxEnd),auxiliary);
 await auxiliary.loadProductionAuxiliaryData([product(1)]);
 assert.equal(auxiliary.componentUsageCountMap[1],7,"component data renders while rank request is still pending");
 assert.equal(rankRefreshes,0);resolveRank();await Promise.resolve();await Promise.resolve();assert.equal(rankRefreshes,1);
 await auxiliary.loadProductionAuxiliaryData([product(1)]);auxiliary.productionAuxRequestSeq++;resolveRank();await Promise.resolve();await Promise.resolve();
 assert.equal(rankRefreshes,1,"late rank response must not repaint a newer search");
 console.log("Production ranks: exact source product codes, explicit group scope, B2020 exclusion, no indirect inheritance, scoped aggregate reads, bounded pagination, zero-read warm cache, one-read group reuse, permissions, stale responses and nonblocking UI passed.");
})().catch(e=>{console.error(e);process.exitCode=1});
