"use strict";
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),acorn=require('acorn');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const runtime=fs.readFileSync(path.join(root,'assets/concierge-pet/integration-readiness.js'),'utf8');
const actor='00000000-0000-4000-8000-000000000001',device='00000000-0000-4000-8000-000000000002';
const record={actor_id:actor,device_id:device,public_key_sha256:'a'.repeat(64),public_key_spki:'-----BEGIN PUBLIC KEY-----\n'+'A'.repeat(300)};
const fullChecks={identity:'available',syncFolder:'available',driveConfiguration:'available',driveAuthorization:'available',backupPassword:'available',recovery:'available',backupAdapter:'available'};
function readiness(checks={}){const all={...fullChecks,...checks};return {status:'production_backup_prerequisites',actorId:actor,deviceId:device,ready:Object.values(all).every(v=>v==='available'),checks:all};}
function harness(options={}){
  const window={},calls=[],storage=options.storage||new Map();let current=true,allowed=true;
  vm.runInNewContext(runtime,{window,Object,Array,Number,Promise,Error,Date});
  const engine=window.DcatsIntegrationReadiness.create({storage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},isAllowed:id=>allowed&&id===actor,
    probe:async()=>{calls.push('extension');return {version:options.version||'0.5.16'};},
    readDevice:async()=>{calls.push('device');if(options.failDevice)throw Error(options.failDevice);return {...record,...options.device};},
    readReadiness:async()=>{calls.push('readiness');if(options.leaveDuringRead)current=false;return options.readiness||readiness(options.checks);},onChange:()=>{}});
  engine.setOwner(actor);
  return {engine,calls,storage,options:{isCurrent:()=>current},leave:()=>{current=false;},deny:()=>{allowed=false;}};
}
const tree=acorn.parse(source,{ecmaVersion:'latest'}),pick=name=>{const node=tree.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(node,name);return source.slice(node.start,node.end);};
function uiHarness(options={}){
  const h=harness(options),business=[],status={textContent:'',className:''},overlay={classList:{contains:()=>true}};
  const ctx={currentUser:{id:actor},isSystemAdmin:()=>true,dcatsCompanyAccountBusy:false,dcatsCompanyIntegrationBusy:false,dcatsCompanyBackupBusy:false,
    dcatsCompanyIntegrationEpoch:0,dcatsCompanyIntegrationRecord:record,dcatsIntegrationReadinessController:h.engine,
    syncDcatsIntegrationReadinessContext(){},resetDcatsCompanyBackupReadiness(){},applyDcatsCompanyBackupReadiness(){},renderDcatsCompanyBackupNextSteps(){},updateDcatsCompanyIntegrationControls(){},t:key=>key,tf:key=>key,
    document:{getElementById:id=>id==='dcats-business-workspace-overlay'?overlay:status,querySelector:selector=>selector.includes('backup-file')?{files:[{name:'synthetic.csv'}]}:status},
    window:{DcatsHanbaiohCompanyBridge:{
      loginOnce:async()=>{business.push('login');return {status:'login_verified'};},exportCsvOnce:async()=>{business.push('export');return {status:'export_verified',cleanup:'closed'};},
      readExportResult:async()=>{business.push('result');return {status:'pending'};},backupBeforePrepare:async()=>{business.push('backup');return {status:'cancelled'};},
      readBackupCheckpointFromPc:async()=>{business.push('backup_result');return {status:'cancelled'};},readImportCheckpointFromPc:async()=>{business.push('import_result');return {status:'cancelled'};}
    }}};
  vm.runInNewContext(pick('ensureDcatsIntegrationBeforeAction')+'\n'+pick('runDcatsCompanyIntegration'),ctx);
  return {...h,ctx,business,status};
}
(async()=>{
  const h=harness();assert.equal(h.engine.snapshot().firstUse,true);await h.engine.start();await h.engine.start();assert.deepEqual(h.calls,['extension']);assert.equal(h.engine.snapshot().phase,'checked');
  h.engine.acknowledgeGuide();assert.equal(h.engine.snapshot().firstUse,false);assert.equal(h.storage.get('dcats-integration-guide-v1:'+actor),'1');
  assert.equal(harness({storage:h.storage}).engine.snapshot().firstUse,false);
  assert.equal(harness({storage:new Map()}).engine.snapshot().firstUse,true);
  await h.engine.check('login',h.options);await h.engine.check('login',h.options);assert.deepEqual(h.calls,['extension','extension','device','readiness','extension','device','readiness']);
  for(const feature of ['connect','login','export','result','backup_result','import_result']){
    const f=harness({checks:{backupPassword:'registration_required',backupAdapter:'unavailable'}});
    assert.equal((await f.engine.check(feature,f.options)).ok,true,feature+' must not require unrelated backup setup');
  }
  const blocked=harness({checks:{backupPassword:'registration_required'}});assert.equal((await blocked.engine.check('backup',blocked.options)).ok,false);assert.equal(blocked.engine.snapshot().reason,'settings_required');
  const setup=harness({checks:{identity:'unverified'}});assert.equal((await setup.engine.check('setup',setup.options)).ok,true);assert.deepEqual(setup.calls,['extension','device']);
  const observedOptions={},observed=harness(observedOptions);await observed.engine.check('setup',observed.options);assert(observed.engine.observeReadiness(readiness()));assert.equal(observed.engine.snapshot().phase,'ready');
  const beforeObserved=JSON.stringify(observed.engine.snapshot());assert.equal(observed.engine.observeReadiness(readiness({identity:'unverified'})),false);assert.equal(JSON.stringify(observed.engine.snapshot()),beforeObserved);
  observedOptions.checks={backupPassword:'registration_required'};assert.equal((await observed.engine.check('backup',observed.options)).ok,false,'Observed success must never replace fresh preflight');
  for(const version of ['0.5.15','0.4.999','bad']){const f=harness({version});assert.equal((await f.engine.check('login',f.options)).ok,false);assert.deepEqual(f.calls,['extension']);}
  for(const version of ['0.5.16','0.6.0','1.0.0']){const f=harness({version});assert.equal((await f.engine.check('login',f.options)).ok,true);}
  const changed=harness();assert.equal((await changed.engine.check('login',{...changed.options,expectedDevice:actor})).ok,false);assert.deepEqual(changed.calls,['extension','device']);
  for(const invalid of [{...readiness(),actorId:device},{...readiness(),deviceId:actor},{...readiness(),ready:false},readiness({identity:'unverified'}),readiness({recovery:'PRIVATE'})]){
    const f=harness({readiness:invalid});assert.equal((await f.engine.check('login',f.options)).ok,false);assert(!JSON.stringify(f.engine.snapshot()).includes('PRIVATE'));}
  for(const code of ['company_native_host_unavailable','company_device_unavailable','PRIVATE']){const f=harness({failDevice:code});assert.equal((await f.engine.check('login',f.options)).ok,false);assert(!JSON.stringify(f.engine.snapshot()).includes('PRIVATE'));}
  const stale=harness({leaveDuringRead:true});assert.equal((await stale.engine.check('backup',stale.options)).reason,'session_changed');
  assert.equal(stale.engine.snapshot().phase,'unverified');
  const denied=harness();denied.deny();assert.equal((await denied.engine.check('login',denied.options)).ok,false);assert.equal(denied.calls.length,0);
  for(const action of ['login','export','result','backup','backup_result','import_result']){
    const f=uiHarness();await f.ctx.runDcatsCompanyIntegration(action,action==='login'?undefined:'products');assert.deepEqual(f.calls,['extension','device','readiness']);assert.deepEqual(f.business,[action]);
    const failed=uiHarness({version:'0.5.15'});await failed.ctx.runDcatsCompanyIntegration(action,action==='login'?undefined:'products');assert.deepEqual(failed.business,[]);assert.equal(failed.status.textContent,'integration_check_blocked');
  }
  const b=uiHarness({checks:{backupPassword:'registration_required'}});await b.ctx.runDcatsCompanyIntegration('backup','sales');assert.deepEqual(b.business,[]);
  const c=uiHarness();c.ctx.dcatsCompanyIntegrationRecord={...record,device_id:actor};await c.ctx.runDcatsCompanyIntegration('login');assert.deepEqual(c.business,[]);assert.equal(c.ctx.dcatsCompanyIntegrationRecord,null);
  for(const name of ['registerDcatsCompanyAccount','openDcatsCompanyBackupSetup','checkDcatsCompanyBackupReadiness'])assert(pick(name).includes('ensureDcatsIntegrationBeforeAction("setup",isCurrent)'),name);
  assert(pick('renderMenu').includes('syncDcatsIntegrationReadinessContext()'));
  assert(html.indexOf('integration-readiness.js?')<html.indexOf('src="app.js?'));
  for(const key of ['title','first_hint','review','dismiss','scope','recheck','details','password_note','checking','ready','connected','unverified','extension','pc','device','identity','settings','busy','failed','blocked','extension_label','pc_label','available','required','open_settings'])assert.equal((source.match(new RegExp('^    integration_check_'+key+':','gm'))||[]).length,3,key);
  console.log('Integration readiness: startup Native0, per-use freshness, first-use storage isolation, feature-specific gates, setup recovery, identity/device changes, stale owner, all action entrances and translations passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
