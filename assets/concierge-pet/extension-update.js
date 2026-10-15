(function(){'use strict';var channel='dcats-extension-update-v1',version=/^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
  function rank(value){var p=value.split('.').map(Number);return p[0]*1e8+p[1]*1e4+p[2];}
  function create(options){
    var phase='current',actual='',target='',challenge='',awaiting='',deferred=false,timer,dirty=new Map();
    var pendingKey='dcats-extension-update-pending-v1',onceKey='dcats-extension-update-reloaded-v1',verifiedKey='dcats-extension-update-verified-v1';
    function get(key){try{return options.storage.getItem(key)||'';}catch{return '';}}
    function put(key,value){try{options.storage.setItem(key,value);return options.storage.getItem(key)===value;}catch{return false;}}
    function valueOf(node){return node.isContentEditable?String(node.textContent):['checkbox','radio'].includes(node.type)?String(node.checked):node.multiple&&node.selectedOptions?Array.from(node.selectedOptions).map(function(v){return v.value;}).join('\u0000'):String(node.value);}
    function safe(){for(var pair of dirty){var node=pair[0];if(!node.isConnected||valueOf(node)===pair[1])dirty.delete(node);}return !dirty.size&&options.isAllowed()&&options.isSafe();}
    function snapshot(){return {phase:phase,version:actual,target:target};}
    function emit(){options.onChange(snapshot());}
    function post(value){options.post(Object.assign({channel:channel},value));}
    function ready(){if(challenge&&target)post({type:'ready',nonce:challenge,ready:safe()&&!(get(onceKey)===target&&actual&&rank(actual)<rank(target))});}
    function refresh(){
      if(!deferred||!target||!safe())return;
      if(get(onceKey)===target){phase='unavailable';deferred=false;emit();return;}
      if(!put(pendingKey,target)||!put(onceKey,target)){phase='unavailable';deferred=false;emit();return;}
      deferred=false;phase='applying';emit();options.reload();
    }
    function receive(value){
      if(!value||Object.keys(value).sort().join(',')!=='channel,nonce,phase,target,type,version'||value.channel!==channel||value.type!=='state'||
        !['current','pending','applying','refresh','invalid','uncertain','unavailable'].includes(value.phase)||typeof value.nonce!=='string'||value.nonce.length>100||
        typeof value.version!=='string'||value.version&&!version.test(value.version)||typeof value.target!=='string'||value.target&&!version.test(value.target))return;
      actual=value.version;if(value.target)target=value.target;challenge=value.nonce;
      if(value.phase==='current'){
        var pending=get(pendingKey),verified=get(verifiedKey);
        if(pending&&version.test(pending)&&actual&&rank(actual)>=rank(pending)){put(verifiedKey,actual);put(pendingKey,'');phase='updated';}
        else if(pending&&version.test(pending)&&actual&&rank(actual)<rank(pending))phase='unavailable';
        else phase=verified&&actual&&rank(actual)>=rank(verified)?'updated':'current';
      }else if(value.phase==='pending'){phase='pending';ready();}
      else if(value.phase==='applying'){awaiting=target;var prepared=!!target&&safe();phase=prepared?'applying':'waiting';post({type:'ready',nonce:challenge,ready:prepared});}
      else if(value.phase==='refresh'){
        if(!target||target!==awaiting)return;deferred=true;phase='waiting';refresh();
      }else if(value.phase==='unavailable'&&deferred){phase='waiting';refresh();}else phase=value.phase;
      emit();
    }
    function poll(){if(!options.isAllowed()){if(challenge)post({type:'ready',nonce:challenge,ready:false});return;}post({type:'probe'});if(deferred)refresh();else ready();}
    function remember(node){if(node&&(typeof node.value!=='undefined'||node.isContentEditable)&&!dirty.has(node))dirty.set(node,valueOf(node));}
    function activity(){if(challenge)post({type:'ready',nonce:challenge,ready:false});}
    function dirtyInput(node){if(node&&!dirty.has(node))dirty.set(node,String(node.defaultValue||''));activity();}
    function initialRequired(){if(!actual){phase='initial';emit();}}
    return Object.freeze({receive:receive,poll:poll,remember:remember,dirtyInput:dirtyInput,activity:activity,initialRequired:initialRequired,snapshot:snapshot});
  }
  window.DcatsExtensionUpdate=Object.freeze({create:create});
})();
