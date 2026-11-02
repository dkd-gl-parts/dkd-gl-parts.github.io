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
document.createElement = function(tag) { const node=create(tag);if(tag==='dialog'){node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;};}if(tag==='a')node.click=()=>{downloadName=node.download;};return node;};
let permission=true, calls=0, listCalls=0, settingsCalls=0, configured=true, configurable=true, previewPayload=null, placeCalls=0, resultFound=false, failPlace=false, failSettings=false, failProducts=false, failList=false, failPostal=false, postalLocal=[], postalDeferred=null, detailId=null, allowConfirm=true;
let configuredId=1, bindingPreviewCalls=0, bindingWarningCount=0, bindingGuard=1, lastSettings=null, failSave=false, failBinding=false;
let feeGuard=2,wrongQuote=false,confirmation='',listData=null,listDeferred=null,lastListQuery=null,csvBlob=null,downloadName='';
const feeConditions={policy_version:2,factoring_rate_percent:6,sales_fee_rate_percent:10,note:'決済は取引税抜額、MPは商品税込額から算定した見込。'};
let candidateRows=[{id:1,code:'5855',name:'ブロードリーフ Recycle＋',billing_customer_code:'5855',closing_code:'31'},{id:2,code:'5856',name:'株式会社ブロードリーフ',billing_customer_code:'5856',closing_code:'20'}];
const product={dkd_shohin_id:123,genuine_part_number:'QA-123',manufacturer_part_number:'QA-M123',manufacturer:'合成',product_kind:'rebuilt',available_qty:3,core_return_required:true,core_charge_jpy:5000};
const ctx = { document, console, Date, Number, String, Object, Array, Blob, URL:{createObjectURL:blob=>{csvBlob=blob;return 'blob:synthetic';},revokeObjectURL:()=>{}}, crypto:require('node:crypto').webcrypto,setTimeout, currentUser:{id:'synthetic'},currentLang:'ja',salesOrderSelectedId:1,
 canManageSalesOrders:()=>permission,SHIPPING_PREFECTURES:[[13,'東京都']],confirm:text=>{confirmation=text;return allowConfirm;},
 lookupCustomerOrderPostalLocal:async()=>postalDeferred ? await postalDeferred : postalLocal,
 lookupCustomerOrderPostalApi:async()=>{if(failPostal)throw new Error('offline');return [{postal_code:'100-0001',prefecture_code:'13',address_line_1:'千代田区千代田',display_address:'東京都千代田区千代田'}];},
 sb:{rpc:async(name,args)=>{assert.equal(name,'recycle_workspace');calls++;
  if(args.target_action==='settings'){if(failSettings)throw new Error('設定読込失敗');const c=candidateRows.find(c=>c.id===configuredId);return {data:{sales_customer_id:configured?configuredId:null,fee_rate_percent:10,provisional:true,fee_basis:'product_net',rounding:'floor',revision:1,can_configure:configurable,note:'合成暫定条件',customer_name:configured?c?.name:null,customer_code:configured?c?.code:null,customer_candidates:candidateRows,customer_binding_guard_version:bindingGuard,fee_policy_version:feeGuard,fee_conditions:feeConditions}};}
  if(args.target_action==='binding_preview'){bindingPreviewCalls++;if(failBinding)throw new Error('受注確認失敗');return {data:{token:'fixture-token-'+args.target_payload.sales_customer_id,changed:true,previous_customer:configured?candidateRows.find(c=>c.id===configuredId):null,next_customer:candidateRows.find(c=>String(c.id)===args.target_payload.sales_customer_id),affected_order_count:bindingWarningCount,warnings:bindingWarningCount?[{customer_code:'5855',customer_name:'ブロードリーフ <img src=x>',closing_date:'2026-10-31',order_count:bindingWarningCount,first_order_date:'2026-10-31',last_order_date:'2026-11-02'}]:[]}};}
  if(args.target_action==='list'){listCalls++;lastListQuery=args.target_payload;if(failList)throw new Error('一覧読込失敗');if(listDeferred)return await listDeferred;return {data:typeof listData==='function'?listData(args.target_payload):listData||{count:0,rows:[],gross_jpy:0,estimated_fee_jpy:0,estimated_factoring_fee_jpy:0,estimated_marketplace_fee_jpy:0,estimated_legacy_fee_jpy:0,actual_fee_jpy:null,unconfirmed_fee_count:0}};}
  if(args.target_action==='products'){if(failProducts)throw new Error('商品読込失敗');return {data:{rows:[product]}};}
  if(args.target_action==='preview'){previewPayload=args.target_payload;const mp=args.target_payload.is_marketplace;return {data:{subtotal_jpy:20000,shipping_fee_jpy:1000,tax_jpy:2100,total_jpy:23100,preview_token:'synthetic-preview',recycle_policy:{policy_version:2},fee_breakdown:{order_route:mp?'marketplace':'normal',is_marketplace:wrongQuote?!mp:mp,estimated_factoring_fee_jpy:1260,estimated_marketplace_fee_jpy:mp?2200:0,estimated_fee_jpy:mp?3460:1260}}};}
  if(args.target_action==='place'){placeCalls++;if(failPlace)throw new Error('応答不明');return {data:{id:7}};}
  if(args.target_action==='result')return {data:{found:resultFound,response:{id:7}}};
  if(args.target_action==='save_settings'){settingsCalls++;lastSettings=args.target_payload;configured=true;configuredId=Number(args.target_payload.sales_customer_id);if(failSave)throw new Error('保存結果不明');return {data:{}};}
  throw new Error('Unexpected fixture RPC: '+args.target_action);}},
 loadSalesOrderDetail:async(id)=>{detailId=id;},enterSalesOrderMgmt:async()=>{} };
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
 const selects=(doc=document)=>doc.querySelectorAll('select').forEach(el=>{if(Object.hasOwn(el,'value'))return;let selected=el.querySelector('option[selected]')?.value||el.querySelector('option')?.value||'';Object.defineProperty(el,'value',{configurable:true,get:()=>selected,set:value=>{selected=value;}});Object.defineProperty(el,'selectedOptions',{configurable:true,get:()=>[...el.querySelectorAll('option')].filter(o=>o.value===selected).map(o=>({text:o.textContent}))});});
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
 eq(document.querySelector('#recycle-customer-summary strong').textContent,'ブロードリーフ Recycle＋');
 eq(document.querySelector('#recycle-customer-summary small').textContent,'得意先コード 5855');
 eq(document.querySelector('#recycle-entry #recycle-customer-id'),null);
 eq(listCalls,0);
 eq(document.getElementById('recycle-rate'),null);eq(document.querySelector('.recycle-fee-rates').textContent.includes('6％'),true);
 eq(!!document.getElementById('recycle-marketplace').checked,false);eq(document.getElementById('recycle-route-summary').textContent.includes('MP手数料なし'),true);
 value('external','QA-ORDER-1');
 value('company','合成直送先');
 await click('settings');eq(document.getElementById('recycle-entry').hidden,true);
 eq(document.getElementById('recycle-setup-note').hidden,true);
 eq(document.getElementById('recycle-title').textContent,'Recycle+設定');
 await click('save_settings');eq(settingsCalls,0);
 eq(document.getElementById('recycle-message').textContent.includes('受注の入力中'),true);
 await click('entry');eq(document.getElementById('recycle-external').value,'QA-ORDER-1');
 await click('settlements');eq(listCalls,1);
 eq(document.getElementById('recycle-title').textContent,'Recycle+精算一覧');
 eq(document.getElementById('recycle-totals').textContent.includes('0件'),true);
 await click('entry');eq(document.getElementById('recycle-company').value,'合成直送先');
 failProducts=true;await click('products');eq(document.getElementById('recycle-message').textContent,'商品読込失敗');failProducts=false;
 ctx.DcatsFactoringPricing={prices:async()=>({'123|rebuilt':7100})};
 await click('products');eq(document.getElementById('recycle-products').textContent.includes('7,100'),true);await click('add');eq(document.getElementById('recycle-price-0').value,'7100');value('price-0','10000');value('quantity-0','2');
 ctx.DcatsFactoringPricing={prices:async()=>({'123|rebuilt':7200})};await click('products');eq(document.getElementById('recycle-price-0').value,'10000');
 await click('settings');await click('entry');eq(document.getElementById('recycle-price-0').value,'10000');eq(document.getElementById('recycle-quantity-0').value,'2');
 eq(document.getElementById('recycle-return-field').hidden,false);
 value('postal','123');await click('postal');eq(document.getElementById('recycle-postal-status').textContent.includes('7桁'),true);
 value('postal','1000001');await click('postal');eq(document.getElementById('recycle-address1').value,'千代田区千代田');
 eq(document.getElementById('recycle-prefecture').value,'13');
 let resolvePostal;postalDeferred=new Promise(r=>{resolvePostal=r;});await click('postal');value('address1','本人が編集中の住所');resolvePostal([{postal_code:'100-0001',prefecture_code:'13',address_line_1:'上書きしない'}]);await tick();eq(document.getElementById('recycle-address1').value,'本人が編集中の住所');postalDeferred=null;
 failPostal=true;await click('postal');eq(document.getElementById('recycle-postal-status').textContent.includes('取得できません'),true);failPostal=false;
 value('phone','0312345678');value('shipping','1000');value('delivery-date','2026-11-01');value('delivery-time','1416');value('return-carrier','佐川急便|飛脚宅配便');
 allowConfirm=false;await click('place');eq(previewPayload.is_marketplace,false);eq(confirmation.includes('通常受注'),true);eq(confirmation.includes('MP 0円'),true);eq(placeCalls,0);
 document.getElementById('recycle-marketplace').checked=true;document.getElementById('recycle-marketplace').dispatchEvent(new domWindow.Event('change',{bubbles:true}));await click('place');eq(previewPayload.is_marketplace,true);eq(confirmation.includes('MP経由'),true);eq(confirmation.includes('2,200円'),true);eq(document.getElementById('recycle-price-0').value,'10000');
 wrongQuote=true;await click('place');eq(placeCalls,0);eq(document.getElementById('recycle-message').textContent.includes('一致しません'),true);wrongQuote=false;
 document.getElementById('recycle-marketplace').checked=false;allowConfirm=true;
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
 await click('settings');eq(document.getElementById('recycle-customer-id').tagName,'SELECT');eq(document.getElementById('recycle-customer-id').value,'');
 eq(document.querySelector('[data-recycle-action="create_customer"]'),null);eq(document.getElementById('recycle-settings-view').textContent.includes('集約先D-CATS ID'),false);
 await click('save_settings');eq(settingsCalls,0);eq(bindingPreviewCalls,0);
 value('customer-id','999');await click('save_settings');eq(settingsCalls,0);eq(bindingPreviewCalls,0);
 value('customer-id','1');eq(document.getElementById('recycle-customer-info').textContent.includes('末日締め'),true);
 await click('save_settings');eq(bindingPreviewCalls,1);eq(settingsCalls,0);eq(document.getElementById('recycle-binding-confirm').hidden,false);
 eq(document.querySelector('[data-recycle-action="binding_confirm"]').disabled,true);await click('binding_confirm');eq(settingsCalls,0);
 document.getElementById('recycle-binding-ack').checked=true;document.getElementById('recycle-binding-ack').dispatchEvent(new domWindow.Event('change',{bubbles:true}));await click('binding_confirm');
 eq(settingsCalls,1);eq(lastSettings.binding_confirmed,true);eq(lastSettings.binding_confirmation,'fixture-token-1');eq(document.getElementById('recycle-entry-fields').disabled,false);
 await click('entry');await click('settings');await click('save_settings');eq(settingsCalls,2);eq(bindingPreviewCalls,1);
 value('customer-id','2');bindingWarningCount=3;await click('save_settings');eq(document.getElementById('recycle-binding-confirm').textContent.includes('3 件'),true);eq(document.querySelector('#recycle-binding-confirm img'),null);
 eq(document.getElementById('recycle-binding-confirm').textContent.includes('2026-10-31'),true);eq(document.getElementById('recycle-binding-confirm').textContent.includes('過去の受注先は変更しません'),true);
 await click('binding_cancel');eq(document.getElementById('recycle-binding-confirm').hidden,true);eq(settingsCalls,2);
 failBinding=true;await click('save_settings');eq(document.getElementById('recycle-message').textContent,'受注確認失敗');eq(settingsCalls,2);failBinding=false;
 await click('save_settings');await click('entry');await click('settings');eq(document.getElementById('recycle-binding-confirm').hidden,true);eq(document.getElementById('recycle-customer-id').disabled,false);
 bindingGuard=0;await click('reload_settings');eq(document.querySelector('[data-recycle-action="save_settings"]').disabled,true);await click('save_settings');eq(settingsCalls,2);bindingGuard=1;await click('reload_settings');
 const storedCandidates=candidateRows;candidateRows=[];await click('reload_settings');eq(document.getElementById('recycle-settings-view').textContent.includes('紐付けできる得意先がありません'),true);eq(document.querySelector('[data-recycle-action="save_settings"]').disabled,true);candidateRows=storedCandidates;await click('reload_settings');
 value('customer-id','2');await click('save_settings');document.getElementById('recycle-binding-ack').checked=true;failSave=true;await click('binding_confirm');eq(settingsCalls,3);
 await click('save_settings');eq(settingsCalls,3);resultFound=false;await click('result');eq(settingsCalls,3);eq(document.getElementById('recycle-message').textContent.includes('再送せず'),true);
 resultFound=true;await click('result');eq(settingsCalls,3);eq(document.querySelector('#recycle-customer-summary strong').textContent,'株式会社ブロードリーフ');failSave=false;await click('close');
 configurable=false;await ctx.DcatsRecycleOrders.open();await click('settings');eq(document.querySelector('#recycle-settings-view [data-recycle-action="save_settings"]'),null);eq(document.getElementById('recycle-settings-view').textContent.includes('システム管理者'),true);await click('close');configurable=true;
 failSettings=true;await ctx.DcatsRecycleOrders.open();eq(document.getElementById('recycle-message').textContent,'設定読込失敗');await click('close');failSettings=false;
 await ctx.DcatsRecycleOrders.open();failList=true;await click('settlements');eq(document.getElementById('recycle-message').textContent,'一覧読込失敗');await click('entry');eq(document.getElementById('recycle-entry').hidden,false);failList=false;await click('close');
 feeGuard=1;await ctx.DcatsRecycleOrders.open();eq(document.getElementById('recycle-entry-fields').disabled,true);await click('place');eq(document.getElementById('recycle-message').textContent.includes('手数料条件を確認できません'),true);await click('close');feeGuard=2;
 const sampleRows=['normal','marketplace','unknown'].map((route,i)=>({id:i+20,order_number:'QA-'+i,status:'accepted',shipping_address:{company_name:i?'合成会社':'=HYPERLINK("bad")'},total_jpy:12100,recycle:{order_route:route,external_order_number:'外部'+i,estimated_factoring_fee_jpy:route==='unknown'?null:660,estimated_marketplace_fee_jpy:route==='unknown'?null:route==='marketplace'?1100:0,estimated_legacy_fee_jpy:route==='unknown'?1000:null,estimated_fee_jpy:route==='unknown'?1000:route==='marketplace'?1760:660,estimated_receipt_jpy:route==='unknown'?11100:route==='marketplace'?10340:11440,actual_fee_jpy:i?null:0,actual_receipt_jpy:i?null:12100,payment_status:'unconfirmed'}}));
 listData=q=>{const rows=sampleRows.filter(o=>q.route==='all'||o.recycle.order_route===q.route);return {rows,count:rows.length,normal_count:rows.filter(o=>o.recycle.order_route==='normal').length,marketplace_count:rows.filter(o=>o.recycle.order_route==='marketplace').length,unknown_count:rows.filter(o=>o.recycle.order_route==='unknown').length,gross_jpy:12100*rows.length,estimated_fee_jpy:3420,estimated_factoring_fee_jpy:1320,estimated_marketplace_fee_jpy:1100,estimated_legacy_fee_jpy:1000,actual_fee_jpy:0,unconfirmed_fee_count:2};};
 await ctx.DcatsRecycleOrders.open();await click('settlements');eq(document.querySelectorAll('.recycle-order-row').length,3);eq(document.getElementById('recycle-list').textContent.includes('未区分（従来方式）'),true);eq(document.getElementById('recycle-list').textContent.includes('0円（確定）'),true);eq(document.querySelector('#recycle-list img'),null);
 await click('csv');const csv=await csvBlob.text();eq(csv.includes('受注区分'),true);eq(csv.includes('MP手数料見込'),true);eq(csv.includes('"通常受注"'),true);eq(csv.includes('"\'=HYPERLINK'),true);eq(csv.includes('"未区分（従来方式）"'),true);eq(downloadName.includes('-all-page-1'),true);
 value('list-route','marketplace');document.getElementById('recycle-list-route').dispatchEvent(new domWindow.Event('change',{bubbles:true}));await tick();eq(lastListQuery.route,'marketplace');eq(lastListQuery.offset,0);eq(document.querySelectorAll('.recycle-order-row').length,1);await click('csv');eq((await csvBlob.text()).includes('"通常受注"'),false);eq(downloadName.includes('-marketplace-page-1'),true);
 value('from','2026-10-01');eq(document.querySelector('[data-recycle-action="csv"]').disabled,true);eq(document.querySelectorAll('.recycle-order-row').length,0);
 let resolveList;listDeferred=new Promise(r=>{resolveList=r;});await click('list');value('to','2026-10-31');resolveList({data:listData({route:'all'})});await tick();eq(document.querySelectorAll('.recycle-order-row').length,0);eq(document.querySelector('[data-recycle-action="csv"]').disabled,true);listDeferred=null;await click('list');eq(lastListQuery.to,'2026-10-31');await click('close');listData=null;
 const before=calls;permission=false;await ctx.DcatsRecycleOrders.open();eq(calls,before);ctx.DcatsRecycleOrders.configureEntryButton();eq(document.getElementById('sales-order-recycle-open').hidden,true);
 const earlyDocument=parseHTML('<html><body><button id="sales-order-recycle-open" hidden></button></body></html>').document;
 const early={document:earlyDocument,console};early.window=early;vm.createContext(early);vm.runInContext(source,early);
 eq(early.DcatsRecycleOrders.isBusy(),false);
 early.canManageSalesOrders=()=>true;early.currentUser={id:'synthetic-late-auth'};early.DcatsRecycleOrders.configureEntryButton();
 eq(earlyDocument.getElementById('sales-order-recycle-open').hidden,false);
 for (const switchActor of [false,true]) {
   const parsed=parseHTML('<html><body></body></html>'),d=parsed.document,newElement=d.createElement.bind(d);
   d.createElement=tag=>{const n=newElement(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;};}return n;};
   let resolveOld,reads=0,savedPayload=null,previews=0;
   const base={fee_rate_percent:10,provisional:true,fee_basis:'product_net',rounding:'floor',can_configure:true,note:'synthetic',customer_binding_guard_version:1,fee_policy_version:2,fee_conditions:feeConditions};
   const currentCfg={...base,revision:2,sales_customer_id:2,customer_name:candidateRows[1].name,customer_code:'5856',customer_candidates:candidateRows};
   const isolated={...ctx,document:d,currentUser:{id:'first-actor'},canManageSalesOrders:()=>true,sb:{rpc:async(name,args)=>{
     if(args.target_action==='settings'){if(++reads===1)return await new Promise(r=>{resolveOld=r;});return {data:currentCfg};}
     if(args.target_action==='binding_preview'){previews++;throw Error('obsolete config reached preview');}
     if(args.target_action==='save_settings'){savedPayload=args.target_payload;return {data:{saved:true}};}
     throw Error('unexpected isolated action');
   }}};
   isolated.window=isolated;vm.createContext(isolated);vm.runInContext(source,isolated);
   const oldOpening=isolated.DcatsRecycleOrders.open();
   d.querySelector('[data-recycle-action="close"]').dispatchEvent(new parsed.window.Event('click',{bubbles:true}));
   if(switchActor)isolated.currentUser={id:'second-actor'};
   await isolated.DcatsRecycleOrders.open();selects(d);
   resolveOld({data:{...base,revision:1,sales_customer_id:1,customer_name:candidateRows[0].name,customer_candidates:[candidateRows[0]]}});await oldOpening;
   eq(d.querySelector('#recycle-customer-summary strong').textContent,currentCfg.customer_name);
   d.querySelector('[data-recycle-action="settings"]').dispatchEvent(new parsed.window.Event('click',{bubbles:true}));
   d.querySelector('[data-recycle-action="save_settings"]').dispatchEvent(new parsed.window.Event('click',{bubbles:true}));
   await new Promise(r=>setTimeout(r,5));eq(previews,0);eq(savedPayload?.revision,2);eq(savedPayload?.sales_customer_id,'2');
 }
 for(const asset of ['recycle-orders.js','recycle-orders.css']) {assert(html.includes(asset));assert(build.includes('"'+asset+'"'));checks+=2;}
 assert(app.includes('DcatsRecycleOrders.mountDetail(order, host)'));assert(app.includes('DcatsRecycleOrders.isBusy()'));checks+=2;
 console.log(JSON.stringify({feature:'recycle-orders',checks,passed:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
