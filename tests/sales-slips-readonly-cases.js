(function(root) {
"use strict";
root.runSalesSlipsReadonlyCases = async function(document, create) {
  var results=[];
  function assert(ok,message){if(!ok)throw new Error(message);}
  function eq(a,b){assert(JSON.stringify(a)===JSON.stringify(b),"Expected "+JSON.stringify(b)+", got "+JSON.stringify(a));}
  function deferred(){var resolve;var promise=new Promise(function(r){resolve=r;});return {promise:promise,resolve:resolve};}
  async function settle(){for(var i=0;i<16;i++)await Promise.resolve();}
  function header(extra){return Object.assign({id:"9007199254740993",slip_number:"S-SYN-001",slip_type:"sale",original_slip_id:null,reversal_slip_id:null,
    selling_company_code:"SYN-A",customer_code:"00018",customer_name:"合成得意先",billing_customer_code:"00018",recorded_on:"2026-11-11",
    tax_timing:"per_slip",tax_state:"final",amount_basis_jpy:"1000",net_amount_jpy:"1000",tax_jpy:"100",total_jpy:"1100",item_count:1},extra);}
  function item(extra){return Object.assign({id:"1",line_no:1,line_kind:"product",product_label:"SYN-PART",quantity:1,unit_price_jpy:"1000",
    amount_jpy:"1000",tax_mode:"excluded",tax_rate_basis_points:1000,cost_state:"unknown",cost_total_jpy:null},extra);}
  function page(rows,extra){return Object.assign({contract_version:1,posting_enabled:false,rows:rows||[],has_more:false,next_before_id:null},extra);}
  function detail(row,items){return {contract_version:1,posting_enabled:false,status:"found",slip:row,items:items||[item()]};}
  function fixture(){
    var host=document.createElement("main");host.className="slip-body";document.body.append(host);
    var responses=[],calls=[],user="synthetic-user",permit=true,active=true;
    var view=create({host:host,currentUserId:function(){return user;},canRead:function(){return permit;},active:function(){return active;},
      rpc:async function(name,payload){assert(["list_sales_slips_readonly","get_sales_slip_readonly"].includes(name),"Mutation RPC forbidden");
        calls.push({name:name,payload:payload});assert(responses.length>0,"Unexpected RPC");var r=responses.shift();return typeof r==="function"?r():r;}});
    function put(data){responses.push({data:data,error:null});}
    async function click(text){var b=Array.from(host.querySelectorAll("button")).find(function(b){return b.textContent===text;});assert(b,"Missing button "+text);b.click();await settle();}
    async function submit(){host.querySelector("form").dispatchEvent(new root.Event("submit",{bubbles:true,cancelable:true}));await settle();}
    return {host:host,view:view,put:put,responses:responses,calls:calls,click:click,submit:submit,
      text:function(){return host.textContent;},input:function(n){return host.querySelector('[name="'+n+'"]');},
      user:function(v){user=v;},permit:function(v){permit=v;},active:function(v){active=v;},
      dispose:function(){view.reset();host.remove();}};
  }
  async function test(name,fn){var f=fixture();try{await fn(f);results.push({name:name,pass:true});}catch(e){results.push({name:name,pass:false,error:String(e.message||e)});}finally{f.dispose();}}
  await test("OFFで空一覧を正常表示",async function(f){f.put(page());await f.view.enter();assert(f.text().includes("機能はOFF")&&f.text().includes("ありません"),"Empty/OFF message");eq(f.calls.length,1);});
  await test("伝票ごとの確定金額と先頭ゼロを保持",async function(f){f.put(page([header()]));await f.view.enter();assert(f.text().includes("00018")&&f.text().includes("1,100 円"),"Frozen amount/customer code");});
  await test("締め時一括の税額と合計を未確定表示",async function(f){f.put(page([header({tax_timing:"per_closing",tax_state:"pending_closing",net_amount_jpy:null,tax_jpy:null,total_jpy:null})]));await f.view.enter();eq(Array.from(f.host.querySelectorAll("td")).slice(-2).map(function(c){return c.textContent;}),["締め時に確定","締め時に確定"]);});
  await test("詳細の未確定原価をゼロ補完しない",async function(f){var h=header();f.put(page([h]));await f.view.enter();f.put(detail(h));await f.click(h.slip_number);assert(f.text().includes("未確定"),"Unknown cost");eq(f.calls[1].payload,{p_slip_id:h.id});});
  await test("赤伝票の負数を保存値で表示",async function(f){f.put(page([header({slip_type:"return",amount_basis_jpy:"-1000",net_amount_jpy:"-1000",tax_jpy:"-100",total_jpy:"-1100"})]));await f.view.enter();assert(f.text().includes("取消（赤伝票）")&&f.text().includes("-1,100 円"),"Negative frozen values");});
  await test("安全整数上限を超える金額を丸めない",async function(f){f.put(page([header({amount_basis_jpy:"9007199254740993",net_amount_jpy:"9007199254740993",tax_jpy:"0",total_jpy:"9007199254740993"})]));await f.view.enter();assert(f.text().includes("9,007,199,254,740,993 円"),"BigInt precision");});
  await test("一覧の得意先名をHTMLとして実行しない",async function(f){f.put(page([header({customer_name:'<img src=x onerror="alert(1)">'})]));await f.view.enter();assert(f.text().includes("<img")&&!f.host.querySelector("img"),"XSS list");});
  await test("明細品番と取消理由をHTMLとして実行しない",async function(f){var h=header({correction_reason:"<img src=x>"});f.put(page([h]));await f.view.enter();f.put(detail(h,[item({product_label:"<img src=x>"})]));await f.click(h.slip_number);assert(f.text().includes("<img")&&!f.host.querySelector("img"),"XSS detail");});
  await test("送料・コア代金の課税明細を表示",async function(f){var h=header({item_count:2});f.put(page([h]));await f.view.enter();f.put(detail(h,[item({line_kind:"shipping"}),item({line_no:2,line_kind:"core"})]));await f.click(h.slip_number);assert(f.text().includes("送料")&&f.text().includes("コア代金")&&f.text().includes("10%"),"Taxable charge rows");});
  await test("検索・日付・区分を読取APIへ渡す",async function(f){f.put(page());await f.view.enter();f.input("search").value="  00018  ";f.input("from").value="2026-11-01";f.input("to").value="2026-11-30";f.input("type").value="return";f.put(page());await f.submit();eq(f.calls[1].payload,{p_search:"00018",p_from:"2026-11-01",p_to:"2026-11-30",p_slip_type:"return",p_limit:50,p_before_id:null});});
  await test("不正な日付範囲は通信前に拒否",async function(f){f.put(page());await f.view.enter();f.input("from").value="2026-11-30";f.input("to").value="2026-11-01";await f.submit();eq(f.calls.length,1);assert(f.text().includes("検索条件を確認"),"Invalid filter");});
  await test("次ページをID文字列で取得",async function(f){var h=header();f.put(page([h],{has_more:true,next_before_id:h.id}));await f.view.enter();f.put(page());await f.click("次の50件");eq(f.calls[1].payload.p_before_id,h.id);});
  await test("フィルター変更時はページカーソルを破棄",async function(f){var h=header();f.put(page([h],{has_more:true,next_before_id:h.id}));await f.view.enter();f.input("search").value="new";f.put(page());await f.click("次の50件");eq(f.calls[1].payload.p_before_id,null);});
  await test("RPC未提供を0件と誤表示しない",async function(f){f.responses.push({error:{code:"PGRST202"}});await f.view.enter();assert(f.text().includes("準備中")&&!f.text().includes("ありません"),"Unavailable != empty");eq(f.calls.length,1);});
  await test("権限エラーを0件と誤表示しない",async function(f){f.responses.push({error:{code:"42501"}});await f.view.enter();assert(f.text().includes("閲覧権限")&&!f.text().includes("ありません"),"Permission != empty");});
  await test("通信例外で自動再試行しない",async function(f){f.responses.push(function(){throw new Error("synthetic network failure");});await f.view.enter();eq(f.calls.length,1);assert(f.text().includes("取得できません"),"Network failure");});
  await test("権限のない利用者はRPCを呼ばない",async function(f){f.permit(false);await f.view.enter();eq(f.calls.length,0);eq(f.text(),"");});
  await test("不明な応答版を拒否",async function(f){f.put(page([header()],{contract_version:2}));await f.view.enter();assert(f.text().includes("取得できません")&&!f.text().includes("S-SYN-001"),"Unknown contract");});
  await test("数値化されたbigint金額を拒否",async function(f){f.put(page([header({total_jpy:1100})]));await f.view.enter();assert(f.text().includes("取得できません"),"Unsafe number rejected");});
  await test("締め時一括に確定税が混入した応答を拒否",async function(f){f.put(page([header({tax_timing:"per_closing",tax_state:"pending_closing"})]));await f.view.enter();assert(f.text().includes("取得できません"),"Premature tax rejected");});
  await test("重複行IDを拒否",async function(f){f.put(page([header(),header()]));await f.view.enter();assert(f.text().includes("取得できません"),"Duplicate IDs rejected");});
  await test("不正なページカーソルを拒否",async function(f){f.put(page([header()],{has_more:true,next_before_id:"1"}));await f.view.enter();assert(f.text().includes("取得できません"),"Bad cursor rejected");});
  await test("明細不存在を安全に表示",async function(f){var h=header();f.put(page([h]));await f.view.enter();f.put({contract_version:1,posting_enabled:false,status:"not_found"});await f.click(h.slip_number);assert(f.text().includes("この伝票は表示できません"),"Not found");});
  await test("別IDの明細応答を拒否",async function(f){var h=header();f.put(page([h]));await f.view.enter();f.put(detail(header({id:"1"})));await f.click(h.slip_number);assert(f.text().includes("取得できません"),"Wrong detail ID");});
  await test("明細件数の不一致を拒否",async function(f){var h=header({item_count:2});f.put(page([h]));await f.view.enter();f.put(detail(h));await f.click(h.slip_number);assert(f.text().includes("取得できません"),"Item count");});
  await test("原価未確定に金額が混入した応答を拒否",async function(f){var h=header();f.put(page([h]));await f.view.enter();f.put(detail(h,[item({cost_total_jpy:"0"})]));await f.click(h.slip_number);assert(f.text().includes("取得できません"),"Unknown cost amount rejected");});
  await test("画面離脱後の遅延応答を破棄",async function(f){var d=deferred();f.responses.push(function(){return d.promise;});var pending=f.view.enter();f.view.reset();d.resolve({data:page([header()])});await pending;eq(f.text(),"");});
  await test("利用者交代後の遅延応答を破棄",async function(f){var d=deferred();f.responses.push(function(){return d.promise;});var pending=f.view.enter();f.user("another-user");d.resolve({data:page([header()])});await pending;eq(f.text(),"");});
  await test("権限失効後の遅延応答を破棄",async function(f){var d=deferred();f.responses.push(function(){return d.promise;});var pending=f.view.enter();f.permit(false);d.resolve({data:page([header()])});await pending;eq(f.text(),"");});
  await test("一覧検索の古い応答で最新結果を上書きしない",async function(f){f.put(page());await f.view.enter();var d=deferred();f.responses.push(function(){return d.promise;});await f.submit();f.put(page([header({slip_number:"LATEST"})]));await f.submit();d.resolve({data:page([header({slip_number:"STALE"})])});await settle();assert(f.text().includes("LATEST")&&!f.text().includes("STALE"),"List race");});
  await test("詳細の古い応答で新しい選択を上書きしない",async function(f){var a=header(),b=header({id:"2",slip_number:"SECOND"});f.put(page([a,b]));await f.view.enter();var d=deferred();f.responses.push(function(){return d.promise;});await f.click(a.slip_number);f.put(detail(b,[item({product_label:"LATEST-DETAIL"})]));await f.click(b.slip_number);d.resolve({data:detail(a,[item({product_label:"STALE-DETAIL"})])});await settle();assert(f.text().includes("LATEST-DETAIL")&&!f.text().includes("STALE-DETAIL"),"Detail race");});
  await test("一覧再検索で未完了の詳細を破棄",async function(f){var h=header();f.put(page([h]));await f.view.enter();var d=deferred();f.responses.push(function(){return d.promise;});await f.click(h.slip_number);f.put(page());await f.submit();d.resolve({data:detail(h,[item({product_label:"STALE-DETAIL"})])});await settle();assert(!f.text().includes("STALE-DETAIL"),"Detail after refresh");});
  await test("元伝票と赤伝票のリンクは読取だけ",async function(f){var h=header({reversal_slip_id:"2"});f.put(page([h]));await f.view.enter();f.put(detail(h));await f.click(h.slip_number);var r=header({id:"2",slip_type:"return",original_slip_id:h.id});f.put(detail(r));await f.click("取消の赤伝票を見る");eq(f.calls[2],{name:"get_sales_slip_readonly",payload:{p_slip_id:"2"}});assert(f.text().includes("元の売上伝票を見る"),"Reverse link");});
  await test("表示は更新・取消・印刷操作を提供しない",async function(f){var h=header();f.put(page([h]));await f.view.enter();f.put(detail(h));await f.click(h.slip_number);assert(!Array.from(f.host.querySelectorAll("button")).some(function(b){return /^(保存|登録|取消する|印刷|計上|確定)/.test(b.textContent);}),"Write control forbidden");eq(f.calls.map(function(c){return c.name;}),["list_sales_slips_readonly","get_sales_slip_readonly"]);});
  return results;
};
})(typeof window!=="undefined"?window:globalThis);

(function(root) {
"use strict";
root.runSalesSlipsReadonlyAccessCases = async function(document, createGate) {
  var results=[];
  function assert(ok,message){if(!ok)throw new Error(message);}
  function deferred(){var resolve;return {promise:new Promise(function(r){resolve=r;}),resolve:function(v){resolve(v);}};}
  async function test(name, run) {
    var context={key:"owner-a:company-a:sales-editor",role:true,admin:false},responses=[],calls=[],timeout=null;
    var button=document.createElement("button");button.textContent="売上伝票を確認";button.hidden=true;document.body.append(button);
    var gate=createGate({setTimeout:function(fn,ms){assert(ms===10000,"Bounded lookup");timeout=fn;return 1;},clearTimeout:function(){timeout=null;},canRead:function(){return context.role;},isSystemAdmin:function(){return context.admin;},contextKey:function(){return context.key;},
      changed:function(allowed){button.hidden=!allowed;},
      rpc:async function(name,payload){calls.push({name:name,payload:payload});assert(name==="get_sales_slip_readonly_access"&&Object.keys(payload).length===0,"Flag-only RPC");
        assert(responses.length>0,"Unexpected status request");var r=responses.shift();return typeof r==="function"?r():r;}});
    var f={gate:gate,button:button,context:context,calls:calls,responses:responses,timeout:function(){assert(timeout,"Pending timer");timeout();},
      flag:function(v){responses.push({data:{contract_version:1,posting_enabled:v},error:null});}};
    try{await run(f);results.push({name:name,pass:true});}catch(e){results.push({name:name,pass:false,error:String(e.message||e)});}finally{gate.reset();button.remove();}
  }
  await test("業務ユーザーは計上状態未取得なら非表示",async function(f){assert(!f.gate.allowed()&&f.button.hidden,"Unknown must hide");assert(f.calls.length===0,"No implicit read");});
  await test("業務ユーザーはOFFなら入口非表示・遷移不可",async function(f){f.flag(false);assert(!await f.gate.refresh()&&!f.gate.allowed()&&f.button.hidden,"OFF must hide");});
  await test("業務ユーザーはONなら入口表示・遷移可",async function(f){f.flag(true);assert(await f.gate.refresh()&&f.gate.allowed()&&!f.button.hidden,"ON may show");});
  await test("システム管理者はOFFでも入口表示",async function(f){f.context.admin=true;assert(await f.gate.refresh()&&f.gate.allowed()&&!f.button.hidden,"Admin exception");assert(f.calls.length===0,"Admin must not need flag lookup");});
  await test("管理者でも既存閲覧権限の拒否を優先",async function(f){f.context.admin=true;f.context.role=false;assert(!await f.gate.refresh()&&f.button.hidden,"Keep original permissions");assert(f.calls.length===0,"Denied user RPC");});
  await test("会社管理者はシステム管理者の例外対象外",async function(f){f.context.key="owner-a:company-a:company-admin";f.flag(false);assert(!await f.gate.refresh()&&f.button.hidden,"Company admin is a business user");});
  await test("状態API未提供なら業務入口非表示",async function(f){f.responses.push({error:{code:"PGRST202"}});assert(!await f.gate.refresh()&&f.button.hidden,"Unapplied API must hide");});
  await test("状態API権限エラーなら非表示",async function(f){f.responses.push({error:{code:"42501"}});assert(!await f.gate.refresh()&&f.button.hidden,"Denied lookup must hide");});
  await test("状態API通信失敗なら非表示・自動再試行なし",async function(f){f.responses.push(function(){throw new Error("synthetic failure");});assert(!await f.gate.refresh()&&f.button.hidden&&f.calls.length===1,"Failure must hide");});
  await test("文字列trueをONとして扱わない",async function(f){f.flag("true");assert(!await f.gate.refresh()&&f.button.hidden,"Strict boolean");});
  await test("応答版の不一致をONとして扱わない",async function(f){f.responses.push({data:{contract_version:2,posting_enabled:true}});assert(!await f.gate.refresh()&&f.button.hidden,"Strict version");});
  await test("再確認中は以前のONを再利用しない",async function(f){f.flag(true);await f.gate.refresh();var d=deferred();f.responses.push(function(){return d.promise;});var p=f.gate.refresh();assert(!f.gate.allowed()&&f.button.hidden,"Pending must hide");d.resolve({data:{contract_version:1,posting_enabled:false}});assert(!await p&&f.button.hidden,"OFF after ON");});
  await test("ログアウト・離脱後の状態応答を破棄",async function(f){var d=deferred();f.responses.push(function(){return d.promise;});var p=f.gate.refresh();f.gate.reset();d.resolve({data:{contract_version:1,posting_enabled:true}});assert(!await p&&!f.gate.allowed()&&f.button.hidden,"Reset must invalidate");});
  await test("利用者変更後の状態応答を破棄",async function(f){var d=deferred();f.responses.push(function(){return d.promise;});var p=f.gate.refresh();f.context.key="owner-b:company-a:sales-editor";d.resolve({data:{contract_version:1,posting_enabled:true}});assert(!await p&&!f.gate.allowed()&&f.button.hidden,"Owner change");});
  await test("同じ利用者でも会社・権限変更後のONを破棄",async function(f){f.flag(true);await f.gate.refresh();f.context.key="owner-a:company-b:sales-editor";assert(!f.gate.allowed(),"Scope change invalidates cached ON");});
  await test("取得中の閲覧権限失効を優先",async function(f){var d=deferred();f.responses.push(function(){return d.promise;});var p=f.gate.refresh();f.context.role=false;d.resolve({data:{contract_version:1,posting_enabled:true}});assert(!await p&&!f.gate.allowed()&&f.button.hidden,"Revoked permission");});
  await test("古いON応答で新しいOFFを上書きしない",async function(f){var d=deferred();f.responses.push(function(){return d.promise;});var first=f.gate.refresh();f.flag(false);assert(!await f.gate.refresh(),"New OFF");d.resolve({data:{contract_version:1,posting_enabled:true}});await first;assert(!f.gate.allowed()&&f.button.hidden,"Stale ON ignored");});
  await test("状態確認の時間切れで非表示を維持し遅延ONを破棄",async function(f){var d=deferred();f.responses.push(function(){return d.promise;});var p=f.gate.refresh();f.timeout();assert(!await p&&f.button.hidden,"Timeout hidden");d.resolve({data:{contract_version:1,posting_enabled:true}});await Promise.resolve();assert(!f.gate.allowed()&&f.button.hidden&&f.calls.length===1,"Late ON rejected without retry");});
  await test("入口判定で売上明細は取得しない",async function(f){f.flag(true);await f.gate.refresh();assert(f.calls.length===1&&f.calls[0].name==="get_sales_slip_readonly_access","Status only");});
  return results;
};
})(typeof window!=="undefined"?window:globalThis);
