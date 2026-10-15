"use strict";
const assert=require("assert/strict"),fs=require("fs"),path=require("path"),vm=require("vm"),acorn=require("acorn");
const root=path.resolve(__dirname,".."),source=fs.readFileSync(path.join(root,"app.js"),"utf8");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const ast=acorn.parse(source,{ecmaVersion:"latest"});
const fn=ast.body.find(n=>n.type==="FunctionDeclaration"&&n.id.name==="openDcatsExtensionManager");
assert(fn,"Extension management action missing");
for(const name of ["title","hint","open","help","step_browser","step_address","step_reload","same_browser","opening","opened","unavailable"]){
  assert.equal((source.match(new RegExp("^    extension_manager_"+name+":","gm"))||[]).length,3,"Missing translation: "+name);
}
assert(html.includes('id="dcats-extension-manager"')&&html.includes('chrome://extensions/')&&html.includes('edge://extensions/'));
assert(!/href=["'](?:chrome|edge):/u.test(html),"Web pages must not use blocked internal links");
assert(source.includes('if(manager)manager.hidden=!allowed;'),"Management action must follow admin visibility");
const body=source.slice(fn.start,fn.end);
assert(!/\.rpc\(|\.invoke\(|sendNative|window\.open|clipboard|location\.href\s*=/u.test(body),"Viewer must not invoke business operations or unsafe direct navigation");
function fixture(){
  const listeners=new Set(),timers=new Map(),posts=[];let next=0,admin=true,visible=true;
  const button={disabled:false,setAttribute(){},removeAttribute(){}},status={textContent:"",setAttribute(){},removeAttribute(){}},help={open:false};
  const window={location:{origin:"https://dcats.daiko-denki.co.jp"},addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),
    setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),postMessage:value=>posts.push(value)};
  const elements={"dcats-extension-manager-open":button,"dcats-extension-manager-status":status,"dcats-extension-manager-help":help,
    "dcats-business-workspace-settings-overlay":{classList:{contains:()=>visible}}};
  const ctx={window,document:{getElementById:id=>elements[id]},currentUser:{id:"owner"},dcatsCompanyIntegrationEpoch:0,dcatsExtensionManagerBusy:false,
    isSystemAdmin:()=>admin,crypto:{randomUUID:()=>"00000000-0000-4000-8000-000000000001"},Date,t:key=>key};
  vm.runInNewContext(body,ctx);
  return {ctx,posts,button,status,help,listeners,timers,deny:()=>{admin=false;},hide:()=>{visible=false;},
    reply:(status="opened",change={})=>{for(const fn of [...listeners])fn({source:window,origin:window.location.origin,
      data:{channel:"dcats-extension-manager-v1",type:"result",id:posts[0].id,status},...change});},timeout:()=>{for(const fn of [...timers.values()])fn();}};
}
(async()=>{
  const f=fixture();assert.equal(f.posts.length,0);const pending=f.ctx.openDcatsExtensionManager();
  assert.equal(f.posts.length,1);assert(f.button.disabled);assert.equal(f.status.textContent,"extension_manager_opening");
  await f.ctx.openDcatsExtensionManager();assert.equal(f.posts.length,1);
  f.reply("opened",{origin:"https://outside.example"});f.reply("opened",{source:{}});assert(f.button.disabled);
  f.reply();await pending;assert(!f.button.disabled);assert.equal(f.status.textContent,"extension_manager_opened");assert.equal(f.listeners.size,0);assert.equal(f.timers.size,0);
  for(const mode of ["unavailable","timeout"]){const f=fixture();const pending=f.ctx.openDcatsExtensionManager();if(mode==="timeout")f.timeout();else f.reply("unavailable");await pending;
    assert(f.help.open);assert.equal(f.status.textContent,"extension_manager_unavailable");assert(!f.button.disabled);assert.equal(f.listeners.size,0);}
  for(const mode of ["deny","hide","signedout"]){const f=fixture();if(mode==="signedout")f.ctx.currentUser=null;else f[mode]();await f.ctx.openDcatsExtensionManager();assert.equal(f.posts.length,0);}
  for(const mode of ["owner","epoch","hide"]){const f=fixture(),pending=f.ctx.openDcatsExtensionManager();if(mode==="owner")f.ctx.currentUser={id:"other"};else if(mode==="epoch")f.ctx.dcatsCompanyIntegrationEpoch++;else f.hide();f.reply();await pending;assert.equal(f.status.textContent,"");}
  const broken=fixture();broken.ctx.crypto.randomUUID=()=>{throw Error("unavailable");};await broken.ctx.openDcatsExtensionManager();assert(broken.help.open);assert(!broken.button.disabled);
  console.log("Extension manager: origin, admin, busy, timeout, stale session, cleanup, failure and translations verified");
})().catch(error=>{console.error(error);process.exitCode=1;});
