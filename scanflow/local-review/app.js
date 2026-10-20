import {startOwnerPresentation} from './owner-auth.js?v=20261020owner1';
import {inspectPagePng} from './png-contract.js?v=20261020owner1';
import {mountReview} from './review-core.js?v=20261020owner1';
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const SHA=/^[a-f0-9]{64}$/,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail=()=>{throw new Error('確認パケットの原本・画像・25項目の形式を確認できません。');};
export async function readPacket(packet){
 if(!exact(packet,['version','scope','fields','reference_image','identity_binding','document_full_confirmation','shared_authoritative_human_confirmation'])||
  packet.version!=='scanflow-local-review-packet/1'||packet.identity_binding!=='pending_existing_dcats_login'||packet.document_full_confirmation!==false||packet.shared_authoritative_human_confirmation!==false)fail();
 const s=packet.scope,img=packet.reference_image;
 if(!exact(s,['document_id','source_hash','document_revision_at_read','pages_total','selected_page','selected_fields','masked_original_image_sha256'])||
  !UUID.test(s.document_id)||!SHA.test(s.source_hash)||!Number.isSafeInteger(s.document_revision_at_read)||s.document_revision_at_read<1||
  s.pages_total!==7||s.selected_fields!==25||!Number.isInteger(s.selected_page)||s.selected_page<1||s.selected_page>7||!SHA.test(s.masked_original_image_sha256))fail();
 if(!exact(img,['mime','sha256','byte_length','width','height','base64'])||img.mime!=='image/png'||img.sha256!==s.masked_original_image_sha256||
  !Number.isSafeInteger(img.byte_length)||img.byte_length<57||img.byte_length>4*1024*1024||!Number.isInteger(img.width)||!Number.isInteger(img.height)||
  img.width<1||img.height<1||img.width>8192||img.height>8192||img.width*img.height>12000000||
  typeof img.base64!=='string'||img.base64.length>6*1024*1024||img.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(img.base64))fail();
 let bytes;try{bytes=Uint8Array.from(atob(img.base64),c=>c.charCodeAt(0));}catch{fail();}
 if(bytes.length!==img.byte_length)fail();
 if(bytes.length<26||new DataView(bytes.buffer).getUint32(16)!==img.width||new DataView(bytes.buffer).getUint32(20)!==img.height)fail();
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(digest!==img.sha256)fail();
 const dimensions=await inspectPagePng(bytes);
 if(dimensions.width!==img.width||dimensions.height!==img.height)fail();
 if(!Array.isArray(packet.fields)||packet.fields.length!==25)fail();
 const seen=new Set(),fields=packet.fields.map(f=>{
  if(!exact(f,['sample_id','field_key','rect','expected_text','visual_status','label'])||
   typeof f.sample_id!=='string'||!/^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(f.sample_id)||['constructor','prototype','__proto__'].includes(f.sample_id)||seen.has(f.sample_id)||
   typeof f.field_key!=='string'||f.field_key.length<1||f.field_key.length>120||typeof f.label!=='string'||f.label.length<1||f.label.length>200||
   typeof f.expected_text!=='string'||f.expected_text.length>10000||!['readable','unconfirmed','ai_visual_unconfirmed'].includes(f.visual_status)||
   !Array.isArray(f.rect)||f.rect.length!==4||!f.rect.every(Number.isSafeInteger)||
   f.rect[0]<0||f.rect[1]<0||f.rect[2]<=f.rect[0]||f.rect[3]<=f.rect[1]||f.rect[2]>img.width||f.rect[3]>img.height)fail();
  seen.add(f.sample_id);return Object.freeze({...f,rect:Object.freeze([...f.rect])});
 });
 return {data:Object.freeze({scope:Object.freeze({...s}),fields:Object.freeze(fields)}),image:new Blob([bytes],{type:'image/png'}),width:img.width,height:img.height};
}
export function mountPacketInput(document,{access}){
 if(typeof access?.authorize!=='function'||typeof access?.isAllowed!=='function')throw new Error('owner_presentation_required');
 const input=document.getElementById('packet-open'),status=document.getElementById('packet-status');
 let sequence=0,loaded=false,disposeReview=null,objectURL=null;
 const listeners=new AbortController();
 const clear=()=>{sequence++;loaded=false;disposeReview?.();disposeReview=null;if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;input.value='';input.disabled=false;document.getElementById('review-editor').hidden=true;document.getElementById('fields').replaceChildren();document.getElementById('field-jump').replaceChildren();document.getElementById('page').removeAttribute('src');for(const id of ['zoom','overview']){const c=document.getElementById(id);c.width=0;c.height=0;}for(const id of ['selected','selected-state','packet-scope','status'])document.getElementById(id).textContent='';document.getElementById('progress').textContent='確認 0/25';document.getElementById('save').disabled=true;status.textContent='まだ読み込んでいません。';};
 input.addEventListener('change',async()=>{
  const ticket=++sequence,file=input.files?.[0];input.value='';
  if(loaded)return;
  try{
   const permit=await access.authorize();if(!permit?.()||ticket!==sequence)return;
   if(!file||file.size>8*1024*1024)fail();
   status.textContent='確認パケットを読み込んでいます。';status.classList.remove('error');
   const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
   if(!permit()||ticket!==sequence)return;
   const parsed=await readPacket(JSON.parse(text));if(ticket!==sequence||!permit())return;
   const url=URL.createObjectURL(parsed.image),probe=new Image();probe.src=url;
   try{
    await probe.decode();if(ticket!==sequence||!permit()){URL.revokeObjectURL(url);return;}
    if(probe.naturalWidth!==parsed.width||probe.naturalHeight!==parsed.height)fail();
    const image=document.getElementById('page');image.src=url;await image.decode();
    if(ticket!==sequence||!permit()){URL.revokeObjectURL(url);return;}
    disposeReview=mountReview(document,parsed.data,{access});objectURL=url;loaded=true;input.disabled=true;
    document.getElementById('review-editor').hidden=false;
    document.getElementById('packet-scope').textContent=parsed.data.scope.selected_page+' / '+parsed.data.scope.pages_total+' 頁・原本SHA '+parsed.data.scope.source_hash.slice(0,12);
    status.textContent='読み込みました。表示画像と原本PDFを照合して、1項目ずつ確認してください。';

   }catch(error){URL.revokeObjectURL(url);throw error;}
  }catch{if(ticket===sequence){status.textContent='確認パケットを開けません。配布されたJSONファイルと容量を確認してください。';status.classList.add('error');}}
 },{signal:listeners.signal});
 return {clear,dispose:()=>{clear();listeners.abort();}};
}
export async function startReview(document,options={}){
 let editor;
 return startOwnerPresentation(document,{...options,onReady:access=>{editor=mountPacketInput(document,{access});options.onReady?.(access);},onRevoke:()=>{editor?.clear();options.onRevoke?.();}});
}
if(typeof document!=='undefined')void startReview(document);
