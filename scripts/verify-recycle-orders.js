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
let permission=true, calls=0;
const ctx = { document, console, Date, Number, String, Object, Array, Blob, URL, crypto:require('node:crypto').webcrypto,setTimeout, currentUser:{id:'synthetic'},currentLang:'ja',salesOrderSelectedId:1,
 canManageSalesOrders:()=>permission,SHIPPING_PREFECTURES:[[13,'東京都']],confirm:()=>true,
 sb:{rpc:async(name,args)=>{assert.equal(name,'recycle_workspace');calls++;if(args.target_action==='settings')return {data:{sales_customer_id:1,fee_rate_percent:10,provisional:true,fee_basis:'product_net',rounding:'floor',revision:1,can_configure:true,note:'合成暫定条件',customer_name:'ブロードリーフ'}};if(args.target_action==='list')return {data:{count:0,rows:[],gross_jpy:0,estimated_fee_jpy:0,actual_fee_jpy:null,unconfirmed_fee_count:0}};throw new Error('Unexpected fixture RPC');}},
 loadSalesOrderDetail:async()=>{},enterSalesOrderMgmt:async()=>{} };
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
 eq(html.indexOf('src="recycle-orders.js')<html.indexOf('src="app.js'),true);
 for(const bad of ['=HYPERLINK("https://example.invalid")','+1','@SUM(1)','-1','\t=1'])eq(ctx.DcatsRecycleOrders.csvCell(bad).startsWith('"\''),true);
 eq(ctx.DcatsRecycleOrders.csvCell('正常"文字'),'"正常""文字"');
 ctx.DcatsRecycleOrders.configureEntryButton();eq(document.getElementById('sales-order-recycle-open').hidden,false);
 await ctx.DcatsRecycleOrders.open();await new Promise(r=>setTimeout(r,5));
 eq(document.getElementById('recycle-title').textContent,'Recycle+受注・精算確認');
 eq(document.querySelectorAll('#recycle-entry').length,1);
 eq(document.getElementById('recycle-rate').value,'10');
 eq(document.getElementById('recycle-totals').textContent.includes('0件'),true);
 const order={id:1,status:'accepted',total_jpy:11000,recycle:{external_order_number:'<img src=x onerror=alert(1)>',policy_snapshot:{fee_rate_percent:10,provisional:true,note:'合成'},estimated_fee_jpy:1000,estimated_receipt_jpy:10000,payment_status:'unconfirmed',accounting_note:'確認待ち'}};
 ctx.DcatsRecycleOrders.mountDetail(order,document.getElementById('detail'));
 eq(document.querySelector('#detail img'),null);
 eq(document.querySelector('#detail .recycle-detail').textContent.includes('<img'),true);
 document.querySelector('#detail input').dispatchEvent(new domWindow.Event('input',{bubbles:true}));
 eq(ctx.DcatsRecycleOrders.isBusy(),true);
 ctx.DcatsRecycleOrders.mountDetail({id:2},document.getElementById('detail'));
 eq(ctx.DcatsRecycleOrders.isBusy(),false);
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
