const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const source = fs.readFileSync(path.join(__dirname, '../recycle-orders.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const build = fs.readFileSync(path.join(__dirname, 'build-static-site.js'), 'utf8');
const { document, window: domWindow } = parseHTML('<html><body><button id="sales-order-new-internal-order" hidden></button><button id="sales-order-recycle-open" hidden></button><div id="detail"><div class="sales-order-detail-navigation"></div></div></body></html>');
const create = document.createElement.bind(document);
document.createElement = tag => {
  const element = create(tag);
  if (tag === 'dialog') {
    element.showModal = () => { element.open = true; };
    element.close = () => { element.open = false; };
  }
  return element;
};
const west = {carrier_name:'ヤマト運輸',service_name:'宅急便'};
const timed = {carrier_name:'ヤマト運輸',service_name:'宅急便タイムサービス'};
const coreCarrier = {carrier_name:'佐川急便',service_name:'飛脚宅配便'};
const key = service => encodeURIComponent(service.carrier_name) + '|' + encodeURIComponent(service.service_name);
const defaults = {default_outbound_carrier_name:'ヤマト運輸',default_outbound_service_name:'宅急便',default_core_return_carrier_name:'佐川急便',default_core_return_service_name:'飛脚宅配便'};
const products = [{dkd_shohin_id:123,genuine_part_number:'PART-12345',manufacturer_part_number:'M-12345',manufacturer:'合成',product_kind:'rebuilt',available_qty:3,core_return_required:true,core_charge_jpy:null}];
const savedCust = {id:1,code:'5855',name:'ブロードリーフ Recycle＋',billing_customer_code:'5855',closing_code:'31'};
const nextCust = {id:2,code:'5856',name:'ブロードリーフ新集約先',billing_customer_code:'5856',closing_code:'20'};
const customerRows = [{id:1,source_customer_code:'5855',customer_name:savedCust.name},{id:9,source_customer_code:'9001',customer_name:'合成得意先'}];
const yamatoOffice = {code:'068721',name:'合成営業所',postal_code:'562-0035',prefecture_code:'27',address_line_1:'合成営業所所在地'};
let recycleAllowed=true, regularAllowed=true, confirmed=true, confirmText='', configuredId=1, configAdmin=true, externalVersion=1;
let settingsError=false, shippingError=false, productError=false, nextQuoteError=false, networkError=false, negativePlaceResult=false;
let pendingRead=null, found=false, orderOpened=null, settingsCalls=0, readOrderList=0, validBinding=true;
let delayedProducts=null, delayedSettings=null, delayPostal=null;
const calls=[], previews=[], writes=[];
const ctx = {
  document, console, crypto:require('node:crypto').webcrypto, Date, Number, Array, Object,
  currentUser:{id:'fixture-actor'}, currentLang:'ja', CUSTOMER_CATALOG_SHORT_QUERY_MAX:5, CUSTOMER_ORDER_YAMATO_OFFICES:[yamatoOffice],
  canManageSalesOrders:()=>recycleAllowed, canStartInternalCustomerOrderEntry:()=>regularAllowed,
  loadDetailSalesCustomerOptions:async()=>customerRows, defaultCustomerDisplaySettings:()=>defaults,
  ensureCustomerAccessShippingServices:async()=>{}, customerAccessShippingServices:[west,timed],
  customerOrderCoreReturnDeliveryServices:()=>[west,timed,coreCarrier],
  customerOrderDeliveryServiceKey:key,
  customerOrderDeliveryServiceFromKey: str => [west,timed,coreCarrier].find(service=>key(service)===str) || null,
  customerOrderBilledCoreChargePerUnit: line=>line.core_charge_jpy || 0,
  customerOrderDestinationError:(addr,service)=>addr.destination_type==='yamato_office' && (!/^\d{6}$/.test(addr.yamato_office_code) || !addr.yamato_office_name || service.carrier_name!=='ヤマト運輸')?'営業所情報を確認してください。':'',
  customerOrderYamatoOffice: code => code===yamatoOffice.code ? yamatoOffice : null,
  normalizeCustomerOrderPostalCode: code=>code.replace(/[^0-9]/g,''),
  normalizePartQuery:q=>q.replace(/[^0-9a-z]/gi,''),
  fetchCoreProductMasterMatches:async()=>({data:products}), fetchCategoryProducts:async()=>({data:products}),
  normalizeCoreProductFastRows:rows=>rows, hydrateSalesDaikoVisibility:async()=>{}, filterSalesVisibleProducts:rows=>rows,
  productSearchCardDkdIds:rows=>rows.map(p=>p.dkd_shohin_id), productDkdId:p=>p.dkd_shohin_id,
  fetchCustomerOrderStockAvailabilityMap:async()=>({map:{123:{rebuilt:{total_available_qty:3}}}}),
  coreReturnPolicyForKind:kind=>({required:kind==='rebuilt',charge:products[0].core_charge_jpy}),
  SHIPPING_PREFECTURES:[[13,'東京都'],[27,'大阪府']],
  confirm:text=>{confirmText=text;return confirmed;},
  lookupCustomerOrderPostalLocal:async()=>delayPostal || [{postal_code:'100-0001',prefecture_code:'13',address_line_1:'千代田区千代田',display_address:'東京都千代田区千代田'}],
  enterSalesOrderMgmt:async()=>{readOrderList++;},loadSalesOrderDetail:async(id)=>{orderOpened=id;},
  sb:{
    from(table) {
      return {select(){return this;},eq(column,id){if(column==='sales_customer_id')this.id=id;return this;},in(){return this;},
        async order(){return {data:table==='assy_categories'?[{category_code:'starter',label_ja:'スターター'}]:products};},
        async maybeSingle(){assert.equal(table,'customer_display_settings');return shippingError?{error:{message:'offline'}}:{data:{...defaults,default_outbound_service_name:this.id==='1'?timed.service_name:west.service_name}};}};
    },
    async rpc(name, wire) {
      if (name==='get_customer_order_delivery_quote') return {data:{available:true,shipping_date:'2026-12-01',earliest_delivery_date:'2026-12-02',max_requested_delivery_date:'2026-12-06'}};
      if (name==='search_customer_catalog_products_by_prefix_fast') return {data:products};
      const channel = name==='recycle_workspace'?'recycle':'standard';
      const action = channel==='recycle'?wire.target_action:name.startsWith('preview')?'preview':'place';
      const args = channel==='recycle' ? wire.target_payload : wire;
      calls.push({channel,action,args});
      if (action==='settings') {
        const hold=delayedSettings;delayedSettings=null;
        if(hold)return hold;
        if(settingsError)throw Error('設定読込失敗');
        const row=[savedCust,nextCust].find(customer=>customer.id===configuredId);
        return {data:{revision:1,sales_customer_id:row?.id,customer_name:row?.name,customer_code:row?.code,customer_candidates:[savedCust,nextCust],can_configure:configAdmin,customer_binding_guard_version:1,external_settlement_version:externalVersion}};
      }
      if (action==='products') {
        if(delayedProducts) return delayedProducts;
        if(productError) throw Error('商品読込失敗');
        return {data:{rows:args.karte_number==='00000-000000000023'?[]:products}};
      }
      if (action==='preview') {
        previews.push({channel,args});
        if(nextQuoteError)return {error:{message:'在庫不足',code:'22023'}};
        const items=(channel==='recycle'?args.items:args.target_items).map(item=>{
          const charge=item.manual_core_charge_jpy||0;
          return {...item,core_charge_jpy:charge,unit_price_jpy:(item.unit_price_jpy??item.product_unit_price_jpy??12500)+charge};
        });
        return {data:{valid:true,items,total_jpy:23100,preview_token:'synthetic-preview',core_charge_total_jpy:items.reduce((sum,i)=>sum+i.core_charge_jpy*i.quantity,0),recycle_policy:channel==='recycle'?{settlement_mode:'external'}:undefined}};
      }
      if (action==='place') {
        writes.push({channel,args});
        if(networkError)throw Error('応答不明');
        if(negativePlaceResult)return {error:{code:'22023',message:'内容を確認してください。'}};
        return {data:{id:channel==='recycle'?7:8}};
      }
      if(action==='result') {
        pendingRead=args.request_id;
        return {data:{found,response:{id:7}}};
      }
      if(action==='binding_preview') {
        if(!validBinding)throw Error('受注確認失敗');
        return {data:{token:'bound-fixture',previous_customer:savedCust,next_customer:nextCust,affected_order_count:2,warnings:[{customer_code:'5855',customer_name:'<img src=x>',closing_date:'2026-10-31',order_count:2}]}};
      }
      if(action==='save_settings'){
        settingsCalls++;
        configuredId=Number(args.sales_customer_id);
        return {data:{saved:true}};
      }
      throw Error('Unexpected fixture RPC '+name+' '+action);
    }
  }
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(source,ctx);
(async()=>{
  let checks=0;
  const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
  const el=id=>document.getElementById('recycle-'+id);
  const dialog=()=>document.querySelector('.recycle-dialog');
  const nav=document.getElementById('sales-order-recycle-open');
  const action=(name)=>document.querySelector('[data-recycle-action="'+name+'"]');
  const selects=()=>document.querySelectorAll('select').forEach(node=>{
    if(Object.hasOwn(node,'value'))return;
    let selected=node.querySelector('option[selected]')?.value || node.querySelector('option')?.value || '';
    Object.defineProperty(node,'value',{get:()=>selected,set:v=>{selected=v;}});
    Object.defineProperty(node,'selectedOptions',{get:()=>[...node.options].filter(o=>o.value===selected).map(o=>({text:o.textContent}))});
  });
  const tick=async()=>{await new Promise(r=>setTimeout(r,8));selects();};
  const emit=(node,type)=>node.dispatchEvent(new domWindow.Event(type,{bubbles:true}));
  const click=async name=>{assert(action(name),'Missing action '+name);emit(action(name),'click');await tick();};
  const input=(id,value)=>{el(id).value=value;emit(el(id),'input');};
  const select=async(id,value)=>{el(id).value=value;emit(el(id),'change');await tick();};
  const selectCustomer=async query=>{input('order-customer',query);await click('select_customer');};
  const keypress=async(id,key)=>{const event=new domWindow.Event('keydown',{bubbles:true,cancelable:true});Object.defineProperty(event,'key',{value:key});el(id).dispatchEvent(event);await tick();};
  const bundle=()=>{el('packed-together').checked=true;emit(el('packed-together'),'input');};
  const fillAddress=async()=>{
    input('company','合成会社');input('phone','0312345678');input('postal','1000001');
    await select('prefecture','13');input('address1','合成住所');
  };
  const add=async query=>{input('product-query',query);await click('products');await click('add');};
  const open=async()=>{await ctx.DcatsRecycleOrders.open();await tick();};

  eq(html.indexOf('src="recycle-orders.js')<html.indexOf('src="app.js'),true);
  eq(app.includes('DcatsRecycleOrders.configureEntryButton()'),true);
  eq(app.includes('DcatsRecycleOrders.mountDetail(order, host)'),true);
  eq(build.includes('recycle-orders.js'),true);
  ctx.DcatsRecycleOrders.configureEntryButton();
  eq(nav.hidden,false);eq(nav.textContent,'社内受注入力');eq(document.getElementById('sales-order-new-internal-order').hidden,true);
  await nav.onclick();await tick();const shared=dialog();
  eq(el('title').textContent,'社内受注入力');eq(el('entry-channel').value,'standard');
  eq(el('entry-fields').disabled,true);eq(el('order-customer').getAttribute('role'),'combobox');
  input('order-customer','不存在');eq(el('customer-options').textContent.includes('該当する得意先がありません'),true);
  eq(el('entry-fields').disabled,true);await keypress('order-customer','Escape');eq(el('order-customer').value,'');
  input('order-customer','ブロードリーフ');eq(el('customer-options').querySelectorAll('[role=option]').length,0);
  input('order-customer','合成');eq(el('customer-options').querySelectorAll('[role=option]').length,1);
  eq(el('settings-open').hidden,true);eq(el('external'),null);eq(el('marketplace'),null);
  input('order-customer','９００１');eq(el('order-customer').getAttribute('aria-expanded'),'true');await keypress('order-customer','Enter');
  eq(el('order-customer').value,'9001 ／ 合成得意先');
  eq(dialog(),shared);eq(el('entry-fields').disabled,false);eq(el('carrier').value,key(west));eq(el('return-carrier').value,key(coreCarrier));
  input('product-query','12');await click('products');eq(el('product-status').textContent.includes('商品分類'),true);
  await add('PART-12345');eq(el('price-0').value,'');eq(el('core-0').options[2].hasAttribute('disabled'),true);
  eq(el('manual-core-field').hidden,true);
  await fillAddress();
  input('vehicle-model','ｑａ');input('vehicle-chassis','ｃａｒ-００１');input('karte-number','ＲＢＳＮ-４２');
  eq(el('packing-field').hidden,true);input('quantity-0','2');eq(el('packing-field').hidden,false);bundle();
  await select('destination','068721');eq(el('prefecture').value,'27');
  eq(el('address1').value,yamatoOffice.address_line_1);
  confirmed=false;await click('place');
  let pp=previews.at(-1);
  eq(pp.channel,'standard');eq(pp.args.target_sales_customer_id,'9');
  eq(pp.args.target_items[0].product_unit_price_jpy,undefined);
  eq(pp.args.target_shipping_address.yamato_office_code,'068721');
  eq(pp.args.target_shipping_address.vehicle_information.vehicle_model_code,'QA');
  eq(pp.args.target_shipping_address.vehicle_information.chassis_number,'CAR-001');
  eq(pp.args.target_shipping_address.staff_intake.karte_number,'RBSN-42');eq(pp.args.target_shipping_address.staff_intake.packed_together,true);
  eq(pp.args.target_items[0].quantity,2);
  eq(confirmText.includes('発送用送り状1枚'),true);
  eq(pp.args.target_core_return_shipping_method.service_name,coreCarrier.service_name);
  eq(writes.length,0);eq(confirmText.includes('23,100円'),true);eq(confirmText.includes('手数料'),false);
  await select('entry-channel','recycle');
  eq(el('entry-channel').value,'standard');eq(el('quantity-0').value,'2');
  input('order-customer','存在しない');await keypress('order-customer','Escape');eq(el('order-customer').value,'9001 ／ 合成得意先');
  input('price-0','14000');confirmed=true;await click('place');
  eq(writes.length,1);eq(writes[0].channel,'standard');eq(writes[0].args.target_items[0].product_unit_price_jpy,14000);
  eq(writes[0].args.target_preview_token,'synthetic-preview');eq(typeof writes[0].args.target_idempotency_key,'string');
  eq(orderOpened,8);eq(dialog().open,false);

  await open();await select('entry-channel','recycle');
  eq(dialog(),shared);eq(el('title').textContent,'社内受注入力');eq(el('order-customer'),null);
  eq(el('carrier').value,key(timed));eq(el('return-carrier').value,key(coreCarrier));eq(el('marketplace'),null);
  input('product-query','invalid');await click('products');eq(el('product-status').textContent.includes('形式'),true);
  input('product-query','23');await click('products');eq(el('product-status').textContent.includes('見つかりません'),true);
  productError=true;input('product-query','22');await click('products');eq(el('product-status').textContent,'商品読込失敗');productError=false;
  ctx.DcatsFactoringPricing={prices:async()=>({'123|rebuilt':10000})};
  await add('２２');
  eq(el('price-0').value,'10000');eq(el('cart').textContent.includes('00000-000000000022'),true);
  const search=calls.filter(c=>c.action==='products').at(-1);
  eq(search.args.karte_number,'00000-000000000022');
  await fillAddress();
  let resolvePostal;delayPostal=new Promise(r=>{resolvePostal=r;});await click('postal');
  input('address1','本人が入力した住所');resolvePostal([{postal_code:'100-0001',prefecture_code:'13',address_line_1:'上書き禁止'}]);await tick();delayPostal=null;
  eq(el('address1').value,'本人が入力した住所');
  await select('core-0','charge_no_return');eq(el('return-field').hidden,true);eq(el('manual-core-field').hidden,false);
  const failedPreviewCount=previews.length;
  await click('place');eq(previews.length,failedPreviewCount);eq(el('message').textContent.includes('コア代金'),true);
  input('manual-core-0','0');await click('place');eq(previews.length,failedPreviewCount);
  input('manual-core-0','4500');input('quantity-0','2');
  bundle();await click('place');eq(el('message').textContent.includes('発注元'),true);
  input('buyer','合成発注者');input('karte-number','RC-19');input('vehicle-model','ａｂｃ');
  confirmed=false;await click('place');pp=previews.at(-1);
  eq(pp.args.shipping_address.staff_intake.karte_number,'RC-19');eq(pp.args.shipping_address.staff_intake.packed_together,true);
  eq(pp.args.shipping_address.vehicle_information.vehicle_model_code,'ABC');eq(confirmText.includes('同梱セット 2点'),true);
  eq(pp.args.settlement_mode,'external');eq(pp.args.is_marketplace,undefined);eq(pp.args.external_order_number,null);
  eq(pp.args.items[0].manual_core_charge_jpy,4500);eq(pp.args.items[0].karte_number,'00000-000000000022');
  eq(pp.args.core_return_shipping_method,null);eq(confirmText.includes('9,000円'),true);
  eq(confirmText.includes('手数料'),false);eq(confirmText.includes('決済'),false);
  await select('core-0','charge_with_return');eq(el('return-field').hidden,false);
  await click('place');eq(previews.at(-1).args.core_return_shipping_method.service_name,coreCarrier.service_name);
  await select('core-0','standard');await click('place');eq(previews.at(-1).args.items[0].manual_core_charge_jpy,undefined);
  await select('core-0','charge_no_return');
  nextQuoteError=true;await click('place');eq(el('message').textContent,'在庫不足');nextQuoteError=false;
  confirmed=true;networkError=true;await click('place');eq(writes.length,2);
  await click('place');eq(writes.length,2);
  await click('result');eq(typeof pendingRead,'string');eq(el('message').textContent.includes('再送せず'),true);
  found=true;await click('result');eq(dialog().open,false);eq(orderOpened,7);networkError=false;

  await open();await select('entry-channel','recycle');await click('settings');
  eq(el('title').textContent,'Recycle+集約先設定');eq(el('settings-view').textContent.includes('手数料'),false);
  await select('customer-id','2');
  validBinding=false;await click('save_settings');eq(el('message').textContent,'受注確認失敗');validBinding=true;
  await click('save_settings');
  eq(el('binding-confirm').hidden,false);eq(el('binding-confirm').textContent.includes('2 件'),true);
  eq(el('binding-confirm').querySelector('img'),null);eq(settingsCalls,0);
  el('binding-ack').checked=true;emit(el('binding-ack'),'change');await click('binding_confirm');eq(settingsCalls,1);
  const saved=calls.filter(x=>x.action==='save_settings').at(-1).args;
  eq(Object.keys(saved).sort(),['binding_confirmation','binding_confirmed','revision','sales_customer_id']);eq(saved.sales_customer_id,'2');
  await click('entry');eq(el('customer-summary').textContent.includes(nextCust.name),true);await click('close');

  const detail=document.getElementById('detail');
  detail.innerHTML='<div class="sales-order-detail-navigation"></div><button id="sales-order-issue-dispatch">出荷指示</button><button data-sales-order-action="prepare_shipping">準備</button>';
  ctx.DcatsRecycleOrders.mountDetail({id:7,recycle:{payment_status:'unconfirmed',external_order_number:'<img src=x>',karte_items:[{karte_number:'00000-000000000022'}]}},detail);
  eq(detail.querySelector('img'),null);eq(detail.querySelector('.recycle-detail').textContent.includes('00000-000000000022'),true);
  eq(detail.querySelector('#sales-order-issue-dispatch').disabled,false);eq(detail.querySelector('[data-sales-order-action]').disabled,false);
  eq(detail.textContent.includes('手数料'),false);eq(detail.textContent.includes('決済'),false);
  ctx.DcatsRecycleOrders.mountDetail({id:8,staff_intake:{karte_number:'<img src=x>',packed_together:true}},detail);
  eq(detail.querySelector('img'),null);eq(detail.textContent.includes('カルテNo. <img src=x>'),true);
  eq(detail.textContent.includes('同梱セット（1箱・発送用送り状1枚）'),true);

  configAdmin=false;await open();await select('entry-channel','recycle');await click('settings');
  eq(action('save_settings'),null);await click('close');configAdmin=true;
  settingsError=true;await open();await selectCustomer('合成');eq(el('entry-fields').disabled,false);await select('entry-channel','recycle');
  eq(el('entry-fields').disabled,true);eq(el('setup-note').textContent.includes('開き直し'),true);await click('close');settingsError=false;
  externalVersion=0;await open();await select('entry-channel','recycle');eq(el('entry-fields').disabled,true);await click('close');externalVersion=1;
  regularAllowed=false;shippingError=true;await open();eq(el('entry-channel').value,'recycle');eq(el('shipping-retry').hidden,false);
  shippingError=false;await click('retry_shipping');eq(el('shipping-retry').hidden,true);await click('close');
  regularAllowed=true;
  const staleSettings={data:{revision:5,sales_customer_id:1,customer_name:savedCust.name,external_settlement_version:1}};
  let resolveSettings;
  delayedSettings=new Promise(r=>{resolveSettings=r;});
  const olderOpen=ctx.DcatsRecycleOrders.open();
  await click('close');await open();
  resolveSettings(staleSettings);await olderOpen;await tick();
  await select('entry-channel','recycle');eq(el('customer-summary').textContent.includes(nextCust.name),true);await click('close');

  let resolveProducts;
  delayedProducts=new Promise(r=>{resolveProducts=r;});
  await open();await select('entry-channel','recycle');input('product-query','22');await click('products');await select('entry-channel','standard');
  resolveProducts({data:{rows:products}});await tick();delayedProducts=null;
  eq(el('entry-channel').value,'standard');eq(el('products').textContent,'');await click('close');

  regularAllowed=true;recycleAllowed=false;await open();eq(el('entry-channel').value,'standard');eq(el('entry-channel').options.length,1);
  await selectCustomer('合成');await add('PART-12345');await fillAddress();
  negativePlaceResult=true;await click('place');eq(el('check-result').hidden,true);eq(el('message').textContent,'内容を確認してください。');negativePlaceResult=false;
  networkError=true;
  const beforeUncertain=writes.length;await click('place');eq(writes.length,beforeUncertain+1);
  await click('place');eq(writes.length,beforeUncertain+1);eq(el('check-result').textContent,'受注一覧へ');
  await click('result');eq(dialog().open,false);eq(readOrderList,3);networkError=false;
  regularAllowed=false;ctx.DcatsRecycleOrders.configureEntryButton();eq(nav.hidden,true);await open();eq(dialog().open,false);

  console.log(JSON.stringify({feature:'unified-internal-order',checks,passed:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
