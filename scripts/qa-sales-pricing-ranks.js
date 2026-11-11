'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),acorn=require('acorn');
const {chromium}=require(process.env.WARRANTY_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.WARRANTY_QA_OUTPUT||path.join(root,'outputs','pricing-rank-qa');fs.mkdirSync(out,{recursive:true});
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),ast=acorn.parse(app,{ecmaVersion:'latest'});
function fn(name){const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return app.slice(n.start,n.end);}
const translations=ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations).find(n=>n.id.name==='TRANSLATIONS').init;
const start=html.indexOf('<div class="form-overlay" id="sales-pricing-overlay"'),end=html.indexOf('</dialog>',start)+9;assert(start>=0&&end>start);
const overlay=html.slice(start,end).replace('class="form-overlay"','class="form-overlay show"');
const fixture='var TRANSLATIONS='+app.slice(translations.start,translations.end)+';\n'+String.raw`var qaLang=new URLSearchParams(location.search).get('lang')||'ja',qaMode=new URLSearchParams(location.search).get('mode')||'normal',qaCalls=[];
var currentUser={id:'synthetic'},salesPricingCustomerCounts={HANBAIOU_URI_1:3},qaEditable=qaMode!=='readonly',qaAllowed=qaMode!=='denied';
function t(key){return TRANSLATIONS[qaLang][key]||TRANSLATIONS.ja[key]||key;}
function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function formatYen(n){return Number(n).toLocaleString('ja-JP');}function formatYenCurrency(n){return '¥'+formatYen(n);}
function canViewSalesPricing(){return qaAllowed;}function canManageSalesPricing(){return qaEditable&&qaAllowed;}function canViewBasePrice(){return qaAllowed;}
var salesPricingRanks=[['HANBAIOU_URI_3','売値区分+2',1.1],['HANBAIOU_URI_2','売値区分+1',1.05],['HANBAIOU_URI_1','売値区分1',1],['HANBAIOU_URI_4','売値区分-1',.95],['HANBAIOU_URI_5','売値区分-2',.9],['RECYCLE_FACTORING','ファクタリング',1]].map(r=>({rank_code:r[0],rank_name:r[1],rate_multiplier:r[2],amount_adjustment_jpy:0,rounding_unit_jpy:10,rounding_method:'round'}));
var qaOriginalOrder=JSON.stringify(salesPricingRanks);
var sb={rpc:async(name,args)=>{qaCalls.push({name,action:args.action});if(name!=='factoring_pricing'||args.action!=='get')throw Error('unexpected mutation');if(qaMode==='loading')await new Promise(r=>window.qaResolve=r);if(qaMode==='error')return {error:{message:'synthetic failure'}};return {data:{tax_rate_percent:10,factoring_rate_percent:6,sales_fee_rate_percent:10,shipping_allocation_rate_percent:1,rounding_unit_jpy:100,revision:1}};}};
`+'\n'+['salesRankDisplayName','calculateSalesPriceClient','renderSalesRankPreview','collectSalesRankSettingsFromForm'].map(fn).join('\n')+'\n'+String.raw`document.documentElement.lang=qaLang;
document.querySelectorAll('[data-i18n]').forEach(n=>n.textContent=t(n.dataset.i18n));
document.getElementById('sales-pricing-product').textContent='オルタネータ / DKD 28970 / 31400-58J10 / 102211-5961 / DENSO';
document.getElementById('sales-g-part-number').textContent='G-QA-10056';
document.getElementById('sales-product-kind').innerHTML='<option>リビルト</option>';
document.getElementById('sales-base-price').value='5800';document.getElementById('sales-effective-start').value='2026-09-25';
document.querySelector('[name="sales-core-return-required"][value="required"]').checked=true;
document.getElementById('sales-basis-note').value='Synthetic pricing layout check';
for(const [id,label,value] of [['manufacturing-cost','製造原価合計','¥3,793'],['ec-reference','ECモール相場','¥14,190'],['daiko-reference','大光サービス価格','¥8,100']])document.getElementById('sales-pricing-'+id).innerHTML='<span class="sales-pricing-reference-label">'+label+'</span><span class="sales-pricing-reference-value">'+value+'</span>';
document.getElementById('sales-base-price').addEventListener('input',()=>{renderSalesRankPreview();DcatsFactoringPricing.syncPreview();});
document.getElementById('btn-sales-pricing-save').disabled=!canManageSalesPricing();document.getElementById('btn-sales-rank-save').hidden=!canManageSalesPricing();
if(qaMode==='empty'){salesPricingRanks=[];renderSalesRankPreview();}else if(!qaAllowed){document.getElementById('sales-rank-preview').textContent=t('no_permission');}else{renderSalesRankPreview();DcatsFactoringPricing.open();}
window.qaReady=true;
`;
const shell='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><script defer src="/factoring-pricing.js"></script><script defer src="/fixture.js"></script></head><body>'+overlay+'</body></html>';
const files={'/':{type:'text/html',body:shell},'/fixture.js':{type:'text/javascript',body:fixture},'/factoring-pricing.js':{type:'text/javascript',body:fs.readFileSync(path.join(root,'factoring-pricing.js'))},'/styles.css':{type:'text/css',body:fs.readFileSync(path.join(root,'styles.css'))}};
const server=http.createServer((req,res)=>{const f=files[new URL(req.url,'http://localhost').pathname];if(!f){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':f.type,'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'",'Cache-Control':'no-store'});res.end(f.body);});
(async()=>{let browser;const results=[];try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true});const base='http://127.0.0.1:'+server.address().port;
 for(const [width,height] of [[1280,948],[1280,720],[1024,768],[390,844],[320,844]])for(const lang of ['ja','en','zh']){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/?lang='+lang);await page.waitForFunction(()=>window.qaReady&&DcatsFactoringPricing.preview(5800));
  const rows=page.locator('.sales-rank-table tr:not(:first-child)');assert.equal(await rows.count(),6);assert.equal(await rows.first().locator('.price-supplier').textContent(),'Recycle＋');assert.match(await rows.first().locator('.sales-rank-price').textContent(),/7,100/);
  assert.equal(await page.evaluate(()=>JSON.stringify(salesPricingRanks)===qaOriginalOrder),true);assert.equal(await page.locator('.sales-rank-rate').count(),5);assert.equal(await page.locator('.sales-rank-rate[data-rank-code="HANBAIOU_URI_1"]').isDisabled(),true);
  const bounds=await page.evaluate(()=>{const b=document.querySelector('.sales-pricing-body'),f=document.querySelector('.sales-pricing-footer'),r=[...document.querySelectorAll('.sales-rank-table tr')].at(-1);return {scroll:b.scrollHeight-b.clientHeight,bodyBottom:b.getBoundingClientRect().bottom,lastBottom:r.getBoundingClientRect().bottom,footer:f.getBoundingClientRect().bottom,horizontal:document.documentElement.scrollWidth>innerWidth};});assert.equal(bounds.horizontal,false);assert.ok(bounds.footer<=height);
  if(width>900){assert.ok(bounds.scroll<=1,JSON.stringify({width,height,lang,...bounds}));assert.ok(bounds.lastBottom<=bounds.bodyBottom);}
  await page.screenshot({path:path.join(out,'pricing-ranks-'+width+'x'+height+'-'+lang+'.png'),fullPage:true});
  await page.locator('#sales-base-price').fill('8000');await page.waitForFunction(()=>document.querySelector('.sales-rank-price').textContent.includes('9,800'));
  await page.locator('#factoring-open').scrollIntoViewIfNeeded();await page.locator('#factoring-open').click();assert.equal(await page.locator('#factoring-dialog').evaluate(n=>n.open),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#factoring-dialog').evaluate(n=>n.open),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'factoring-open');
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>qaCalls),[{name:'factoring_pricing',action:'get'}]);results.push({width,height,lang,...bounds});await page.close();
 }
 for(const mode of ['empty','loading','error','readonly','denied']){
  const page=await browser.newPage({viewport:{width:1280,height:720}});await page.goto(base+'/?mode='+mode);await page.waitForFunction(()=>window.qaReady);if(mode==='error')await page.waitForFunction(()=>document.getElementById('factoring-status').textContent.includes('取得できません'));
  if(mode==='empty'||mode==='denied')assert.equal(await page.locator('.sales-rank-table').count(),0);else{assert.equal(await page.locator('.sales-rank-table tr').count(),7);assert.equal(await page.locator('.price-supplier').first().textContent(),'Recycle＋');if(mode==='readonly')assert.equal(await page.locator('.sales-rank-rate').count(),0);if(mode==='loading'||mode==='error')assert.equal(await page.locator('.sales-rank-price').first().textContent(),'-');}
  if(mode==='readonly'||mode==='denied')assert.equal(await page.locator('#btn-sales-pricing-save').isDisabled(),true);
  assert.ok((await page.evaluate(()=>qaCalls)).every(c=>c.action==='get'));results.push({mode});await page.close();
 }
 fs.writeFileSync(path.join(out,'pricing-ranks-results.json'),JSON.stringify({passed:true,results},null,2));console.log('Sales pricing ranks browser QA passed: '+results.length+' scenarios');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
