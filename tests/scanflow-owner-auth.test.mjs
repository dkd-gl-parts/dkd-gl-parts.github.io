import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {OwnerPresentationGate,OWNER,createExistingAuth,startOwnerPresentation} from '../scanflow/local-review/owner-auth.js';
const user=id=>({data:{user:{id,is_anonymous:false}},error:null});
function fixture(result=user(OWNER)){
 const states=[],clears=[],calls=[];let next=result;
 const auth={getUser:async()=>{calls.push('getUser');return typeof next==='function'?next():next;}};
 const gate=new OwnerPresentationGate({auth,onState:s=>states.push(s),onRevoke:()=>clears.push(true)});
 return{gate,states,clears,calls,set:r=>next=r};
}
test('locked default permits only server-verified fixed owner identity',async()=>{
 const x=fixture();assert.equal(x.gate.isAllowed(),false);const permit=await x.gate.authorize();assert.equal(permit(),true);assert.equal(x.gate.isAllowed(),true);assert.deepEqual(x.calls,['getUser']);
});
for(const[name,result,state]of[
 ['no session',{data:{user:null},error:null},'signed_out'],
 ['other user with forged owner metadata',{data:{user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_metadata:{owner_id:OWNER,role:'system_admin'}}},error:null},'other_user'],
 ['anonymous user',{data:{user:{id:OWNER,is_anonymous:true}},error:null},'other_user'],
 ['expired session',{data:null,error:{status:401}},'signed_out'],
 ['missing session',{data:null,error:{name:'AuthSessionMissingError'}},'signed_out'],
 ['Auth network error',{data:null,error:{status:0,name:'AuthRetryableFetchError'}},'unavailable']
])test('fails closed for '+name,async()=>{const x=fixture(result);assert.equal(await x.gate.authorize(),null);assert.equal(x.gate.isAllowed(),false);assert.equal(x.states.at(-1),state);assert.equal(x.clears.length,1);});
test('exceptions and bounded request timeout cannot leave an authorized view',async()=>{
 const x=fixture(()=>{throw new Error('synthetic offline');});assert.equal(await x.gate.authorize(),null);assert.equal(x.states.at(-1),'unavailable');
 const states=[];const gate=new OwnerPresentationGate({auth:{getUser:()=>new Promise(()=>{})},timeoutMs:5,onState:s=>states.push(s)});
 assert.equal(await gate.authorize(),null);assert.equal(states.at(-1),'unavailable');
});
test('logout immediately invalidates an existing file/save permit',async()=>{
 const x=fixture(),permit=await x.gate.authorize();x.gate.invalidate('signed_out');assert.equal(permit(),false);assert.equal(x.gate.isAllowed(),false);assert.equal(x.clears.length,1);
});
test('old successful Auth response cannot reopen a later denied session',async()=>{
 const x=fixture();let release;x.set(()=>new Promise(r=>release=r));const first=x.gate.authorize();x.set(user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));assert.equal(await x.gate.authorize(),null);release(user(OWNER));assert.equal(await first,null);assert.equal(x.gate.isAllowed(),false);
});
test('old failure cannot close a later correctly verified owner',async()=>{
 const x=fixture();let reject;x.set(()=>new Promise((_,r)=>reject=r));const first=x.gate.authorize();x.set(user(OWNER));const latest=await x.gate.authorize();reject(new Error('late synthetic failure'));assert.equal(await first,null);assert.equal(latest(),true);assert.equal(x.clears.length,0);
});
test('revalidation pauses presentation and invalidates previously issued permits',async()=>{
 const x=fixture(),first=await x.gate.authorize();let release;x.set(()=>new Promise(r=>release=r));const second=x.gate.authorize();assert.equal(first(),false);assert.equal(x.gate.isAllowed(),false);release(user(OWNER));assert.equal((await second)(),true);
});
test('disposed view cannot be reopened by a late Auth result or another operation',async()=>{
 const x=fixture();let release;x.set(()=>new Promise(r=>release=r));const pending=x.gate.authorize();x.gate.dispose();release(user(OWNER));assert.equal(await pending,null);assert.equal(await x.gate.authorize(),null);
});
const config={enabled:true,fixture:false,supabaseUrl:'https://jqoeqximtwfpqwzngutj.supabase.co',publishableKey:'sb_publishable_synthetic_fixture_only'};
test('existing configuration and SDK session are reused without reading or exporting a token',async()=>{
 let settings;const paths=[],auth={getUser(){},onAuthStateChange(){}};
 const result=await createExistingAuth({fetcher:async(url,options)=>{paths.push(url.pathname);assert.equal(options.redirect,'error');return{ok:true,json:async()=>config};},createClient:(url,key,options)=>{settings=options;assert.equal(url,config.supabaseUrl);assert.equal(key,config.publishableKey);return{auth};}});
 assert.equal(result,auth);assert.equal(paths.length,1);assert.ok(paths[0].endsWith('/scanflow/config.public.json'));
 assert.equal(settings.auth.storageKey,'sb-jqoeqximtwfpqwzngutj-auth-token');assert.equal(settings.auth.detectSessionInUrl,false);assert.equal(settings.auth.autoRefreshToken,false);
});
test('project substitution, disabled configuration and secret keys are refused before client construction',async()=>{
 for(const alter of [c=>c.supabaseUrl='https://other.supabase.co',c=>c.enabled=false,c=>c.fixture=true,c=>c.publishableKey='sb_secret_synthetic_only']){
  const c=structuredClone(config);alter(c);let clients=0;
  await assert.rejects(createExistingAuth({fetcher:async()=>({ok:true,json:async()=>c}),createClient:()=>{clients++;}}));assert.equal(clients,0);
 }
});
test('Auth subscription revokes before a later response; handler never reads the session argument',async()=>{
 class Element extends EventTarget{hidden=false;inert=false;disabled=false;textContent='';}
 const nodes=Object.fromEntries(['owner-content','auth-status','auth-retry','auth-badge'].map(k=>[k,new Element()]));
 class Doc extends EventTarget{visibilityState='visible';getElementById(id){return nodes[id];}}
 let change,clears=0;const auth={getUser:async()=>user(OWNER),onAuthStateChange:fn=>{change=fn;return{data:{subscription:{unsubscribe(){}}}};}};
 const dispose=await startOwnerPresentation(new Doc(),{createAuth:async()=>auth,onRevoke:()=>clears++});assert.equal(nodes['owner-content'].hidden,false);
 const sensitive=new Proxy({}, {get(){throw new Error('session must stay inside SDK');}});change('SIGNED_OUT',sensitive);
 assert.equal(nodes['owner-content'].hidden,true);assert.equal(nodes['owner-content'].inert,true);assert.equal(clears,1);dispose();
});
test('configuration failure remains locked and offers an explicit retry',async()=>{
 class Element extends EventTarget{hidden=false;inert=false;disabled=false;textContent='';}
 const nodes=Object.fromEntries(['owner-content','auth-status','auth-retry','auth-badge'].map(k=>[k,new Element()]));
 const doc={getElementById:id=>nodes[id]};let cleared=0;
 const dispose=await startOwnerPresentation(doc,{createAuth:async()=>{throw new Error('synthetic config offline');},onRevoke:()=>cleared++});
 assert.equal(nodes['owner-content'].hidden,true);assert.equal(nodes['auth-retry'].disabled,false);assert.equal(cleared,1);dispose();
});
test('HTML starts hidden and CSP allows only existing Auth as an external connection',async()=>{
 const html=await fs.readFile(new URL('../scanflow/local-review/index.html',import.meta.url),'utf8');
 assert.match(html,/id="owner-content" hidden inert/);assert.match(html,/connect-src 'self' https:\/\/jqoeqximtwfpqwzngutj\.supabase\.co\/auth\/v1\//);
 assert.ok(!html.includes('unsafe-inline'));assert.match(html,/\/vendor\/supabase-js-2\.115\.0\.js/);
 const src=await fs.readFile(new URL('../scanflow/local-review/owner-auth.js',import.meta.url),'utf8');
 assert.ok(!/\.(?:rpc|from|signInWithPassword|signUp|setSession|getSession)\s*\(/.test(src));
 assert.ok(!/user_metadata|access_token|refresh_token|console\./.test(src));
});
