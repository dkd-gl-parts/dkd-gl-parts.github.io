// Presentation only. No document authorization, API/RPC, login, or token export.
export const OWNER='4baba302-8aed-4ac0-a35f-bc99100cb760';
const PROJECT='https://jqoeqximtwfpqwzngutj.supabase.co';
const STORAGE_KEY='sb-jqoeqximtwfpqwzngutj-auth-token';
export class OwnerPresentationGate{
 #auth;#state='locked';#epoch=0;#disposed=false;#stateChanged;#revoked;#timeout;
 constructor({auth,onState=()=>{},onRevoke=()=>{},timeoutMs=10000}){
  if(typeof auth?.getUser!=='function')throw new Error('existing_auth_required');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw new Error('bounded_auth_timeout_required');
  this.#auth=auth;this.#stateChanged=onState;this.#revoked=onRevoke;
  this.#timeout=timeoutMs;
 }
 isAllowed(){return !this.#disposed&&this.#state==='allowed';}
 #set(state){this.#state=state;this.#stateChanged(state);}
 invalidate(state='checking',erase=true){
  if(this.#disposed)return;
  this.#epoch++;this.#set(state);if(erase)this.#revoked();
 }
 async authorize(){
  if(this.#disposed)return null;
  const ticket=++this.#epoch;this.#set('checking');
  let timer;
  try{
   const {data,error}=await Promise.race([this.#auth.getUser(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('auth_timeout')),this.#timeout);})]);
   if(this.#disposed||ticket!==this.#epoch)return null;
   if(error){this.invalidate(error.status===401||error.status===403||error.name==='AuthSessionMissingError'?'signed_out':'unavailable');return null;}
   if(!data?.user){this.invalidate('signed_out');return null;}
   if(data.user.id!==OWNER||data.user.is_anonymous===true){this.invalidate('other_user');return null;}
   this.#set('allowed');
   return()=>!this.#disposed&&ticket===this.#epoch&&this.#state==='allowed';
  }catch{
   if(!this.#disposed&&ticket===this.#epoch)this.invalidate('unavailable');
   return null;
  }finally{clearTimeout(timer);}
 }
 dispose(){if(this.#disposed)return;this.invalidate('locked');this.#disposed=true;}
}
export async function createExistingAuth({createClient=globalThis.supabase?.createClient,fetcher=globalThis.fetch}={}){
 if(typeof createClient!=='function'||typeof fetcher!=='function')throw new Error('existing_auth_unavailable');
 const response=await fetcher(new URL('../config.public.json',import.meta.url),{cache:'no-store',credentials:'same-origin',redirect:'error'});
 if(!response.ok)throw new Error('existing_configuration_unavailable');
 const config=await response.json();
 if(config?.enabled!==true||config.fixture!==false||config.supabaseUrl!==PROJECT||
  typeof config.publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{10,200}$/.test(config.publishableKey))
  throw new Error('existing_configuration_invalid');
 // The existing SDK owns its normal session storage. Application code never reads a token.
 const client=createClient(PROJECT,config.publishableKey,{auth:{storageKey:STORAGE_KEY,detectSessionInUrl:false,autoRefreshToken:false}});
 if(typeof client?.auth?.getUser!=='function'||typeof client.auth.onAuthStateChange!=='function')throw new Error('existing_auth_invalid');
 return client.auth;
}
export async function startOwnerPresentation(document,{createAuth=createExistingAuth,onRevoke=()=>{},onReady=()=>{}}={}){
 const content=document.getElementById('owner-content'),status=document.getElementById('auth-status'),
  retry=document.getElementById('auth-retry'),badge=document.getElementById('auth-badge');
 let gate,subscription,disposed=false,timer;
 const controls=new AbortController();
 const messages={
  checking:'D-CATSのログインを確認しています。',allowed:'対象のD-CATSログインを確認しました。',
  signed_out:'D-CATSでログインしてから、この画面を開いてください。',
  other_user:'この画面は対象のD-CATSアカウントだけが利用できます。',
  unavailable:'ログインを確認できません。接続を確認してから、もう一度お試しください。',
  locked:'D-CATSのログイン確認が必要です。'
 };
 const stateChanged=state=>{
  content.hidden=state!=='allowed';content.inert=state!=='allowed';
  status.textContent=messages[state]||messages.locked;
  badge.textContent=state==='allowed'?'ログイン確認済み':'ロック中';
  retry.disabled=state==='checking';
 };
 stateChanged('checking');
 try{
  const auth=await createAuth();if(disposed)return;
  gate=new OwnerPresentationGate({auth,onState:stateChanged,onRevoke});
  const access=Object.freeze({isAllowed:()=>gate.isAllowed(),authorize:()=>gate.authorize()});
  onReady(access);
  subscription=auth.onAuthStateChange(event=>{
   if(disposed||event==='INITIAL_SESSION')return;
   clearTimeout(timer);
   gate.invalidate(event==='SIGNED_OUT'?'signed_out':'checking',['SIGNED_OUT','SIGNED_IN','USER_UPDATED'].includes(event));
   // Do not call Auth from inside its subscription lock.
   if(event!=='SIGNED_OUT')timer=setTimeout(()=>{void gate.authorize();},0);
  }).data?.subscription;
  retry.addEventListener('click',()=>{void gate.authorize();},{signal:controls.signal});
  document.addEventListener('visibilitychange',()=>{
   gate.invalidate('checking',false);
   if(document.visibilityState==='visible')void gate.authorize();
  },{signal:controls.signal});
  globalThis.addEventListener?.('pagehide',()=>gate.invalidate('locked',true),{signal:controls.signal});
  globalThis.addEventListener?.('pageshow',event=>{if(event.persisted)void gate.authorize();},{signal:controls.signal});
  await gate.authorize();
 }catch{stateChanged('unavailable');retry.disabled=false;retry.addEventListener('click',()=>globalThis.location?.reload(),{once:true,signal:controls.signal});onRevoke();}
 return()=>{disposed=true;clearTimeout(timer);controls.abort();subscription?.unsubscribe();gate?.dispose();};
}
