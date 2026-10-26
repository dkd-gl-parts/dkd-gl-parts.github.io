const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const source=fs.readFileSync(path.join(__dirname,'../recycle-accounting.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const build=fs.readFileSync(path.join(__dirname,'build-static-site.js'),'utf8');
const wait=()=>new Promise(r=>setTimeout(r,10));
async function fixture({admin=true,enabled=true,pkg=null}={}){
 const {document,window}=parseHTML('<html><body><main id="host"></main></body></html>');
 let calls=[],permission=true,mode='',verified=false,downloaded=0;
 const ctx={document,console,Set,String,Array,Object,Blob,TextDecoder,crypto:require('node:crypto').webcrypto,
  currentUser:{id:'QA-A'},isSystemAdmin:()=>admin,canManageSalesOrders:()=>permission,
  confirm:()=>true,prepareDcatsHanbaiouExportDirectory:async()=>({syntheticDirectory:true}),downloadSalesAccountingExportFile:async(data,directory)=>{assert.equal(directory.syntheticDirectory,true);downloaded++;},
  sb:{rpc:async(name,args)=>{assert.equal(name,'recycle_accounting_workspace');calls.push(structuredClone(args));
   const action=args.target_action;
   if(mode==='network' && action==='prepare')throw new Error('ネットワーク切断');
   if(mode==='denied' && action==='prepare')return {error:{code:'42501',message:'権限なし'}};
   if(mode==='wait' && action==='get')await new Promise(r=>setTimeout(r,30));
   if(action==='get')return {data:{order_id:1,can_configure:admin,enabled,package:pkg}};
   if(action==='config')return {data:{revision:1,external_customer_code:'QA-BL',verification_note:'合成台帳確認',enabled}};
   if(action==='result')return {data:{found:verified,response:{order_id:1}}};
   return {data:{order_id:1,content_base64:'cWE='}};
  }}
 };ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
 const host=document.getElementById('host');
 const mount=()=>ctx.DcatsRecycleAccounting.mount({id:1,recycle:{}},host);
 const click=async(action)=>{const b=host.querySelector('[data-ra-action="'+action+'"]');assert(b,'missing '+action);b.dispatchEvent(new window.Event('click',{bubbles:true}));await wait();};
 mount();await wait();
 return {ctx,host,click,mount,calls,setMode:x=>mode=x,setVerified:()=>verified=true,setPermission:x=>permission=x,getDownloaded:()=>downloaded};
}
(async()=>{
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
 assert(index.indexOf('recycle-accounting.js')<index.indexOf('recycle-orders.js'));checks++;
 assert(build.includes('"recycle-accounting.js"'));checks++;
 let f=await fixture();eq(!!f.host.querySelector('[data-ra-action="config"]'),true);
 eq(f.host.textContent.includes('売上総額'),true);eq(f.host.querySelector('[data-ra-field="received-on"]').value,'');
 f.host.querySelector('[data-ra-field="received-amount"]').dispatchEvent(new (parseHTML('<html></html>').window.Event)('input',{bubbles:true}));
 eq(f.ctx.DcatsRecycleAccounting.isBusy(),true);eq(f.host.querySelector('[data-ra-action="reload"]').disabled,true);
 f.setMode('network');await f.click('prepare');eq(f.host.textContent.includes('結果を確認するまで再送できません'),true);
 const prepare=f.calls.filter(c=>c.target_action==='prepare');eq(prepare.length,1);assert(prepare[0].target_request_id);checks++;
 eq(f.host.querySelector('[data-ra-action="prepare"]').disabled,true);await f.click('result');eq(f.host.textContent.includes('再送せず'),true);
 f.host.innerHTML='';f.mount();await wait();eq(f.host.querySelector('[data-ra-action="prepare"]').disabled,true);
 f.setVerified();await f.click('result');eq(f.ctx.DcatsRecycleAccounting.isBusy(),false);
 eq(f.calls.filter(c=>c.target_action==='prepare').length,1);
 f=await fixture({admin:false});eq(f.host.querySelector('[data-ra-action="config"]'),null);eq(f.calls.some(c=>c.target_action==='config'),false);
 f.setMode('denied');await f.click('prepare');eq(f.host.textContent.includes('権限なし'),true);eq(f.host.querySelector('[data-ra-action="prepare"]').disabled,false);
 f.setPermission(false);const prior=f.calls.length;await f.click('prepare');eq(f.calls.length,prior);
 f=await fixture({enabled:false});eq(f.host.textContent.includes('無効'),true);
 const pkg={financial_snapshot:{gross_jpy:11000,fee_jpy:1000,net_jpy:10000,sale_date:'2026-10-02',received_on:'2026-10-01',sales_voucher:'RCS0000000001',receipts_voucher:'RCR0000000001'},sales_state:'unknown',receipts_state:'pending'};
 f=await fixture({pkg});eq(f.host.querySelector('[data-ra-action="prepare"]'),null);eq(f.host.textContent.includes('結果未確認・再取込しない'),true);eq(f.host.textContent.includes('前受'),true);
 // linkedom does not supply the browser's first-option default select.value.
 // The actual selected value is also checked in the non-visible IAB QA.
 eq(f.host.querySelector('[data-ra-field="format-sales"] option').getAttribute('value'),'sales_standard_55');
 eq(f.host.querySelector('[data-ra-action="download_receipts"]'),null);await f.click('download_sales');eq(f.getDownloaded(),1);eq(f.calls.at(-1).target_action,'download');
 pkg.sales_state='verified';f=await fixture({pkg});eq(!!f.host.querySelector('[data-ra-action="download_receipts"]'),true);
 await f.click('readback_receipts');eq(f.host.textContent.includes('CSVを選択'),true);
 const upload=f.host.querySelector('[data-ra-field="file-receipts"]'),body=new TextEncoder().encode('合成の独立入金CSV\r\n');
 Object.defineProperty(upload,'files',{value:[{size:body.length,arrayBuffer:async()=>body.buffer}]});
 f.host.querySelector('[data-ra-field="reference-receipts"]').value='合成・販売王から独立に出力';
 await f.click('readback_receipts');eq(f.calls.find(c=>c.target_action==='readback').target_payload.export_format,'receipts_13');
 eq(f.calls.find(c=>c.target_action==='readback').target_payload.file_text,'合成の独立入金CSV\r\n');
 pkg.receipts_state='verified';pkg.reconciled_at='2026-10-26';f=await fixture({pkg});eq(f.host.querySelector('[data-ra-action="reconcile"]'),null);eq(f.host.textContent.includes('担当者が確認'),true);
 f=await fixture();f.setMode('wait');f.host.innerHTML='';f.mount();f.ctx.currentUser={id:'QA-B'};await new Promise(r=>setTimeout(r,40));eq(f.host.textContent.includes('読み込んでいます'),true);
 const early={window:{},document:{},console};vm.createContext(early);vm.runInContext(source,early);eq(early.window.DcatsRecycleAccounting.isBusy(),false);
 console.log(JSON.stringify({feature:'recycle-accounting-ui',checks,passed:true,nativeVerified:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
