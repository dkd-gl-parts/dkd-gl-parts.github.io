const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { parseHTML } = require("linkedom");
const root = path.join(__dirname,".."), app = fs.readFileSync(path.join(root,"app.js"),"utf8");
const html = fs.readFileSync(path.join(root,"index.html"),"utf8");
function fn(name) {
  const start = app.indexOf("function " + name + "("), async = app.slice(start-6,start) === "async ";
  const next = [app.indexOf("\nfunction ",start+1),app.indexOf("\nasync function ",start+1)].filter(n=>n>=0);
  return app.slice(async?start-6:start,Math.min(...next));
}
function deferred() { let resolve; const promise = new Promise(r=>{resolve=r;}); return {promise,resolve}; }
function harness({fields={code:"SYNTH-001",name:"合成得意先",billingCode:"SYNTH-001",closingCode:"31"},pending,duplicate=false,queryError=false,overwrite=true}={}) {
  const {document}=parseHTML(html), overlay=document.getElementById("customer-register-overlay");
  overlay.classList.add("show");
  document.getElementById("customer-register-closing-code").innerHTML="<option value=''></option><option value='0'>0</option><option value='31'>31</option>";
  document.getElementById("customer-register-rank").innerHTML="<option value='SPECIAL'>SPECIAL</option>";
  // linkedom has no HTMLSelectElement.value setter. Model the standard
  // browser property here; the non-visible browser QA checks the real DOM.
  for (const select of document.querySelectorAll("#customer-register-overlay select")) {
    let value = select.options[0] ? select.options[0].getAttribute("value") : "";
    Object.defineProperty(select,"value",{configurable:true,get:()=>value,set:v=>{value=String(v);}});
  }
  const notes=[],calls=[],queries=[];let cancelled=0,confirmed=0,allowed=true,admin=true;
  const query={select(){return this;},eq(k,v){queries.push([k,v]);return this;},limit:async()=>({data:duplicate?[{id:"existing"}]:[],error:queryError?{}:null})};
  const window={confirm(){confirmed++;return overwrite;},setTimeout(){},DcatsHanbaiohCompanyBridge:{isBusy:()=>false,
    readCustomerScreenFromPc:async o=>{calls.push(o);return pending?pending.promise:{fields};},cancelCustomerScreen(){cancelled++;}}};
  const context={window,document,currentUser:{id:"synthetic-actor"},customerAccessRegistrationReadSeq:0,customerAccessRegistrationReading:false,customerAccessRegistrationSaving:false,
    canManageCustomerAccess:()=>allowed,isSystemAdmin:()=>admin,t:k=>k,
    setCustomerRegistrationMessage:(text,error)=>notes.push({text,error}),sb:{from:name=>{assert.equal(name,"sales_customers");return query;},rpc:()=>{throw new Error("read_must_not_write");}}};
  vm.createContext(context);
  for(const name of ["customerRegistrationFieldValue","customerRegistrationReadSnapshot","setCustomerRegistrationSaving","setCustomerRegistrationReading","readHanbaiohCustomerScreen","closeCustomerRegistration"])vm.runInContext(fn(name),context);
  return {context,document,overlay,notes,calls,queries,read:()=>context.readHanbaiohCustomerScreen(),get:id=>document.getElementById("customer-register-"+id),
    count:()=>({cancelled,confirmed}),allowed:v=>{allowed=v;},admin:v=>{admin=v;}};
}
test("screen read fills exact fields, preserves rank, clears confirmation and never registers",async()=>{
  const h=harness();h.get("confirmed").checked=true;await h.read();
  assert.equal(h.get("code").value,"SYNTH-001"); assert.equal(h.get("billing-code").value,"SYNTH-001");assert.equal(h.get("closing-code").value,"31");
  assert.equal(h.get("rank").value,"SPECIAL");assert.equal(h.get("confirmed").checked,false);
  assert(h.notes.at(-1).text.includes("customer_register_read_success"));assert.equal(h.context.customerAccessRegistrationReading,false);
  assert.deepEqual(h.queries,[["source_code","hanbaiou"],["source_customer_code","SYNTH-001"]]);
});
test("partial screen read does not invent billing/closing; another customer cannot retain old contact fields",async()=>{
  const h=harness({fields:{code:"NEXT",name:"別の合成得意先"}});h.get("code").value="OLD";h.get("phone").value="old-phone";h.get("billing-code").value="OLD";await h.read();
  assert.equal(h.count().confirmed,1);assert.equal(h.get("phone").value,"");assert.equal(h.get("billing-code").value,"");assert.equal(h.get("closing-code").value,"");
  assert(h.notes.at(-1).text.includes("customer_register_read_missing"));
});
test("declined overwrite and duplicates preserve all inputs",async()=>{
  for(const settings of [{overwrite:false},{duplicate:true},{queryError:true}]){
    const h=harness(settings);h.get("code").value="MANUAL";h.get("name").value="入力中";await h.read();
    assert.equal(h.get("code").value,"MANUAL");assert.equal(h.get("name").value,"入力中");assert.equal(h.context.customerAccessRegistrationReading,false);
  }
});

test("reading both tabs of the same customer accumulates fields and reports remaining form requirements",async()=>{
  const h=harness({fields:{code:"SYNTH-001",name:"合成得意先",phone:"000-0000-0000"}});
  await h.read();assert(h.notes.at(-1).text.includes("customer_register_read_missing"));
  h.context.window.DcatsHanbaiohCompanyBridge.readCustomerScreenFromPc=async()=>({fields:{code:"SYNTH-001",name:"合成得意先",billingCode:"BILL-001",closingCode:"0"}});
  await h.read();assert.equal(h.get("phone").value,"000-0000-0000");assert.equal(h.get("billing-code").value,"BILL-001");assert.equal(h.get("closing-code").value,"0");
  assert(!h.notes.at(-1).text.includes("customer_register_read_missing"));
  h.context.window.DcatsHanbaiohCompanyBridge.readCustomerScreenFromPc=async()=>({fields:{code:"SYNTH-001",name:"合成得意先"}});
  await h.read();assert.equal(h.get("billing-code").value,"BILL-001");assert(!h.notes.at(-1).text.includes("customer_register_read_missing"));assert.equal(h.count().confirmed,0);
});
test("closing/reopening, editing, actor changes and revoked permissions discard delayed results",async()=>{
  for(const change of [h=>h.context.closeCustomerRegistration(),h=>{h.context.closeCustomerRegistration();h.overlay.classList.add("show");},h=>{h.get("name").value="変更";},h=>{h.context.currentUser={id:"another"};},h=>h.allowed(false),h=>h.admin(false)]){
    const pending=deferred(),h=harness({pending});const operation=h.read();
    assert.equal(h.get("code").disabled,true);assert.equal(h.document.getElementById("btn-customer-register-save").disabled,true);assert.equal(h.document.getElementById("btn-customer-register-close").disabled,false);
    change(h);pending.resolve({fields:{code:"LATE",name:"late"}});await operation;
    assert.equal(h.get("code").value,"");assert.equal(h.context.customerAccessRegistrationReading,false);
  }
});
test("read is restricted to existing administrator pilot and duplicate clicks submit once",async()=>{
  const unauthorized=harness();unauthorized.admin(false);await unauthorized.read();assert.equal(unauthorized.calls.length,0);
  const pending=deferred(),h=harness({pending});const one=h.read();await h.read();assert.equal(h.calls.length,1);pending.resolve({fields:{code:"ONE",name:"one"}});await one;
});
test("labels are translated three times and native acquisition panel stays initially hidden",()=>{
  for(const key of ["read","reading","read_help","read_success","read_duplicate","read_missing","read_session","read_update","read_reload","read_changed","read_overwrite"])assert.equal((app.match(new RegExp("customer_register_"+key+":","g"))||[]).length,3);
  assert(html.includes('id="customer-register-read-panel" hidden'));
});
