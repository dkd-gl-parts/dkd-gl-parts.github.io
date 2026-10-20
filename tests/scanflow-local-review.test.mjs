import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import fs from 'node:fs/promises';
import {readPacket} from '../scanflow/local-review/app.js';
import {draftRecord,restoreDraft,reviewRecord} from '../scanflow/local-review/review-core.js';
import {crc32} from '../scanflow/local-review/png-contract.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
function chunk(type,bytes){const h=Buffer.alloc(8),c=Buffer.alloc(4);h.writeUInt32BE(bytes.length);h.write(type,4);c.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type),bytes])));return Buffer.concat([h,bytes,c]);}
function packet(color=2){
 const h=Buffer.alloc(13);h.writeUInt32BE(32);h.writeUInt32BE(16,4);h[8]=8;h[9]=color;
 const image=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.alloc((32*(color===0?1:3)+1)*16))),chunk('IEND',Buffer.alloc(0))]);
 return {version:'scanflow-local-review-packet/1',scope:{document_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',source_hash:hash('synthetic source'),document_revision_at_read:8,pages_total:7,selected_page:1,selected_fields:25,masked_original_image_sha256:hash(image)},
 fields:Array.from({length:25},(_,i)=>({sample_id:'s'+i,field_key:'product_name',rect:[0,0,32,16],expected_text:'SYNTHETIC '+i,visual_status:'readable',label:'架空項目 '+(i+1)})),
 reference_image:{mime:'image/png',sha256:hash(image),byte_length:image.length,width:32,height:16,base64:image.toString('base64')},
 identity_binding:'pending_existing_dcats_login',document_full_confirmation:false,shared_authoritative_human_confirmation:false};
}
test('packet validates image bytes, dimensions, source metadata and exactly 25 unconfirmed fields',async()=>{
 const p=await readPacket(packet());assert.equal(p.data.fields.length,25);assert.equal(p.image.type,'image/png');assert.ok(Object.isFrozen(p.data.fields[0].rect));
 const values=Object.fromEntries(p.data.fields.map(f=>[f.sample_id,f.expected_text]));
 const draft=draftRecord(p.data.scope,p.data.fields,values,new Set(),0,3);
 assert.equal(draft.fields.filter(f=>f.checked).length,0);assert.equal(draft.document_full_confirmation,false);assert.equal(draft.shared_authoritative_human_confirmation,false);
 assert.equal(draft.identity_binding,'pending_existing_dcats_login');assert.throws(()=>reviewRecord(p.data.scope,p.data.fields,values,new Set()));
});
const mutations={
 authority:p=>p.document_full_confirmation=true,identity:p=>p.identity_binding='verified',duplicate:p=>p.fields[1].sample_id=p.fields[0].sample_id,
 prototype:p=>p.fields[0].sample_id='constructor',outside:p=>p.fields[0].rect=[0,0,33,16],count:p=>p.fields.pop(),
 imageHash:p=>p.reference_image.sha256='a'.repeat(64),size:p=>p.reference_image.byte_length++,MIME:p=>p.reference_image.mime='image/svg+xml',
 hugeImage:p=>p.reference_image.width=100000,extra:p=>p.scope.owner_id='untrusted',badProvenance:p=>p.fields[0].visual_status='human_confirmed',
};
for(const [name,change]of Object.entries(mutations))test('packet refuses '+name,async()=>{const p=packet();change(p);await assert.rejects(readPacket(p));});
test('partial save and restore retains local values, checks, field and zoom without authority',async()=>{
 const p=await readPacket(packet()),values=Object.fromEntries(p.data.fields.map(f=>[f.sample_id,f.expected_text]));values.s0='synthetic edited\nsecond line';
 const d=draftRecord(p.data.scope,p.data.fields,values,new Set(['s1','s2']),7,2.5);
 const r=restoreDraft(JSON.parse(JSON.stringify(d)),p.data.scope,p.data.fields);
 assert.equal(r.values.s0,values.s0);assert.deepEqual([...r.checked],['s1','s2']);assert.equal(r.current,7);assert.equal(r.zoom,2.5);
 assert.equal(d.fields[0].checked,false);assert.equal(d.fields[0].checked_value,null);
});
test('old local completed declaration resumes values with all checks clear',async()=>{
 const p=await readPacket(packet()),values=Object.fromEntries(p.data.fields.map(f=>[f.sample_id,f.expected_text]));
 const done=reviewRecord(p.data.scope,p.data.fields,values,new Set(p.data.fields.map(f=>f.sample_id)));
 const r=restoreDraft(done,p.data.scope,p.data.fields);assert.equal(r.checked.size,0);assert.equal(r.legacyValuesOnly,true);
 assert.equal(done.document_full_confirmation,false);assert.equal(done.shared_authoritative_human_confirmation,false);
});
test('stale source, changed checked value and malformed timestamp cannot replace a draft',async()=>{
 const p=await readPacket(packet()),values=Object.fromEntries(p.data.fields.map(f=>[f.sample_id,f.expected_text]));
 const original=draftRecord(p.data.scope,p.data.fields,values,new Set(['s1']),0,3);
 for(const change of [d=>d.scope.document_revision_at_read++,d=>d.fields[1].value='changed',d=>d.saved_utc='invalid']){
  const d=structuredClone(original);change(d);assert.throws(()=>restoreDraft(d,p.data.scope,p.data.fields));
 }assert.equal(values.s1,'SYNTHETIC 1');
});
test('document processing has no backend or browser-session access; Auth is isolated from the local records',async()=>{
 const base=new URL('../scanflow/local-review/',import.meta.url);
 const html=await fs.readFile(new URL('index.html',base),'utf8');
 assert.match(html,/connect-src 'self' https:\/\/jqoeqximtwfpqwzngutj\.supabase\.co\/auth\/v1\//);assert.match(html,/default-src 'none'/);assert.ok(!html.includes('unsafe-inline'));
 for(const n of ['app.js','review-core.js','png-contract.js']){
  const s=await fs.readFile(new URL(n,base),'utf8');assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(s),n);
  assert.ok(!/(?:localStorage|sessionStorage|document\.cookie)/.test(s),n);
 }
 // This release adds a direct route without changing the existing ScanFlow hub.
 // Every script/style reference must resolve to an existing file in this release.
 const site=new URL('https://dcats.invalid/scanflow/local-review/'),root=new URL('../',import.meta.url);
 const assets=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>new URL(m[1],site)).filter(u=>!u.pathname.endsWith('/'));
 assert.equal(assets.length,3);
 for(const asset of assets){assert.equal(asset.origin,site.origin);assert.ok((await fs.stat(new URL('.'+asset.pathname,root))).isFile(),asset.pathname);}
});


test('unchanged grayscale reference images remain valid without relaxing the backend worker contract',async()=>{const p=await readPacket(packet(0));assert.equal(p.width,32);assert.equal(p.height,16);});

test('existing dotted sample identifiers retain their exact identity',async()=>{const p=packet();p.fields.forEach((f,i)=>f.sample_id='synthetic.pdf_p1_'+i);const r=await readPacket(p);assert.equal(r.data.fields[0].sample_id,p.fields[0].sample_id);p.fields[0].sample_id='../outside';await assert.rejects(readPacket(p));});
