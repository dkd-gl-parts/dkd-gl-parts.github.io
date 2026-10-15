"use strict";
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),acorn=require('acorn');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const runtime=fs.readFileSync(path.join(root,'assets/concierge-pet/integration-readiness.js'),'utf8');
const concierge=fs.readFileSync(path.join(root,'assets/concierge-pet/concierge-pet.js'),'utf8');
const conciergeTree=acorn.parse(concierge,{ecmaVersion:'latest'});
const conciergePick=name=>{let found;function visit(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&node.id.name===name)found=node;for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}}visit(conciergeTree);assert(found,name);return concierge.slice(found.start,found.end);};
const actor='00000000-0000-4000-8000-000000000001',device='00000000-0000-4000-8000-000000000002';
const record={actor_id:actor,device_id:device,public_key_sha256:'a'.repeat(64),public_key_spki:'-----BEGIN PUBLIC KEY-----\n'+'A'.repeat(300)};
const fullChecks={identity:'available',syncFolder:'available',driveConfiguration:'available',driveAuthorization:'available',backupPassword:'available',recovery:'available',backupAdapter:'available'};
function readiness(checks={}){const all={...fullChecks,...checks};return {status:'production_backup_prerequisites',actorId:actor,deviceId:device,ready:Object.values(all).every(v=>v==='available'),checks:all};}
function harness(options={}){
  const window={},calls=[],storage=options.storage||new Map(),automaticResults=[],timers=new Map();let current=true,allowed=true,nextTimer=0;
  vm.runInNewContext(runtime,{window,Object,Array,Number,Promise,Error,Date});
  const engine=window.DcatsIntegrationReadiness.create({storage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},isAllowed:id=>allowed&&id===actor,
    isIdle:()=>options.idle!==false,canContinueAutomatic:()=>options.continue!==false,now:()=>options.clock||0,
    setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
    onAutomaticResult:result=>automaticResults.push(result),expectedDevice:()=>options.expectedDevice,
    probe:async()=>{calls.push('extension');return {version:options.version||'0.5.16'};},
    readDevice:async()=>{calls.push('device');if(options.failDevice)throw Error(options.failDevice);return {...record,...options.device};},
    readReadiness:async()=>{calls.push('readiness');if(options.wait)await options.wait;if(options.leaveDuringRead)current=false;return options.readiness||readiness(options.checks);},onChange:()=>{}});
  engine.setOwner(actor);
  return {engine,calls,storage,automaticResults,timers,options:{isCurrent:()=>current},leave:()=>{current=false;},deny:()=>{allowed=false;}};
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
  const h=harness();assert.equal(h.engine.snapshot().firstUse,true);await h.engine.start();await h.engine.start();assert.deepEqual(h.calls,['extension','device','readiness']);assert.equal(h.engine.snapshot().phase,'ready');assert.equal(h.automaticResults.length,1);
  h.engine.acknowledgeGuide();assert.equal(h.engine.snapshot().firstUse,false);assert.equal(h.storage.get('dcats-integration-guide-v1:'+actor),'1');
  assert.equal(harness({storage:h.storage}).engine.snapshot().firstUse,false);
  assert.equal(harness({storage:new Map()}).engine.snapshot().firstUse,true);
  await h.engine.check('login',h.options);await h.engine.check('login',h.options);assert.deepEqual(h.calls,Array(3).fill(['extension','device','readiness']).flat());
  const clock={clock:100,idle:false},automatic=harness(clock);await automatic.engine.start();assert.equal(automatic.calls.length,0);
  clock.idle=true;await automatic.engine.start();assert.equal(automatic.calls.length,3);
  await automatic.engine.refresh();await automatic.engine.refresh();assert.equal(automatic.calls.length,3);assert.equal(automatic.timers.size,1);
  assert.equal([...automatic.timers.values()][0].delay,30000);clock.clock+=30000;const timer=[...automatic.timers.values()][0];automatic.timers.clear();timer.fn();await automatic.engine.start();assert.equal(automatic.calls.length,6);
  await automatic.engine.refresh({force:true});assert.equal(automatic.calls.length,9);
  await automatic.engine.refresh();assert.equal(automatic.timers.size,1);automatic.engine.setOwner('');assert.equal(automatic.timers.size,0);
  let resume;const wait=new Promise(resolve=>{resume=resolve;}),during=harness({wait});
  const initial=during.engine.start();assert.equal(during.engine.refresh(),initial,'Concurrent automatic triggers coalesce');
  await new Promise(resolve=>setImmediate(resolve));const foreground=during.engine.check('login',during.options);assert.equal(during.calls.length,3);
  resume();await initial;await foreground;assert.equal(during.calls.length,6,'Foreground must freshly verify after automatic check');
  let finishStale;const staleAutomatic=harness({wait:new Promise(resolve=>{finishStale=resolve;})});const staleStart=staleAutomatic.engine.start();await new Promise(resolve=>setImmediate(resolve));staleAutomatic.engine.setOwner('');finishStale();await staleStart;assert.equal(staleAutomatic.automaticResults.length,0);assert.equal(staleAutomatic.engine.snapshot().owner,'');
  const pausedOptions={continue:false},paused=harness(pausedOptions);await paused.engine.start();assert.equal(paused.automaticResults.length,0);pausedOptions.continue=true;await paused.engine.start();assert.equal(paused.automaticResults.length,1,'Interrupted checks can restart without manual recheck');
  const autoMismatch=harness({expectedDevice:actor});await autoMismatch.engine.start();assert.equal(autoMismatch.engine.snapshot().reason,'device_changed');
  for(const feature of ['connect','login','prepare','export','result','backup_result','import_result']){
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
  const discoveryTimeout=uiHarness({failDevice:'company_device_read_timeout'});await discoveryTimeout.ctx.runDcatsCompanyIntegration('login');
  assert.equal(discoveryTimeout.engine.snapshot().reason,'discovery_timeout');assert.equal(discoveryTimeout.engine.snapshot().checks.extension,'available');
  assert.equal(discoveryTimeout.engine.snapshot().checks.pc,'unverified');assert.deepEqual(discoveryTimeout.business,[]);assert.deepEqual(discoveryTimeout.calls,['extension','device']);
  const stale=harness({leaveDuringRead:true});assert.equal((await stale.engine.check('backup',stale.options)).reason,'session_changed');
  assert.equal(stale.engine.snapshot().phase,'unverified');
  const denied=harness();denied.deny();assert.equal((await denied.engine.check('login',denied.options)).ok,false);assert.equal(denied.calls.length,0);
  for(const action of ['login','export','result','backup','backup_result','import_result']){
    const f=uiHarness();await f.ctx.runDcatsCompanyIntegration(action,action==='login'?undefined:'products');assert.deepEqual(f.calls,['extension','device','readiness']);assert.deepEqual(f.business,[action]);
    const failed=uiHarness({version:'0.5.15'});await failed.ctx.runDcatsCompanyIntegration(action,action==='login'?undefined:'products');assert.deepEqual(failed.business,[]);assert.equal(failed.status.textContent,'integration_check_blocked');
  }
  const b=uiHarness({checks:{backupPassword:'registration_required'}});await b.ctx.runDcatsCompanyIntegration('backup','sales');assert.deepEqual(b.business,[]);
  const c=uiHarness();c.ctx.dcatsCompanyIntegrationRecord={...record,device_id:actor};await c.ctx.runDcatsCompanyIntegration('login');assert.deepEqual(c.business,[]);assert.equal(c.ctx.dcatsCompanyIntegrationRecord,null);
  const separate=uiHarness();assert.equal((await separate.ctx.ensureDcatsIntegrationBeforeAction('login',()=>true,{...record,device_id:actor})).ok,false);assert.equal(separate.ctx.dcatsCompanyIntegrationRecord,record,'Concierge record mismatch must not clear another view record');
  for(const category of ['account','products','customers','sales'])for(const outcome of ['allowed','blocked','missing','stale']){
    const calls=[];let current=true;
    const ctx={companyToken:0,companyPending:false,bridgeRequestPending:false,companyStatusKey:'',reviewPreviewRecord:record,
      isSystemAdminSession:()=>current,currentSettingsOwner:()=>actor,updateBridgeStatus(){},
      window:{DcatsHanbaiohCompanyBridge:{loginOnce:async()=>{calls.push('login');return {status:'login_verified'};},prepareCsv:async()=>{calls.push('prepare');return {status:'prepared'};}}}};
    if(outcome!=='missing')ctx.window.ensureDcatsIntegrationBeforeAction=async(feature,isCurrent,expected)=>{
      assert.equal(feature,category==='account'?'login':'prepare');assert.equal(expected,record);assert.equal(isCurrent(),true);calls.push('check');if(outcome==='stale')current=false;return {ok:outcome!=='blocked'};
    };
    vm.runInNewContext(conciergePick('checkIntegrationBeforeOperation')+'\n'+conciergePick('runCompanyOperation'),ctx);
    await ctx.runCompanyOperation(category,{name:category+'.csv'});
    assert.deepEqual(calls,outcome==='allowed'?['check',category==='account'?'login':'prepare']:outcome==='missing'?[]:['check']);assert.equal(ctx.bridgeRequestPending,false);
  }
  for(const name of ['issueBackupEnrollment','runWindowsBridgeRequest','runPilotTestSale','runPilotLogin'])assert(conciergePick(name).includes('await checkIntegrationBeforeOperation("setup"'),name+' requires fresh connectivity before its existing signed pilot checks');
  for(const name of ['registerDcatsCompanyAccount','openDcatsCompanyBackupSetup','checkDcatsCompanyBackupReadiness'])assert(pick(name).includes('ensureDcatsIntegrationBeforeAction("setup",isCurrent)'),name);
  assert(pick('renderMenu').includes('syncDcatsIntegrationReadinessContext()'));
  for(const name of ['openDcatsBusinessWorkspace','openDcatsBusinessWorkspaceSettings','registerDcatsCompanyAccount','openDcatsCompanyBackupSetup'])assert(pick(name).includes('refreshDcatsIntegrationReadinessAutomatically('),name+' triggers automatic inspection');
  assert(!html.includes('data-integration-check-dismiss'),'No mandatory first-use dismissal');
  assert(html.indexOf('data-integration-check-recheck')>html.indexOf('id="dcats-integration-check-details"'),'Manual retry is optional under details');
  assert(html.indexOf('integration-readiness.js?')<html.indexOf('src="app.js?'));
  for(const key of ['title','first_hint','review','dismiss','scope','recheck','details','password_note','checking','ready','connected','unverified','extension','pc','timeout','device','identity','settings','busy','failed','blocked','extension_label','pc_label','available','required','open_settings'])assert.equal((source.match(new RegExp('^    integration_check_'+key+':','gm'))||[]).length,3,key);
  console.log('Integration readiness: automatic startup/settings/return checks, coalescing/throttle/trailing retry, idle/owner guards, fresh action checks, setup recovery, identity/device changes, all entrances and translations passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
