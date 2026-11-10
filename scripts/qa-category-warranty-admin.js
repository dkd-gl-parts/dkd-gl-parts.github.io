'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),acorn=require('acorn');
const {chromium}=require(process.env.WARRANTY_PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ast=acorn.parse(app,{ecmaVersion:'latest'});
function extract(name){const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return app.slice(n.start,n.end);}
const trans=ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations).find(n=>n.id.name==='TRANSLATIONS').init;
const start=html.indexOf('<div class="form-overlay" id="finished-warranty-policy-overlay"'),end=html.indexOf('<div class="form-overlay" id="finished-shipment-replacement-overlay"',start);
assert(start>=0&&end>start);
const menu=extract('renderMenu');
const deps=[...new Set(menu.match(/\b(?:can\w+|isSystemAdmin)\(/g))].map(x=>x.slice(0,-1)).filter(n=>!['canManageSharedSettings','canManageFinishedProductShipping'].includes(n));
const runtime='var TRANSLATIONS='+app.slice(trans.start,trans.end)+';\n'+
String.raw`var currentLang='ja',userProfile={id:'fixture'},categoryOptions=[],finishedWarrantyPolicyRows=[],salesOrderWarrantyPolicies=[],currentProduct=null,detailSecondaryRequestSeq=0;
var qaCategories=true,qaWarranty=true,qaMode='',qaCalls=[],qaChanges=[],qaCounter=1,qaStore;
function t(k){return (TRANSLATIONS[currentLang]||TRANSLATIONS.ja)[k]||TRANSLATIONS.ja[k]||k;}
function canManageSharedSettings(){return qaCategories;} function canManageFinishedProductShipping(){return qaWarranty;}
function hasAccessRole(){return false;}function syncDcatsIntegrationReadinessContext(){}async function refreshConciergeMenuBadge(){}
function renderFinishedShipmentOrderContext(){}function renderSalesProductIdentity(){}function loadSalesProductWarrantyForCurrent(){}
window.confirm=function(){return true;};
function qaSeed(){qaCounter=1;qaCalls=[];qaChanges=[];qaMode='';qaStore={categories:[],policies:[],revision:'00000000000000000000000000000001',can_edit_categories:qaCategories,can_edit_warranty:qaWarranty};for(var i=0;i<35;i++){var code=i===0?'alternator':i===1?'starter':'fixture_'+i;qaStore.categories.push({category_code:code,label_ja:i===0?'オルタネータ':'カテゴリ '+(i+1),label_en:i===0?'Alternator':'Category '+(i+1),label_zh:i===0?'发电机':'类别 '+(i+1),sort_order:i,show_to_customers:i%5===0||i===34});['rebuilt','aftermarket_new'].forEach(function(k){qaStore.policies.push({category_code:code,product_kind:k,warranty_months:i===0&&k==='rebuilt'?24:12,warranty_distance_km:i===0&&k==='rebuilt'?40000:null});});}}
function clone(v){return JSON.parse(JSON.stringify(v));}
var sb={rpc:async function(name,args){qaCalls.push(name);if(name==='get_category_warranty_settings'){
 if(qaMode==='load_delay')return new Promise(function(resolve){window.qaResolve=resolve;});
 if(qaMode==='load_error')return {error:{code:'42501'}};
 if(qaMode==='malformed')return {data:[]};
 return {data:clone(qaStore)};
}
qaChanges.push(clone(args));
if(qaMode==='save_delay')return new Promise(function(resolve){window.qaResolve=resolve;});
if(qaMode==='save_network')throw Error('synthetic network');
if(qaMode==='save_conflict')return {error:{code:'40001'}};
if(qaMode==='save_denied')return {error:{code:'42501'}};
if(qaMode==='save_validation')return {error:{code:'22023',message:t('cw_nameInvalid')}};
args.target_changes.categories.forEach(function(row){var c=qaStore.categories.find(function(c){return c.category_code===row.category_code;});if(c)Object.assign(c,row);else qaStore.categories.push(row);});
args.target_changes.policies.forEach(function(row){var p=qaStore.policies.find(function(p){return p.category_code===row.category_code&&p.product_kind===row.product_kind;});if(p)Object.assign(p,row);else qaStore.policies.push(row);});
qaStore.revision=(++qaCounter).toString(16).padStart(32,'0');return {data:clone(qaStore)};
}};
qaSeed();
`+deps.map(n=>'function '+n+'(){return false;}').join('\n')+'\n'+
['esc','renderMenu','openFinishedWarrantyPolicySettings','closeFinishedWarrantyPolicySettings','saveFinishedWarrantyPolicies','renderFinishedWarrantyPolicyTable','categoryTranslationSource','tCat','categoryOptionLabel','productCategoryLabel','categoryCodeFromForm','formValueFromCategoryCode','renderCategoryChips','refreshCategorySelectLabels'].map(extract).join('\n')+'\n'+
String.raw`document.getElementById('finished-warranty-policy-close').addEventListener('click',closeFinishedWarrantyPolicySettings);
document.getElementById('finished-warranty-policy-cancel').addEventListener('click',closeFinishedWarrantyPolicySettings);
document.getElementById('finished-warranty-policy-save').addEventListener('click',saveFinishedWarrantyPolicies);
document.getElementById('finished-warranty-policy-overlay').addEventListener('click',function(e){if(e.target===this)closeFinishedWarrantyPolicySettings();});renderMenu();`;
const body='<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"></head><body><div class="menu-body"><div id="menu-grid"></div></div><select id="pf-category" hidden><option value="Alternator">Alternator</option><option value="Starter">Starter</option></select><select id="search-category-filter" hidden></select>'+html.slice(start,end)+'<script src="category-warranty-settings.js"></script><script src="fixture.js"></script></body></html>';
const output=process.env.WARRANTY_QA_OUTPUT||path.join(root,'.qa-output/category-warranty');fs.mkdirSync(output,{recursive:true});
const results=[];let browser,server;
const tick=page=>page.waitForTimeout(20);
async function run(){
 server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.setHeader('content-type','text/html');res.end(body);}else if(url.pathname==='/fixture.js'){res.setHeader('content-type','application/javascript');res.end(runtime);}else{const p=path.join(root,url.pathname.slice(1));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.statusCode=404;res.end();return;}res.setHeader('content-type',p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':'application/octet-stream');res.end(fs.readFileSync(p));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const url='http://127.0.0.1:'+server.address().port;
 async function fresh(options={}){await page.goto(url);await page.evaluate(o=>{qaCategories=o.categories!==false;qaWarranty=o.warranty!==false;qaSeed();qaMode=o.mode||'';renderMenu();},options);}
 async function open(){await page.locator('[data-action="category-warranty-settings"]').click();await page.locator('[data-cw-row]').first().waitFor();}
 const input=(code,field,kind)=>page.locator('[data-cw-code="'+code+'"][data-cw-'+(kind?'policy':'name')+'="'+field+'"]'+(kind?'[data-cw-kind="'+kind+'"]':''));
 for(const width of [1280,1024,768,390,320])for(const lang of ['ja','en','zh']){
 await page.setViewportSize({width,height:({1280:976,1024:768,768:1024,390:844,320:720})[width]});await fresh();await page.evaluate(l=>{currentLang=l;renderMenu();},lang);await open();
 assert.equal(await page.locator('[data-action="category-warranty-settings"]').count(),1);
 const geometry=await page.evaluate(()=>{const c=document.querySelector('.finished-warranty-policy-card').getBoundingClientRect(),s=document.getElementById('finished-warranty-policy-save').getBoundingClientRect();return {width:c.width,overflow:document.documentElement.scrollWidth>innerWidth,saveVisible:s.bottom<=innerHeight&&s.top>=0,inputsInside:Array.from(document.querySelectorAll('#finished-warranty-policy-overlay input')).every(n=>{const r=n.getBoundingClientRect();return r.left>=c.left-1&&r.right<=c.right+1;}),visibleRows:Array.from(document.querySelectorAll('[data-cw-row]')).filter(n=>{const r=n.getBoundingClientRect(),pane=n.closest('.finished-warranty-policy-table-wrap').getBoundingClientRect();return r.top>=pane.top&&r.bottom<=pane.bottom;}).length,rows:document.querySelectorAll('[data-cw-row]').length};});
 assert(!geometry.overflow&&geometry.saveVisible&&geometry.inputsInside);assert.equal(geometry.rows,35);if(width===1280)console.log('Admin geometry',lang,JSON.stringify(geometry));if(width===1280)assert(geometry.visibleRows>=3,'three complete editable categories fit on desktop');
 await page.screenshot({path:path.join(output,'category-admin-'+width+'-'+lang+'.png')});results.push({case:'layout',width,lang,...geometry});
 }
 await page.setViewportSize({width:1280,height:976});await fresh();await open();
 await input('alternator','label_ja').fill('発電機');await page.locator('#finished-warranty-policy-save').click();await tick(page);
 const rename=await page.evaluate(()=>({change:qaChanges[0],category:tCat('alternator'),product:productCategoryLabel({category_code:'alternator',category_ja:'古い名前'}),option:document.querySelector('#pf-category [value="Alternator"]').textContent}));
 assert.equal(rename.change.target_changes.categories.length,1);assert.equal(rename.change.target_changes.policies.length,0);assert.equal(rename.category,'発電機');assert.equal(rename.product,'発電機');assert.equal(rename.option,'発電機');results.push({case:'rename-and-display',passed:true});
 await page.locator('#category-warranty-add').click();var newCode=await page.locator('[data-cw-row]').last().getAttribute('data-cw-row');await input(newCode,'label_ja').fill('追加カテゴリ');await page.locator('#finished-warranty-policy-save').click();await tick(page);
 const added=await page.evaluate(c=>({change:qaChanges.at(-1),option:document.querySelector('#pf-category [value="'+c+'"]')?.textContent,form:formValueFromCategoryCode(c)}),newCode);assert.equal(added.change.target_changes.categories[0].show_to_customers,false);assert.equal(added.change.target_changes.categories[0].label_en,'追加カテゴリ');assert.equal(added.change.target_changes.policies.length,2);assert.equal(added.option,'追加カテゴリ');assert.equal(added.form,newCode);results.push({case:'add-category-and-both-terms',passed:true});
 await fresh();await open();await page.locator('[data-cw-public][data-cw-code=alternator]').uncheck();await page.locator('#finished-warranty-policy-save').click();await tick(page);assert.equal(await page.evaluate(()=>qaChanges[0].target_changes.categories[0].show_to_customers),false);assert.equal(await page.evaluate(()=>qaChanges[0].target_changes.policies.length),0);results.push({case:'global-publication-only-save',passed:true});
 await fresh();await page.evaluate(()=>{qaStore.categories[0].label_ja='<img id="cw-injected" src="x" onerror="window.qaInjected=true">';});await open();assert.equal(await page.locator('#cw-injected').count(),0);assert.equal(await page.evaluate(()=>!!window.qaInjected),false);results.push({case:'category-name-renders-as-text',passed:true});
 await fresh();await open();await input('alternator','months','rebuilt').fill('0');await page.locator('#finished-warranty-policy-save').click();assert.equal(await page.evaluate(()=>qaChanges.length),0);assert(await page.locator('#finished-warranty-policy-message').textContent());results.push({case:'invalid-months',passed:true});
 await input('alternator','months','rebuilt').fill('24');await input('alternator','distance','rebuilt').fill('10000001');await page.locator('#finished-warranty-policy-save').click();assert.equal(await page.evaluate(()=>qaChanges.length),0);results.push({case:'invalid-mileage',passed:true});
 for(const mode of ['save_network','save_conflict','save_denied','save_validation']){
 await fresh();await open();await input('alternator','label_ja').fill('保存試験');await page.evaluate(m=>qaMode=m,mode);await page.locator('#finished-warranty-policy-save').click();await tick(page);assert.equal(await page.evaluate(()=>qaChanges.length),1);
 if(['save_network','save_conflict'].includes(mode)){assert(await page.locator('#finished-warranty-policy-save').isDisabled());await page.evaluate(()=>DcatsCategoryWarrantySettings.save());assert.equal(await page.evaluate(()=>qaChanges.length),1);await page.evaluate(()=>qaMode='');await page.locator('#category-warranty-reload').click();await tick(page);assert.equal(await input('alternator','label_ja').inputValue(),'オルタネータ');}
 results.push({case:mode,passed:true});}
 await fresh();await open();await input('alternator','label_ja').fill('待機');await page.evaluate(()=>qaMode='save_delay');await page.locator('#finished-warranty-policy-save').click();await page.evaluate(()=>DcatsCategoryWarrantySettings.save());assert.equal(await page.evaluate(()=>qaChanges.length),1);assert(await page.locator('#finished-warranty-policy-close').isDisabled());await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#menu-grid')),false);await page.evaluate(()=>{userProfile={id:'other'};qaResolve({data:clone(qaStore)});});await tick(page);assert(!await page.locator('#finished-warranty-policy-overlay').evaluate(n=>n.classList.contains('show')));results.push({case:'duplicate-save-and-actor-change',passed:true});
 for(const role of [{categories:false,warranty:true},{categories:true,warranty:false}]){await fresh(role);await open();assert.equal(await page.locator('[data-cw-public][data-cw-code=alternator]').isDisabled(),!role.categories);assert.equal(await input('alternator','label_ja').isDisabled(),!role.categories);assert.equal(await input('alternator','months','rebuilt').isDisabled(),!role.warranty);assert(await page.locator('#category-warranty-add').isDisabled());results.push({case:'scoped-role',...role,passed:true});}
 await fresh({categories:false,warranty:false});assert.equal(await page.locator('[data-action="category-warranty-settings"]').count(),0);await page.evaluate(()=>openFinishedWarrantyPolicySettings());assert.equal(await page.evaluate(()=>qaCalls.length),0);results.push({case:'unauthorized-menu',passed:true});
 for(const mode of ['load_error','malformed']){await fresh({mode});await page.locator('[data-action="category-warranty-settings"]').click();await tick(page);assert(await page.locator('#finished-warranty-policy-save').isDisabled());assert.equal(await page.locator('[data-cw-row]').count(),0);results.push({case:mode,passed:true});}
 await fresh({mode:'load_delay'});await page.locator('[data-action="category-warranty-settings"]').click();assert(await page.locator('#finished-warranty-policy-save').isDisabled());await page.evaluate(()=>DcatsCategoryWarrantySettings.close());await page.evaluate(()=>qaResolve({data:clone(qaStore)}));await tick(page);assert(!await page.locator('#finished-warranty-policy-overlay').evaluate(n=>n.classList.contains('show')));results.push({case:'late-load-after-close',passed:true});
 await fresh();await open();await input('alternator','label_ja').fill('未保存');await page.evaluate(()=>{currentLang='en';renderFinishedWarrantyPolicyTable();});assert.equal(await input('alternator','label_ja').inputValue(),'未保存');await page.locator('#finished-warranty-policy-close').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'finished-warranty-policy-save');await page.keyboard.press('Escape');assert(!await page.locator('#finished-warranty-policy-overlay').evaluate(n=>n.classList.contains('show')));results.push({case:'language-keeps-edits-and-keyboard',passed:true});
 assert.deepEqual(errors,[]);results.push({case:'console-and-page-errors',count:errors.length,passed:true});
 fs.writeFileSync(path.join(output,'category-admin-results.json'),JSON.stringify(results,null,2));console.log('Category warranty admin browser QA: '+results.length+' cases passed');
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});

// Temporary acceptance capture for the finished-label history layout.
require("./qa-finished-label-history.js");
