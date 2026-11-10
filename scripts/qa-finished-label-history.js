'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),acorn=require('acorn');
const {chromium}=require(process.env.WARRANTY_PLAYWRIGHT_MODULE),root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),ast=acorn.parse(app,{ecmaVersion:'latest'});
const translations=ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations).find(n=>n.id.name==='TRANSLATIONS').init;
const names=['renderFinishedLabelHistory','esc','normalizeProductKind','productKindLabel'];
const pre=[
"var currentLang=new URL(location.href).searchParams.get('lang')||'ja',finishedLabelPrintMode=new URL(location.href).searchParams.get('mode')||'product',finishedLabelSelectedHistoryId=null,qaActions=[],qaJob=null;",
"function t(k){return TRANSLATIONS[currentLang][k]||TRANSLATIONS.ja[k]||k;}function tf(k,v){return t(k).replace(/\\{([^}]+)\\}/g,function(_,n){return v[n]==null?'':String(v[n]);});}",
"function tCat(v){return v;}function formatDateTime(){return '2026/11/10 14:35:21';}",
"function finishedLabelHistoryPrintJob(){return qaJob;}function finishedLabelHistoryPrintStatus(j){return j;}function finishedLabelHistoryPrintJobActive(j){return !!(j&&j.active);}",
"function reprintFinishedLabelIssue(row,type){qaActions.push({action:'reprint',id:row.id,type:type});}function selectFinishedBoxLabelHistory(row){qaActions.push({action:'select',id:row.id});finishedLabelSelectedHistoryId=row.id;renderFinishedLabelHistory();}",
"function setFinishedLabelPrintMode(m){qaActions.push({action:'mode',mode:m});}function resumeFinishedLabelPrintStationIfEnabled(){}",
"function qaDefaultRows(){return [15,14,13].map(function(n){return {id:n,issue_code:'FB2026-00000'+n,issued_at:'2026-11-10T05:35:21Z',product_category:'オルタネータ',product_kind:'rebuilt',quantity:1,genuine_part_number:'31400-58J10',genuine_part_number_2:null,manufacturer_part_number:'102211-5961',components_json:[],finishedUnits:[{id:n,manufacturing_serial:'M2026-0000'+n}]};});}var finishedLabelHistoryRows=qaDefaultRows();"
].join('\n');
const runtime='var TRANSLATIONS='+app.slice(translations.start,translations.end)+';\n'+pre+'\n'+names.map(name=>{const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(node,name);return app.slice(node.start,node.end);}).join('\n')+"\ndocument.querySelectorAll('[data-i18n]').forEach(function(n){n.textContent=t(n.dataset.i18n);});renderFinishedLabelHistory();";
const at=html.indexOf('id="finished-label-history-list"'),start=html.lastIndexOf('<section class="finished-label-card"',at),end=html.indexOf('</section>',at)+10;
assert(start>=0&&end>start);
function fixture(mode){return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="screen-finished-label-mgmt" class="screen active"><main class="mgmt-body finished-label-body"><div id="finished-label-workspace" class="finished-label-workspace is-'+mode+'-mode"><div class="finished-label-shell"><div class="finished-label-left">'+html.slice(start,end)+'</div><div class="finished-label-editor"></div></div></div></main></div><script src="/qa-history-runtime.js"></script></body></html>';}
const output=process.env.WARRANTY_QA_OUTPUT;fs.mkdirSync(output,{recursive:true});let browser,server;const results=[],errors=[],requests=[];
async function verifyFit(page){
 const issues=await page.evaluate(()=>Array.from(document.querySelectorAll('.finished-label-history-row,.finished-label-history-serial,.finished-label-history-part-numbers dd')).filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>({cls:n.className,width:n.clientWidth,scroll:n.scrollWidth})));
 assert.deepEqual(issues,[],'history content overflows');
}
async function run(){
 server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1'),p=u.pathname;
  if(p==='/'){res.setHeader('Content-Type','text/html');res.end(fixture(u.searchParams.get('mode')||'product'));return;}
  if(p==='/qa-history-runtime.js'){res.setHeader('Content-Type','application/javascript');res.end(runtime);return;}
  if(p==='/favicon.ico'){res.statusCode=204;res.end();return;}
  const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});
 for(const width of [1280,1024,768,390,320])for(const lang of ['ja','en','zh'])for(const mode of ['product','box']){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
  await page.goto(url+'/?lang='+lang+'&mode='+mode);const list=page.locator('#finished-label-history-list'),rows=list.locator('.finished-label-history-row');assert.equal(await rows.count(),3);
  assert.equal(await rows.first().locator('.finished-label-history-main > .finished-label-history-serial').textContent(),'M2026-000015');
  assert.equal(await rows.first().locator('.finished-label-history-part-numbers dd').nth(0).textContent(),'31400-58J10');
  assert.equal(await rows.first().locator('.finished-label-history-part-numbers dd').nth(1).textContent(),'102211-5961');
  assert.equal(await rows.first().locator('.finished-label-history-part-numbers dt').nth(0).textContent(),await page.evaluate(()=>t('f_genuine_pn')));
  assert.equal(await rows.first().locator('.finished-label-history-part-numbers dt').nth(1).textContent(),await page.evaluate(()=>t('f_mfr_pn')));
  assert(!(await list.textContent()).includes('FB2026'));await verifyFit(page);
  const firstAction=mode==='product'?'[data-finished-label-history-preview]':'[data-finished-box-label-history-select]';
  await rows.first().locator(firstAction).focus();await page.keyboard.press('Enter');const action=await page.evaluate(()=>qaActions[qaActions.length-1]);assert.equal(action.id,15);assert.equal(action.action,mode==='product'?'reprint':'select');
  if(mode==='box')assert(await rows.first().evaluate(n=>n.classList.contains('active')));
  if(lang==='ja'&&[1280,390,320].includes(width))await page.locator('.finished-label-left > .finished-label-card').screenshot({path:path.join(output,'history-'+mode+'-'+width+'.png')});
  if(mode==='product'){
   await page.evaluate(()=>{qaJob={state:'printing',label:'Printing',message:'Fixture printing',active:true,showStationAction:false};renderFinishedLabelHistory();});assert(await rows.first().locator(firstAction).isDisabled());
   await page.evaluate(()=>{qaJob={state:'error',label:'Error',message:'Fixture retry',active:false,showStationAction:true};renderFinishedLabelHistory();});assert(!await rows.first().locator(firstAction).isDisabled());await rows.first().locator('[data-finished-label-open-station]').click();assert.equal(await page.evaluate(()=>qaActions[qaActions.length-1].mode),'station');
  }
  await page.evaluate(()=>{qaJob=null;finishedLabelHistoryRows=[qaDefaultRows()[0]];finishedLabelHistoryRows[0].finishedUnits.push({id:16,manufacturing_serial:'M2026-000016'});finishedLabelHistoryRows[0].quantity=2;finishedLabelHistoryRows[0].genuine_part_number_2='31400-58J11';finishedLabelHistoryRows[0].manufacturer_part_number='LONG-MANUFACTURER-PART-NUMBER-'.repeat(4);renderFinishedLabelHistory();});
  assert.equal(await rows.first().locator('.finished-label-history-serial').textContent(),'M2026-000015 ～ M2026-000016');assert.equal(await rows.first().locator('dd').first().textContent(),'31400-58J10 / 31400-58J11');await verifyFit(page);
  await page.evaluate(()=>{var r=finishedLabelHistoryRows[0];r.genuine_part_number=null;r.genuine_part_number_2=null;r.manufacturer_part_number='  ';r.finishedUnits=[];renderFinishedLabelHistory();});
  assert.equal(await rows.first().locator('.finished-label-history-serial').textContent(),'-');assert.deepEqual(await rows.first().locator('dd').allTextContents(),['-','-']);assert(await rows.first().locator(firstAction).isDisabled());assert(!(await list.textContent()).includes('FB2026'));
  const payload='<img src=x onerror="window.qaInjected=true">&';
  await page.evaluate(v=>{finishedLabelHistoryRows=qaDefaultRows();finishedLabelHistoryRows[0].genuine_part_number=v;finishedLabelHistoryRows[0].manufacturer_part_number=v;renderFinishedLabelHistory();},payload);assert.equal(await rows.first().locator('dd').first().textContent(),payload);assert.equal(await list.locator('img').count(),0);assert.equal(await page.evaluate(()=>!!window.qaInjected),false);
  await page.evaluate(()=>{finishedLabelHistoryRows=[];renderFinishedLabelHistory();});assert.equal(await list.textContent(),await page.evaluate(()=>t('finished_label_history_empty')));
  results.push({width,lang,mode,passed:true,states:['normal','actions','range-and-long-parts','missing','escaped','empty']});await page.close();
 }
 assert.deepEqual(errors,[]);assert(requests.every(u=>u.startsWith(url+'/')),'unexpected network request');
 fs.writeFileSync(path.join(output,'finished-label-history-results.json'),JSON.stringify({results,errors,onlySyntheticData:true,noBusinessWrites:true},null,2));console.log('Finished-label history browser QA: '+results.length+' viewport/language/mode cases passed');
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
