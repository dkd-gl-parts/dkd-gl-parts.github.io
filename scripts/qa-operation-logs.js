const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.WARRANTY_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/\r\n/g,'\n');
function extract(name){const start=source.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0);const end=source.indexOf('\n}\n',start);return source.slice(start,end+2);}
const functions=['formatYen','formatYenCurrency','operationLogText','operationLogFieldLabel','operationLogValue','operationLogChanges','operationLogDetailsHtml','renderLogs','loadLogs'].map(extract).join('\n');
const out=path.join(process.env.WARRANTY_QA_OUTPUT||path.join(root,'outputs'),'operation-logs');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results=[];
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  for(const width of [1280,390,320]) for(const lang of ['ja','en','zh']){
   await page.setViewportSize({width,height:900});
   const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const start=html.indexOf('<div id="screen-logs"');const end=html.indexOf('\n<!--',start);
   await page.setContent('<!doctype html><html lang="'+lang+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>'+html.slice(start,end)+'</body></html>');
   await page.addStyleTag({content:fs.readFileSync(path.join(root,'styles.css'),'utf8')});
   await page.addScriptTag({content:`var currentLang=${JSON.stringify(lang)};var userProfile={id:'qa'};var allowed=true;var rows=[];function t(k){return ({loading:'Loading',log_no_data:'No logs',log_insert:'追加',log_update:'修正',log_delete:'削除',log_date:'日時',log_operation:'操作',log_user:'操作者',log_target:'対象'})[k]||k;}function productKindLabel(k){return k;}function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}function canViewOperationLogs(){return allowed;}function showPermissionDenied(){document.getElementById('logs-list').textContent='Permission denied';}var sb={from:()=>({select:()=>({order:()=>({limit:async()=>({data:rows})})})})};\n${functions}\ndocument.getElementById('screen-logs').classList.add('active');`});
   await page.evaluate(()=>{
    rows=[{operation:'update',table_name:'product_rank1_prices',target_desc:'QA 27060-TEST',user_name:'QA',before_data:{price_jpy:12000,source_type:'manual',note:'旧価格'},after_data:{price_jpy:13000,source_type:'cost_list',note:'原価の見直し'}},{operation:'update',table_name:'sales_price_ranks',target_desc:'RANK1',before_data:{rate_multiplier:1,amount_adjustment_jpy:0,rounding_unit_jpy:10,rounding_method:'floor',is_active:false,note:'旧'},after_data:{rate_multiplier:0.8,amount_adjustment_jpy:100,rounding_unit_jpy:100,rounding_method:'round',is_active:true,note:'<script>sample</script>'}},{operation:'update',table_name:'core_product_variants',target_desc:'QA stock',before_data:{stock_qty:24,stock_note:null},after_data:{stock_qty:20,stock_note:'棚卸による数量修正'}}];rows.push({operation:"update",table_name:"core_product_variants",target_desc:"QA unchanged",before_data:{stock_qty:24},after_data:{stock_qty:24}});renderLogs(rows);
   });
   assert.ok(await page.locator('.log-details').first().innerText().then(x=>x.includes('12,000')&&x.includes('13,000')));
   assert.equal(await page.locator('.log-details script').count(),0);
   assert.ok((await page.locator('.log-details').last().innerText()).includes(lang==='ja'?'変更なし':lang==='zh'?'未更改':'No values changed'));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,'whole page overflow');
   const more=page.locator('.log-change-more').first();await more.locator('summary').focus();await page.keyboard.press('Enter');assert.ok(await more.getAttribute('open')!==null);assert.ok((await more.innerText()).includes('<script>sample</script>'));
   await page.screenshot({path:path.join(out,`${lang}-${width}-success.png`),fullPage:true});
   await page.evaluate(()=>renderLogs([]));assert.ok((await page.locator('#logs-list').innerText()).includes('No logs'));
   await page.evaluate(async()=>{sb={from:()=>({select:()=>({order:()=>({limit:async()=>({error:{message:'offline'}})})})})};await loadLogs();});assert.ok((await page.locator('#logs-list').innerText()).length>15);
   await page.evaluate(async()=>{allowed=false;await loadLogs();});assert.equal(await page.locator('#logs-list').innerText(),'Permission denied');
   await page.evaluate(async()=>{allowed=true;sb={from:()=>({select:()=>({order:()=>({limit:async()=>{userProfile={id:'new-session'};return {data:rows};}})})})};await loadLogs();});assert.equal(await page.locator('.log-table').count(),0,'stale actor must not render logs');
   results.push({width,lang,states:['success','expanded','empty','error','unauthorized','changed-session'],passed:true});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,results,consoleErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
