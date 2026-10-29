"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), crypto = require("node:crypto");
const {parseHTML} = require("linkedom"), acorn = require("acorn");
const root = path.resolve(__dirname, ".."), moduleSource = fs.readFileSync(path.join(root, "factoring-pricing.js"), "utf8"), app = fs.readFileSync(path.join(root, "app.js"), "utf8"), html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const panel = html.slice(html.indexOf('<section id="factoring-pricing-panel"'), html.indexOf("</section>", html.indexOf('<section id="factoring-pricing-panel"')) + 10);
const {document, window: dom} = parseHTML('<html><body><input id="sales-base-price" value="5800"><div id="sales-rank-preview"></div>'+panel+"</body></html>");
const unit = document.getElementById("factoring-rounding_unit_jpy");let unitValue = "";
Object.defineProperty(unit, "value", {configurable:true,get:()=>unitValue,set:v=>{unitValue=String(v);}});
const storage = new Map(), sessionStorage = {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const ctx = {document,console,sessionStorage,crypto:crypto.webcrypto,confirm:()=>true,Number,String,Object,Array,Set,BigInt};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(moduleSource,ctx);
const api=ctx.DcatsFactoringPricing, config={tax_rate_percent:10,factoring_rate_percent:6,sales_fee_rate_percent:10,shipping_allocation_rate_percent:1,rounding_unit_jpy:100};
let count=0;const eq=(a,b,m)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),b,m);count++;};
const tick=()=>new Promise(r=>setTimeout(r,0)), node=id=>document.getElementById("factoring-"+id);
const reject=async(f,p)=>{await assert.rejects(f,p);count++;};
const ast=acorn.parse(app,{ecmaVersion:"latest",sourceType:"script"});
function fn(name){const n=ast.body.find(n=>n.type==="FunctionDeclaration"&&n.id.name===name);assert(n,name);return app.slice(n.start,n.end);}
(async()=>{
 for(const [base,trade,market] of [[5800,6300,7100],[8000,8700,9700],[12000,13000,14600],[2725,3000,3400],[41700,45100,50500]])
  eq(api.calculate(base,config),{trade_price_jpy:trade,marketplace_price_jpy:market,sales_price_jpy:market});
 const roundup=(n,d,u)=>Number(((n+d*BigInt(u)-1n)/(d*BigInt(u)))*BigInt(u));
 for(const [t,f,s,h,u] of [[10,6,10,1,100],[8,4.25,8.5,2.125,10],[0,0,0,0,1],[10,5,0,0,1000]]){
  for(const b of [1,83,417,2725,5799,5800,100000,214700]){
   const S=1000000n,r=x=>BigInt(Math.round(x*10000)),n=BigInt(b)*(S+r(h))*S,dt=S*S-r(f)*(S+r(t)),dm=dt-r(s)*S;
   const trade=roundup(n,dt,u),market=roundup(n,dm,u);
   eq(api.calculate(b,{tax_rate_percent:t,factoring_rate_percent:f,sales_fee_rate_percent:s,shipping_allocation_rate_percent:h,rounding_unit_jpy:u}),{trade_price_jpy:trade,marketplace_price_jpy:market,sales_price_jpy:Math.max(trade,market)});
  }
 }
 for(const v of [null,"",0])eq(api.calculate(v,config),null);
 for(const [b,s] of [[-1,config],[1.5,config],[2147483647,config],[1,{...config,factoring_rate_percent:95}],[1,{...config,shipping_allocation_rate_percent:1.00001}],[1,{...config,tax_rate_percent:""}],[1,{...config,rounding_unit_jpy:20}],[1,{...config,sales_fee_rate_percent:NaN}]]){
  assert.throws(()=>api.calculate(b,s));count++;
 }
 let actor="actor-1",allowed=true,editable=true,confirm=true,server={...config,revision:1},rpcLog=[],handler=null,changes=0;
 const options={document,storage:sessionStorage,owner:()=>actor,allowed:()=>allowed,editable:()=>editable,confirm:()=>confirm,base:()=>document.getElementById("sales-base-price").value,yen:n=>"¥"+n,changed:()=>{changes++;},uuid:()=>crypto.randomUUID(),
 rpc:async(action,payload)=>{rpcLog.push({action,payload});if(handler)return handler(action,payload);if(action==="get")return {...server};if(action==="save"){server={...payload.settings,revision:server.revision+1};return {...server};}throw new Error("Unexpected "+action);}};
 const ui=api.createController(options);
 eq(ui.preview(5800),null);await ui.open();eq(ui.preview(5800).sales_price_jpy,7100);
 eq(node("tax_rate_percent").value,"10");eq(node("save").disabled,true);
 const input=(key,value)=>{node(key).value=String(value);node(key).dispatchEvent(new dom.Event("input",{bubbles:true}));};
 input("factoring_rate_percent","95");eq(ui.preview(5800),null);const before=rpcLog.length;await ui.save();eq(rpcLog.length,before);
 input("factoring_rate_percent","7");eq(ui.isBusy(),true);eq(node("save").disabled,false);
 confirm=false;eq(ui.close(),false);confirm=true;
 await ui.save();eq(server.revision,2);eq(node("save").disabled,true);eq(storage.size,0);
 input("shipping_allocation_rate_percent","2");handler=async()=>{throw new TypeError("Network lost");};await ui.save();
 eq(node("receipt").hidden,false);eq(node("save").disabled,true);eq(ui.close(),false);eq(storage.size,1);
 const sent=rpcLog.findLast(r=>r.action==="save"),calls=rpcLog.length;await ui.save();eq(rpcLog.length,calls,"unknown result never automatically replays");
 handler=async(action)=>action==="receipt"?{saved:false,settings:null}:null;await ui.receipt();eq(node("retry").hidden,false);
 handler=async(action,payload)=>{assert.equal(action,"save");eq(payload.request_id,sent.payload.request_id);server={...payload.settings,revision:3};return server;};
 node("retry").dispatchEvent(new dom.Event("click"));await tick();eq(node("receipt").hidden,true);eq(storage.size,0);
 input("tax_rate_percent","8");handler=async()=>{throw {code:"40001",message:"他の操作で更新されています"};};await ui.save();eq(node("receipt").hidden,true);eq(node("status").textContent.includes("他の操作"),true);
 handler=null;await ui.load();eq(node("tax_rate_percent").value,"10");
 editable=false;ui.refresh();input("tax_rate_percent","8");const readonly=rpcLog.length;await ui.save();eq(rpcLog.length,readonly);eq(node("save").hidden,true);editable=true;
 let resolveLoad;handler=()=>new Promise(resolve=>{resolveLoad=resolve;});const loading=ui.load();actor="actor-2";resolveLoad({...config,revision:99});await loading;eq(ui.preview(5800),null);eq(node("pricing-panel").hidden,true);
 actor="actor-1";handler=null;await ui.open();
 input("tax_rate_percent","8");let resolveSave;handler=()=>new Promise(resolve=>{resolveSave=resolve;});const saving=ui.save();allowed=false;resolveSave({...config,revision:100});await saving;eq(ui.preview(5800),null);eq(storage.size,1,"lost permission keeps operation receipt for its actor");
 allowed=true;handler=async(action)=>{assert.equal(action,"receipt");return {saved:true,settings:{...config,tax_rate_percent:8,revision:100}};};await ui.open();eq(ui.preview(5800).sales_price_jpy,7100);eq(storage.size,0);
 // Reopening never accepts a response from an earlier open.
 server={...config,revision:101};ui.invalidate();let resolveOld;handler=()=>new Promise(resolve=>{resolveOld=resolve;});const old=ui.open();ui.invalidate();handler=null;await ui.open();resolveOld({...config,revision:999,tax_rate_percent:0});await old;eq(node("tax_rate_percent").value,"10");
 // Existing app consumers must use final server prices and never fall back to base/DKS values.
 ctx.salesPricingRanks=[{rank_code:"HANBAIOU_URI_1",rank_name:"売値区分1",rate_multiplier:1,rounding_unit_jpy:1}, {rank_code:"HANBAIOU_URI_2",rank_name:"売値区分+1",rate_multiplier:1.05,rounding_unit_jpy:10}, {rank_code:"RECYCLE_FACTORING",rank_name:"ファクタリング",rate_multiplier:1,rounding_unit_jpy:100}];
 ctx.salesPricingCustomerCounts={};ctx.canManageSalesPricing=()=>true;ctx.canViewBasePrice=()=>true;ctx.salesRankDisplayName=r=>r.rank_name;ctx.formatYen=String;ctx.formatYenCurrency=v=>"¥"+v;ctx.esc=String;ctx.t=k=>k;ctx.CSS={escape:s=>s};
 ctx.DcatsFactoringPricing={...api,preview:b=>ui.preview(b)};
 for(const name of ["calculateSalesPriceClient","renderSalesRankPreview","collectSalesRankSettingsFromForm"])vm.runInContext(fn(name),ctx);
 ctx.renderSalesRankPreview();eq(document.querySelectorAll(".sales-rank-rate").length,2);eq(ctx.collectSalesRankSettingsFromForm().map(r=>r.rank_code),["HANBAIOU_URI_1","HANBAIOU_URI_2"]);
 eq(document.getElementById("sales-rank-preview").textContent.includes("¥7100"),true);
 ctx.isCustomerViewer=()=>false;ctx.isCustomerPortalSearchMode=()=>false;ctx.customerViewerSetting=()=>true;ctx.productDkdId=p=>p.dkd_shohin_id;ctx.customerCatalogProductKind=p=>p.default_product_kind||"rebuilt";ctx.selectedProductKind=()=>"rebuilt";ctx.normalizeProductKind=k=>k||"rebuilt";
 ctx.customerCatalogContext=()=>({customer:{price_rank_code:"RECYCLE_FACTORING"}});ctx.fetchInternalFactoringPriceMap=async()=>({"1|rebuilt":7100,"4|rebuilt":14600});
 ctx.sb={from:()=>{throw new Error("Must not query base prices");},rpc:()=>{throw new Error("Unexpected RPC");}};
 for(const name of ["fetchCustomerCatalogPriceMap","fetchDetailCustomerPriceInfo","loadCustomerPriceListRows"])vm.runInContext(fn(name),ctx);
 eq(await ctx.fetchCustomerCatalogPriceMap([{dkd_shohin_id:1},{dkd_shohin_id:3},{dkd_shohin_id:4}]),{1:7100,3:null,4:14600});
 eq(await ctx.fetchDetailCustomerPriceInfo({price_rank_code:"RECYCLE_FACTORING"},3),{salesPrice:null,basePrice:null,taxIncluded:false});
 ctx.ensureCustomerAccessPriceRanks=async()=>{};ctx.loadCustomerPriceListBaseRows=async()=>[{dkd_shohin_id:1,product_kind:"rebuilt",base_price_jpy:5800},{dkd_shohin_id:3,product_kind:"rebuilt",base_price_jpy:9999}];
 ctx.loadCustomerPriceListProductMap=async()=>({1:{dkd_shohin_id:1},3:{dkd_shohin_id:3},4:{dkd_shohin_id:4}});ctx.defaultCustomerDisplaySettings=()=>({});ctx.customerAccessSettings={};ctx.customerAccessVisibilityRows=[];ctx.customerPriceListRank=()=>({rank_code:"RECYCLE_FACTORING"});ctx.customerCategoryIsVisible=()=>true;ctx.customerPriceListSortRows=rows=>rows;
 eq((await ctx.loadCustomerPriceListRows({price_rank_code:"RECYCLE_FACTORING"},{})).map(r=>r.salesPrice),[7100,14600]);
 // Batch API handles >500 products and discards responses after a session change.
 ctx.DcatsFactoringPricing=api;ctx.currentUser={id:"synthetic"};ctx.canSeeSalesPrice=()=>true;ctx.canViewSalesPricing=()=>true;let authCallback,batches=[];
 ctx.sb={auth:{onAuthStateChange:cb=>{authCallback=cb;}},rpc:async(name,args)=>{assert.equal(name,"get_factoring_product_prices");batches.push(args.target_ids);return {data:[{dkd_shohin_id:args.target_ids[0],product_kind:"rebuilt",price_jpy:7100}]};}};
 await api.prices(Array.from({length:501},(_,i)=>i+1));eq(batches.map(r=>r.length),[500,1]);
 let resolvePrice;ctx.sb.rpc=()=>new Promise(resolve=>{resolvePrice=resolve;});const inFlight=api.prices([1]);authCallback("SIGNED_OUT");resolvePrice({data:[{dkd_shohin_id:1,product_kind:"rebuilt",price_jpy:7100}]});await reject(()=>inFlight,/ログイン/);
 eq(html.indexOf('src="factoring-pricing.js')<html.indexOf('src="app.js'),true);
 eq(fs.readFileSync(path.join(root,"scripts/build-static-site.js"),"utf8").includes('"factoring-pricing.js"'),true);
 assert(changes>0);count++;
 console.log("Factoring pricing frontend: "+count+" assertions passed");
})().catch(e=>{console.error(e);process.exitCode=1;});
