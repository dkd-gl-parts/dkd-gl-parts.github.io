"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),source=fs.readFileSync(path.join(root,"app.js"),"utf8");
const moduleApi=require(path.join(root,"packing-boxes.js"));
let count=0;
function eq(a,b){assert.deepEqual(a,b);count++;}
const context={Number,Array,Math,parseInt,APP_VERSION:"v-test",encodeURIComponent,
 esc:s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])),
 salesOrderDispatch:o=>o.dispatch,
 salesOrderInventoryItemHtml:()=>"<div class='sales-order-inventory-values'>合成在庫表示</div>",
 shippingDocumentDestinationContext:()=>({type:"direct",label:"配送先",badge:"合成",recipient:"合成宛先",postalAddress:"合成住所",phone:"000"}),
 customerProductKindLabel:k=>k==="rebuilt"?"リビルト品":"新品",
 customerOrderShippingMethodLabel:(s,f)=>s?s.carrier_name+" / "+s.service_name:f,
 customerOrderSavedShippingMethod:(o,k)=>k==="outbound"?o.outbound_shipping_method:o.core_return_shipping_method,
 customerOrderDateTimeText:()=>"2026/11/02",salesOrderDispatchBarcodeDataUrl:()=>"data:image/png;base64,fixture"};
const start=source.indexOf("function salesOrderDispatchWarrantyCount("),end=source.indexOf("async function ensureSalesOrderWarrantyPolicies",start);
vm.runInNewContext(source.slice(start,end),context);
function entry(i,quantity,warranty,core,size,boxes){return {quantity,warranty_snapshot:{warranty_document_required:warranty},serials:[],order_item:{gltek_part_number:"SYNTH-"+i,genuine_part_number:"SYNTH-G"+i,product_kind:"rebuilt",core_return_required:core,packing:{shipping_size_cm:size,box_options:boxes||[]}}};}
const order={order_number:"SYNTH-ORDER",customer_name:"合成宛先",core_return_required:true,
 outbound_shipping_method:{carrier_name:"合成運送",service_name:"元払い"},core_return_shipping_method:{carrier_name:"合成運送",service_name:"着払い"},
 dispatch:{dispatch_number:"D1234567890",issued_at:"2026-11-02T03:00:00Z",items:[entry(1,2,true,true,60,[{box_code:"BOX-A",box_name:"合成小箱"}]),entry(2,3,false,false,100),entry(3,1,true,true,null),entry(4,4,true,false,60,[{box_code:"A"},{box_code:"B"}]),entry(5,2,true,false,80,[{box_code:"C",box_name:"合成箱"}]),entry(6,1,false,true,120,[{box_code:"D",box_name:"合成箱"}]) ]}};
const rows=JSON.parse(JSON.stringify(context.salesOrderDispatchDocumentSet(order)));
eq(rows.map(r=>r.detail),["合成運送 / 元払い / 受注1件","9枚","4枚","4枚 / 合成運送 / 着払い"]);
const first=context.buildSalesOrderDispatchPage(order,order.dispatch.items.slice(0,4),0,2,"data:image/png;base64,fixture");
const last=context.buildSalesOrderDispatchPage(order,order.dispatch.items.slice(4),1,2,"data:image/png;base64,fixture");
eq(first.includes("dispatch-documents"),false);eq(last.includes("dispatch-documents"),true);
eq(last.indexOf("dispatch-documents")>last.indexOf("dispatch-signoff"),true);
const docs=last.slice(last.indexOf("<section class='dispatch-documents'"));
eq(docs.includes("対象商品"),false);eq(docs.includes("SYNTH-"),false);eq((docs.match(/<th scope='row'>/g)||[]).length,4);
eq(first.includes("出荷サイズ 60サイズ"),true);eq(first.includes("BOX-A / 合成小箱"),true);
eq(first.includes("出荷サイズ 未設定"),true);eq(first.includes("対応箱 未登録"),true);eq(first.includes("候補が複数あります"),true);
eq(first.includes("対象外"),false);eq(last.includes("対象外"),false);
const xss=entry(1,1,true,false,60,[{box_code:"X",box_name:"<script>alert(1)</script>"}]);
eq(context.buildSalesOrderDispatchPage({...order,core_return_required:false,dispatch:{items:[xss]}},[xss],0,1,"").includes("<script>"),false);
const unnecessary=JSON.parse(JSON.stringify(context.salesOrderDispatchDocumentSet({...order,dispatch:{warranty_document_required:false,items:[entry(1,1,false,false,60)]}})));
eq(unnecessary.slice(1).map(r=>r.detail),["不要","不要","不要"]);
const values={box_code:" box-a ",box_name:" 合成箱 ",shipping_size_cm:"60",inner_length_mm:"",inner_width_mm:"",inner_height_mm:"",display_order:"0",is_active:true};
const valid=moduleApi.validate(values);eq(valid.box_code,"BOX-A");eq(valid.shipping_size_cm,60);eq(valid.inner_length_mm,null);
for(const bad of [{shipping_size_cm:"1e2"},{shipping_size_cm:"0"},{shipping_size_cm:"501"},{inner_length_mm:"10"},{box_name:""},{box_code:"<x>"}]){assert.throws(()=>moduleApi.validate({...values,...bad}));count++;}
for(const fragment of ['id="packing-boxes-overlay"','src="packing-boxes.js?','id="shipping-packing-boxes-open"']){assert(fs.readFileSync(path.join(root,"index.html"),"utf8").includes(fragment));count++;}
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({order,expectedDocumentRows:rows},null,2));
console.log(`Shipping packing and document rows: ${count} assertions passed`);
