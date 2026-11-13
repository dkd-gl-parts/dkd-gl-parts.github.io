"use strict";
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),acorn=require('acorn');
const root=path.resolve(__dirname,'..');
function fixtureFiles(){
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),ast=acorn.parse(app,{ecmaVersion:2022});
 const fn=name=>{let found;function visit(n){if(!n||typeof n!=='object'||found)return;if(n.type==='FunctionDeclaration'&&n.id.name===name){found=n;return;}for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}visit(ast);assert(found,name);return app.slice(found.start,found.end);};
 const dict=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='TRANSLATIONS'));assert(dict);
 const script=app.slice(dict.start,dict.end)+'\n'+['renderProductMasterDetailHtml','renderGltekPartNumberRow','renderAcPartRows'].map(fn).join('\n')+'\n'+String.raw`
 const params=new URLSearchParams(location.search),qaScreen=params.get('screen')||'sales',qaCategory=params.get('category')||'ac_compressor';
 function t(k){return TRANSLATIONS.ja[k]||k}
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function productDkdId(p){return p.dkd_shohin_id}
 function renderCatalogVehicleSummaryHtml(){return ''}function renderSpecPlaceholderRows(){return ''}
 const p={dkd_shohin_id:1,category_code:qaCategory,genuine_part_number:'88310-16060',genuine_body_part_number:'88320-16070, 88320-16071, 88320-16140',genuine_clutch_part_number:'88410-12300, 88410-16020, 88410-16021',genuine_part_number_2:'88320-16070, 88320-16071, 88320-16140',manufacturer:'DENSO',manufacturer_part_number:'447280-1230, 447280-1240',manufacturer_body_part_number:'447220-1230',manufacturer_clutch_part_number:'',gltek_part_number:'GL-12345'};
 const salesRows=qaCategory==='ac_compressor'?[['f_genuine_assy_pn',p.genuine_part_number],['f_genuine_body_pn',p.genuine_body_part_number],['f_genuine_clutch_pn',p.genuine_clutch_part_number]]:[['f_genuine_pn',p.genuine_part_number],['f_genuine_pn2',p.genuine_part_number_2]];
 const action="<button type='button' class='btn-sm-edit detail-inline-action' id='qa-components'>構成部品</button>";
 const sales="<div class='detail-main-grid'><div class='detail-column'><div class='ac-part-grid'>"+renderAcPartRows(salesRows)+renderGltekPartNumberRow(p)+"</div></div><div class='detail-column'><div class='ac-part-grid'>"+renderAcPartRows([['f_mfr_pn',p.manufacturer_part_number,action],['f_mfr_body_pn',p.manufacturer_body_part_number],['f_mfr_clutch_pn','']])+"</div></div></div>";
 document.getElementById('qa-host').innerHTML="<section id='"+(qaScreen==='sales'?'screen-search':'screen-production-search')+"' class='screen dcats-ui-screen active'><h1>"+(qaScreen==='sales'?'販売管理':'製造管理')+" 品番表示</h1>"+(qaScreen==='sales'?sales:renderProductMasterDetailHtml(p))+"<p id='qa-action-result'></p></section>";
 document.getElementById('qa-components')?.addEventListener('click',()=>{document.getElementById('qa-action-result').textContent='構成部品表示';});
 window.qaReady=true;
 `;
 return {'/qa.js':script,'/styles.css':fs.readFileSync(path.join(root,'styles.css')),'/qa.css':"body{background:#fff}#qa-host{max-width:840px;padding:12px;margin:auto}h1{font-size:16px;margin-bottom:14px}#qa-host.inherit-right{text-align:right}",'/':'<!doctype html><html lang="ja"><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/qa.css"><div id="qa-host"></div><script src="/qa.js"></script></html>'};
}
async function main(){
 const {chromium}=require(process.env.WARRANTY_PLAYWRIGHT_MODULE||'playwright');
 const out=path.join(process.env.WARRANTY_QA_OUTPUT||path.join(root,'outputs'),'part-number-alignment');fs.mkdirSync(out,{recursive:true});
 const files=fixtureFiles(),server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;if(!Object.hasOwn(files,p)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(files[p]);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;const results=[];
 try{browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 for(const screen of ['sales','production'])for(const width of [1280,390,320])for(const category of ['ac_compressor','alternator']){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:'+server.address().port+'/?screen='+screen+'&category='+category);await page.waitForFunction(()=>window.qaReady===true);
  for(const inherited of [false,true]){await page.evaluate(v=>document.getElementById('qa-host').classList.toggle('inherit-right',v),inherited);
   const cells=await page.locator('.ac-part-value').evaluateAll(nodes=>nodes.map(n=>{const s=n.querySelector('.ac-part-value-text'),r=n.getBoundingClientRect(),p=getComputedStyle(n),range=document.createRange();range.selectNodeContents(s);const text=range.getClientRects()[0],button=n.querySelector('button'),b=button?.getBoundingClientRect();return {text:s.textContent,align:getComputedStyle(s).textAlign,start:text?text.x-(r.x+parseFloat(p.paddingLeft)):0,rightOverflow:Math.max(0,s.getBoundingClientRect().right-r.right),buttonOverlaps:!!b&&s.getBoundingClientRect().right>b.x+.6,missing:s.textContent==='-'};}));
   assert(cells.length>=5);for(const c of cells){assert.equal(c.align,'left',JSON.stringify(c));assert(Math.abs(c.start)<1,JSON.stringify(c));assert(c.rightOverflow<1,JSON.stringify(c));assert(!c.buttonOverlaps,JSON.stringify(c));}
   results.push({screen,width,category,inheritedRight:inherited,cells:cells.length,passed:true});
  }
  await page.evaluate(()=>document.getElementById('qa-host').classList.remove('inherit-right'));
  if(screen==='sales'){await page.locator('#qa-components').click();assert.equal(await page.locator('#qa-action-result').textContent(),'構成部品表示');}
  await page.screenshot({path:path.join(out,screen+'-'+width+'-'+category+'.png'),fullPage:true});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({scenarios:results.length,results,errors},null,2));console.log('Part-number alignment browser QA: '+results.length+' scenarios passed (sales/production, PC/mobile, AC/standard, inherited alignment, component action).');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={fixtureFiles};
