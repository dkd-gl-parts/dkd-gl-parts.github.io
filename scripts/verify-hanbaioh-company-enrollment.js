const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const root=path.join(__dirname,".."),source=fs.readFileSync(path.join(root,"assets/concierge-pet/company-bridge.js"),"utf8");
const actor="00000000-0000-4000-8000-000000000001",device="00000000-0000-4000-8000-000000000002";
const record={actor_id:actor,device_id:device,public_key_sha256:"a".repeat(64),public_key_spki:"-----BEGIN PUBLIC KEY-----\n"+"A".repeat(300)};
function fixture(mode={}){
  const listeners=new Map(),posts=[],issues=[];let current=true;
  const emit=m=>queueMicrotask(()=>{for(const fn of listeners.get("message")||[])fn({source:win,origin:win.location.origin,data:{channel:"dcats-hanbaioh25-bridge-v1",...m}});});
  const win={location:{origin:"https://dcats.daiko-denki.co.jp"},crypto:webcrypto,setTimeout,clearTimeout,setInterval,clearInterval,
    addEventListener(n,f){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},removeEventListener(n,f){listeners.get(n)?.delete(f);},
    postMessage(m){posts.push(structuredClone(m));const q=m.request;
      if(q?.command==="read_hanbaioh_company_device")emit({type:"response",response:{id:q.id,command:q.command,ok:!mode.noDevice,data:mode.wrongOwner?{...record,actor_id:device}:record}});
      else if(q?.command==="enroll_hanbaioh_company_account"){
        if(mode.cancel){queueMicrotask(()=>win.DcatsHanbaiohCompanyBridge.cancelCurrent());return;}
        if(mode.sessionChanged){current=false;return;}
        if(mode.cancelled||mode.expired){emit({type:"response",response:{id:q.id,command:q.command,ok:true,data:{status:mode.cancelled?"cancelled":"expired"}}});return;}
        emit({type:"company_enrollment_ticket_request",id:q.id,challengeId:webcrypto.randomUUID()});
      }else if(m.type==="company_enrollment_ticket_reply"){
        const q=posts.find(x=>x.request?.command==="enroll_hanbaioh_company_account").request;
        emit({type:"response",response:{id:q.id,command:q.command,ok:true,data:{status:"enrolled",replaced:!!mode.replacing,generation:mode.replacing?2:1}}});
      }
    },
    DcatsHanbaiohCompanyApi:{issue:async(r,b)=>{assert.equal(r.actor_id,actor);issues.push(structuredClone(b));if(mode.revoked&&issues.length===2)return{error:new Error("DO-NOT-ECHO")};return{data:{ok:true,request_id:b.request_id,device_id:device,expires_at:new Date(Date.now()+170000).toISOString(),capability:"v2.c3ludGhldGlj."+"A".repeat(86)}};}}
  };
  vm.runInNewContext(source,{window:win,Date,Object,Set,Promise,Error,Number,Array,Uint8Array});
  return{win,posts,issues,listeners,run:()=>win.DcatsHanbaiohCompanyBridge.enrollAccountFromPc({actorId:actor,isCurrent:()=>current})};
}
(async()=>{
  for(const replacing of [false,true]){
    const f=fixture({replacing}),result=await f.run();assert.equal(result.status,"enrolled");assert.equal(result.replaced,replacing);assert.equal(f.issues.length,2);assert.notEqual(f.issues[0].request_id,f.issues[1].request_id);
    assert.equal(f.posts.filter(m=>m.type==="company_enrollment_ticket_reply").length,1);assert(f.posts.some(m=>m.type==="company_enrollment_cancel"));
    assert.doesNotMatch(JSON.stringify(f.posts)+JSON.stringify(f.issues),/password|DO-NOT-ECHO/);assert([...f.listeners.values()].every(s=>s.size===0));
    assert.equal(f.win.DcatsHanbaiohCompanyBridge.wasLoginAttempted(record),false);
  }
  for(const key of ["noDevice","wrongOwner","revoked","cancel","sessionChanged"]){const f=fixture({[key]:true});await assert.rejects(f.run());assert([...f.listeners.values()].every(s=>s.size===0));}
  for(const key of ["cancelled","expired"]){const f=fixture({[key]:true});assert.equal((await f.run()).status,key);assert.equal(f.issues.length,1);}
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8"),app=fs.readFileSync(path.join(root,"app.js"),"utf8");
  const card=html.slice(html.indexOf('<section class="dcats-business-workspace-account"'),html.indexOf('<section class="dcats-business-workspace-b2"'));
  assert(card.includes('id="dcats-business-workspace-account"'));assert(card.includes(" hidden>"));assert(card.includes('role="status"'));assert(!card.includes('<input'));
  for(const name of ["title","hint","update_hint","register","note","opening","saved","updated","cancelled","expired","failed"])assert.equal((app.match(new RegExp("business_workspace_account_"+name+":","g"))||[]).length,3,name);
  assert(app.includes('enroll_hanbaioh_company_account: false'));assert(app.includes('dcats-business-workspace-account-register"'));
  console.log("Company enrollment GUI entry: public device discovery, fresh same-owner approval, cancellation/revocation, no browser passwords, no login retry, three languages: OK");
})().catch(e=>{console.error(e);process.exitCode=1;});
