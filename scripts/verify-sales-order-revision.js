const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync('sales-order-revision.js','utf8');
const app = fs.readFileSync('app.js','utf8');
const context = {document:{addEventListener(){}},canManageSalesOrders:()=>true};
vm.runInNewContext(source,context);
for(const status of ['submitted','accepted','shipping_ready']) assert(context.salesOrderCanRevise({status}));
for(const status of ['shipped','completed','cancelled']) assert(!context.salesOrderCanRevise({status}));
assert(!context.salesOrderCanRevise({status:'accepted',completed_at:'2026-09-01'}));
context.canManageSalesOrders=()=>false;
assert(!context.salesOrderCanRevise({status:'accepted'}));
for(const text of ['target_expected_version:state.order.version','target_order_id:state.order.id','salesOrderRevisionSaving','revise_sales_order','data-revision-quantity','data-revision-price','data-revision-core-handling','core_return_handling','fetchProductVariantsByDkdId','coreReturnPolicyForKind','customer_order_core_handling','customer_order_core_return_standard','customer_order_core_charge_no_return_label','customer_order_core_charge_no_return_status','customer_order_core_charge_unset','customer_order_core_charge_setup','customer_order_core_charge_note','customer_order_unit_price','customer_order_subtotal','vehicle_name','vehicle_model_code','first_registration_month','chassis_number','engine_model','model_designation_number','classification_number','sales_customer_id','shipping_address','outbound_shipping_method','core_return_shipping_method','requested_delivery_date','delivery_time_code','customer_note','adjustments','shipping_fee_jpy','state !== salesOrderRevision']) assert(source.includes(text),text);
assert(!source.includes('sales-order-revision-confirm'));
assert(!source.includes('sales-order-revision-review'));
assert(!source.includes('salesOrderRevisionValue("reason")'));
assert(source.includes('target_reason:"受注修正画面から変更"'));
assert(app.includes('salesOrderRevisionHistoryHtml(order.revision_history)'));
assert(app.includes('revisionButton.addEventListener("click", openSalesOrderRevisionEditor)'));
assert(app.includes("id='sales-order-revision-open'>受注修正</button>"));
assert(!app.includes("id='sales-order-pricing-open'"));
assert(!app.includes('pricingOpenButton.addEventListener'));
assert.equal(Object.keys(context.SALES_ORDER_REVISION_ENTRY_FIELDS).length,21);
assert.equal(context.SALES_ORDER_REVISION_ENTRY_FIELDS["customer-order-destination-type"],"destination_type");
assert.equal(context.SALES_ORDER_REVISION_ENTRY_FIELDS["customer-order-yamato-office-code"],"yamato_office_code");
for(const id of Object.keys(context.SALES_ORDER_REVISION_ENTRY_FIELDS)) assert(fs.readFileSync('index.html','utf8').includes('id="'+id+'"'),id);
assert(source.includes('document.querySelector(selector).cloneNode(true)'));
assert(source.includes('customerOrderDeliveryServiceFromKey(salesOrderRevisionValue(key))'));
assert(source.includes('lookupCustomerOrderPostalApi(code)'));
assert(source.includes('lookupCustomerOrderPostalLocal(code)'));
assert(source.includes('seq !== state.postalSeq'));
assert(!source.includes('customerOrderDeliveryEstimate('));
assert(source.includes('async function configureSalesOrderRevisionDelivery(changed)'));
assert(source.includes('sb.rpc("get_customer_order_delivery_quote"'));
assert(source.includes('target_shipping_date: order.scheduled_shipping_date || null'));
assert(source.includes('requestSeq !== state.deliveryQuoteSeq'));
assert(source.includes('quote.requested_date_supported !== true'));
assert(source.includes('quote.allowed_time_codes'));
assert(source.includes('document.getElementById("revision-entry-shipping-date")'));
assert(fs.readFileSync('scripts/build-static-site.js','utf8').includes('"sales-order-revision.js"'));
assert(fs.readFileSync('index.html','utf8').includes('src="sales-order-revision.js?v='));
context.esc=String;
context.customerOrderCurrency=(value)=>'¥'+Number(value).toLocaleString('ja-JP');
const revisionLabels={core_return_required:'コア返却必要',customer_order_core_handling:'交換コアの対応',customer_order_core_return_standard:'後日、交換したコアを返却する',customer_order_core_charge_no_return_label:'コア代金 {amount} 計上',customer_order_core_charge_no_return_status:'コア代金請求済み',customer_order_core_charge_unset:'返却不可時コア代金が未設定（選択不可）',customer_order_core_charge_setup:'商品マスタに返却不可時コア代金を設定してください。',customer_order_core_charge_note:'コアを返却できない受注として、商品マスタのコア代金を商品金額に計上します。返送用送り状は発行しません。'};
context.t=(key)=>revisionLabels[key] || key;
context.tf=(key,values)=>context.t(key).replace('{amount}',values.amount);
context.normalizeProductKind=String;
context.coreReturnPolicyForKind=(kind,rows)=>({kind,row:rows[0] || null,required:!!(rows[0] && rows[0].core_return_required),charge:rows[0] && rows[0].core_charge_jpy});
const exactPolicy=context.salesOrderRevisionCorePolicy({product_kind:'rebuilt',product_variant_id:22},[
  {product_variant_id:11,product_kind:'rebuilt',stock_qty:99,core_return_required:true,core_charge_jpy:3000},
  {product_variant_id:22,product_kind:'rebuilt',stock_qty:1,core_return_required:true,core_charge_jpy:5000}
]);
assert.equal(exactPolicy.row.product_variant_id,22);
const newLinePolicy=context.salesOrderRevisionCorePolicy({product_kind:'rebuilt'},[
  {product_variant_id:11,product_kind:'rebuilt',stock_qty:2,core_return_required:true,core_charge_jpy:3000},
  {product_variant_id:22,product_kind:'rebuilt',stock_qty:7,core_return_required:true,core_charge_jpy:5000}
]);
assert.equal(newLinePolicy.row.product_variant_id,22);
const coreRequired={product_core_return_required:true,core_return_required:true,core_return_handling:'standard',configured_core_charge_jpy:5000,revision_unit_price_jpy:7500};
assert.equal(context.salesOrderRevisionItemNeedsCoreReturn(coreRequired),true);
assert.equal(context.salesOrderRevisionEffectiveUnitPrice(coreRequired),7500);
assert(context.salesOrderRevisionCoreChoiceHtml(coreRequired,0).includes('コア代金 ¥5,000 計上'));
coreRequired.core_return_handling='charge_no_return';
assert.equal(context.salesOrderRevisionItemNeedsCoreReturn(coreRequired),false);
assert.equal(context.salesOrderRevisionEffectiveUnitPrice(coreRequired),12500);
assert(context.salesOrderRevisionCoreChoiceHtml(coreRequired,0).includes('コア代金請求済み'));
const noCharge={product_core_return_required:true,core_return_required:true,core_return_handling:'standard',configured_core_charge_jpy:null,revision_unit_price_jpy:7500};
assert(context.salesOrderRevisionCoreChoiceHtml(noCharge,1).includes('返却不可時コア代金が未設定（選択不可）'));
context.salesOrderDispatch=()=>null;
vm.runInNewContext(app.slice(app.indexOf('function shippingDocumentStageHtml('),app.indexOf('function shippingDocumentOrderB2HistoryHtml(')),context);
const changed={b2_exports:[{created_at:'2026-09-01T00:00:00Z'}],revision_history:[{created_at:'2026-09-02T00:00:00Z',waybills_need_reissue:true}]};
assert(context.shippingDocumentStageHtml(changed).includes('再発行が必要'));
changed.b2_exports.push({created_at:'2026-09-03T00:00:00Z'});
assert(!context.shippingDocumentStageHtml(changed).includes('再発行が必要'));

(async function verifyRevisionDeliveryQuoteRuntime() {
  const fields = {
    prefecture_code:{value:'27',selectedIndex:0,options:[{textContent:'大阪府'}],disabled:false},
    outbound_shipping_method:{value:'ヤマト運輸|宅急便',innerHTML:'',disabled:false},
    core_return_shipping_method:{value:'',innerHTML:'',disabled:false},
    requested_delivery_date:{value:'2026-09-11',disabled:false,min:'',max:'',removeAttribute(name){this[name]='';}},
    delivery_time_code:{value:'',disabled:false,options:[{value:'',disabled:false,hidden:false},{value:'0812',disabled:false,hidden:false}]},
    postal_code:{value:'5620035'},
    address_line_1:{value:'箕面市船場東'}
  };
  const elements = {
    'revision-entry-core-return-service-field':{hidden:false},
    'revision-entry-delivery-estimate':{textContent:'',className:'',removeAttribute(){}},
    'revision-entry-shipping-date':{value:''}
  };
  let rpcArgs;
  context.document = {
    addEventListener(){},
    querySelector(selector){
      const match = selector.match(/data-revision-field='([^']+)'/);
      return match ? fields[match[1]] || null : null;
    },
    getElementById(id){return elements[id] || null;}
  };
  context.customerOrderDeliveryServiceKey = (row) => row ? `${row.carrier_name}|${row.service_name}` : '';
  context.customerOrderDeliveryServiceFromKey = (value) => {
    const parts = String(value || '').split('|');
    return parts.length === 2 ? {carrier_name:parts[0],service_name:parts[1]} : null;
  };
  context.customerOrderDeliveryServiceSortValue = () => 0;
  context.customerOrderDeliveryServiceOptionsHtml = () => '<option></option>';
  context.customerOrderCoreReturnDeliveryServices = (rows) => rows;
  context.normalizeCustomerOrderPostalCode = (value) => String(value || '').replace(/\D/g,'');
  context.customerOrderDeliveryDateLabel = String;
  context.t = String;
  context.tf = (key) => key;
  context.console = {warn(){}};
  context.sb = {rpc:async (name,args) => {
    rpcArgs = {name,args};
    return {data:{available:true,shipping_date:'2026-09-09',earliest_delivery_date:'2026-09-10',max_requested_delivery_date:'2026-09-22',automatic_requested_delivery_date:'2026-09-10',requested_date_supported:true,allowed_time_codes:['','0812'],precision:'exact'}};
  }};
  context.salesOrderRevision = {
    order:{scheduled_shipping_date:'2026-09-09',outbound_shipping_method:{carrier_name:'ヤマト運輸',service_name:'宅急便'}},
    items:[{core_return_required:false}],
    rates:[{prefecture_code:'27',carrier_name:'ヤマト運輸',service_name:'宅急便',display_order:1}]
  };
  await context.configureSalesOrderRevisionDelivery(false);
  assert.equal(rpcArgs.name,'get_customer_order_delivery_quote');
  assert.equal(rpcArgs.args.target_postal_code,'5620035');
  assert.equal(rpcArgs.args.target_shipping_date,'2026-09-09');
  assert.equal(elements['revision-entry-shipping-date'].value,'2026-09-09');
  assert.equal(fields.requested_delivery_date.min,'2026-09-10');
  assert.equal(fields.requested_delivery_date.max,'2026-09-22');
  assert.equal(elements['revision-entry-delivery-estimate'].className,'customer-order-delivery-estimate ready');
  console.log('Order revision status, payload, optimistic-lock, UI wiring and deployment contracts passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
