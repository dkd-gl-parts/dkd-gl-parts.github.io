(function(){
  'use strict';
  var channel='dcats-workspace-support-v1';
  function valid(value,action){return !!value&&Object.keys(value).sort().join(',')==='canStart,folder,installed,mounted,running,startRequested,status'&&value.status==='workspace_status'&&
    ['installed','running','mounted','canStart','startRequested'].every(function(key){return typeof value[key]==='boolean';})&&['available','missing','unknown'].includes(value.folder)&&
    (value.mounted||value.folder!=='available')&&(value.installed||!value.canStart)&&(!value.startRequested||action==='start'&&value.canStart&&!value.running);}
  function classify(value){
    if(value.folder==='available'&&value.mounted)return 'ready';
    if(!value.installed&&!value.running)return 'not_installed';
    if(!value.running)return 'stopped';
    if(!value.mounted)return 'drive_missing';
    return value.folder==='missing'?'folder_missing':'unverified';
  }
  function request(action,isCurrent){return new Promise(function(resolve,reject){
    var id=window.crypto.randomUUID(),settled=false,timer,watch;
    function finish(value){if(settled)return;settled=true;window.clearTimeout(timer);window.clearInterval(watch);window.removeEventListener('message',receive);window.removeEventListener('pagehide',stop);if(value&&isCurrent())resolve(value);else reject(new Error('workspace_unavailable'));}
    function stop(){finish(null);}
    function receive(event){var data=event.data;if(event.source!==window||event.origin!==window.location.origin||!data||Object.keys(data).sort().join(',')!=='channel,data,id,type'||data.channel!==channel||data.type!=='result'||data.id!==id)return;finish(valid(data.data,action)?data.data:null);}
    window.addEventListener('message',receive);window.addEventListener('pagehide',stop);
    timer=window.setTimeout(stop,22000);watch=window.setInterval(function(){if(!isCurrent())stop();},200);
    try{window.postMessage({channel:channel,type:'request',id:id,action:action,expiresAt:Date.now()+4000},window.location.origin);}catch{stop();}
  });}
  function create(adapters){
    var owner='',epoch=0,busy=false,last=-Infinity,poll=null,phase='unverified',observed=null;
    function clear(){if(poll!==null){window.clearTimeout(poll);poll=null;}}
    function snapshot(){return {owner:owner,phase:phase,busy:busy,canStart:!!observed&&observed.canStart&&!observed.running&&!observed.startRequested,checks:observed};}
    function emit(){adapters.onChange(snapshot());}
    function setOwner(value){value=typeof value==='string'?value:'';if(owner===value)return;clear();owner=value;epoch++;busy=false;last=-Infinity;observed=null;phase='unverified';emit();}
    async function check(action,force){
      action=action||'inspect';if(!['inspect','start'].includes(action)||!owner||!adapters.isAllowed(owner)||!adapters.isVisible()||busy)return false;
      if(action==='inspect'&&!force&&Date.now()-last<30000)return false;
      if(action==='start'&&(!observed||!observed.canStart||observed.running))return false;
      clear();var actor=owner,generation=epoch;
      function current(){return actor===owner&&generation===epoch&&adapters.isAllowed(actor)&&adapters.isVisible();}
      busy=true;phase=action==='start'?'starting':'checking';emit();
      try{
        // A start request must be sent synchronously from the explicit button.
        // Only read-only inspections may first probe the extension version.
        if(action==='inspect'&&adapters.probe){var extension=await adapters.probe({isCurrent:current});if(!current())return false;
          var parts=extension&&String(extension.version).split('.').map(Number);if(!parts||parts.length!==3||!(parts[0]>0||parts[1]>5||parts[1]===5&&parts[2]>=17)){observed=null;phase='update_required';return false;}}
        var result=await (adapters.request||request)(action,current);if(!current())return false;
        if(!valid(result,action))throw new Error('workspace_unavailable');observed=result;phase=result.startRequested?'waiting':classify(result);last=Date.now();
        if(result.startRequested){var remaining=3;function recheck(){poll=window.setTimeout(async function(){poll=null;if(!current())return;await check('inspect',true);if(current()&&phase!=='ready'&&remaining-->0)recheck();},4000);}recheck();}
        return phase==='ready';
      }catch{if(current()){observed=null;phase='unavailable';last=Date.now();}return false;}
      finally{if(actor===owner&&generation===epoch){busy=false;if(!current()){observed=null;phase='unverified';}emit();}}
    }
    function cancel(){clear();epoch++;busy=false;last=-Infinity;observed=null;phase='unverified';emit();}
    return Object.freeze({setOwner:setOwner,check:check,cancel:cancel,snapshot:snapshot});
  }
  window.DcatsWorkspaceSupport=Object.freeze({create:create,classify:classify});
})();
