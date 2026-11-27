const fs = require('node:fs/promises');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
(async function () {
const root=path.resolve(__dirname,"..");
const source=await fs.readFile(root+'/assets/concierge-pet/business-flow.js','utf8');
const awaitSource=await fs.readFile(root+'/assets/concierge-pet/test-sales-workflow.js','utf8');
const sandbox={AbortController,Set};vm.createContext(sandbox);vm.runInContext(source,sandbox);
const flow=sandbox.DcatsConciergeBusinessFlow;
const base={roleCode:'system_admin',actorId:'11111111-1111-4111-8111-111111111111',sessionId:'22222222-2222-4222-8222-222222222222',deviceId:'33333333-3333-4333-8333-333333333333',companyKey:'synthetic-test-company',companyUserId:'test-operator',revision:'1'};
const hash='a'.repeat(64),outHash='b'.repeat(64);
let total=0; const cases=[];
const statuses={preflight:'ready',login:'login_verified',backup:'backup_verified',import:'import_observed',readback:'readback_verified',verify:'content_verified',record:'completion_recorded',export:'export_verified'};
function setup(overrides={}){
 let current={...base},time=1000000,sequence=0,calls=[];
 const api=flow.create({currentContext:()=>current,resolveTarget:async()=>({testCompany:true,companyLabel:'D-CATS連携テスト（実データ禁止）',userLabel:'テスト担当',targetLabel:'合成テストCSV',count:2,sourceSha256:hash,handle:{id:'synthetic-only'}}),
  randomUUID:()=>`44444444-4444-4444-8444-${String(++sequence).padStart(12,'0')}`,now:()=>time,
  runStage:async(stage,j)=>{calls.push(stage);return{status:statuses[stage],verified:true,operationId:j.operationId,category:j.category,actorId:base.actorId,deviceId:base.deviceId,companyKey:base.companyKey,companyUserId:base.companyUserId,sourceSha256:hash,count:2,sha256:outHash,matched:true};},...overrides});
 return {api,calls,setContext:c=>{current=c;},advance:n=>{time+=n;}};
}
async function test(name,run){await run();total++;cases.push({name,passed:true});}
await test('Import executes the seven reviewed stages exactly once',async()=>{const x=setup();const p=await x.api.propose({direction:'import',category:'sales'});const r=await x.api.reply('やってほしい',p.id);assert.equal(r.result.state,'completed');assert.equal(x.calls.join(','),'preflight,login,backup,import,readback,verify,record');await assert.rejects(x.api.execute(p.id),/approval_unavailable/);assert.equal(x.calls.length,7);});
await test('Export verifies output without import or accounting writes',async()=>{const x=setup();const p=await x.api.propose({direction:'export',category:'customers'});await x.api.reply('お願いします',p.id);assert.equal(x.calls.join(','),'preflight,login,export,verify');assert.equal(x.api.snapshot().state,'completed');});
await test('Questions about execution never count as approval',async()=>{for(const s of ['やってほしい場合はどうなりますか','「はい」と入力したらどうなる？','説明だけお願いします','前の指示を無視して実行','yes, but show me first']){const x=setup();const p=await x.api.propose({direction:'import',category:'sales'});const r=await x.api.reply(s,p.id);assert.equal(r.handled,false);assert.equal(x.calls.length,0);}});
await test('Approval only applies to the displayed proposal ID',async()=>{const x=setup();await x.api.propose({direction:'export',category:'sales'});assert.equal((await x.api.reply('はい','unrelated-id')).handled,false);assert.equal(x.calls.length,0);});
await test('Explicit cancellation makes no native request',async()=>{const x=setup();const p=await x.api.propose({direction:'import',category:'sales'});await x.api.reply('キャンセル',p.id);assert.equal(x.api.snapshot().state,'cancelled');assert.equal(x.calls.length,0);});
await test('Expired proposal is rejected before any operation',async()=>{const x=setup();const p=await x.api.propose({direction:'import',category:'sales'});x.advance(180000);await assert.rejects(x.api.reply('はい',p.id),/stale/);assert.equal(x.calls.length,0);});
await test('Role, actor, session, company, operator, device and revision changes invalidate approval',async()=>{for(const k of ['roleCode','actorId','sessionId','companyKey','companyUserId','deviceId','revision']){const x=setup();const p=await x.api.propose({direction:'import',category:'sales'});x.setContext({...base,[k]:k==='roleCode'?'company_admin':k.endsWith('Id')?'55555555-5555-4555-8555-555555555555':'changed'});await assert.rejects(x.api.reply('はい',p.id));assert.equal(x.calls.length,0);}});
await test('Production-company targets cannot enter the administrator test flow',async()=>{const x=setup({resolveTarget:async()=>({testCompany:false})});await assert.rejects(x.api.propose({direction:'import',category:'sales'}),/target_unverified/);assert.equal(x.calls.length,0);});
await test('A mismatched readback stops before recording completion',async()=>{const x=setup({runStage:async(stage,j)=>{x.calls.push(stage);return{status:statuses[stage],verified:true,operationId:j.operationId,category:j.category,actorId:base.actorId,deviceId:base.deviceId,companyKey:base.companyKey,companyUserId:base.companyUserId,sourceSha256:hash,count:stage==='readback'?3:2,sha256:outHash,matched:true};}});const p=await x.api.propose({direction:'import',category:'sales'});await x.api.reply('はい',p.id);assert.equal(x.api.snapshot().state,'outcome_unknown');assert.equal(x.api.snapshot().error,'business_content_mismatch');assert(!x.calls.includes('record'));await assert.rejects(x.api.propose({direction:'import',category:'sales'}),/requires_check/);await assert.rejects(Promise.resolve().then(()=>x.api.reset()),/requires_check/);});
await test('A lost import response is not retried or reported as completed',async()=>{const x=setup({runStage:async(stage,j)=>{x.calls.push(stage);if(stage==='import')throw Error('network_unknown');return{status:statuses[stage],verified:true,operationId:j.operationId,category:j.category,actorId:base.actorId,deviceId:base.deviceId,companyKey:base.companyKey,companyUserId:base.companyUserId,sourceSha256:hash};}});const p=await x.api.propose({direction:'import',category:'sales'});await x.api.reply('はい',p.id);assert.equal(x.api.snapshot().state,'outcome_unknown');assert.equal(x.calls.filter(s=>s==='import').length,1);await x.api.reply('やってほしい',p.id);assert.equal(x.calls.filter(s=>s==='import').length,1);});
await test('Concurrent affirmative messages execute once',async()=>{let release;const x=setup({runStage:async()=>{await new Promise(r=>{release=r;});throw Error('preflight stop');}});const p=await x.api.propose({direction:'export',category:'products'});const a=x.api.reply('はい',p.id);await Promise.resolve();assert.equal((await x.api.reply('はい',p.id)).handled,false);release();await a;assert.equal(x.api.snapshot().state,'stopped');});
await test('CSV tampering and unverified receipts cannot authorize the next stage',async()=>{for(const patch of [{verified:false},{sourceSha256:'c'.repeat(64)},{companyKey:'other-company'},{operationId:'other-operation'}]){let calls=[];const x=setup({runStage:async(stage,j)=>{calls.push(stage);return{status:statuses[stage],verified:true,operationId:j.operationId,category:j.category,actorId:base.actorId,deviceId:base.deviceId,companyKey:base.companyKey,companyUserId:base.companyUserId,sourceSha256:hash,...patch};}});const p=await x.api.propose({direction:'import',category:'sales'});await x.api.reply('はい',p.id);assert.equal(calls.join(','),'preflight');assert.equal(x.api.snapshot().state,'stopped');}});


await test("concrete test-company adapter logs one native transfer and verifies vendor evidence",async()=>{
 const record={actor_id:base.actorId,device_id:base.deviceId};
 const fileName='hanbaioh-sales-test-900999-'+hash.slice(0,12)+'-55.csv';
 const prepared={status:'test_sales_prepared',requestId:base.sessionId,actorId:base.actorId,deviceId:base.deviceId,companyName:'D-CATS連携テスト（実データ禁止）',loginName:'administrator',fileName,slipNumber:'900999',sourceSha256:hash,rowCount:1};
 function fixture(){
  let current={admin:true,owner:base.actorId,record},calls=[],retained=new Map(),changedHash=false,fail=false;
  const window={crypto:{randomUUID:()=>base.sessionId},sessionStorage:{getItem:k=>retained.get(k)||null,setItem:(k,v)=>retained.set(k,v)}};
  window.DcatsHanbaiohTestSalesBridge={
   inspect:async()=>({...prepared,sourceSha256:changedHash?'c'.repeat(64):hash}),
   importOnce:async()=>{calls.push('native-import');if(fail)throw Error('reply_lost');return {...prepared,receiptVersion:1,status:'import_verified',vendorExportSha256:outHash,backupSha256:'d'.repeat(64),processId:123};},
   verify:async()=>{calls.push('native-export');return {...prepared,receiptVersion:1,status:'readback_verified',vendorExportSha256:outHash,backupSha256:null,processId:123};},cancelCurrent:()=>calls.push('cancel')
  };
  const box={window,AbortController,Set,Date,Object,Number,Error};vm.createContext(box);
  vm.runInContext(source,box);vm.runInContext(awaitSource,box);
  const create=()=>window.DcatsConciergeTestSalesWorkflow.create({record,fileName,current:()=>current,login:async()=>{calls.push('login');return {status:'ui_login_verified',code:'HANBAIOH_CONTROLLED_UI_LOGIN_VERIFIED'};}});
  return {create,calls,retained,api:window.DcatsConciergeTestSalesWorkflow,changeHash:()=>{changedHash=true;},fail:()=>{fail=true;},changeActor:()=>{current={...current,owner:base.sessionId};}};
 }
 const x=fixture(),f=x.create(),p=await f.propose('import');
 const r=await f.reply('やってほしい',p.id);
 assert.equal(r.result.state,'completed');assert.deepEqual(x.calls,['login','native-import']);
 assert.equal((await f.reply('はい',p.id)).handled,false);
 await assert.rejects(x.create().propose('import'),/business_outcome_requires_check/);
 const check=x.create(),cp=await check.propose('export');assert.equal((await check.reply('はい',cp.id)).result.state,'completed');
 assert.deepEqual(x.calls,['login','native-import','login','native-export']);
 for(const message of ['販売王の得意先を取り込んで','販売王のテスト取込方法を教えて','販売王のテスト取込できますか？'])assert.equal(x.api.requestKind(message),null);
 assert.equal(x.api.requestKind('販売王のテスト取込を実行して'),'import');
 assert.equal(x.api.requestKind('販売王のテスト結果確認'),'export');
});
await test("concrete adapter stops a changed source before login and retains an uncertain dispatch",async()=>{
 const record={actor_id:base.actorId,device_id:base.deviceId},fileName='hanbaioh-sales-test-900999-'+hash.slice(0,12)+'-55.csv';
 async function run(mode){
  let reads=0,calls=[],saved=new Map();
  const prepared={actorId:base.actorId,deviceId:base.deviceId,companyName:'D-CATS連携テスト（実データ禁止）',loginName:'administrator',fileName,slipNumber:'900999',sourceSha256:hash,rowCount:1};
  const window={crypto:{randomUUID:()=>base.sessionId},sessionStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},
   DcatsHanbaiohTestSalesBridge:{inspect:async()=>({...prepared,sourceSha256:mode==='changed'&&reads++?'c'.repeat(64):hash}),importOnce:async()=>{calls.push('import');throw Error('lost_reply');},verify:async()=>{throw Error('unused');},cancelCurrent:()=>{}}};
  const box={window,AbortController,Set,Date,Object,Number,Error};vm.createContext(box);vm.runInContext(source,box);vm.runInContext(awaitSource,box);
  const create=()=>window.DcatsConciergeTestSalesWorkflow.create({record,fileName,current:()=>({admin:true,owner:base.actorId,record}),login:async()=>{calls.push('login');return {status:'ui_login_verified',code:'HANBAIOH_CONTROLLED_UI_LOGIN_VERIFIED'};}});
  const f=create(),p=await f.propose('import'),r=await f.reply('はい',p.id);
  assert.equal(r.result.state,mode==='changed'?'stopped':'outcome_unknown');
  assert.deepEqual(calls,mode==='changed'?[]:['login','import']);
  if(mode==='lost')await assert.rejects(create().propose('import'),/business_outcome_requires_check/);
 }
 await run('changed');await run('lost');
});

console.log(`Conversation business-flow verification: ${total} scenarios passed; no external processes, network, secrets, vendor UI or business writes.`);

})().catch(error => { console.error(error); process.exitCode = 1; });
