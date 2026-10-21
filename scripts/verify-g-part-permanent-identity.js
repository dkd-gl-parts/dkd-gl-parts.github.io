const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),acorn=require('acorn');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),bulk=fs.readFileSync(path.join(root,'sales-pricing-lists.js'),'utf8');
const tree=acorn.parse(app,{ecmaVersion:'latest'}),functions=new Map(tree.body.filter(n=>n.type==='FunctionDeclaration').map(n=>[n.id.name,n]));
const text=name=>{const n=functions.get(name);assert.ok(n,name);return app.slice(n.start,n.end);};
function visit(n,owner,out){
 if(!n||typeof n!=='object')return;
 if(n.type==='FunctionDeclaration')owner=n.id.name;
 if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.object.name==='sb'&&n.callee.property.name==='rpc'){
  const rpc=n.arguments[0]?.value;if(typeof rpc==='string'&&/gltek/.test(rpc))out.push({rpc,owner});
 }
 for(const v of Object.values(n)){
  if(Array.isArray(v)){for(const c of v)visit(c,owner,out);}
  else if(v&&typeof v==='object')visit(v,owner,out);
 }
}
const routes=[];visit(tree,null,routes);
assert.deepEqual(routes.map(r=>r.rpc).sort(),['create_gltek_core_product','ensure_gltek_part_number_issued','issue_gltek_part_number']);
for(const r of routes)assert.ok(['saveCoreProductForm','callGltekPartNumberIssueRpc'].includes(r.owner),JSON.stringify(r));
assert.match(text('saveCoreProductForm'),/ensureGltekPartNumberIssuedForDkdId\(dkd,/);
assert.match(text('saveSalesPricing'),/ensureGltekPartNumberIssuedForDkdId\(dkdId,/);
assert.match(bulk,/root\.ensureGltekPartNumberIssuedForDkdId\(id,/);
assert.match(text('callGltekPartNumberIssueRpc'),/ensure_gltek_part_number_issued/);
assert.match(text('callGltekPartNumberIssueRpc'),/issue_gltek_part_number/);
const ensure=text('ensureGltekPartNumberIssuedForDkdId');
(async()=>{
 for(const context of ['product_add','product_edit','sales_pricing']){
  let calls=0,applied;
  const existing={dkd_shohin_id:123,manufacturer:'SAWAFUJI',manufacturer_part_number:'CORRECTED',gltek_part_number:'G0101-10020',gltek_base_manufacturer_code:'01',gltek_category_number_code:'01',gltek_serial_code:'10020'};
  const sandbox={fetchCoreProductForGltekIssue:async()=>({data:existing}),canIssueGltekPartNumber:()=>true,
   applyGltekPartNumberIssueResult:(id,result)=>{applied=result;},callGltekPartNumberIssueRpc:async()=>{calls++;throw Error('Existing number must not request issuance');}};
  const fn=vm.runInNewContext('('+ensure+')',sandbox);
  const result=await fn(123,{context});
  assert.equal(result.result.gltek_part_number,'G0101-10020');assert.equal(applied.gltek_part_number,'G0101-10020');assert.equal(calls,0);
  assert.equal((await fn(123,{context,isCurrent:()=>false})).reason,'session');
 }
 let calls=0;
 const sandbox={fetchCoreProductForGltekIssue:async()=>({data:{manufacturer:'DENSO',manufacturer_part_number:'PN'}}),
  canIssueGltekPartNumber:()=>true,applyGltekPartNumberIssueResult:()=>{},callGltekPartNumberIssueRpc:async()=>{calls++;return {data:{action:'issued',gltek_part_number:'G0102-10059'}};}};
 const fn=vm.runInNewContext('('+ensure+')',sandbox);
 assert.equal((await fn(124,{context:'sales_pricing'})).result.gltek_part_number,'G0102-10059');assert.equal(calls,1);
 assert.ok(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('メーカー・メーカー品番を修正しても変わりません'));
 for(const id of ['pf-g-part-number','sales-g-part-number'])assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),new RegExp('<output[^>]*id="'+id+'"'));
 console.log('Permanent G frontend routes: product add/edit, individual/bulk pricing, production GLTEK creation and legacy fallback use the common server path; existing and stale cases passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

