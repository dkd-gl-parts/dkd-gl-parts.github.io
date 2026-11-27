const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../assets/concierge-pet/qa-sales-trial.js"), "utf8");
(async () => {
  const actor = "1da048d8-1908-4eae-bbc8-5d9c362b2df2", device = "336bd0fb-0f26-47f4-a1a9-4731b28d4beb", session = crypto.randomUUID();
  const record = {actor_id:actor,device_id:device,public_key_sha256:"6d6c0d4d97bdd5835e6d879c5dcc8bbe85d912911b546ba109231aa3af99f0ac"};
  const events = new Set(), requests=[];
  const win = {currentUser:{id:actor},DcatsAccess:{isSystemAdmin:()=>true},location:{origin:"https://dcats.daiko-denki.co.jp",pathname:"/",search:"?dcats_qa=900100"},
    addEventListener:(t,h)=>events.add(h), removeEventListener:(t,h)=>events.delete(h),
    postMessage(message) {
      const q=message.request;
      assert.equal(q.command,"sign_qa_sales_trial");assert.equal(q.actorId,actor);assert.equal(q.deviceId,device);
      assert.equal(q.capability,"qa1."+"A".repeat(86));
      const response={id:q.id,command:q.command,ok:true,data:{id:q.id,action:q.action,session:q.session,issuedAt:q.issuedAt,signature:"A".repeat(512)}};
      for(const h of events)h({source:win,origin:win.location.origin,data:{channel:message.channel,type:"response",response}});
    },
    sb:{auth:{getClaims:async()=>({data:{claims:{sub:actor,session_id:session}}})},functions:{
      async invoke(name,{body}) {
        assert.equal(name,"hanbaioh-qa-sales-trial");requests.push(body);
        return body.prepare?{data:{session,issuedAt:Date.now(),capability:"qa1."+"A".repeat(86)}}:{data:{ok:true}};
      }
    }}
  };
  vm.runInNewContext(source,{window:win,crypto,setTimeout,clearTimeout});
  const trial=win.DcatsQaSalesTrial, fallback={};
  assert.equal(trial.fileName,"hanbaioh-sales-test-900100-f59332f7cbd2-55.csv");
  assert.equal(trial.matches(record),true);
  for (const invalid of [null,{...record,actor_id:device},{...record,device_id:actor},{...record,public_key_sha256:"other"}]) {
    assert.equal(trial.matches(invalid),false);
    assert.equal(trial.select(invalid,fallback),null);
  }
  win.location.search="";
  assert.equal(trial.matches(record),false);
  assert.equal(trial.select(record,fallback),null);
  assert.equal(trial.select({...record,public_key_sha256:"other"},fallback),fallback);
  win.location.search="?dcats_qa=900100";
  win.DcatsAccess.isSystemAdmin=()=>false;
  assert.equal(trial.matches(record),false);
  win.DcatsAccess.isSystemAdmin=()=>true;
  const api=win.DcatsQaSalesTrial.select(record,fallback);
  const loginId=crypto.randomUUID();await api.issue(record,loginId);
  assert.equal(requests.length,2);assert.equal(requests[0].id,loginId);assert.equal(requests[1].id,loginId);assert.equal(requests[1].action,"login");
  assert.throws(()=>api.claimOnce(record,"900101","0".repeat(64)));
  assert.equal(requests.length,2);assert.equal(events.size,0);
  win.currentUser.id=crypto.randomUUID();await assert.rejects(api.issueBinding(record));assert.equal(requests.length,2);
  console.log("QA endpoint selection, signed login correlation, source restrictions, account change and listener cleanup passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});
