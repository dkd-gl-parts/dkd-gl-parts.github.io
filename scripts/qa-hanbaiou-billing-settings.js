'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),acorn=require('acorn');
const {chromium}=require(process.env.WARRANTY_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),ast=acorn.parse(app,{ecmaVersion:'latest'});
const names=['t','tf','esc','normalizeAsciiWidth','normalizeHanbaiouCustomerCode','customerRegistrationFieldValue','hanbaiouClosingCodeOptionsHtml','collectHanbaiouCustomerBillingSettings','validateHanbaiouCustomerBillingSettings','collectHanbaiouCustomerCollectionSettings','validateHanbaiouCustomerCollectionSettings','customerAccessOperationCurrent','saveCustomerAccessSettings'];
const functions=names.map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return app.slice(n.start,n.end);});
const translations=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='TRANSLATIONS'));
function fixture(){
var currentLang='ja',userProfile={id:'synthetic-actor'},currentCustomerAccessCustomer={id:1,source_code:'hanbaiou',billing_customer_code:'SYNTH-001',closing_code:'31'},customerAccessSaveOperation=null,customerAccessSettingsSaving=false,customerAccessRows=[],customerAccessFilteredRows=[],salesCustomerOptions=[],detailSalesCustomerOptions=[],customerPortalPreviewContext=null,detailCustomerDisplaySettingsCache={},customerAccessSettings={},qaMode='success',qaCalls=[],qaAlerts=[],qaResolve=null,qaPending=null;
function canManageCustomerAccess(){return !!userProfile&&qaMode!=='denied';}
function customerCategorySettingsReady(){return qaMode!=='loading';}
function customerAccessOnlyCategoryChanges(){return false;}
function syncCustomerDisplayRuleControls(){}
function updateCustomerAccessSaveState(){document.getElementById('save').disabled=customerAccessSettingsSaving||!canManageCustomerAccess()||!customerCategorySettingsReady();document.getElementById('state').textContent=customerAccessSettingsSaving?'保存中':'入力可能';}
function collectCustomerDisplaySettings(){return{show_sales_price:true};}
function defaultCustomerDisplaySettings(){return{show_sales_price:true};}
function collectCustomerAccessCategoryVisibility(){return{};}
async function saveCustomerAccessCategoryVisibility(){qaCalls.push({kind:'category'});return true;}
function renderCustomerAccessList(){qaCalls.push({kind:'render'});}
async function loadCustomerAccessDetail(){qaCalls.push({kind:'reload'});}
window.alert=message=>{qaAlerts.push(String(message));document.getElementById('message').textContent=String(message);};
window.fetch=()=>{throw Error('external request forbidden');};
var sb={from(table){return{update(data){qaCalls.push({kind:'update',table,data});return{eq(){return{select(){return{async maybeSingle(){
if(qaMode.startsWith('wait'))await new Promise(r=>qaResolve=r);
if(qaMode==='network')throw Error('synthetic network failure');
if(qaMode==='zero'||qaMode==='wait-zero')return{data:null,error:null};
if(qaMode==='wrong')return{data:{id:999},error:null};
return{data:{id:1},error:null};
}}}}}}},async upsert(data){qaCalls.push({kind:'display',table,data});return{data:null,error:null};}};},async rpc(name,args){qaCalls.push({kind:'rpc',name,args});return{data:{sales_customer_id:1,billing_customer_code:args.target_billing_customer_code,closing_code:args.target_closing_code},error:null};}};
function render(){document.getElementById('customer-hanbaiou-closing-code').innerHTML=hanbaiouClosingCodeOptionsHtml('31',true);document.getElementById('save').textContent=t('customer_access_save_display');updateCustomerAccessSaveState();}
document.getElementById('save').onclick=()=>{qaPending=saveCustomerAccessSettings();};
render();
}
const ft=fixture.toString(),runtime=app.slice(translations.start,translations.end)+'\n'+functions.join('\n')+'\n'+ft.slice(ft.indexOf('{')+1,ft.lastIndexOf('}'));
const body='<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>main{box-sizing:border-box;max-width:760px;width:calc(100% - 24px);margin:12px auto;padding:16px}label{display:block;margin:14px 0}input,select{box-sizing:border-box;width:100%;max-width:100%}#message{overflow-wrap:anywhere}</style></head><body><main class="customer-access-panel"><h1>合成データ：請求設定</h1><label>請求得意先コード<input id="customer-hanbaiou-billing-code" value="SYNTH-001"></label><label>得意先締めコード<select id="customer-hanbaiou-closing-code"></select></label><label>価格ランク<select id="customer-access-rank-select"><option value="SYNTH-RANK">合成ランク</option></select></label><div class="customer-access-save-bar"><span id="state"></span><button id="save" class="btn-primary">保存</button></div><p id="message" role="status"></p></main><script src="/fixture.js"></script></body></html>';
const output=process.env.WARRANTY_QA_OUTPUT||path.join(root,'.qa-output/billing'),results=[];fs.mkdirSync(output,{recursive:true});
let server,browser;
async function run(){
server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/'){res.setHeader('content-type','text/html; charset=utf-8');res.end(body);}else if(pathname==='/fixture.js'){res.setHeader('content-type','application/javascript; charset=utf-8');res.end(runtime);}else if(pathname==='/styles.css'){res.setHeader('content-type','text/css');res.end(fs.readFileSync(path.join(root,'styles.css')));}else{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[],unexpected=[];
page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();unexpected.push(route.request().url());return route.abort();});
async function fresh(mode='success'){await page.goto(origin);await page.evaluate(m=>{qaMode=m;updateCustomerAccessSaveState();},mode);}
async function save(){await page.locator('#save').click();await page.evaluate(()=>qaPending);}
for(const width of [1280,390,320])for(const language of ['ja','en','zh']){
await page.setViewportSize({width,height:900});await fresh();await page.evaluate(l=>{currentLang=l;render();},language);
for(const code of ['0','31','50']){await page.locator('#customer-hanbaiou-closing-code').selectOption(code);assert.equal(await page.locator('#customer-hanbaiou-closing-code').inputValue(),code);}
assert.equal(await page.locator('#customer-hanbaiou-closing-code option').count(),34);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.locator('#customer-hanbaiou-closing-code').focus();assert.equal(await page.evaluate(()=>document.activeElement.id),'customer-hanbaiou-closing-code');
await page.screenshot({path:path.join(output,'billing-'+width+'-'+language+'.png'),fullPage:true});
results.push({case:'closing-0-31-50-layout-keyboard',width,language,passed:true});}
for(const mode of ['zero','wrong','network']){await fresh(mode);await page.locator('#customer-hanbaiou-closing-code').selectOption('50');await save();const state=await page.evaluate(()=>({rpc:qaCalls.filter(x=>x.kind==='rpc').length,display:qaCalls.filter(x=>x.kind==='display').length,reload:qaCalls.filter(x=>x.kind==='reload').length,alerts:qaAlerts.length,code:document.getElementById('customer-hanbaiou-closing-code').value,stored:currentCustomerAccessCustomer.closing_code}));assert.deepEqual(state,{rpc:0,display:0,reload:0,alerts:1,code:'50',stored:'31'});results.push({case:mode+'-preserves-input-no-downstream-save',passed:true});}
await fresh();await page.locator('#customer-hanbaiou-closing-code').selectOption('50');await save();assert.deepEqual(await page.evaluate(()=>({rpc:qaCalls.filter(x=>x.kind==='rpc').length,code:currentCustomerAccessCustomer.closing_code,reload:qaCalls.filter(x=>x.kind==='reload').length})),{rpc:1,code:'50',reload:1});results.push({case:'success-saves-50-once',passed:true});
for(const mode of ['loading','denied']){await fresh(mode);assert(await page.locator('#save').isDisabled());await page.evaluate(()=>saveCustomerAccessSettings());assert.equal(await page.evaluate(()=>qaCalls.length),0);results.push({case:mode+'-no-write',passed:true});}
await fresh();await page.evaluate(()=>{userProfile=null;updateCustomerAccessSaveState();});assert(await page.locator('#save').isDisabled());await page.evaluate(()=>saveCustomerAccessSettings());assert.equal(await page.evaluate(()=>qaCalls.length),0);results.push({case:'expired-actor-no-write',passed:true});
await fresh('wait-zero');await page.locator('#customer-hanbaiou-closing-code').selectOption('50');await page.locator('#save').click();await page.waitForFunction(()=>!!qaResolve);assert(await page.locator('#save').isDisabled());await page.evaluate(()=>saveCustomerAccessSettings());assert.equal(await page.evaluate(()=>qaCalls.filter(x=>x.kind==='update').length),1);await page.evaluate(async()=>{qaResolve();await qaPending;});assert.equal(await page.locator('#customer-hanbaiou-closing-code').inputValue(),'50');assert.equal(await page.evaluate(()=>qaCalls.filter(x=>x.kind==='rpc').length),0);results.push({case:'pending-duplicate-and-input-preservation',passed:true});
await fresh('wait-success');await page.locator('#save').click();await page.waitForFunction(()=>!!qaResolve);await page.evaluate(async()=>{currentCustomerAccessCustomer={id:2,closing_code:'31'};qaResolve();await qaPending;});assert.equal(await page.evaluate(()=>qaCalls.filter(x=>x.kind==='rpc').length),0);assert.equal(await page.evaluate(()=>currentCustomerAccessCustomer.id),2);results.push({case:'late-response-does-not-cross-customer',passed:true});
assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);fs.writeFileSync(path.join(output,'billing-results.json'),JSON.stringify({results,errors,unexpected},null,2));console.log('Billing settings browser QA: '+results.length+' cases passed');
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
