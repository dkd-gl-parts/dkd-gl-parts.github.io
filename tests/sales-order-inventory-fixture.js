
var currentLang=new URLSearchParams(location.search).get('lang')||'ja',currentUser={id:'synthetic-owner'},APP_VERSION='qa';
var mode=new URLSearchParams(location.search).get('mode')||'success';
function t(k){return TRANSLATIONS[currentLang][k]||TRANSLATIONS.ja[k]||k;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function canManageSalesOrders(){return mode!=='unauthorized';}
function salesOrderDispatch(o){return o.dispatch;}
function customerProductKindLabel(k){return ({rebuilt:'リビルト',oem_new:'純正新品',aftermarket_new:'社外新品'})[k]||k;}
function shippingDocumentDestinationContext(){return {type:'customer',label:'お届け先',badge:'合成検証',recipient:'検証用得意先',postalAddress:'検証用住所',phone:'000-0000-0000'};}
function customerOrderShippingMethodLabel(){return 'ヤマト 宅急便';}
function customerOrderSavedShippingMethod(){return {};}
function salesOrderDispatchPackingView(){return {sizeText:'80サイズ',boxText:'検証用箱'};}
function salesOrderDispatchDocumentSet(){return [{name:'製品保証書',detail:'4枚',required:true},{name:'商品発送送り状',detail:'1枚',required:true},{name:'コア返却シート',detail:'4枚',required:true},{name:'コア返却用伝票',detail:'4枚',required:true}];}
function customerOrderDateTimeText(){return '2026/11/13 10:00';}
function salesOrderDispatchBarcodeDataUrl(){return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="280" height="52"%3E%3Cpath stroke="black" stroke-width="3" d="M10 0v52 M18 0v52 M25 0v52 M40 0v52 M48 0v52 M60 0v52 M69 0v52 M78 0v52 M91 0v52 M101 0v52 M120 0v52 M134 0v52 M141 0v52 M151 0v52 M163 0v52 M179 0v52 M200 0v52 M225 0v52 M244 0v52"/%3E%3C/svg%3E';}
var sb={rpc:async function(name,args){if(name!=='get_warehouse_stock')throw Error('Unexpected write');if(mode==='loading')return new Promise(()=>{});if(mode==='error')throw Error('Synthetic offline');if(mode==='denied'||mode==='expired')return {error:{code:'42501'}};var kinds={2250:'rebuilt',2251:'oem_new',2252:'aftermarket_new',2253:'rebuilt'};return {data:{variants:mode==='missing'?[]:[{variant_id:args.p_variant_id,product_id:'123',kind:kinds[args.p_variant_id],stock_qty:args.p_variant_id==='2250'?24:0,needs_recount:mode==='recount'}],positions:args.p_variant_id==='2250'?[{variant_id:'2250',location:'GLA-21',quantity:10},{variant_id:'2250',location:'GLA-32',quantity:13},{variant_id:'2250',location:'GLA-41',quantity:1}]:[]}};}};
var qaOrder={id:1,order_number:'QA-20261113',customer_name:'検証用得意先',core_return_required:true,items:Array.from({length:4},(_,i)=>({product_variant_id:String(2250+i),dkd_shohin_id:123,product_kind:['rebuilt','oem_new','aftermarket_new','rebuilt'][i],genuine_part_number:i?'QA-PART-00'+i:'31400-73H01',manufacturer_part_number:'QA-MAKER-001',gltek_part_number:'G0101-10001',core_return_required:true})),dispatch:{dispatch_number:'D1234567890',issued_at:'2026-11-13T01:00:00Z'}};
qaOrder.dispatch.items=qaOrder.items.map(item=>({order_item:item,quantity:1,serials:[]}));
var printMode=new URLSearchParams(location.search).get('print')==='1';
function renderQA(){if(printMode){document.body.className='document-dispatch';document.getElementById('root').innerHTML=buildSalesOrderDispatchPage(qaOrder,qaOrder.dispatch.items,0,1,salesOrderDispatchBarcodeDataUrl());}else{document.getElementById('root').innerHTML=salesOrderInventorySectionHtml(qaOrder);}}
var pending=hydrateSalesOrderInventory(qaOrder);renderQA();pending.then(()=>{renderQA();document.documentElement.dataset.ready='true';});
