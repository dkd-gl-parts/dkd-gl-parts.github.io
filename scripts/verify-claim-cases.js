const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');const source=fs.readFileSync(path.join(root,'claim-cases.js'),'utf8');new vm.Script(source);
const context={};vm.createContext(context);vm.runInContext(source,context);const api=context.DcatsClaimCases;
const c={decision:'replacement',replacement_status:'created',shipment_status:'preparing',return_status:'received',inspection_status:'pending'};
const progress=api.progress(c);assert.equal(progress.find(x=>x[0]==='発送')[1],'出荷準備中');assert.equal(progress.find(x=>x[0]==='旧品受領')[1],'受領済み');assert.equal(progress.find(x=>x[0]==='旧品検査')[1],'未検査');
c.inspection_status='inspected';assert.equal(api.progress(c).find(x=>x[0]==='発送')[1],'出荷準備中');c.shipment_status='shipped';c.return_status='awaiting_return';assert.equal(api.progress(c).find(x=>x[0]==='旧品受領')[1],'未受領');
assert.equal(api.escape('<img src=x onerror=alert(1)>'),'&lt;img src=x onerror=alert(1)&gt;');assert.equal(api.escape('"\'&'),'&quot;&#39;&amp;');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(html.includes('id="screen-claim-case-mgmt"'));assert(html.indexOf('claim-cases.js?')<html.indexOf('src="app.js?'));assert(!/on(?:click|submit|load)=/.test(source));
console.log('Claim case UI contracts passed.');
