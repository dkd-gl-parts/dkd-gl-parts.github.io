"use strict";
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {fixtureFiles}=require('../tests/shipping-print-actions.cjs');
async function main(){
 const {chromium}=require(process.env.WARRANTY_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..'),out=path.join(process.env.WARRANTY_QA_OUTPUT||path.join(root,'outputs'),'shipping-print-actions');fs.mkdirSync(out,{recursive:true});
 const files=fixtureFiles(root),server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;if(!Object.hasOwn(files,p)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(files[p]);});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[],errors=[];
 try{browser=await chromium.launch({headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:'+server.address().port+'/');
  assert(await page.evaluate(()=>checkSalesOrderPrintReadiness()));assert(await page.locator('[data-order-print-readiness]').evaluate(n=>n.classList.contains('ready')));await page.evaluate(()=>resetQa('printed','ready'));
  const settings=page.locator('[data-shipping-document-open-settings]'),print=page.locator('[data-shipping-document-queue]');assert.equal(await print.textContent(),'印刷');assert.equal(await page.locator('#qa-state').textContent(),'印刷済み');
  await settings.click();assert(await page.locator('#shipping-document-settings-overlay').evaluate(n=>n.classList.contains('show')));assert.equal(await page.evaluate(()=>calls.length),0);assert.equal(await page.locator('#qa-state').textContent(),'印刷済み');
  await page.locator('#shipping-document-temporary-apply').click();assert.equal(await page.evaluate(()=>calls.length),0);assert.equal(await page.locator('#qa-state').textContent(),'印刷済み');
  await settings.focus();await page.keyboard.press('Enter');await page.locator('#qa-settings-close').click();assert.equal(await page.evaluate(()=>calls.length),0);
  await page.evaluate(async()=>{resetQa('printed','stopped');await checkSalesOrderPrintReadiness()});assert(await page.locator('[data-order-print-readiness]').evaluate(n=>n.classList.contains('stopped')));await print.click();await page.waitForFunction(()=>!shippingDocumentSaving);assert.equal(await page.evaluate(()=>calls.filter(x=>x.name.startsWith('queue_')).length),0);assert.equal(await page.locator('#qa-state').textContent(),'印刷済み');assert((await page.locator('#shipping-document-message').textContent()).includes('停止中'));
  await page.screenshot({path:path.join(out,'offline-'+width+'.png'),fullPage:true});
  await page.evaluate(()=>resetQa('queued','stopped'));assert(await print.isDisabled());await settings.click();assert.equal(await page.evaluate(()=>calls.length),0);await page.locator('#qa-settings-close').click();assert.equal(await page.locator('#qa-state').textContent(),'印刷待ち');assert((await page.locator('[data-shipping-document-print-notice]').textContent()).includes('待機中'));await page.screenshot({path:path.join(out,'pending-'+width+'.png'),fullPage:true});
  await page.evaluate(()=>resetQa('printed','ready'));await print.click();await page.waitForFunction(()=>!shippingDocumentSaving);assert.equal(await page.evaluate(()=>calls.filter(x=>x.name.startsWith('queue_')).length),1);assert(await print.isDisabled());assert.equal(await page.locator('#qa-state').textContent(),'印刷待ち');
  await page.evaluate(()=>{resetQa('printed','ready');queueBehavior='throw'});await print.click();await page.waitForFunction(()=>!shippingDocumentSaving);assert.equal(await page.locator('#qa-state').textContent(),'印刷済み');assert((await page.locator('#shipping-document-message').textContent()).includes('再送せず'));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,'horizontal overflow '+width);results.push({width,settingsUnchanged:true,offlineNoQueue:true,pendingNoDuplicate:true,onlineSingleQueue:true,unknownNoRetry:true,keyboard:true,startupCheck:true,offlineRecoveryVisible:true,overflow:false});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({results,errors,physicalPrinting:false},null,2));console.log('Shipping print actions browser QA: '+results.length+' widths passed.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={main};
