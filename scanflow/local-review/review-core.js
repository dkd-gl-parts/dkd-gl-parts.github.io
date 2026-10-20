// Local selected-field record only. Auth presentation is separate; no document API or token export.
function reviewRecord(scope,fields,values,checked,now=new Date()){
 if(fields.length!==25||checked.size!==fields.length||fields.some(f=>!checked.has(f.sample_id)))throw new Error('各項目を原本で確認してください。');
 if(fields.some(f=>typeof values[f.sample_id]!=='string'||values[f.sample_id].length>10000))throw new Error('値の形式を確認してください。');
 return {version:'scanflow-owner-local-review/1',scope,
   identity_binding:'pending_existing_dcats_login',document_full_confirmation:false,
   shared_authoritative_human_confirmation:false,
   owner_declaration:'selected_25_fields_reviewed',recorded_utc:now.toISOString(),
   fields:fields.map(f=>({sample_id:f.sample_id,field_key:f.field_key,rect:f.rect,
                value:values[f.sample_id],original_candidate_provenance:'ai_visual_unconfirmed',
                local_owner_check_declared:true}))};
}


const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const fail=message=>{throw new Error(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const validTime=x=>typeof x==='string'&&x.length<=40&&Number.isFinite(Date.parse(x));
function draftRecord(scope,fields,values,checked,current,zoom,now=new Date()){
 if(!Number.isInteger(current)||current<0||current>=fields.length||typeof zoom!=='number'||!Number.isFinite(zoom)||zoom<.25||zoom>5)fail('表示位置を確認してください。');
 if(fields.length!==25||fields.some(f=>typeof values[f.sample_id]!=='string'||values[f.sample_id].length>10000))fail('下書きの項目を確認してください。');
 return {version:'scanflow-owner-review-draft/2',scope,field_schema:fields.map(f=>({sample_id:f.sample_id,field_key:f.field_key,rect:f.rect})),
  identity_binding:'pending_existing_dcats_login',document_full_confirmation:false,shared_authoritative_human_confirmation:false,
  current,zoom,saved_utc:now.toISOString(),fields:fields.map(f=>({sample_id:f.sample_id,value:values[f.sample_id],
   checked:checked.has(f.sample_id),checked_value:checked.has(f.sample_id)?values[f.sample_id]:null}))};
}
function restoreDraft(record,scope,fields){
 if(record?.version==='scanflow-owner-local-review/1'){
  if(!exact(record,['version','scope','identity_binding','document_full_confirmation','shared_authoritative_human_confirmation','owner_declaration','recorded_utc','fields'])||
   record.identity_binding!=='pending_existing_dcats_login'||record.document_full_confirmation!==false||record.shared_authoritative_human_confirmation!==false||record.owner_declaration!=='selected_25_fields_reviewed'||!validTime(record.recorded_utc)||
   !same(record.scope,scope)||!Array.isArray(record.fields)||record.fields.length!==fields.length)fail('以前の確認票の原本と版が一致しません。');
  const values={};record.fields.forEach((r,i)=>{
   if(!exact(r,['sample_id','field_key','rect','value','original_candidate_provenance','local_owner_check_declared'])||r.sample_id!==fields[i].sample_id||r.field_key!==fields[i].field_key||!same(r.rect,fields[i].rect)||typeof r.value!=='string'||r.value.length>10000||
    r.original_candidate_provenance!=='ai_visual_unconfirmed'||r.local_owner_check_declared!==true)fail('以前の確認票の項目が一致しません。');
   values[r.sample_id]=r.value;
  });
  return {values,checked:new Set(),current:0,zoom:3,legacyValuesOnly:true};
 }
 if(!exact(record,['version','scope','field_schema','identity_binding','document_full_confirmation','shared_authoritative_human_confirmation','current','zoom','saved_utc','fields'])||
 record.version!=='scanflow-owner-review-draft/2'||record.identity_binding!=='pending_existing_dcats_login'||
 record.document_full_confirmation!==false||record.shared_authoritative_human_confirmation!==false||!validTime(record.saved_utc)||
 !same(record.scope,scope)||!same(record.field_schema,fields.map(f=>({sample_id:f.sample_id,field_key:f.field_key,rect:f.rect})))||
 !Number.isInteger(record.current)||record.current<0||record.current>=fields.length||typeof record.zoom!=='number'||!Number.isFinite(record.zoom)||record.zoom<.25||record.zoom>5||
 !Array.isArray(record.fields)||record.fields.length!==fields.length)fail('原本・項目・版が一致する下書きを選んでください。');
 const values={},checked=new Set();
 record.fields.forEach((r,i)=>{
  if(!exact(r,['sample_id','value','checked','checked_value'])||r.sample_id!==fields[i].sample_id||typeof r.value!=='string'||r.value.length>10000||
   typeof r.checked!=='boolean'||(r.checked?r.checked_value!==r.value:r.checked_value!==null))fail('下書きの確認状態が一致しません。');
  values[r.sample_id]=r.value;if(r.checked)checked.add(r.sample_id);
 });
 return {values,checked,current:record.current,zoom:record.zoom};
}
function mountReview(document,data,{access}){
 if(typeof access?.authorize!=='function'||typeof access?.isAllowed!=='function')throw new Error('owner_presentation_required');
 let active=true;const events=new AbortController();
 const listen=(target,event,handler)=>target.addEventListener(event,e=>{if(active&&access.isAllowed())handler(e);},{signal:events.signal});
 const authorize=async()=>{const permit=await access.authorize();return active&&permit?.()?permit:null;};
 const $=id=>document.getElementById(id),image=$('page'),canvas=$('zoom'),ctx=canvas.getContext('2d'),
  overview=$('overview'),overviewCtx=overview.getContext('2d');
 let checked=new Set(),values=Object.fromEntries(data.fields.map(f=>[f.sample_id,f.expected_text])),current=0,zoom=3;
 let stateRevision=0,importSequence=0;
 const controls=[];
 const save=(record,name)=>{
  const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 function update(){
  $('progress').textContent=`確認 ${checked.size}/${data.fields.length}（この画面内の途中状態）`;
  $('save').disabled=checked.size!==data.fields.length;
  $('zoom-level').textContent=`${Math.round(zoom*100)}%`;
 }
 function draw(){
  if(!image.complete||!image.naturalWidth)return;
  const f=data.fields[current],[x,y,right,bottom]=f.rect;
  const padding=12,l=Math.max(0,x-padding),t=Math.max(0,y-padding),
   r=Math.min(image.naturalWidth,right+padding),b=Math.min(image.naturalHeight,bottom+padding),w=r-l,h=b-t;
  zoom=Math.max(.25,Math.min(zoom,8192/w,8192/h,Math.sqrt(8000000/(w*h))));
  canvas.width=Math.round(w*zoom);canvas.height=Math.round(h*zoom);
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;
  ctx.drawImage(image,l,t,w,h,0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#dc5b00';ctx.lineWidth=3;
  ctx.strokeRect((x-l)*zoom,(y-t)*zoom,(right-x)*zoom,(bottom-y)*zoom);
  overview.width=image.naturalWidth;overview.height=image.naturalHeight;overviewCtx.drawImage(image,0,0);
  data.fields.forEach((q,i)=>{
   const[a,c,d,e]=q.rect;overviewCtx.strokeStyle=i===current?'#dc5b00':'#2761a3';overviewCtx.lineWidth=i===current?9:3;
   overviewCtx.strokeRect(a,c,d-a,e-c);overviewCtx.fillStyle=i===current?'#dc5b00':'#123e70';
   overviewCtx.font='bold 28px sans-serif';overviewCtx.fillText(String(i+1),a,Math.max(29,c-4));
  });
 }
 function focus(index){
  if(current!==index)stateRevision++;
  current=index;const f=data.fields[index];$('selected').textContent=`確認用画像 ${data.scope.selected_page} 頁・項目${index+1}/25：${f.label}`;
  $('selected-state').textContent=checked.has(f.sample_id)?'この項目は途中確認済みです。':'原本のオレンジ枠を見て値を確認してください。';
  document.querySelectorAll('.field').forEach((e,i)=>{e.classList.toggle('selected',i===index);e.hidden=i!==index;});
  $('field-jump').value=String(index);draw();update();
 }
 data.fields.forEach((f,i)=>{
  const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1}. ${f.label}`;$('field-jump').append(option);
  const row=document.createElement('div');row.className='field';
  const choose=document.createElement('button');choose.type='button';choose.className='choose-field';choose.textContent=`${i+1}. ${f.label}`;
  listen(choose,'click',()=>focus(i));
  const value=document.createElement('textarea');value.rows=2;value.maxLength=10000;value.spellcheck=false;value.autocomplete='off';value.value=f.expected_text;
  value.dataset.sample=f.sample_id;value.setAttribute('aria-label',f.label+' の確認値');
  const check=document.createElement('input');check.type='checkbox';check.checked=false;
  check.setAttribute('aria-label',f.label+' を原本で確認しました');
  listen(check,'change',()=>{stateRevision++;if(check.checked)checked.add(f.sample_id);else checked.delete(f.sample_id);focus(i);update();});
  listen(value,'input',()=>{stateRevision++;values[f.sample_id]=value.value;checked.delete(f.sample_id);check.checked=false;focus(i);$('status').textContent='変更した項目を原本で再確認してください。下書きは途中でも保存できます。';});
  listen(value,'focus',()=>focus(i));
  const ack=document.createElement('label');ack.className='check-ack';const ackText=document.createElement('span');ackText.textContent='表示画像と原本を照合';ack.append(check,ackText);
  row.append(choose,value,ack);$('fields').append(row);controls.push({value,check});
 });
 listen(image,'load',()=>focus(current));if(image.complete)focus(0);update();
 listen($('next'),'click',()=>focus((current+1)%data.fields.length));
 listen($('previous'),'click',()=>focus((current+data.fields.length-1)%data.fields.length));
 listen($('field-jump'),'change',()=>focus(Number($('field-jump').value)));
 listen($('input-current'),'click',()=>{controls[current].value.focus();controls[current].value.scrollIntoView({block:'center'});});
 listen($('zoom-plus'),'click',()=>{stateRevision++;zoom=Math.min(5,zoom+.5);draw();update();});
 listen($('zoom-minus'),'click',()=>{stateRevision++;zoom=Math.max(.25,zoom-.5);draw();update();});
 listen($('fit'),'click',()=>{stateRevision++;const f=data.fields[current];zoom=Math.max(.25,Math.min(5,$('crop-viewport').clientWidth/(f.rect[2]-f.rect[0]+24)));draw();update();});
 listen(overview,'click',e=>{
  const box=overview.getBoundingClientRect(),x=(e.clientX-box.left)*overview.width/box.width,y=(e.clientY-box.top)*overview.height/box.height;
  const index=data.fields.findIndex(f=>x>=f.rect[0]&&x<=f.rect[2]&&y>=f.rect[1]&&y<=f.rect[3]);if(index>=0)focus(index);
 });
 listen($('draft-save'),'click',async()=>{
  const permit=await authorize();if(!permit?.())return;
  save(draftRecord(data.scope,data.fields,values,checked,current,zoom),'ScanFlow_25項目_途中下書き.json');
  $('status').textContent='途中JSONのダウンロードを開始しました。保存先でファイルを確認してください。次回は同じパケットとJSONで再開できます。';
 });
 listen($('draft-open'),'change',async()=>{
  const sequence=++importSequence,revision=stateRevision,file=$('draft-open').files?.[0];
  $('draft-open').value='';
  try{
  if(!file||file.size>1024*1024)fail('下書きの容量を確認してください。');
  $('status').textContent='下書きを読み込んでいます。現在の入力は保持しています。';
  const permit=await authorize();if(!permit?.()||sequence!==importSequence)return;
  const text=await file.text();
  if(!active||!permit()||sequence!==importSequence)return;
  if(revision!==stateRevision){$('status').textContent='読み込み中に入力・確認・表示位置が変わったため、現在の状態を保持しました。再開する場合は、もう一度JSONを選んでください。';return;}
  const restored=restoreDraft(JSON.parse(text),data.scope,data.fields);
  stateRevision++;
  values=restored.values;checked=restored.checked;current=restored.current;zoom=restored.zoom;
  controls.forEach((c,i)=>{c.value.value=values[data.fields[i].sample_id];c.check.checked=checked.has(data.fields[i].sample_id);});
  focus(current);$('status').textContent=restored.legacyValuesOnly?'以前の確認票から値だけを再開しました。原本で各項目を再確認してください。':'この原本の途中下書きを再開しました。復元したチェックはローカル状態で、正規本人確認ではありません。';
 }catch{if(sequence===importSequence)$('status').textContent='下書きを再開できません。原本・項目・版を確認してください。現在の入力は保持しています。';}});
 listen($('save'),'click',async()=>{
  const permit=await authorize();if(!permit?.())return;
  save(reviewRecord(data.scope,data.fields,values,checked),'ScanFlow_選択25項目_本人確認票.json');
  $('status').textContent='25項目のローカル確認票のダウンロードを開始しました。共有ライブラリでの全頁確定は別に行います。';
 });
 return()=>{active=false;stateRevision++;importSequence++;events.abort();checked.clear();for(const key of Object.keys(values))delete values[key];for(const c of controls){c.value.value='';c.check.checked=false;}controls.length=0;};
}

export {reviewRecord,draftRecord,restoreDraft,mountReview};
