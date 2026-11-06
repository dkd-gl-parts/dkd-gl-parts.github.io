const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),acorn=require('acorn');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const ast=acorn.parse(source,{ecmaVersion:'latest'}),functions=new Map(ast.body.filter(n=>n.type==='FunctionDeclaration').map(n=>[n.id.name,source.slice(n.start,n.end)]));
const translations=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='TRANSLATIONS'));
const names=['t','tf','esc','normalizeAsciiWidth','normalizeHanbaiouCustomerCode','customerRegistrationFieldValue','hanbaiouClosingCodeOptionsHtml','customerCollectionMethodOptionsHtml','customerCollectionDayOptionsHtml','collectHanbaiouCustomerCollectionSettings','validateHanbaiouCustomerCollectionSettings','customerCollectionSummary','syncCustomerCollectionSummary','collectHanbaiouCustomerBillingSettings','validateHanbaiouCustomerBillingSettings','saveCustomerAccessSettings'];
const code=source.slice(translations.start,translations.end)+'\n'+names.map(n=>{assert(functions.has(n),n);return functions.get(n)}).join('\n');
function harness({invalid=false,denied=false,rpcError=false,deferred=false,customerResult={data:{id:1,price_rank_code:'SYNTH-RANK'}}}={}){
 let resolve;const wait=deferred?new Promise(r=>resolve=r):Promise.resolve();
 const fields={'customer-collection-method':{value:'3'},'customer-collection-month':{value:invalid?'':'2'},'customer-collection-day':{value:'15'},'customer-hanbaiou-billing-code':{value:'SYNTH-001'},'customer-hanbaiou-closing-code':{value:'31'},'customer-access-rank-select':{value:'SYNTH-RANK'}};
 for(const field of Object.values(fields))field.focus=()=>{};
 const c={currentLang:'ja',currentCustomerAccessCustomer:{id:1,source_code:'hanbaiou',billing_customer_code:'SYNTH-001',closing_code:'31'},customerAccessSettingsSaving:false,customerAccessRows:[],customerAccessFilteredRows:[],salesCustomerOptions:[],detailSalesCustomerOptions:[],customerPortalPreviewContext:null,detailCustomerDisplaySettingsCache:{},calls:[],alerts:[],document:{getElementById:id=>fields[id]||null},canManageCustomerAccess:()=>!denied,syncCustomerDisplayRuleControls(){},updateCustomerAccessSaveState(){},collectCustomerDisplaySettings:()=>({show_sales_price:true}),collectCustomerAccessCategoryVisibility:()=>({}),defaultCustomerDisplaySettings:()=>({}),saveCustomerAccessCategoryVisibility:async()=>{},renderCustomerAccessList(){},loadCustomerAccessDetail:async()=>{},alert:x=>c.alerts.push(x),console:{warn(){}},fields};
 c.saveCustomerAccessCategoryVisibility=async()=>{c.calls.push({operation:'categories'});};
 c.renderCustomerAccessList=()=>{c.calls.push({operation:'render'});};
 c.loadCustomerAccessDetail=async()=>{c.calls.push({operation:'reload'});};
 c.sb={from(table){return{update(data){c.calls.push({table,data});return{eq(){return{select(){return{async maybeSingle(){await wait;return customerResult}}}}}}},async upsert(data){c.calls.push({table,data});return{data:null,error:null}}}},async rpc(name,args){c.calls.push({name,args});return rpcError?{error:{message:'synthetic failure'}}:{data:{sales_customer_id:1,billing_customer_code:args.target_billing_customer_code,closing_code:args.target_closing_code,collection_method_code:args.target_collection_method_code,collection_month_offset:args.target_collection_month_offset,collection_day:args.target_collection_day}}}};
 vm.createContext(c);vm.runInContext(code,c);return{c,resolve};
}
async function run(){
 const {c}=harness();
 assert.equal(c.customerCollectionSummary({collection_method_code:'3',collection_month_offset:2,collection_day:15}),'翌々月15日払い (振込)');
 assert(c.customerCollectionSummary({collection_month_offset:0,collection_day:31}).includes('当月末日'));
 assert.equal(c.customerCollectionSummary({collection_month_offset:null,collection_day:null}),'未設定');
 for(const patch of [{collection_method_code:'5'},{collection_month_offset:-1},{collection_month_offset:100},{collection_month_offset:2.5},{collection_day:0},{collection_day:32},{collection_day:null},{collection_month_offset:null}])assert(c.validateHanbaiouCustomerCollectionSettings({collection_method_code:'3',collection_month_offset:2,collection_day:15,...patch}));
 assert.equal(c.validateHanbaiouCustomerCollectionSettings({collection_method_code:null,collection_month_offset:null,collection_day:null}),null);
 for(const language of ['ja','en','zh']){c.currentLang=language;assert(!c.customerCollectionSummary({collection_method_code:'3',collection_month_offset:2,collection_day:15}).includes('customer_collection_'));assert.equal((c.customerCollectionDayOptionsHtml(31).match(/<option /g)||[]).length,32);}
 c.currentLang='ja';c.fields['customer-collection-month'].value='0';assert.equal(c.collectHanbaiouCustomerCollectionSettings().collection_month_offset,0);c.fields['customer-collection-month'].value='2';
 for(const language of ['ja','en','zh']){
  c.currentLang=language;
  const options=c.hanbaiouClosingCodeOptionsHtml('50',true);
  assert.equal((options.match(/<option /g)||[]).length,34);
  assert(options.includes("value='50' selected"));assert(!options.includes('hanbaiou_closing_'));
  for(const closing_code of [...Array.from({length:32},(_,i)=>String(i)),'50'])assert.equal(c.validateHanbaiouCustomerBillingSettings({billing_customer_code:'SYNTH-001',closing_code}),null);
  for(const closing_code of ['','-1','32','49','51','050','50.0','50x'])assert(c.validateHanbaiouCustomerBillingSettings({billing_customer_code:'SYNTH-001',closing_code}));
 }
 c.currentLang='ja';
 await c.saveCustomerAccessSettings();const rpc=c.calls.filter(x=>x.name);assert.equal(rpc.length,1);assert.equal(rpc[0].name,'save_hanbaiou_customer_collection_settings');assert.equal(rpc[0].args.target_sales_customer_id,1);assert.equal(rpc[0].args.target_collection_month_offset,2);assert.equal(rpc[0].args.target_collection_day,15);assert.equal(rpc[0].args.target_billing_customer_code,'SYNTH-001');assert.equal(rpc[0].args.target_closing_code,'31');assert.equal(c.currentCustomerAccessCustomer.collection_day,15);assert.equal(c.customerAccessSettingsSaving,false);
 for(const options of [{invalid:true},{denied:true}]){const {c}=harness(options);await c.saveCustomerAccessSettings();assert.equal(c.calls.length,0);}
 const failed=harness({rpcError:true}).c;await failed.saveCustomerAccessSettings();assert.equal(failed.currentCustomerAccessCustomer.collection_day,undefined);assert.equal(failed.customerAccessSettingsSaving,false);assert(failed.alerts.some(s=>s.includes('synthetic failure')));
 for(const customerResult of [{data:null},{data:undefined},{data:[]},{data:{}},{data:{id:2}},{data:null,error:{message:'synthetic update failure'}}]){
  const failed=harness({customerResult}).c;
  const before=JSON.stringify(failed.currentCustomerAccessCustomer),inputs=JSON.stringify(failed.fields);
  await failed.saveCustomerAccessSettings();
  assert.equal(failed.calls.length,1,'Unconfirmed update must stop before RPC, display/category writes and UI reload');
  assert.equal(failed.calls[0].table,'sales_customers');assert.equal(JSON.stringify(failed.currentCustomerAccessCustomer),before);
  assert.equal(JSON.stringify(failed.fields),inputs,'Unconfirmed update must preserve the draft');
  assert.equal(failed.customerAccessSettingsSaving,false);assert.equal(failed.alerts.length,1);
  assert(failed.alerts[0].startsWith(failed.t('msg_save_err')));assert(!failed.alerts.includes(failed.t('msg_saved')));
 }
 const fifty=harness({customerResult:{data:{id:'1',price_rank_code:'SYNTH-RANK'}}}).c;
 fifty.fields['customer-hanbaiou-closing-code'].value='50';await fifty.saveCustomerAccessSettings();
 assert.equal(fifty.calls.find(x=>x.name).args.target_closing_code,'50');assert(fifty.alerts.includes(fifty.t('msg_saved')));
 assert(fifty.calls.some(x=>x.operation==='reload'),'Normal upsert without returned data is still successful');
 for(const changeCustomer of [false,true]){const {c,resolve}=harness({deferred:true});const first=c.saveCustomerAccessSettings();await Promise.resolve();await c.saveCustomerAccessSettings();assert.equal(c.calls.length,1);if(changeCustomer)c.currentCustomerAccessCustomer={id:2};resolve();await first;assert.equal(c.calls.filter(x=>x.name).length,1);assert.equal(c.calls.find(x=>x.name).args.target_sales_customer_id,1);assert.equal(c.currentCustomerAccessCustomer.id,changeCustomer?2:1);}
 assert(source.includes('hanbaiouCollection: collectHanbaiouCustomerCollectionSettings()'));
 for(const id of ['customer-collection-method','customer-collection-month','customer-collection-day','customer-collection-summary'])assert(source.includes("id='"+id+"'"));
 assert.equal((source.match(/collection_method_code,collection_month_offset,collection_day,/g)||[]).length,2);
 console.log('Customer collection terms: translation, validation, unknown/zero/month-end, atomic RPC payload, dirty tracking, failure, double-submit and customer-switch checks passed.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
