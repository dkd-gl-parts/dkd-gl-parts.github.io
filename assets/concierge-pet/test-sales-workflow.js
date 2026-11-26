(function (global) {
"use strict";
var COMPANY="D-CATS連携テスト（実データ禁止）";
function same(a,b){return ["actorId","deviceId","loginName","companyName","fileName","slipNumber","sourceSha256","rowCount"].every(function(k){return a[k]===b[k];});}
function create(options){
 var native=global.DcatsHanbaiohTestSalesBridge, engine=global.DcatsConciergeBusinessFlow, prepared, flow, sessionId=global.crypto.randomUUID(), sequence=0;
 if(!native||!engine||!options||typeof options.current!=="function"||typeof options.login!=="function")throw Error("business_adapter_unavailable");
 function current(){var c=options.current();if(!c||c.admin!==true||c.record!==options.record||c.owner!==options.record.actor_id)throw Error("business_request_stale");return c;}
 function callOptions(){current();return {record:options.record,fileName:options.fileName,isCurrent:function(){try{current();return true;}catch{return false;}}};}
 var storageKey="dcats_test_sales_flow_v1:"+options.record.actor_id+":"+options.record.device_id+":"+options.fileName;
 function retained(){try{return global.sessionStorage.getItem(storageKey);}catch{throw Error("business_journal_unavailable");}}
 function save(value){try{global.sessionStorage.setItem(storageKey,value);if(global.sessionStorage.getItem(storageKey)!==value)throw Error();}catch{throw Error("business_journal_unavailable");}}
 function context(){current();return {roleCode:"system_admin",actorId:options.record.actor_id,deviceId:options.record.device_id,
  sessionId:sessionId,companyKey:COMPANY,companyUserId:prepared.loginName,revision:prepared.sourceSha256};}
 function receipt(status,j,extra){return Object.assign({verified:true,status:status,operationId:j.operationId,category:"sales",
  actorId:j.context.actorId,deviceId:j.context.deviceId,companyKey:COMPANY,companyUserId:prepared.loginName,sourceSha256:prepared.sourceSha256},extra||{});}
 function changed(value){if(typeof options.changed==="function")options.changed(value);}
 async function propose(direction){
  if(flow&&flow.snapshot().busy)throw Error("business_operation_busy");
  var token=++sequence;current();
  if(direction!=="import"&&direction!=="export")throw Error("business_request_invalid");
  if(direction==="import"&&retained())throw Error("business_outcome_requires_check");
  prepared=await native.inspect(callOptions());
  if(token!==sequence)throw Error("business_request_stale");
  context();
  flow=engine.create({atomicTransfer:true,currentContext:context,randomUUID:function(){return global.crypto.randomUUID();},
   resolveTarget:async function(){return {testCompany:true,companyLabel:COMPANY,userLabel:prepared.loginName,
    targetLabel:"テスト売上伝票 "+prepared.slipNumber,count:1,sourceSha256:prepared.sourceSha256,handle:prepared.fileName};},
   changed:changed,runStage:async function(stage,j){
    current();
    if(stage==="preflight"){var fresh=await native.inspect(callOptions());if(!same(fresh,prepared))throw Error("business_target_changed");return receipt("ready",j);}
    if(stage==="login"){var login=await options.login();current();if(!login||login.status!=="ui_login_verified"||login.code!=="HANBAIOH_CONTROLLED_UI_LOGIN_VERIFIED")throw Error("business_login_unverified");return receipt("login_verified",j);}
    if(stage==="transfer"||stage==="export"){
     // Retain before dispatch. Reload, closing a panel or losing the reply can
     // never turn an uncertain write into a fresh import.
     if(stage==="transfer")save("outcome_unknown");
     var value=stage==="transfer"?await native.importOnce(callOptions()):await native.verify(callOptions());
     current();
     if(!value||!same(Object.assign({fileName:prepared.fileName},value),prepared)||
        value.receiptVersion!==1||value.rowCount!==1||!value.vendorExportSha256||
        (stage==="transfer"?!["import_verified","already_present"].includes(value.status):value.status!=="readback_verified"))throw Error("business_result_unverified");
     save("verified");
     return receipt(stage==="transfer"?"transfer_verified":"export_verified",j,{count:1,sha256:value.vendorExportSha256,matched:true});
    }
    throw Error("business_adapter_unavailable");
   }});
  return flow.propose({direction:direction,category:"sales"});
 }
 return Object.freeze({propose:propose,reply:function(message,id){if(!flow)return Promise.resolve({handled:false});return flow.reply(message,id);},
  snapshot:function(){return flow?flow.snapshot():{state:"idle",busy:false};},
  cancel:function(){sequence++;if(flow)flow.cancel();native.cancelCurrent();},
  inspectResult:async function(){var value=await native.verify(callOptions());if(!same(Object.assign({fileName:prepared.fileName},value),prepared))throw Error("business_result_unverified");save("verified");return value;}
 });
}
function requestKind(message){
 var s=String(message||"").normalize("NFKC").trim();
 if(!/販売王/.test(s)||!/(テスト|試験)/.test(s)||/(方法|やり方|できますか|どう|教えて|説明|[?？])/.test(s))return null;
 if(/(出力|書き出し|エクスポート|結果確認|照合)/.test(s)&&!/(取込|取り込|インポート)/.test(s))return "export";
 if(/(取込|取り込|インポート)/.test(s))return "import";
 return null;
}
global.DcatsConciergeTestSalesWorkflow=Object.freeze({create:create,requestKind:requestKind});
})(typeof window!=="undefined"?window:globalThis);
