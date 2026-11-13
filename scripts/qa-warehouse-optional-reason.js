const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.WARRANTY_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(process.env.WARRANTY_QA_OUTPUT || path.join(root, 'outputs'), 'warehouse-optional-reason');
fs.mkdirSync(out, {recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true});
  const results = [];
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('https://warehouse-qa.invalid/**', route => route.fulfill({contentType:'text/html', body:'<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><button id="btn-warehouse-stock-open">Warehouse</button></body></html>'}));
    for (const width of [1280,390,320]) for (const lang of ['ja','en','zh']) {
      await page.setViewportSize({width,height:960});
      await page.goto('https://warehouse-qa.invalid/');
      await page.addStyleTag({content:fs.readFileSync(path.join(root,'styles.css'),'utf8')});
      await page.addStyleTag({content:fs.readFileSync(path.join(root,'warehouse-stock.css'),'utf8')});
      await page.evaluate(({lang}) => {
        window.currentLang=lang;
        window.userProfile={id:'synthetic-warehouse-actor'};
        window.canViewProductKindStockMgmt=()=>true;
        window.showScreen=id=>document.getElementById('screen-'+id)?.classList.add('active');
        window.calls=[];window.failure=false;
        window.fixture={can_manage:true,locations:[{code:'GLS-21',type:'pallet'},{code:'T03-04',type:'shelf'}],variants:[{variant_id:'10',product_id:'1',kind:'rebuilt',genuine_part_number:'QA-STARTER-001',stock_qty:10,allocated_qty:4,unassigned_qty:6}],positions:[{id:'00000000-0000-4000-8000-000000000010',variant_id:'10',location:'GLS-21',source_reference:'GLS-21',container_round:2,quantity:4,revision:'1'}],history:[]};
        window.sb={rpc:async(name,args)=>{if(name==='get_warehouse_stock')return {data:structuredClone(fixture),status:200};calls.push({name,args});return failure?{error:{message:'Synthetic network failure'},status:0}:{data:{request_id:args.p_request_id},status:200};}};
      },{lang});
      await page.addScriptTag({content:fs.readFileSync(path.join(root,'warehouse-stock.js'),'utf8')});
      await page.locator('#btn-warehouse-stock-open').click();
      await page.waitForFunction(()=>!!DcatsWarehouseStock._state.snapshot);
      await page.evaluate(()=>{DcatsWarehouseStock._state.selected='10';DcatsWarehouseStock._render();});
      for (const operation of ['allocate','transfer','release','recount']) {
        await page.evaluate(operation=>DcatsWarehouseStock._openDialog(operation,operation==='allocate'?undefined:fixture.positions[0].id),operation);
        assert.equal(await page.locator('#warehouse-note').getAttribute('required'),null);
        assert.match(await page.locator('label.warehouse-field').filter({has:page.locator('#warehouse-note')}).textContent(), /任意|optional|选填/);
        const bounds=await page.locator('#warehouse-dialog').boundingBox();
        assert(bounds && bounds.x>=0 && bounds.x+bounds.width<=width+1,'dialog fits viewport');
        await page.locator('#warehouse-quantity').fill(operation==='recount'?'0':'1');
        if(operation==='allocate'||operation==='transfer')await page.locator('#warehouse-destination').selectOption('T03-04');
        if(lang==='ja')await page.screenshot({path:path.join(out,width+'-'+operation+'.png'),fullPage:true});
        const before=await page.evaluate(()=>calls.length);
        await page.locator('[data-wh-submit]').click();
        await page.waitForFunction(n=>calls.length===n+1,before);
        assert.equal(await page.evaluate(()=>calls.at(-1).args.p_payload.note),'');
        await page.waitForFunction(()=>!DcatsWarehouseStock._state.working);
        assert.equal(await page.locator('#warehouse-dialog').evaluate(e=>e.open),false);
        results.push({width,lang,operation,blankSaved:true});
      }
      await page.evaluate(()=>DcatsWarehouseStock._openDialog('transfer',fixture.positions[0].id));
      await page.locator('#warehouse-quantity').fill('5');
      await page.locator('#warehouse-destination').selectOption('T03-04');
      const before=await page.evaluate(()=>calls.length);
      await page.locator('[data-wh-submit]').click();
      assert.equal(await page.evaluate(()=>calls.length),before,'excess quantity cannot write');
      assert((await page.locator('#warehouse-dialog-status').textContent()).length>0);
      await page.locator('#warehouse-quantity').fill('1');
      await page.locator('#warehouse-note').fill('  memo  ');
      await page.evaluate(()=>failure=true);
      await page.locator('[data-wh-submit]').click();
      await page.waitForFunction(()=>!DcatsWarehouseStock._state.working);
      assert.equal(await page.evaluate(()=>calls.at(-1).args.p_payload.note),'memo');
      assert.equal(await page.evaluate(()=>!!DcatsWarehouseStock._state.pending),true,'unknown result stays locked');
      await page.evaluate(()=>DcatsWarehouseStock._submit());
      assert.equal(await page.evaluate(()=>calls.length),before+1,'unknown result is never resent');
      await page.evaluate(()=>{DcatsWarehouseStock._state.pending=null;fixture.can_manage=false;DcatsWarehouseStock._state.snapshot=structuredClone(fixture);DcatsWarehouseStock._render();DcatsWarehouseStock._openDialog('transfer',fixture.positions[0].id);});
      assert.equal(await page.locator('#warehouse-dialog').evaluate(e=>e.open),false,'viewer cannot open mutation');
    }
    assert.deepEqual(errors,[],'no browser errors');
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,results},null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
