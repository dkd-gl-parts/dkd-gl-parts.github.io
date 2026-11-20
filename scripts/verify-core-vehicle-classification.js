const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const acorn = require('acorn');
const source = fs.readFileSync('app.js', 'utf8');
const ast = acorn.parse(source, {ecmaVersion:'latest'});
const names = ['coreCollectionUiLabel','coreCollectionReferencePages','coreCollectionVehicleClasses','coreCollectionVehicleText','readCoreCollectionVehicleForm','coreCollectionDisplayProduct','saveCoreCollectionForm','csvCoreCollectionCell','exportCoreCollectionCsv'];
const code = ast.body.filter(n=>n.type==='FunctionDeclaration'&&names.includes(n.id.name)).map(n=>source.slice(n.start,n.end)).join('\n');
const classes = [['kei','軽四'],['passenger','乗用車'],['truck','トラック'],['van','商用バン'],['bus','バス'],['machine','建機・農機'],['other','その他']];
function fixture(){
 const els = new Map(); const get = id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',disabled:false,classList:{remove(){}}});return els.get(id);};
 const calls=[]; let selected=['kei','truck'];
 const c={console,Blob,Date,CORE_COLLECTION_VEHICLE_CLASSES:classes,coreCollectionFormRank:null,coreCollectionFormSaving:false,coreCollectionFormSaveUnknown:false,coreCollectionFormMode:'edit',coreCollectionRows:[{id:9,dkd_shohin_id:42,vehicle_classes:[],source_rank:11,sort_order:12}],coreCollectionProductMap:{42:{manufacturer_part_number:'TEST-42',genuine_part_number:'TEST-G',manufacturer:'TEST'}},coreCollectionFilteredRows:[],currentUser:{id:'synthetic-only'},document:{getElementById:get,querySelectorAll:()=>selected.map(value=>({value})),body:{appendChild(){}},createElement:()=>({click(){},remove(){}})},URL:{createObjectURL(blob){c.csv=blob;return 'blob:synthetic';},revokeObjectURL(){}},nullableIntFromInput:id=>Number(get(id).value),nullableTextFromInput:id=>get(id).value||null,canManageProductionRecords:()=>true,writeLog:async()=>{},loadCoreCollectionList:async()=>{c.reloads=(c.reloads||0)+1;},t:x=>x,applyCoreCollectionFilters(){},coreListMode:"collection",coreManagementDataReady:true,coreCollectionSourceLabel:()=>"2025出荷ランキング",coreCollectionReportRank:true,isCoreReplenishmentRow:row=>row.target_quantity>0,coreCollectionRank:row=>row.reportRank||({rank:21,shipment:5}),coreCollectionCategoryRank:row=>row.reportRank?2:7,coreCollectionPriorityLabel:()=> '高',coreCollectionStatusLabel:status=>status==='unregistered'?'未登録':'収集中',productionCategoryLabel:()=> 'スタータ',coreCollectionStockQty:()=>3,coreCollectionShortageQty:()=>2};
 c.result=async()=>({data:{id:9},error:null});
 c.sb={from(table){const q={update(data){calls.push({table,data});return q;},insert(data){calls.push({table,data});return q;},eq(){return q;},select(){return q;},single(){return c.result();}};return q;}};
 Object.entries({'ccf-id':9,'ccf-dkd-id':42}).forEach(([k,v])=>get(k).value=v);
 get('ccf-target-quantity').valueAsNumber = 5;
 vm.createContext(c);vm.runInContext(code,c);return {c,get,calls,setSelected:v=>selected=v};
}
(async()=>{
 let checks=0;
 {const {c}=fixture();assert.equal(c.coreCollectionVehicleText({vehicle_classes:['truck','kei','kei','unknown']}),'軽四・トラック');assert.equal(c.coreCollectionVehicleText({}),'未分類');assert.equal(c.coreCollectionVehicleText({vehicle_classes:'truck'}),'未分類');checks+=3;}
 {const {c,calls}=fixture();await c.saveCoreCollectionForm();assert.equal(calls.length,1);assert.deepEqual(JSON.parse(JSON.stringify(calls[0].data.vehicle_classes)),['kei','truck']);assert.deepEqual(Object.keys(calls[0].data).sort(),['target_quantity','updated_at','updated_by','vehicle_classes']);assert.equal(calls[0].data.target_quantity,5);assert.equal(Object.hasOwn(calls[0].data,'priority'),false);assert.equal(c.coreCollectionRows[0].source_rank,11);assert.equal(c.reloads,1);checks+=7;}
 {const {c,calls,setSelected}=fixture();setSelected([]);await c.saveCoreCollectionForm();assert.deepEqual(JSON.parse(JSON.stringify(calls[0].data.vehicle_classes)),[]);checks++;}
 {const {c,calls}=fixture();c.canManageProductionRecords=()=>false;await c.saveCoreCollectionForm();assert.equal(calls.length,0);checks++;}
 {const {c,calls}=fixture();let release;c.result=()=>new Promise(r=>release=r);const first=c.saveCoreCollectionForm();const second=c.saveCoreCollectionForm();assert.equal(calls.length,1);release({data:{id:9},error:null});await Promise.all([first,second]);checks++;}
 {const {c,get}=fixture();c.result=async()=>({error:{code:'23514',message:'constraint rejected'}});await c.saveCoreCollectionForm();assert.equal(get('btn-core-collection-form-save').disabled,false);assert.equal(c.reloads,undefined);checks+=2;}
 {const {c,get,calls}=fixture();c.result=async()=>({error:{message:'network lost'}});await c.saveCoreCollectionForm();await c.saveCoreCollectionForm();assert.equal(calls.length,1);assert.equal(get('btn-core-collection-form-save').disabled,true);assert.match(get('core-collection-form-error').textContent,/再送せず/);checks+=3;}
 {const {c,get}=fixture();c.result=async()=>{throw Error('transport closed');};await c.saveCoreCollectionForm();assert.equal(get('btn-core-collection-form-save').disabled,true);checks++;}
 {const {c}=fixture();c.coreCollectionFilteredRows=Array.from({length:205},(_,i)=>({dkd_shohin_id:42,vehicle_classes:i%2?['kei','truck']:[],target_quantity:5}));c.exportCoreCollectionCsv();const text=await c.csv.text();assert.match(text,/車両区分/);assert.match(text,/軽四・トラック/);assert.match(text,/未分類/);assert.equal(text.split('\r\n').length,206);assert.match(text,/2025年総合順位/);assert.doesNotMatch(text,/優先度/);assert.match(text,/"21","5","2025出荷ランキング"/);checks+=7;}

 {
   const {c}=fixture();
   c.coreCollectionFilteredRows=[{status:'unregistered',reportRank:{rank:2,shipment:40,productCode:'0071'},reportProduct:{manufacturer_part_number:'QA-RAW'},target_quantity:null}];
   c.exportCoreCollectionCsv();const text=await c.csv.text();const [header,row]=text.split('\r\n');
   assert.match(header,/帳票商品コード/);assert.match(row,/"2","40"/);assert.match(row,/"未登録"/);
   assert.match(header,/2025年カテゴリ内順位/);
   assert.ok(row.endsWith('"QA-RAW","","","","","","","0071","2"'));checks+=5;
 }
 {const {c}=fixture();const text='長い参照品番'.repeat(50)+'\n'.repeat(12)+'END';const pages=c.coreCollectionReferencePages(text);assert.equal(pages.join(''),text);assert.ok(pages.every(p=>p.length<=120));assert.ok(pages.every(p=>(p.match(/\n/g)||[]).length<=3));checks+=3;}
 {const {c,calls,get}=fixture();get('ccf-id').value='';get('ccf-target-quantity').valueAsNumber=0;c.coreCollectionFormRank={rank:21,shipment:5};c.validateCoreCollectionMasterProduct=async()=>({data:{dkd_shohin_id:42}});c.isCoreCollectionMasterProduct=()=>true;await c.saveCoreCollectionForm();assert.equal(calls[0].data.dkd_shohin_id,42);assert.equal(calls[0].data.target_quantity,0);assert.equal(calls[0].data.source_type,'ranking');assert.equal(calls[0].data.source_rank,21);assert.equal(calls[0].data.shipment_count,5);checks+=5;}
 {const {c,calls,get}=fixture();for (const bad of [NaN,-1,1.5,2147483648]) {get('ccf-target-quantity').valueAsNumber=bad;await c.saveCoreCollectionForm();assert.match(get('core-collection-form-error').textContent,/必要数/);assert.equal(calls.length,0);checks+=2;}}

 console.log('Core vehicle classes: '+checks+' behavioral checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
