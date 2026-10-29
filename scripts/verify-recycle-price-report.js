const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomUUID,createHash} = require('node:crypto');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'customer-price-report.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
let count=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);count++;};
const ok=(a,label)=>{assert.ok(a,label);count++;};
const el={},listeners={},windows=[],calls=[];
let allowed=true,active=true,reply;
const element=id=>el[id] ||= {value:'',disabled:false,hidden:false,dataset:{},classList:{toggle(){}},
  querySelectorAll:()=>[],addEventListener:(event,fn)=>{(listeners[id] ||= {})[event]=fn;}};
const runtime={URL,Map,Intl,crypto:{randomUUID},APP_VERSION:'v-test',document:{getElementById:element},
  currentUser:{id:'actor-one'},showScreen(){},
  canManageCustomerAccess:()=>allowed,isScreenActive:()=>active,doLogout(){},enterManufacturingRankingReport(){},
  customerCategoryIsVisible:()=>true,esc:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  window:{location:{href:'https://example.test/index.html'},open(){const win={closed:false,document:{body:{},open(){},write(text){win.output=text;},close(){},getElementById(){return {addEventListener(){}};}},close(){this.closed=true;}};windows.push(win);return win;}},
  sb:{rpc:async(name,args)=>{calls.push({name,args});return reply(name,args);},from(){throw new Error('Recycle＋ must not read customer visibility');}}};
const exposed='globalThis.testReport={state,preview,issue,printHtml,applyReportType,loadVisibleCategories,loadHistory,reopen,checkIssueReceipt};';
vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,exposed+'})();'),runtime);
const api=runtime.testReport;
const data={report_type:'recycle_plus',report_title:'Recycle＋向け販売価格表',pricing:{revision:1},filters:{category_code:null,product_kind:null,part_number:null},
  preview_hash:'1'.repeat(32),rows:[{category_code:'alternator',category_label:'オルタネータ',gltek_part_number:'G-1',genuine_part_number:'TEST',manufacturer:'MITSUBISHI',manufacturer_part_number:'A001T123',sales_price_jpy:7100}],
  excluded_rows:[],summary:{candidate_count:1,included_count:1}};
const issued={...data,issue_id:1,issued_at:'2026-10-28T15:00:00Z',issued_by_name:'架空担当'};
const clone=v=>JSON.parse(JSON.stringify(v));
async function run(){
  ok(html.includes('id="cpr-report-type"') && html.includes('value="recycle_plus">Recycle＋向け'),'type selector uses requested name');
  ok(html.includes('src="assets/recycle-plus-logo.png" alt="Recycle＋"'),'provided logo has an accessible name');
  eq(createHash('sha256').update(fs.readFileSync(path.join(root,'assets/recycle-plus-logo.png'))).digest('hex'),'4f5d7d5f2b09235577980b16d50ef0a4777eb4555defc61dc3783eaf9d63e666','provided logo bytes unchanged');
  element('cpr-report-type').value='recycle_plus';api.applyReportType();
  eq(el['cpr-customer-field'].hidden,true);eq(el['cpr-recycle-brand'].hidden,false);eq(el['cpr-title'].textContent,'Recycle＋向け販売価格表');
  ok(!el['cpr-output-help'].textContent.includes('非公開'),'do not imply customer visibility rules apply to this channel');
  api.state.categoryOptions=['alternator','starter'];api.state.categories={alternator:'オルタネータ',starter:'スタータ'};
  await api.loadVisibleCategories();eq(el['cpr-category'].disabled,false);eq(el['cpr-preview-button'].disabled,false);
  reply=async()=>({data:clone(data)});await api.preview();
  eq(calls[0].name,'recycle_price_report');eq(calls[0].args.action,'preview');
  eq(Object.keys(calls[0].args.payload).sort(),['category_code','part_number','product_kind']);
  ok(!JSON.stringify(calls[0]).includes('customer'),'customer selection does not affect channel price');
  eq(el['cpr-issue-button'].disabled,false);ok(el['cpr-preview-rows'].innerHTML.includes('7,100円'));
  let release;reply=()=>new Promise(resolve=>{release=resolve;});const stale=api.preview();
  reply=async()=>({data:[]});
  el['cpr-report-type'].value='customer';listeners['cpr-report-type'].change();
  release({data:clone(data)});await stale;eq(api.state.preview,null,'old response cannot cross modes');
  el['cpr-report-type'].value='recycle_plus';api.applyReportType();await api.loadVisibleCategories();
  reply=async()=>({data:clone(data)});await api.preview();
  reply=async(name,args)=>({data:args.action==='history'?[]:clone(issued)});
  await api.issue();ok(windows.at(-1).output.includes('Recycle＋向け販売価格表'));
  ok(windows.at(-1).output.includes("alt='Recycle＋'"));ok(windows.at(-1).output.includes('assets/recycle-plus-logo.png'));
  ok(windows.at(-1).output.includes('<title>Recycle＋向け販売価格表_2026-10-29</title>'));
  ok(!windows.at(-1).output.includes('得意先</span>'),'channel print has no fake customer');
  ok(!windows.at(-1).output.includes('revision') && !windows.at(-1).output.includes('手数料率'),'private calculation settings do not print');
  const printed=api.printHtml({...issued,customer:{name:'<script>alert(1)</script>'}},{});
  ok(!printed.includes('<script>'));ok(printed.includes('送料・コア代・取引条件は別途ご確認ください。'));
  const old=api.printHtml({customer:{name:'架空得意先'},rows:[]},{});
  ok(!old.includes('recycle-plus-logo.png'),'customer reports do not acquire this brand');
  let finishHistory;reply=()=>new Promise(resolve=>{finishHistory=resolve;});
  const history=api.loadHistory();el['cpr-report-type'].value='customer';reply=async()=>({data:[]});await api.loadHistory();
  finishHistory({data:[{issue_id:1,report_name:'Recycle＋',issued_at:issued.issued_at,item_count:1}]});await history;
  ok(!el['cpr-history-list'].innerHTML.includes('Recycle＋'),'old history response cannot cross modes');
  el['cpr-report-type'].value='recycle_plus';reply=async()=>({data:clone(data)});await api.preview();
  reply=async()=>{throw new Error('network lost');};await api.issue();
  ok(api.state.pendingIssue);eq(el['cpr-receipt-button'].hidden,false);eq(el['cpr-report-type'].disabled,true);
  const callCount=calls.length;await api.issue();await api.preview();eq(calls.length,callCount,'unknown result blocks replay and new preview');
  reply=async(name,args)=>({data:args.action==='receipt'?{saved:true,issue:clone(issued)}:[]});
  await api.checkIssueReceipt();eq(api.state.pendingIssue,null);ok(windows.at(-1).output.includes('7,100円'));
  eq(calls.at(-2).args.action,'receipt');eq(el['cpr-report-type'].disabled,false);
  reply=async()=>({data:clone(data)});await api.preview();reply=async()=>({error:{code:'40001',message:'Price report preview changed'}});await api.issue();
  eq(api.state.preview,null);eq(api.state.pendingIssue,null,'explicit stale response is not an unknown write');
  reply=async()=>({data:clone(data)});await api.preview();reply=async()=>{throw new Error('network lost');};await api.issue();
  reply=async()=>({data:{saved:false,issue:null}});await api.checkIssueReceipt();eq(api.state.pendingIssue,null);eq(api.state.preview,null);
  allowed=false;const deniedCalls=calls.length;await api.preview();await api.reopen(1,'recycle_plus');eq(calls.length,deniedCalls);
  allowed=true;active=false;reply=async()=>({data:clone(data)});await api.preview();eq(api.state.preview,null,'inactive screen ignores preview');
  active=true;reply=async()=>({data:clone(data)});await api.preview();
  reply=async()=>({data:{...clone(data),summary:{candidate_count:2,included_count:1}}});await api.preview();eq(api.state.preview,null,'incomplete result fails closed');
  let completeOld;reply=()=>new Promise(resolve=>{completeOld=resolve;});const oldActor=api.preview();
  runtime.currentUser={id:'actor-two'};completeOld({data:clone(data)});await oldActor;
  eq(api.state.preview,null,'response cannot cross signed-in accounts');
  const pending={requestId:'old-id',actor:'actor-one',options:{}};
  api.state.pendingByActor['actor-one']=pending;api.state.pendingIssue=pending;
  el['cpr-report-type'].disabled=true;
  await runtime.window.enterCustomerPriceReport();
  eq(api.state.pendingIssue,null,'new user does not inherit another user receipt');eq(el['cpr-report-type'].disabled,false);
  runtime.currentUser={id:'actor-one'};await runtime.window.enterCustomerPriceReport();
  eq(api.state.pendingIssue,pending,'original user retains unresolved receipt');eq(el['cpr-report-type'].value,'recycle_plus');eq(el['cpr-receipt-button'].hidden,false);
  console.log(`Recycle＋ price report frontend: ${count} assertions passed`);
}
run().catch(error=>{console.error(error);process.exitCode=1;});
