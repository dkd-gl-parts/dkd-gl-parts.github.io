const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const source = fs.readFileSync(path.join(__dirname, '../recycle-orders.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const build = fs.readFileSync(path.join(__dirname, 'build-static-site.js'), 'utf8');
const { document, window: domWindow } = parseHTML('<html><body><button id="sales-order-recycle-open" hidden></button><div id="detail"><div class="sales-order-detail-navigation"></div></div></body></html>');
const create = document.createElement.bind(document);
document.createElement = function(tag) { const node=create(tag);if(tag==='dialog'){node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;};}return node;};
let permission=true, calls=0, listCalls=0, settingsCalls=0, configured=true, configurable=true, previewPayload=null, placeCalls=0, resultFound=false, failPlace=false, failSettings=false, failProducts=false, failList=false, failPostal=false, postalLocal=[], postalDeferred=null, detailId=null, allowConfirm=true;
const product={dkd_shohin_id:123,genuine_part_number:'QA-123',manufacturer_part_number:'QA-M123',manufacturer:'合成',product_kind:'rebuilt',available_qty:3,core_return_required:true,core_charge_jpy:5000};
const ctx = { document, console, Date, Number, String, Object, Array, Blob, URL, crypto:require('node:crypto').webcrypto,setTimeout, currentUser:{id:'synthetic'},currentLang:'ja',salesOrderSelectedId:1,
 canManageSalesOrders:()=>permission,SHIPPING_PREFECTURES:[[13,'東京都']],confirm:()=>allowConfirm,
 lookupCustomerOrderPostalLocal:async()=>postalDeferred ? await postalDeferred : postalLocal,
 lookupCustomerOrderPostalApi:async()=>{if(failPostal)throw new Error('offline');return [{postal_code:'100-0001',prefecture_code:'13',address_line_1:'千代田区千代田',display_address:'東京都千代田区千代田'}];},
 sb:{rpc:async(name,args)=>{assert.equal(name,'recycle_workspace');calls++;
  if(args.target_action==='settings'){if(failSettings)throw new Error('設定読込失敗');return {data:{sales_customer_id:configured?1:null,fee_rate_percent:10,provisional:true,fee_basis:'product_net',rounding:'floor',revision:1,can_configure:configurable,note:'合成暫定条件',customer_name:'ブロードリーフ'}};}
  if(args.target_action==='list'){listCalls++;if(failList)throw new Error('一覧読込失敗');return {data:{count:0,rows:[],gross_jpy:0,estimated_fee_jpy:0,actual_fee_jpy:null,unconfirmed_fee_count:0}};}
  if(args.target_action==='products'){if(failProducts)throw new Error('商品読込失敗');return {data:{rows:[product]}};}
  if(args.target_action==='preview'){previewPayload=args.target_payload;return {data:{subtotal_jpy:20000,shipping_fee_jpy:1000,tax_jpy:2100,total_jpy:23100,preview_token:'synthetic-preview'}};}
  if(args.target_action==='place'){placeCalls++;if(failPlace)throw new Error('応答不明');return {data:{id:7}};}
  if(args.target_action==='result')return {data:{found:resultFound,response:{id:7}}};
  if(args.target_action==='save_settings'){settingsCalls++;return {data:{}};}
  if(args.target_action==='create_customer'){configured=true;return {data:{}};}
  throw new Error('Unexpected fixture RPC: '+args.target_action);}},
 loadSalesOrderDetail:async(id)=>{detailId=id;},enterSalesOrderMgmt:async()=>{} };
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
 const selects=()=>document.querySelectorAll('select').forEach(el=>{if(Object.hasOwn(el,'value'))return;let selected=el.querySelector('option[selected]')?.value||el.querySelector('option')?.value||'';Object.defineProperty(el,'value',{configurable:true,get:()=>selected,set:value=>{selected=value;}});Object.defineProperty(el,'selectedOptions',{configurable:true,get:()=>[...el.querySelectorAll('option')].filter(o=>o.value===selected).map(o=>({text:o.textContent}))});});
 const tick=async()=>{await new Promise(r=>setTimeout(r,5));selects();};
 const click=async(action)=>{const b=[...document.querySelectorAll('[data-recycle-action]')].find(b=>b.dataset.recycleAction===action);assert(b,'Missing action '+action);b.dispatchEvent(new domWindow.Event('click',{bubbles:true}));await tick();};
 const value=(id,text)=>{const el=document.getElementById('recycle-'+id);el.value=text;el.dispatchEvent(new domWindow.Event('input',{bubbles:true}));};
 eq(html.indexOf('src="recycle-orders.js')<html.indexOf('src="app.js'),true);
 for(const bad of ['=HYPERLINK("https://example.invalid")','+1','@SUM(1)','-1','\t=1'])eq(ctx.DcatsRecycleOrders.csvCell(bad).startsWith('"\''),true);
 eq(ctx.DcatsRecycleOrders.csvCell('正常"文字'),'"正常""文字"');
 ctx.DcatsRecycleOrders.configureEntryButton();eq(document.getElementById('sales-order-recycle-open').hidden,false);
 await ctx.DcatsRecycleOrders.open();await tick();
 eq(document.getElementById('recycle-title').textContent,'Recycle+受注入力');
 eq(document.querySelectorAll('#recycle-entry').length,1);
 eq(document.getElementById('recycle-entry').tagName,'SECTION');
 eq(document.getElementById('recycle-entry').hidden,false);
 eq(document.getElementById('recycle-settings-view').hidden,true);
 eq(document.getElementById('recycle-settlements-view').hidden,true);
 eq(document.querySelector('#recycle-customer-summary strong').textContent,'ブロードリーフ');
 eq(document.querySelector('#recycle-entry #recycle-customer-id'),null);
 eq(listCalls,0);
 eq(document.getElementById('recycle-rate').value,'10');
 value('external','QA-ORDER-1');
 value('company','合成直送先');
 await click('settings');eq(document.getElementById('recycle-entry').hidden,true);
 eq(document.getElementById('recycle-title').textContent,'Recycle+設定');
 await click('save_settings');eq(settingsCalls,0);
 eq(document.getElementById('recycle-message').textContent.includes('受注の入力中'),true);
 await click('entry');eq(document.getElementById('recycle-external').value,'QA-ORDER-1');
 await click('settlements');eq(listCalls,1);
 eq(document.getElementById('recycle-title').textContent,'Recycle+精算一覧');
 eq(document.getElementById('recycle-totals').textContent.includes('0件'),true);
 await click('entry');eq(document.getElementById('recycle-company').value,'合成直送先');
 failProducts=true;await click('products');eq(document.getElementById('recycle-message').textContent,'商品読込失敗');failProducts=false;
 await click('products');await click('add');value('price-0','10000');value('quantity-0','2');
 await click('settings');await click('entry');eq(document.getElementById('recycle-price-0').value,'10000');eq(document.getElementById('recycle-quantity-0').value,'2');
 eq(document.getElementById('recycle-return-field').hidden,false);
 value('postal','123');await click('postal');eq(document.getElementById('recycle-postal-status').textContent.includes('7桁'),true);
 value('postal','1000001');await click('postal');eq(document.getElementById('recycle-address1').value,'千代田区千代田');
 eq(document.getElementById('recycle-prefecture').value,'13');
 let resolvePostal;postalDeferred=new Promise(r=>{resolvePostal=r;});await click('postal');value('address1','本人が編集中の住所');resolvePostal([{postal_code:'100-0001',prefecture_code:'13',address_line_1:'上書きしない'}]);await tick();eq(document.getElementById('recycle-address1').value,'本人が編集中の住所');postalDeferred=null;
 failPostal=true;await click('postal');eq(document.getElementById('recycle-postal-status').textContent.includes('取得できません'),true);failPostal=false;
 value('phone','0312345678');value('shipping','1000');value('delivery-date','2026-11-01');value('delivery-time','1416');value('return-carrier','佐川急便|飛脚宅配便');
 failPlace=true;await click('place');eq(placeCalls,1);
 eq(previewPayload.external_order_number,'QA-ORDER-1');eq(previewPayload.items[0].unit_price_jpy,10000);eq(previewPayload.items[0].quantity,2);
 eq(previewPayload.requested_delivery_date,'2026-11-01');eq(previewPayload.delivery_time,'1416');eq(previewPayload.core_return_shipping_method.carrier_name,'佐川急便');
 eq(previewPayload.sales_customer_id,undefined);
 await click('place');eq(placeCalls,1);await click('settings');eq(document.getElementById('recycle-entry').hidden,false);
 await click('result');eq(placeCalls,1);eq(document.getElementById('recycle-message').textContent.includes('再送せず'),true);
 resultFound=true;await click('result');eq(detailId,7);eq(document.querySelector('.recycle-dialog').open,false);failPlace=false;
 const order={id:1,status:'accepted',total_jpy:11000,recycle:{external_order_number:'<img src=x onerror=alert(1)>',policy_snapshot:{fee_rate_percent:10,provisional:true,note:'合成'},estimated_fee_jpy:1000,estimated_receipt_jpy:10000,payment_status:'unconfirmed',accounting_note:'確認待ち'}};
 ctx.DcatsRecycleOrders.mountDetail(order,document.getElementById('detail'));
 eq(document.querySelector('#detail img'),null);
 eq(document.querySelector('#detail .recycle-detail').textContent.includes('<img'),true);
 document.querySelector('#detail input').dispatchEvent(new domWindow.Event('input',{bubbles:true}));
 eq(ctx.DcatsRecycleOrders.isBusy(),true);
 ctx.DcatsRecycleOrders.mountDetail({id:2},document.getElementById('detail'));
 eq(ctx.DcatsRecycleOrders.isBusy(),false);
 configured=false;await ctx.DcatsRecycleOrders.open();eq(document.getElementById('recycle-entry').hidden,false);eq(document.getElementById('recycle-entry-fields').disabled,true);
 await click('settings');await click('create_customer');eq(document.getElementById('recycle-entry-fields').disabled,false);await click('entry');
 await click('settings');await click('save_settings');eq(settingsCalls,1);await click('close');
 configurable=false;await ctx.DcatsRecycleOrders.open();await click('settings');eq(document.querySelector('#recycle-settings-view [data-recycle-action="save_settings"]'),null);eq(document.getElementById('recycle-settings-view').textContent.includes('システム管理者'),true);await click('close');configurable=true;
 failSettings=true;await ctx.DcatsRecycleOrders.open();eq(document.getElementById('recycle-message').textContent,'設定読込失敗');await click('close');failSettings=false;
 await ctx.DcatsRecycleOrders.open();failList=true;await click('settlements');eq(document.getElementById('recycle-message').textContent,'一覧読込失敗');await click('entry');eq(document.getElementById('recycle-entry').hidden,false);failList=false;await click('close');
 const before=calls;permission=false;await ctx.DcatsRecycleOrders.open();eq(calls,before);ctx.DcatsRecycleOrders.configureEntryButton();eq(document.getElementById('sales-order-recycle-open').hidden,true);
 const earlyDocument=parseHTML('<html><body><button id="sales-order-recycle-open" hidden></button></body></html>').document;
 const early={document:earlyDocument,console};early.window=early;vm.createContext(early);vm.runInContext(source,early);
 eq(early.DcatsRecycleOrders.isBusy(),false);
 early.canManageSalesOrders=()=>true;early.currentUser={id:'synthetic-late-auth'};early.DcatsRecycleOrders.configureEntryButton();
 eq(earlyDocument.getElementById('sales-order-recycle-open').hidden,false);
 for(const asset of ['recycle-orders.js','recycle-orders.css']) {assert(html.includes(asset));assert(build.includes('"'+asset+'"'));checks+=2;}
 assert(app.includes('DcatsRecycleOrders.mountDetail(order, host)'));assert(app.includes('DcatsRecycleOrders.isBusy()'));checks+=2;
 console.log(JSON.stringify({feature:'recycle-orders',checks,passed:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
