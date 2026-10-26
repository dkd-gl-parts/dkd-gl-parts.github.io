"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const research = fs.readFileSync(path.join(root, "partsfan-research.js"), "utf8");
const source = fs.readFileSync(path.join(root, "partsfan-queue.js"), "utf8");
const context = {window: {currentLang:"ja", canManageProductSpecs:()=>false, canImportPartsfanFitments:()=>false}, URL, Date};
vm.runInNewContext(research, context);
vm.runInNewContext(source, context);
const api = context.window.PartsfanQueue;
assert.equal(api.open(), false, "unauthorized callers cannot open saved data");
assert.equal(api.parseParts("31100-5K6-004\n311005K6004\n31100-RV4-004", "honda").length, 2);
for (const [text, maker] of [["", "honda"], ["=CMD", "honda"], ["31100-5K6-004", ""], ["AA\n".repeat(51), "honda"], ["AA,BB", "honda"]]) assert.throws(()=>api.parseParts(text, maker));
const row = {source_record_key:"a".repeat(64), catalog_manufacturer:"HONDA", normalized_genuine_part_number:"311005K6004", vehicle_manufacturer:"ホンダ", vehicle_type:"N ONE", model:"DBA-JG1", engine:"S07A", part_role:"partsfan_genuine_application", raw_payload:{chassis_range:"1000001 - 1099999", grade:"G", transmission:"CVT"}};
const second = {...row, source_record_key:"b".repeat(64)};
assert.equal(api.registrationState([row], []).state, "unregistered");
assert.equal(api.registrationState([row], [structuredClone(row)]).state, "registered");
assert.equal(api.registrationState([row, second], [row]).state, "partial");
for (const stored of [{...row, model:"DBA-JG2"}, {...row, effective_start:"2014/05"}, {...row, normalized_genuine_part_number:"ANOTHER"}, {...row, raw_payload:{...row.raw_payload,chassis_range:"2000001 - 2099999"}}, {...row, raw_payload:{...row.raw_payload,chassis_range_review:"vehicle_list_vs_detail_conflict"}}]) assert.equal(api.registrationState([row], [stored]).state, "different");
assert.equal(api.registrationState([row], [row, row]).state, "different", "ambiguous duplicates must not claim registration");
assert(source.includes('.from("catalog_vehicle_applications")') && source.includes('.eq("source_code", "partsfan")'));
assert(source.includes('state:"unknown"'), "lookup errors must not imply unregistered");
assert(!/\.insert\(|\.update\(|\.delete\(|\.rpc\(/.test(source), "queue must not introduce another mutation path");
assert(research.includes('root.importPartsfanApplications(') && research.includes('!confirm.checked'), "registration must use the existing reviewed RPC flow");
assert(source.includes('if (!allowed) { snapshot = null; detailCache = {}; registrations = {}; }'), "clear local view caches on permission loss");
for (const file of ["index.html", "scripts/build-static-site.js"]) assert(fs.readFileSync(path.join(root,file),"utf8").includes("partsfan-queue.js"));
const version = fs.readFileSync(path.join(root,"app.js"),"utf8").match(/var APP_VERSION\s*=\s*"v([^"]+)"/)[1];
assert(fs.readFileSync(path.join(root,"index.html"),"utf8").includes('partsfan-queue.js?v=' + version));
console.log("PARTS FAN durable queue / registration evidence checks passed");

async function verifyAutomaticUpdates() {
  const owner="11111111-1111-4111-8111-111111111111", other="22222222-2222-4222-8222-222222222222";
  const record={...row, source_code:"partsfan",source_table:"genuine_applications",genuine_part_number:"31100-5K6-004",is_catalog_evidence:true,
    effective_start:null,effective_end:null,production_period_text:null,engine:null,
    raw_payload:{...row.raw_payload,source_url:"https://partsfan.com/honda/jp/pnodetail/TEST/311005K6004/",collected_at:"2026-10-26T00:00:00Z"}};
  function setup(options={}) {
    let stored=options.stored || [], writes=0, claims=0;
    const job={jobId:"a".repeat(32),part:"31100-5K6-004",maker:"honda",state:"completed",updatedAt:new Date().toISOString(),
      autoUpdate:{owner,state:"pending",attempt:null,reason:null},
      review:{format:"dcats.partsfan.review.v1",items:[{part:"31100-5K6-004",maker:"honda",status:"completed",records:[record]}]}};
    async function request(path,method,body) {
      if(path==="/health")return {autoUpdateVersion:options.oldBridge?0:1};
      if(!path.endsWith("/registration"))return structuredClone(job);
      assert.equal(body.owner,owner);
      if(body.action==="claim") {
        claims++;
        if(job.autoUpdate.state!=="pending")return {...structuredClone(job),claimed:false};
        job.autoUpdate={owner,state:"submitting",attempt:body.attempt,reason:null};
        return {...structuredClone(job),claimed:true};
      }
      if(body.action==="retry") { job.autoUpdate={owner,state:"pending",attempt:null,reason:null};return structuredClone(job); }
      assert.equal(body.attempt,job.autoUpdate.attempt);
      job.autoUpdate.state=body.state;job.autoUpdate.reason=body.reason;
      return structuredClone(job);
    }
    function tab() {
      const window={currentUser:{id:owner},canManageProductSpecs:()=>true,canImportPartsfanFitments:()=>true,currentLang:"ja",crypto:require("node:crypto").webcrypto,
        sb:{from:()=>({select:()=>{const q={eq:()=>q,in:()=>q,range:async()=>({data:structuredClone(stored),error:null})};return q;}})},
        importPartsfanApplications:async(part,maker,rows)=>{
          writes++;assert.equal(part,job.part);assert.equal(maker,job.maker);
          assert.equal(rows[0].production_period_text,null,"missing source years remain importable");
          if(!options.noCommit)stored=structuredClone(rows);
          if(options.networkError)throw new Error("network response lost");
          return {inserted:rows.length,updated:0};
        }};
      const ctx={window,URL,Date};vm.runInNewContext(research,ctx);window.PartsfanResearch.request=request;vm.runInNewContext(source,ctx);
      return window;
    }
    return {job,tab,writes:()=>writes,claims:()=>claims,stored:()=>stored};
  }
  let f=setup(),a=f.tab(),b=f.tab();
  await Promise.all([a.PartsfanQueue.processUpdates([structuredClone(f.job)]),b.PartsfanQueue.processUpdates([structuredClone(f.job)])]);
  assert.equal(f.writes(),1,"two tabs must send only one import");assert.equal(f.job.autoUpdate.state,"registered");
  await a.PartsfanQueue.processUpdates([structuredClone(f.job)]);assert.equal(f.writes(),1,"successful imports are not repeated");
  f=setup();a=f.tab();a.currentUser={id:other};await a.PartsfanQueue.processUpdates([f.job]);assert.equal(f.claims(),0);
  a.currentUser={id:owner};a.canImportPartsfanFitments=()=>false;await a.PartsfanQueue.processUpdates([f.job]);assert.equal(f.claims(),0);
  f=setup();a=f.tab();f.job.state="running";await a.PartsfanQueue.processUpdates([f.job]);assert.equal(f.writes(),0,"partial collection must never be imported");
  f=setup();a=f.tab();f.job.autoUpdate=null;await a.PartsfanQueue.processUpdates([f.job]);assert.equal(f.writes(),0,"opening legacy history does not authorize import");
  f=setup({networkError:true});a=f.tab();await a.PartsfanQueue.processUpdates([f.job]);assert.equal(f.job.autoUpdate.state,"registered","readback recognizes a committed import after a lost response");assert.equal(f.writes(),1);
  f=setup({networkError:true,noCommit:true});a=f.tab();await a.PartsfanQueue.processUpdates([f.job]);assert.equal(f.job.autoUpdate.state,"unknown");
  await f.tab().PartsfanQueue.processUpdates([f.job]);assert.equal(f.writes(),1,"a reopened page must not resend an unknown import");
  f=setup();a=f.tab();f.job.autoUpdate={owner,state:"unknown",attempt:other,reason:"registration_interrupted"};
  await a.PartsfanQueue.processUpdates([f.job]);assert.equal(f.writes(),0);
  await a.PartsfanQueue.retryUpdate(f.job.jobId);assert.equal(f.writes(),1,"only explicit retry restarts an unconfirmed update");
  const dated={...record,effective_start:"2012/10",production_period_text:"2012/10 - ",raw_payload:{...record.raw_payload,production_period_basis:"application_row"}};
  f=setup({stored:[dated]});a=f.tab();await a.PartsfanQueue.processUpdates([f.job]);assert.equal(f.writes(),0,"a blank incoming year preserves existing verified data");assert.equal(f.stored()[0].effective_start,"2012/10");
  f=setup({oldBridge:true});a=f.tab();await assert.rejects(()=>a.PartsfanQueue.updateRequest(),/old_bridge/);
  f=setup();a=f.tab();assert.equal((await a.PartsfanQueue.updateRequest()).auto_update_owner,owner);
  console.log("PARTS FAN automatic update: blanks, ownership, closed dialogs, duplicate claims, lost responses and readback verified");
}
verifyAutomaticUpdates().catch(error=>{console.error(error);process.exitCode=1;});
