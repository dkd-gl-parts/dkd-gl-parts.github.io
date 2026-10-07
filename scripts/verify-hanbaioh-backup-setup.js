const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto'),root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'assets/concierge-pet/company-bridge.js'),'utf8');
const actor='00000000-0000-4000-8000-000000000001',device='00000000-0000-4000-8000-000000000002';
function fixture(mode={}){
  const listeners=new Map(),posts=[],issues=[];let current=true;
  const record={actor_id:actor,device_id:device,public_key_sha256:'a'.repeat(64),public_key_spki:'-----BEGIN PUBLIC KEY-----\n'+'A'.repeat(300)};
  function emit(response){queueMicrotask(()=>{for(const fn of listeners.get('message')||[])fn({source:win,origin:win.location.origin,data:{channel:'dcats-hanbaioh25-bridge-v1',type:'response',response}});});}
  const win={location:{origin:'https://dcats.daiko-denki.co.jp'},crypto:webcrypto,
    setTimeout:(fn,ms)=>setTimeout(fn,mode.timeout&&ms===610000?5:ms),clearTimeout,setInterval,clearInterval,
    addEventListener(n,f){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},removeEventListener(n,f){listeners.get(n)?.delete(f);},
    postMessage(m){posts.push(structuredClone(m));const q=m.request;if(!q)return;
      if(q.command==='read_hanbaioh_company_device'){emit({id:q.id,ok:true,command:q.command,data:{...record,...(mode.actor?{actor_id:device}:{})}});return;}
      assert.equal(q.command,'open_hanbaioh_company_backup_setup');assert.equal(Object.keys(q).sort().join(','),'capability,command,deviceId,id');
      if(mode.timeout)return;
      if(mode.oldExtension){emit({ok:false,error:{code:'REQUEST_REJECTED',message:'PRIVATE'}});return;}
      if(mode.close){for(const fn of [...listeners.get('pagehide')])fn();return;}
      if(mode.cancel){win.DcatsHanbaiohCompanyBridge.cancelCurrent();return;}
      if(mode.stale)current=false;
      emit({id:q.id,ok:true,command:q.command,data:{status:mode.status||'saved',...(mode.secret?{password:'PRIVATE'}:{})}});
    },
    DcatsHanbaiohCompanyApi:{issue:async(r,q)=>{assert.equal(r.actor_id,actor);assert.equal(q.command,'enroll_hanbaioh_company_account');assert.equal(Object.keys(q).sort().join(','),'command,device_id,request_id');issues.push(q);
      if(mode.unauthorized)return {error:{context:{status:403},message:'PRIVATE'}};
      return {data:{ok:true,request_id:q.request_id,device_id:device,expires_at:new Date(Date.now()+170000).toISOString(),capability:'v2.c3ludGhldGlj.'+'A'.repeat(86)}};
    }}
  };
  vm.runInNewContext(source,{window:win,Date,Object,Set,Map,Promise,Error,Number,Array,Uint8Array});
  return {posts,issues,listeners,run:()=>win.DcatsHanbaiohCompanyBridge.openBackupSetupFromPc({actorId:actor,isCurrent:()=>current})};
}
(async()=>{
  for(const status of ['saved','cancelled','failed','outcome_unknown','expired']){
    const f=fixture({status}),value=await f.run();assert.equal(value.status,status);assert.equal(Object.keys(value).join(','),'status');
    assert.equal(f.issues.length,1);assert.deepEqual(f.posts.filter(m=>m.request).map(m=>m.request.command),['read_hanbaioh_company_device','open_hanbaioh_company_backup_setup']);
    assert(f.posts.some(m=>m.type==='company_backup_setup_cancel'));assert([...f.listeners.values()].every(s=>s.size===0));assert.doesNotMatch(JSON.stringify(value),/password|token|capability/);
  }
  for(const flag of ['secret','timeout','close','cancel','stale','oldExtension','actor','unauthorized']){
    const f=fixture({[flag]:true});await assert.rejects(f.run(),e=>!e.message.includes('PRIVATE'));assert([...f.listeners.values()].every(s=>s.size===0));
    if(flag==='actor'||flag==='unauthorized')assert.equal(f.posts.filter(m=>m.request).length,1);
  }
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const card=html.slice(html.indexOf('<section class="dcats-business-workspace-backup"'),html.indexOf('<section class="dcats-business-workspace-company"'));
  assert(card.includes(' hidden>'));assert(!card.includes('<input'));assert(card.includes('id="dcats-business-workspace-backup-setup"'));
  for(const name of ['setup','setup_hint','setup_opening','setup_saved','setup_cancelled','setup_failed','setup_outcome_unknown','setup_expired'])assert.equal((app.match(new RegExp('business_workspace_backup_'+name+':','g'))||[]).length,3,name);
  const handler=app.slice(app.indexOf('async function openDcatsCompanyBackupSetup()'),app.indexOf('function resetDcatsCompanyBackupReadiness()'));
  assert(handler.includes('isSystemAdmin()'));assert(handler.includes('resetDcatsCompanyBackupReadiness()'));assert(handler.includes('if(!isCurrent())return'));
  assert(!handler.includes('dcatsCompanyBackupResult=result'));assert(!handler.includes('loginOnce'));assert(!handler.includes('exportCsvOnce'));
  console.log('Backup setup: same-owner view permit, fixed statuses, independent native authentication, cancellation, stale owner, old extension, no browser password inputs: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
