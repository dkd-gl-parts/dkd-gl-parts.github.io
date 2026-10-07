// Loopback synthetic QA only. No credentials, Supabase calls or paid provider.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=page.indexOf('<section class="product-3d-prepared-inputs"');
const markup=page.slice(start,page.indexOf('</section>',start)+10);
const fixture=`
const params=new URLSearchParams(location.search),events=[];
const property=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
Object.defineProperty(HTMLImageElement.prototype,'src',{...property,set(url){
  // Only synthetic URL assignment is redirected; there is no live network.
  this.dataset.requested=url;property.set.call(this,'/photo.svg?view='+encodeURIComponent(this.alt));
}});
const images=['front','left','back','right'].map((view,i)=>({view,id:[171,175,179,172][i],rotation_clockwise:[0,270,0,90][i],
  bytes:20,sha256:String(i+1).repeat(64),width:3024,height:4032,stored:params.get('mode')!=='partial'}));
const plan={product_id:2639,product_kind:'aftermarket_new',plan_id:'synthetic-plan',plan_sha256:'72a66c307fc89f916f2305abbe97f77874f88a02fc3acab73196c3fbf7b3abaa',
  ready:images.every(i=>i.stored),generation_allowed:false,images};
const controller=DcatsPreparedInputs.create(document.querySelector('#product-3d-prepared-inputs'));
controller.open({target:{productId:2639,kind:'aftermarket_new'},isCurrent:()=>params.get('role')!=='staff',
  async invoke(action){events.push(action);if(params.get('mode')==='error')throw Error('Synthetic unavailable');
    if(action==='input_plan')return plan;
    if(action==='prepared_latest')return {status:'none'};
    if(!['input_preview','input_check','prepared_quote'].includes(action))throw Error('No upload or paid operation in this visual fixture');
    if(['input_check','prepared_quote'].includes(action)&&params.get('mode')==='balance-error')throw Error('Synthetic balance unavailable');
    const balance=params.get('mode')==='low'?10:70;
    return {...plan,images:images.map(i=>({...i,preview_url:'https://jqoeqximtwfpqwzngutj.supabase.co/storage/v1/object/sign/product-3d/tripo-input-review/'+i.view+'.jpg?token=synthetic'})),
      ...(['input_check','prepared_quote'].includes(action)?{request_key:'5e123f39-434b-4ac7-816c-ff7ea12b3290',estimated_credits:30,balance,balance_sufficient:balance>=30,can_start:params.get('mode')==='approved',
        blocked_reason:params.get('mode')==='approved'?null:'prepared_paid_approval_required',checked_at:new Date().toISOString()}: {})};
  },storage:{from(){throw Error('No Storage write in this fixture');}}});
document.querySelector('#close-fixture').addEventListener('click',()=>controller.close());
`;
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>整列入力・合成QA</title><link rel="stylesheet" href="/styles.css"><body><main class="product-3d-tripo-body"><h2>整列画像プレビュー（合成試験）</h2>${markup}<button id="close-fixture">閉じる</button></main><script src="/product-3d-prepared-inputs.js"></script><script type="module" src="/fixture.js"></script></body></html>`;
const csp=fs.readFileSync(path.join(root,'_headers'),'utf8').match(/Content-Security-Policy:\s*([^\r\n]+)/)[1].replace(/; upgrade-insecure-requests\s*$/,'');
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');let content,type;
  if(url.pathname==='/'){content=html;type='text/html';}
  else if(url.pathname==='/fixture.js'){content=fixture;type='text/javascript';}
  else if(url.pathname==='/photo.svg'){content='<svg xmlns="http://www.w3.org/2000/svg" width="360" height="280"><rect width="360" height="280" fill="#e1efed"/><circle cx="180" cy="120" r="85" fill="#586d79"/><text x="180" y="250" text-anchor="middle" font-size="16">'+String(url.searchParams.get('view')).replace(/[<>&"']/g,'')+'</text></svg>';type='image/svg+xml';}
  else if(['/styles.css','/product-3d-prepared-inputs.js'].includes(url.pathname)){content=fs.readFileSync(path.join(root,url.pathname.slice(1)));type=url.pathname.endsWith('css')?'text/css':'text/javascript';}
  else{res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':csp});res.end(content);
});
server.listen(0,'127.0.0.1',()=>process.stdout.write('http://127.0.0.1:'+server.address().port+'/\n'));
