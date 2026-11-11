const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');const source=fs.readFileSync(path.join(root,'claim-cases.js'),'utf8');new vm.Script(source);
const context={};vm.createContext(context);vm.runInContext(source,context);const api=context.DcatsClaimCases;
const c={decision:'replacement',replacement_status:'created',shipment_status:'preparing',return_status:'received',inspection_status:'pending'};
const progress=api.progress(c);assert.equal(progress.find(x=>x[0]==='発送')[1],'出荷準備中');assert.equal(progress.find(x=>x[0]==='旧品受領')[1],'受領済み');assert.equal(progress.find(x=>x[0]==='旧品検査')[1],'未検査');
c.inspection_status='inspected';assert.equal(api.progress(c).find(x=>x[0]==='発送')[1],'出荷準備中');c.shipment_status='shipped';c.return_status='awaiting_return';assert.equal(api.progress(c).find(x=>x[0]==='旧品受領')[1],'未受領');
assert.equal(api.escape('<img src=x onerror=alert(1)>'),'&lt;img src=x onerror=alert(1)&gt;');assert.equal(api.escape('"\'&'),'&quot;&#39;&amp;');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(html.includes('id="screen-claim-case-mgmt"'));assert(html.indexOf('claim-cases.js?')<html.indexOf('src="app.js?'));assert(!/on(?:click|submit|load)=/.test(source));
const acorn=require('acorn');const app=fs.readFileSync(path.join(root,'app.js'),'utf8');const ast=acorn.parse(app,{ecmaVersion:2022});const route=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='refreshCoreReturnManagement');assert(route,'shared return scanner is missing');let routed=null;const scanContext={coreReturnManagementListSeq:0,document:{getElementById:id=>({value:id==='core-return-mgmt-search'?'CR1234-5678-9':'all'})},enterClaimCaseMgmt:async options=>{routed=options;},sb:{rpc:()=>{throw Error('claim code was sent to normal-core API');}}};vm.createContext(scanContext);vm.runInContext(app.slice(route.start,route.end),scanContext);scanContext.refreshCoreReturnManagement().then(()=>{assert.equal(routed.search,'CR123456789');assert.equal(routed.state,'all');assert.equal(routed.openSingle,true);console.log('Claim case UI and shared scanner contracts passed.');}).catch(error=>{console.error(error);process.exitCode=1;});

// The order-list entry must carry the exact source, and must never create a case by itself.
(async function(){
 const nodes=['salesOrderCanStartClaim','startSalesOrderClaimIntake'].map(name=>{const n=ast.body.find(x=>x.type==='FunctionDeclaration'&&x.id.name===name);assert(n,name);return app.slice(n.start,n.end);});
 const calls=[],ctx={canManageSalesOrders:()=>true,claimCaseReturnContext:{id:'old-case'},enterClaimCaseMgmt:async options=>calls.push(options),showPermissionDenied:()=>calls.push('denied')};vm.createContext(ctx);vm.runInContext(nodes.join('\n'),ctx);
 for(const status of ['shipped','completed'])assert.equal(ctx.salesOrderCanStartClaim({id:12,order_number:'123456789',status}),true);
 for(const status of ['submitted','accepted','shipping_ready','cancelled'])assert.equal(ctx.salesOrderCanStartClaim({id:12,order_number:'123456789',status}),false);
 assert.equal(ctx.salesOrderCanStartClaim(null),false);await ctx.startSalesOrderClaimIntake({id:12,order_number:'123456789',status:'shipped'});assert.equal(calls.length,1);assert.equal(calls[0].sourceOrderId,12);assert.equal(calls[0].sourceOrderNumber,'123456789');assert.equal(ctx.claimCaseReturnContext,null);
 ctx.canManageSalesOrders=()=>false;await ctx.startSalesOrderClaimIntake({id:12,order_number:'123456789',status:'shipped'});assert.equal(calls[1],'denied');assert.equal(calls.length,2);
 console.log('Order-source reception permission and selection contracts passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
