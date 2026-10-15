(function () {
  "use strict";
  var channel="dcats-integration-status-v1";
  var fields=["extension","pc","identity","syncFolder","driveConfiguration","driveAuthorization","backupPassword","recovery","backupAdapter"];
  var features=["startup","overview","setup","connect","login","export","result","backup","backup_result","import_result"];
  function supportedVersion(version){
    var match=typeof version==="string"&&/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(version);
    return !!match&&(Number(match[1])>0||Number(match[2])>5||Number(match[2])===5&&Number(match[3])>=16);
  }
  function probeExtension(options){
    return new Promise(function(resolve,reject){
      if(!options||typeof options.isCurrent!=="function"||!options.isCurrent()){reject(new Error("session_changed"));return;}
      var id=window.crypto.randomUUID(),settled=false,timer,watch;
      function finish(value){
        if(settled)return;settled=true;
        window.clearTimeout(timer);window.clearInterval(watch);window.removeEventListener("message",receive);window.removeEventListener("pagehide",stop);
        if(value&&options.isCurrent())resolve(value);else reject(new Error("extension_unavailable"));
      }
      function stop(){finish(null);}
      function receive(event){
        var data=event.data;
        if(event.source!==window||event.origin!==window.location.origin||!data||
          Object.keys(data).sort().join(",")!=="channel,id,status,type,version"||data.channel!==channel||data.type!=="status"||data.id!==id)return;
        if(data.status!=="available"||typeof data.version!=="string"||!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(data.version)){stop();return;}
        finish({version:data.version});
      }
      window.addEventListener("message",receive);window.addEventListener("pagehide",stop);
      timer=window.setTimeout(stop,2500);watch=window.setInterval(function(){if(!options.isCurrent())stop();},100);
      try{window.postMessage({channel:channel,type:"probe",id:id,expiresAt:Date.now()+2000},window.location.origin);}catch{stop();}
    });
  }
  function create(adapters){
    var owner="",generation=0,sequence=0,running=false,started=false,observedDevice="",state;
    function initial(){var checks={};fields.forEach(function(key){checks[key]="unverified";});return checks;}
    function firstUse(){try{return adapters.storage.getItem("dcats-integration-guide-v1:"+owner)!=="1";}catch{return true;}}
    function snapshot(){return Object.freeze({owner:owner,phase:state.phase,reason:state.reason,feature:state.feature,firstUse:state.firstUse,checks:Object.freeze(Object.assign({},state.checks))});}
    function emit(){if(typeof adapters.onChange==="function")adapters.onChange(snapshot());}
    function setOwner(value){
      value=typeof value==="string"?value:"";
      if(value===owner&&state)return;
      owner=value;generation++;sequence++;running=false;started=false;observedDevice="";
      state={phase:"unverified",reason:"",feature:"startup",firstUse:!!owner&&firstUse(),checks:initial()};emit();
    }
    function acknowledgeGuide(){if(!owner||!adapters.isAllowed(owner))return;try{adapters.storage.setItem("dcats-integration-guide-v1:"+owner,"1");}catch{}
      state.firstUse=false;emit();}
    function storeReadiness(readiness){
      var allowed={identity:["available","unverified"],syncFolder:["available","unverified"],driveConfiguration:["available","unverified","configuration_required"],
        driveAuthorization:["available","unverified"],backupPassword:["available","registration_required","local_only"],recovery:["available","unverified"],backupAdapter:["available","unavailable"]};
      if(!readiness||readiness.status!=="production_backup_prerequisites"||readiness.actorId!==owner||readiness.deviceId!==observedDevice||
        !readiness.checks||Object.keys(readiness.checks).sort().join(",")!==Object.keys(allowed).sort().join(",")||typeof readiness.ready!=="boolean")return false;
      var keys=Object.keys(allowed);
      if(keys.some(function(key){return !allowed[key].includes(readiness.checks[key]);})||readiness.ready!==keys.every(function(key){return readiness.checks[key]==="available";}))return false;
      if(readiness.checks.identity!=="available")return false;
      keys.forEach(function(key){state.checks[key]=readiness.checks[key];});return true;
    }
    function observeReadiness(readiness){
      // Presentation only. check() always performs fresh reads before any action.
      if(running||!owner||!observedDevice||!adapters.isAllowed(owner)||!storeReadiness(readiness))return false;
      state.phase=readiness.ready?"ready":"attention";state.reason=readiness.ready?"":"settings_required";state.feature="overview";emit();return true;
    }
    async function check(feature,options){
      options=options||{};
      if(!features.includes(feature)||!owner||!adapters.isAllowed(owner)||typeof options.isCurrent!=="function"||!options.isCurrent())return {ok:false,reason:"session_changed"};
      if(running&&state.feature!=="startup")return {ok:false,reason:"busy"};
      var actor=owner,epoch=generation,request=++sequence;
      function current(){return actor===owner&&epoch===generation&&request===sequence&&adapters.isAllowed(actor)&&options.isCurrent();}
      function assertCurrent(){if(!current())throw new Error("session_changed");}
      function fail(reason){if(current()){state.phase="attention";state.reason=reason;emit();}return {ok:false,reason:reason};}
      running=true;observedDevice="";state={phase:"checking",reason:"",feature:feature,firstUse:state.firstUse,checks:initial()};emit();
      try{
        var extension=await adapters.probe({isCurrent:current});assertCurrent();
        if(!extension||!supportedVersion(extension.version)){state.checks.extension="outdated";return fail("extension_outdated");}
        state.checks.extension="available";
        if(feature==="startup"){state.phase="checked";emit();return {ok:true};}
        var record=await adapters.readDevice({actorId:actor,isCurrent:current});assertCurrent();
        if(!record||record.actor_id!==actor||typeof record.device_id!=="string")return fail("device_unavailable");
        state.checks.pc="available";
        if(options.expectedDevice&&record.device_id!==options.expectedDevice)return fail("device_changed");
        observedDevice=record.device_id;
        if(feature==="setup"){state.phase="checked";emit();return {ok:true,record:record};}
        var readiness=await adapters.readReadiness({actorId:actor,isCurrent:current});assertCurrent();
        if(!storeReadiness(readiness))return fail("identity_unverified");
        if(feature==="backup"&&!readiness.ready){var blocked=fail("settings_required");blocked.readiness=readiness;return blocked;}
        state.phase=readiness.ready?"ready":"attention";state.reason=readiness.ready?"":"settings_required";emit();
        assertCurrent();return {ok:true,record:record,readiness:readiness};
      }catch(error){
        if(!current())return {ok:false,reason:"session_changed"};
        var reasons={company_extension_reload_required:"extension_reload",company_extension_update_required:"extension_outdated",company_bridge_unavailable:"extension_unavailable",
          company_native_host_unavailable:"native_unavailable",company_device_unavailable:"device_unavailable",company_authentication_required:"authentication_required",
          company_not_authorized:"not_authorized",company_binding_unavailable:"identity_unverified",company_operation_unavailable:"busy",extension_unavailable:"extension_unavailable"};
        return fail(reasons[error&&error.message]||"check_unavailable");
      }finally{
        if(request===sequence){running=false;
          if(actor===owner&&epoch===generation&&state.phase==="checking"){
            state={phase:"unverified",reason:"",feature:feature,firstUse:state.firstUse,checks:initial()};emit();
          }
        }
      }
    }
    function start(){if(started||!owner)return Promise.resolve();started=true;return check("startup",{isCurrent:function(){return true;}});}
    setOwner("");
    return Object.freeze({setOwner:setOwner,start:start,check:check,snapshot:snapshot,acknowledgeGuide:acknowledgeGuide,observeReadiness:observeReadiness});
  }
  window.DcatsIntegrationReadiness=Object.freeze({create:create,probeExtension:probeExtension});
})();
