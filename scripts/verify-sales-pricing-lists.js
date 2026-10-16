const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{parseHTML}=require('linkedom'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync('sales-pricing-lists.js','utf8');
const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8'),build=fs.readFileSync('scripts/build-static-site.js','utf8');
assert.match(app,/DcatsSalesPricingLists\.enter\(\)/);assert.match(html,/id="sales-pricing-lists"/);assert.match(html,/sales-pricing-lists\.js\?v=/);assert.match(html,/sales-pricing-lists\.css\?v=/);assert.match(build,/"sales-pricing-lists\.js"/);
assert.doesNotMatch(source,/localStorage|sessionStorage|console\.(log|warn|error)|innerHTML\s*\+=/);
const tick=()=>new Promise(r=>setImmediate(r));
async function fixture(lang='ja'){
 const {window}=parseHTML('<html><body><div id="screen-sales-pricing-mgmt" class="screen active"><section id="sales-pricing-lists"></section></div></body></html>');
 const doc=window.document,selectValue=new WeakMap();
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return selectValue.has(this)?selectValue.get(this):(this.querySelector('option[selected],option')?.getAttribute('value')||'');},set(v){selectValue.set(this,String(v));}});
 const create=doc.createElement.bind(doc);doc.createElement=(tag)=>{const n=create(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;n.dispatchEvent(new window.Event('close'));};}return n;};
 const calls=[],rows=[{item_id:1,dkd_shohin_id:100,manufacturer_part_number:'OEM-100',genuine_part_number:'G-100',manufacturer:'DENSO',state:'ready',cost_jpy:8000,minimum_jpy:11500,suggested_jpy:11500,dks_price_jpy:10000,target_jpy:8000,ec_price_jpy:10500,ec_tax_basis:'unknown'},
 {item_id:2,dkd_shohin_id:101,manufacturer_part_number:'<script>bad</script>',state:'dks_missing',cost_jpy:3510,minimum_jpy:5100},
 {item_id:3,dkd_shohin_id:102,manufacturer_part_number:'OEM-102',state:'configured',cost_jpy:3510,current_rank1_jpy:9000}];
 let allowed=true,unknown=false,saved=false;
 Object.assign(window,{currentLang:lang,currentUser:{id:'actor-1'},canEditBasePrice:()=>allowed,canViewManufacturingCostMgmt:()=>allowed,isSystemAdmin:()=>true,
 sb:{rpc:async(name,args)=>{calls.push(structuredClone(args));if(args.action==='lists')return {data:{lists:[{id:1,list_name:'合成リスト',item_count:3}]}};
 if(args.action==='preview')return {data:{run_id:args.payload.operation_id,rows:structuredClone(rows).map(r=>saved&&r.item_id===1?{...r,state:'configured',current_rank1_jpy:11500}:r)}};
 if(args.action==='commit'){if(unknown){unknown=false;return {error:{message:'network interrupted'}};}saved=true;return {data:{saved_count:1,saved:[{item_id:1,price_jpy:11500}]}};}
 if(args.action==='history')return {data:{history:[{id:'run',list_name:'合成リスト',created_at:new Date().toISOString(),committed_at:null,selected_count:3}]}};
 throw Error('unexpected_action');}}});
 vm.runInContext(source,vm.createContext({window,document:doc,MutationObserver:window.MutationObserver,crypto:webcrypto,Set,console}));
 await window.DcatsSalesPricingLists.enter();doc.getElementById('spl-list').value='1';doc.getElementById('spl-load').click();await tick();await tick();
 return {window,doc,calls,setUnknown(){unknown=true;},deny(){allowed=false;},rows};
}
(async()=>{
 let f=await fixture();assert.equal(f.doc.querySelectorAll('[data-spl-price]').length,1);assert.equal(f.doc.querySelector('[data-spl-select="3"]').disabled,true);assert.equal(f.doc.querySelectorAll('script').length,0,'untrusted part text is escaped');
 f.doc.getElementById('spl-all').click();assert.equal(f.doc.querySelector('[data-spl-select="1"]').hasAttribute('checked'),true);assert.equal(f.doc.querySelector('[data-spl-select="2"]').hasAttribute('checked'),false);
 const price=f.doc.querySelector('[data-spl-price]');price.value='10000';price.dispatchEvent(new f.window.Event('input'));f.doc.querySelector('[data-spl-one]').click();assert.equal(f.doc.querySelector('dialog'),null,'30% floor blocks underpricing');
 price.value='11500';price.dispatchEvent(new f.window.Event('input'));f.doc.querySelector('[data-spl-one]').click();assert.ok(f.doc.querySelector('dialog'));f.doc.querySelector('[data-spl-cancel]').click();assert.equal(f.calls.filter(c=>c.action==='commit').length,0);
 f.doc.querySelector('[data-spl-one]').click();f.doc.querySelector('[data-spl-confirm]').click();await tick();await tick();assert.equal(f.calls.filter(c=>c.action==='commit').length,1);assert.deepEqual(f.calls.find(c=>c.action==='commit').payload.items,[{item_id:1,price_jpy:11500}]);
 f=await fixture();f.setUnknown();f.doc.querySelector('[data-spl-one]').click();f.doc.querySelector('[data-spl-confirm]').click();await tick();await tick();
 assert.ok(f.doc.querySelector('[data-spl-retry]'));assert.equal(f.doc.querySelector('[data-spl-retry]').disabled,false);assert.equal(f.doc.getElementById('spl-load').disabled,true,'unknown result blocks new operations');
 f.doc.querySelector('[data-spl-retry]').click();await tick();await tick();const commits=f.calls.filter(c=>c.action==='commit');assert.equal(commits.length,2);assert.deepEqual(commits[0].payload,commits[1].payload,'unknown response reuses identical operation and prices');
 f=await fixture();f.doc.querySelector('[data-spl-one]').click();f.deny();f.doc.querySelector('[data-spl-confirm]').click();assert.equal(f.calls.filter(c=>c.action==='commit').length,0,'permission change during review blocks save');
 for(const lang of ['en','zh']){f=await fixture(lang);assert.equal(f.doc.querySelectorAll('[data-spl-price]').length,1);assert.ok(!f.doc.getElementById('sales-pricing-lists').textContent.includes('原価計算リストから価格を設定'));}
 f=await fixture();f.window.DcatsSalesPricingLists.reset();assert.equal(f.doc.getElementById('sales-pricing-lists').children.length,0);assert.equal(f.doc.querySelector('dialog'),null);
 console.log('Sales pricing list UI: list selection, margin floor, escaping, existing prices, review/cancel, idempotent retry, permission loss and three languages passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
