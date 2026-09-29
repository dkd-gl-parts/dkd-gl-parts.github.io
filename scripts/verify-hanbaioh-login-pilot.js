const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
const start = source.indexOf("async function issueConciergePilotLogin(record, requestId)");
const end = source.indexOf("var CONCIERGE_AI_SCREEN_IDS",start);
assert(start>=0 && end>start);
const actor="00000000-0000-4000-8000-000000000001", device="00000000-0000-4000-8000-000000000002";
const request="00000000-0000-4000-8000-000000000003";
const calls=[];
const context={window:{}, currentUser:{id:actor}, isSystemAdmin:()=>true,
  sb:{functions:{invoke:async(name,options)=>{calls.push({name,options});return {data:{ok:true},error:null};}}}};
vm.createContext(context); vm.runInContext(source.slice(start,end),context);
const record={actor_id:actor,device_id:device,public_key_spki:"PUBLIC-ONLY",public_key_sha256:"a".repeat(64)};
(async()=>{
  const issue=context.window.DcatsHanbaiohLoginApi.issue;
  for(const invalid of [null,{...record,actor_id:device},{...record,device_id:"bad"},
    {...record,password:"SYNTHETIC"},{...record,session_id:actor},{...record,connectionName:"arbitrary"}]) {
    assert((await issue(invalid,request)).error);
  }
  assert((await issue(record,"invalid")).error);
  context.isSystemAdmin=()=>false; assert((await issue(record,request)).error);
  context.isSystemAdmin=()=>true; context.currentUser=null; assert((await issue(record,request)).error);
  context.currentUser={id:actor}; assert.equal(calls.length,0);
  await issue(record,request); assert.equal(calls.length,1);
  assert.equal(calls[0].name,"issue-hanbaioh-pilot-login");
  assert.equal(JSON.stringify(calls[0].options.body),JSON.stringify({device_id:device,request_id:request}));
  console.log("Login pilot browser boundary: OK (admin, owner, exact request, no credentials/target/session fields)");
})().catch(error=>{console.error(error);process.exitCode=1;});
