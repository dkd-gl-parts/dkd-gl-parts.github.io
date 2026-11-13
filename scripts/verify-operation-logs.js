const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/\r\n/g,'\n');
function extract(name){const start=source.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0);const end=source.indexOf('\n}\n',start);return source.slice(start,end+2);}
const elements={'logs-count':{},'logs-list':{}};
const ctx=vm.createContext({currentLang:'ja',userProfile:{id:'actor'},productKindLabel:v=>v,document:{getElementById:id=>elements[id]},esc:v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),t:k=>k,canViewOperationLogs:()=>true,showPermissionDenied:()=>{throw Error('denied');}});
for(const name of ['formatYen','formatYenCurrency','operationLogText','operationLogFieldLabel','operationLogValue','operationLogChanges','operationLogDetailsHtml','renderLogs','loadLogs'])vm.runInContext(extract(name),ctx);
let assertions=0;
function has(text,fragment){assert.ok(text.includes(fragment),fragment+' missing in '+text);assertions++;}
function details(before,after,operation='update',table_name='product_rank1_prices'){return ctx.operationLogDetailsHtml({operation,table_name,before_data:before,after_data:after});}
has(details({price_jpy:12000},{price_jpy:13000}),'売値区分1: ¥12,000 → ¥13,000');
has(details({price_jpy:0},{price_jpy:1}),'¥0 → ¥1');
has(details({price_jpy:null},{price_jpy:12000}),'未設定 → ¥12,000');
has(details(null,{price_jpy:12000}),'記録なし → ¥12,000');
has(details(null,{base_price_jpy:9000},'insert','product_base_prices'),'基準価格: ¥9,000');
has(details({base_price_jpy:9000},null,'delete','product_base_prices'),'¥9,000 を削除');
let partial=details({price_jpy:12,note:'keep'},{price_jpy:13});assert.ok(!partial.includes('keep'));assertions++;
has(details({price_jpy:100,updated_at:'old'},{price_jpy:100,updated_at:'new'}),'変更なし（同じ内容で保存）');
has(details(null,null),'変更内容の記録なし');
has(details({password:'old'},{password:'new'}),'変更内容の記録なし');
has(details(null,{stock_qty_after:50},'insert','finished_product_units'),'保存後在庫数: 50');
has(details([{stock_qty:24}],{stock_qty:20},'update','core_product_variants'),'在庫数: 24 → 20');
const nested=details({core_policy:[{product_variant_id:1,core_charge_jpy:1000},{product_variant_id:2,core_charge_jpy:2000}]},{core_policy:[{product_variant_id:2,core_charge_jpy:2200},{product_variant_id:1,core_charge_jpy:1000}]});
has(nested,'¥2,000 → ¥2,200');assert.ok(!nested.includes('¥1,000 →'));assertions++;
has(details({rounding_method:'floor'},{rounding_method:'round'}),'切り捨て → 四捨五入');
has(details({rate_multiplier:1},{rate_multiplier:0.8}),'掛率: 1 → 0.8');
has(details({fee_rate_percent:2.5},{fee_rate_percent:3}),'2.5% → 3%');
const safe=details({}, {note:'<img src=x onerror=alert(1)>',password:'do-not-show',token:'hidden'});has(safe,'&lt;img');assert.ok(!safe.includes('do-not-show')&&!safe.includes('hidden'));assertions++;
const many=details({},Object.fromEntries(Array.from({length:12},(_,i)=>['field'+i,'value'+i])));has(many,'<details');has(many,'value11');
for(const lang of ['en','zh']){ctx.currentLang=lang;has(details({price_jpy:12000},{price_jpy:13000}),lang==='en'?'Sales price 1':'售价等级1');}
ctx.currentLang='ja';ctx.renderLogs([{operation:'update',table_name:'product_rank1_prices',target_desc:'<script>',before_data:{price_jpy:12000},after_data:{price_jpy:13000}}]);has(elements['logs-list'].innerHTML,'¥12,000 → ¥13,000');has(elements['logs-list'].innerHTML,'&lt;script&gt;');
ctx.renderLogs([]);has(elements['logs-list'].innerHTML,'log_no_data');
(async()=>{
 ctx.sb={from:()=>({select:()=>({order:()=>({limit:async()=>({error:{message:'failed'}})})})})};
 await ctx.loadLogs();has(elements['logs-list'].textContent,'ログを取得できません');
 let resolve;ctx.sb={from:()=>({select:()=>({order:()=>({limit:()=>new Promise(r=>resolve=r)})})})};
 const pending=ctx.loadLogs();ctx.userProfile={id:'other'};resolve({data:[{after_data:{price_jpy:999}}]});await pending;assert.ok(!elements['logs-list'].innerHTML.includes('999'));assertions++;
 console.log(JSON.stringify({passed:true,assertions}));
})().catch(e=>{console.error(e);process.exitCode=1;});
