const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const app = fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const ast = acorn.parse(app,{ecmaVersion:'latest'});
const names = ['customerOrderManualProductPrice','customerOrderHasInvalidManualPrices','customerOrderPayloadItems'];
const functions = names.map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert.ok(n,name);return app.slice(n.start,n.end);}).join('\n');
let internal=true;
const context={canRegisterInternalCustomerOrder:()=>internal,normalizeProductKind:v=>v,t:k=>k,customerOrderCart:[]};
vm.createContext(context);vm.runInContext(functions,context);
const item={dkd_shohin_id:1,product_kind:'rebuilt',quantity:2,core_return_handling:'charge_with_return',manual_product_unit_price_jpy:'5800'};
context.customerOrderCart=[item];
assert.equal(context.customerOrderPayloadItems()[0].product_unit_price_jpy,5800);
assert.equal(context.customerOrderPayloadItems()[0].core_return_handling,'charge_with_return');
item.manual_product_unit_price_jpy='0';assert.equal(context.customerOrderPayloadItems()[0].product_unit_price_jpy,0);
item.manual_product_unit_price_jpy='';assert.equal(Object.hasOwn(context.customerOrderPayloadItems()[0],'product_unit_price_jpy'),false);
for(const value of ['-1','1.1','1e2','2147483648','NaN','Infinity']){
 item.manual_product_unit_price_jpy=value;assert.equal(context.customerOrderHasInvalidManualPrices(),true);assert.throws(()=>context.customerOrderPayloadItems());
}
internal=false;
assert.equal(context.customerOrderHasInvalidManualPrices(),false);
assert.equal(Object.hasOwn(context.customerOrderPayloadItems()[0],'product_unit_price_jpy'),false);
item.manual_product_unit_price_jpy='5800';assert.equal(Object.hasOwn(context.customerOrderPayloadItems()[0],'product_unit_price_jpy'),false);
console.log('Internal-only product price payload and invalid-input guard passed.');

// An old server may ignore a newly introduced item field. Verify that the real
// preview handler refuses that result before it can become a confirmed order.
const previewNames=['customerOrderCartKey','customerOrderPreviewItemMap','customerOrderBilledCoreChargePerUnit','previewCustomerOrder'];
for(const name of previewNames){const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);vm.runInContext(app.slice(node.start,node.end),context);}
internal=true;item.manual_product_unit_price_jpy='6200';context.customerOrderCart=[{...item,key:'1:rebuilt'}];
Object.assign(context,{
 customerOrderPreview:null,customerOrderPreviewSeq:0,customerPortalPreviewContext:{sales_customer_id:1},
 canPreviewCustomerOrdering:()=>false,canUseCustomerOrdering:()=>false,
 customerOrderAddressPayload:()=>({}),customerOrderShippingMethodPayload:()=>({}),customerOrderCoreReturnShippingMethodPayload:()=>null,
 customerOrderDestinationError:()=>'',renderCustomerOrderCart:()=>{},applyCustomerOrderAddress:()=>{},
 customerOrderSetStatus:(message,error)=>{context.lastStatus={message,error};},
 sb:{rpc:async()=>({data:{valid:true,preview_token:'synthetic',items:[{dkd_shohin_id:1,product_kind:'rebuilt',unit_price_jpy:5800,core_charge_jpy:0}]}})}
});
(async()=>{
 await context.previewCustomerOrder();assert.equal(context.customerOrderPreview,null);assert.equal(context.lastStatus.message,'customer_order_internal_price_not_applied');
 context.sb.rpc=async()=>({data:{valid:true,preview_token:'synthetic',items:[{dkd_shohin_id:1,product_kind:'rebuilt',unit_price_jpy:9200,core_charge_jpy:3000}]}});
 await context.previewCustomerOrder();assert.equal(context.customerOrderPreview.valid,true);
 console.log('Server price confirmation rejects ignored edits and accepts the edited product price with a separate core charge.');
})().catch(error=>{console.error(error);process.exitCode=1;});
