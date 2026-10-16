(function(root) {
  'use strict';
  var state={owner:null,lists:[],listId:'',rows:[],selected:new Set(),busy:false,run:null,pending:null,epoch:0};
  var words={
    ja:{title:'原価計算リストから価格を設定',intro:'DKS価格−2,000円と、総原価に対する利益率30%を満たす価格の高い方を100円単位で切り上げます。金額は税抜です。',scope:'未設定品の販売基準価格と販売価格区分1を同額で登録します。他区分は既存のランク計算を適用します。設定済み品は上書きしません。',list:'保存済み原価計算リスト',choose:'リストを選択',load:'リストを確認',refresh:'最新の内容を確認',all:'表示中の設定可能品を選択',none:'選択を解除',filter:'表示',any:'すべて',ready:'設定可能',configured:'設定済み',review:'要確認',search:'品番・商品IDで絞り込み',part:'品番',cost:'保存総原価',dks:'DKS参考価格',ec:'EC相場（参考）',target:'DKS−2,000円',floor:'利益率30%の下限',proposal:'設定する価格',margin:'原価差額 / 利益率',status:'状態',one:'この品番を確認',bulk:'選択品をまとめて確認',history:'選定・設定履歴',empty:'このリストに品番がありません。',loading:'処理中…',error:'読み込みに失敗しました。再確認してください。',expired:'表示中に利用者または権限が変わりました。開き直してください。',confirm:'販売価格を設定',confirmText:'次の税抜価格で販売基準価格と区分1を登録します。保存直前に原価・DKS価格・設定済み状態を再確認します。',cancel:'戻って確認',save:'この内容で設定する',invalid:'100円単位で、利益率30%の下限以上の価格を入力してください。',saved:'価格設定を保存しました。',unknown:'結果を確認できませんでした。同じ操作の結果確認を行ってください。',retry:'同じ操作の結果を確認',noSelection:'設定する品番を選択してください。',stale:'内容が変更されたか設定済みです。最新の内容を確認してください。',historyEmpty:'このリストの履歴はまだありません。',prepared:'リストを選定',committed:'価格設定済み',count:'品番',identity_review:'同一品番の複数商品を確認',missing_product:'商品マスタ未登録',kind_review:'商品区分を確認',oem_review:'OEM品番を確認',cost_review:'原価の不足項目を確認',dks_missing:'DKS価格未取得',registered:'登録済みDKS',strain:'strain3取得',noEc:'未調査・30日以内の参考値なし',taxUnknown:'税込/税抜未確認',taxExclusive:'税抜',taxInclusive:'税込',scrape:'不足DKS価格を取得',credentials:'大光サービスから価格を取得',settings:"DKS認証情報",credentialHelp:"入口認証とstrain3のパスワードを、この管理者専用に暗号化して保存します。次回から再入力せず取得できます。更新時はすべての欄を入力してください。",stored:"登録済み（パスワードは表示しません）",notStored:"未登録",credentialSave:"暗号化して保存",credentialSaved:"DKS認証情報を保存しました。",credentialRemove:"登録を解除",credentialRemoved:"DKS認証情報の登録を解除しました。",credentialRemoveHelp:"この管理者のDKS認証情報を解除します。次回の取得には再登録が必要です。",credentialUnknown:"保存結果を確認できませんでした。認証情報を開き直して登録状態を確認してください。",credentialNeeded:"先に「DKS認証情報」から登録してください。",account:"DKSログインID",basicUser:'入口認証ID',basicPassword:'入口認証パスワード',password:'strain3のパスワード',fetch:'未取得の選択品を取得',fetchMissing:'価格未取得品を選択してください。',fetchDone:'取得を完了しました。最新の内容を確認します。',fetchFailed:'取得できませんでした。認証またはサイトの表示を確認してください。',fetchReview:'品番・税区分・表示形式を確認できなかったため保留しました。',fetchSelect:'価格未取得品も取得対象として選択できます。',total:'選択',close:'閉じる'},
    en:{title:'Set prices from saved cost lists',intro:'Round up to ¥100: the higher of DKS minus ¥2,000 and the price needed for a 30% margin on total saved cost. Prices exclude tax.',scope:'Create the same base and class 1 price for unset products. Other classes use existing rank rules. Existing prices are preserved.',list:'Saved manufacturing cost list',choose:'Choose a list',load:'Review list',refresh:'Refresh',all:'Select visible eligible products',none:'Clear selection',filter:'Show',any:'All',ready:'Ready',configured:'Configured',review:'Review needed',search:'Filter part number / product ID',part:'Part number',cost:'Saved total cost',dks:'DKS reference',ec:'EC market reference',target:'DKS minus ¥2,000',floor:'30% margin floor',proposal:'Price to save',margin:'Profit / margin',status:'Status',one:'Review this product',bulk:'Review selected products',history:'Selection and pricing history',empty:'This list has no products.',loading:'Working…',error:'Could not load. Please refresh.',expired:'Account or permissions changed. Reopen this view.',confirm:'Set selling prices',confirmText:'Create base and class 1 prices below, excluding tax. Cost, DKS reference and existing prices are checked again before saving.',cancel:'Back to review',save:'Set these prices',invalid:'Enter a multiple of ¥100 at or above the 30% margin floor.',saved:'Prices saved.',unknown:'The result is unknown. Check the same operation before continuing.',retry:'Check the same operation',noSelection:'Select products to price.',stale:'The data changed or a price already exists. Refresh the list.',historyEmpty:'No history for this list.',prepared:'List selected',committed:'Prices saved',count:'products',identity_review:'Check duplicate OEM product identities',missing_product:'Product not registered',kind_review:'Check product kind',oem_review:'Check OEM identity',cost_review:'Complete cost information',dks_missing:'DKS price missing',registered:'Registered DKS',strain:'Fetched with strain3',noEc:'No reference within 30 days',taxUnknown:'Tax basis unknown',taxExclusive:'Excluding tax',taxInclusive:'Including tax',scrape:'Fetch missing DKS prices',credentials:'Fetch prices from Daiko Service',settings:"DKS credentials",credentialHelp:"Save the gateway credentials and strain3 password encrypted for this administrator. Future fetches use the saved credentials. Enter all fields to replace them.",stored:"Configured (passwords are never displayed)",notStored:"Not configured",credentialSave:"Save encrypted",credentialSaved:"DKS credentials saved.",credentialRemove:"Remove saved credentials",credentialRemoved:"DKS credentials removed.",credentialRemoveHelp:"Remove this administrator’s DKS credentials? Register again before the next fetch.",credentialUnknown:"Could not confirm the result. Reopen DKS credentials to check their status.",credentialNeeded:"Register credentials under DKS credentials first.",account:"DKS login ID",basicUser:'Gateway login ID',basicPassword:'Gateway password',password:'strain3 password',fetch:'Fetch selected missing prices',fetchMissing:'Select products with missing DKS prices.',fetchDone:'Fetch completed. Refreshing the list.',fetchFailed:'Could not fetch. Check authentication and the vendor page.',fetchReview:'Product identity, tax basis or page layout could not be verified.',fetchSelect:'Products missing a DKS price can also be selected for fetching.',total:'Selected',close:'Close'},
    zh:{title:'从已保存成本清单设置价格',intro:'取DKS价格减2,000日元与总成本利润率30%所需价格中的较高值，并以100日元向上取整。价格均不含税。',scope:'仅对未设置商品同时登记基准价格和价格类别1。其他类别沿用原有等级规则。已设置价格不覆盖。',list:'已保存成本清单',choose:'选择清单',load:'查看清单',refresh:'刷新',all:'选择当前可设置商品',none:'取消选择',filter:'显示',any:'全部',ready:'可设置',configured:'已设置',review:'待确认',search:'按品号或商品ID筛选',part:'品号',cost:'已保存总成本',dks:'DKS参考价格',ec:'电商参考行情',target:'DKS减2,000日元',floor:'利润率30%下限',proposal:'设置价格',margin:'利润 / 利润率',status:'状态',one:'确认此商品',bulk:'批量确认所选商品',history:'选择及设置记录',empty:'清单中没有商品。',loading:'处理中…',error:'读取失败，请刷新。',expired:'用户或权限已改变，请重新打开。',confirm:'设置销售价格',confirmText:'按以下未税价格登记基准价格和类别1。保存前重新核对成本、DKS价格及已设置状态。',cancel:'返回确认',save:'按此内容设置',invalid:'请输入100日元的整数倍，且不低于30%利润率下限。',saved:'价格已保存。',unknown:'结果不明，请先核对同一操作。',retry:'核对同一操作',noSelection:'请选择商品。',stale:'内容已改变或价格已设置，请刷新。',historyEmpty:'此清单暂无记录。',prepared:'已选清单',committed:'价格已设置',count:'商品',identity_review:'确认同品号的多个商品',missing_product:'未登记商品',kind_review:'确认商品类别',oem_review:'确认OEM品号',cost_review:'补全成本信息',dks_missing:'缺少DKS价格',registered:'已登记DKS',strain:'strain3获取',noEc:'30天内无参考行情',taxUnknown:'税别待确认',taxExclusive:'未税',taxInclusive:'含税',scrape:'获取缺少的DKS价格',credentials:'从大光服务获取价格',settings:"DKS认证信息",credentialHelp:"为此管理员加密保存入口认证和strain3密码。以后获取无需重复输入。更新时请填写全部字段。",stored:"已登记（不显示密码）",notStored:"未登记",credentialSave:"加密保存",credentialSaved:"DKS认证信息已保存。",credentialRemove:"解除登记",credentialRemoved:"DKS认证信息已解除。",credentialRemoveHelp:"解除此管理员的DKS认证信息？下次获取前需要重新登记。",credentialUnknown:"无法确认保存结果，请重新打开认证信息确认状态。",credentialNeeded:"请先登记DKS认证信息。",account:"DKS登录ID",basicUser:'入口认证ID',basicPassword:'入口认证密码',password:'strain3密码',fetch:'获取所选缺少价格',fetchMissing:'请选择缺少DKS价格的商品。',fetchDone:'获取完成，正在刷新。',fetchFailed:'获取失败，请确认认证或网站页面。',fetchReview:'品号、税别或页面格式无法确认。',fetchSelect:'也可选择缺少DKS价格的商品进行获取。',total:'已选择',close:'关闭'}
  };
  function w(k){return (words[root.currentLang]||words.ja)[k]||k;}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function money(v){return v==null?'—':'¥'+Number(v).toLocaleString('ja-JP');}
  function el(id){return document.getElementById(id);}
  function permitted(){return !!root.currentUser && root.canEditBasePrice() && root.canViewManufacturingCostMgmt() && (!root.canViewBasePrice||root.canViewBasePrice());}
  function owner(){return root.currentUser&&root.currentUser.id;}
  function canFetch(r){return !r.dks_price_jpy&&!['configured','missing_product','kind_review','oem_review','identity_review'].includes(r.state);}
  function valid(){return permitted() && state.owner===owner();}
  async function rpc(action,payload){if(!valid())throw Error('session');var r=await root.sb.rpc('manage_sales_pricing_list',{action:action,payload:payload||{}});if(!valid())throw Error('session');if(r.error)throw r.error;return r.data;}
  function status(text,bad){var e=el('spl-status');if(e){e.textContent=text||'';e.classList.toggle('error',!!bad);}}
  function errorText(e){var m=String(e&&e.message||'');if(m==='session')return w('expired');if(/stale|configured|expired/.test(m))return w('stale');return w('error');}
  function button(id,key){return '<button type="button" class="'+(id==='spl-bulk'?'btn-primary':'btn-sm-edit')+'" id="'+id+'">'+esc(w(key))+'</button>';}
  function lock(on){state.busy=on;var host=el('sales-pricing-lists');if(host){host.setAttribute('aria-busy',String(on));host.querySelectorAll('button,input,select').forEach(function(n){n.disabled=on||!!state.pending&&!n.hasAttribute('data-spl-retry');});}if(!on)renderRows();}
  function reset(){state.epoch++;state.owner=null;state.rows=[];state.lists=[];state.selected.clear();state.run=null;state.pending=null;state.busy=false;var host=el('sales-pricing-lists');if(host)host.replaceChildren();document.querySelectorAll('dialog[data-spl-owned]').forEach(function(d){if(d.open)d.close();d.remove();});}
  async function enter(){
    var host=el('sales-pricing-lists');if(!host)return;
    if(!permitted()){reset();host.hidden=true;return;}
    if(state.owner!==owner())reset();state.owner=owner();host.hidden=false;var epoch=++state.epoch;
    host.innerHTML='<h2>'+esc(w('title'))+'</h2><p>'+esc(w('intro'))+'</p><p class="spl-muted">'+esc(w('scope'))+'</p>'+
      '<div class="spl-toolbar"><label>'+esc(w('list'))+'<select id="spl-list"><option value="">'+esc(w('choose'))+'</option></select></label>'+button('spl-load','load')+(root.isSystemAdmin()?button('spl-credentials','settings'):'')+'</div>'+
      '<div id="spl-status" role="status" aria-live="polite"></div><div id="spl-content"></div>';
    el('spl-load').addEventListener('click',function(){load(false);});
    if(el('spl-credentials'))el('spl-credentials').addEventListener('click',credentialSettings);
    lock(true);try{var r=await rpc('lists');if(epoch!==state.epoch)return;state.lists=r.lists||[];el('spl-list').innerHTML='<option value="">'+esc(w('choose'))+'</option>'+state.lists.map(function(l){return '<option value="'+esc(l.id)+'">'+esc(l.list_name)+' · '+esc(l.item_count)+' '+esc(w('count'))+'</option>';}).join('');el('spl-list').value=state.listId;
      if(state.listId&&state.rows.length)renderContent();
    }catch(e){if(epoch===state.epoch)status(errorText(e),true);}finally{if(epoch===state.epoch)lock(false);}
  }
  async function load(keep){
    if(state.busy||state.pending||!valid())return;
    var id=el('spl-list').value;if(!id)return;
    var epoch=++state.epoch;lock(true);status(w('loading'));
    try{var runId=crypto.randomUUID();var result=await rpc('preview',{operation_id:runId,list_id:Number(id)});if(epoch!==state.epoch)return;
      state.listId=id;state.run=result.run_id;state.rows=result.rows||[];if(!keep)state.selected.clear();
      state.selected=new Set(Array.from(state.selected).filter(function(k){return state.rows.some(function(r){return String(r.item_id)===k&&(r.state==='ready'||canFetch(r));});}));
      renderContent();status('');
    }catch(e){if(epoch===state.epoch){state.run=null;state.rows=[];el('spl-content').replaceChildren();status(errorText(e),true);}}finally{if(epoch===state.epoch)lock(false);}
  }
  function filtered(){var f=el('spl-filter')?el('spl-filter').value:'any',q=el('spl-query')?el('spl-query').value.trim().toLowerCase():'';return state.rows.filter(function(r){return (f==='any'||f==='review'&&!['ready','configured'].includes(r.state)||f===r.state)&&(!q||[r.dkd_shohin_id,r.manufacturer_part_number,r.genuine_part_number].join(' ').toLowerCase().includes(q));});}
  function renderContent(){
    el('spl-content').innerHTML='<div class="spl-summary" id="spl-summary"></div><div class="spl-toolbar"><label>'+esc(w('filter'))+'<select id="spl-filter">'+['any','ready','review','configured'].map(function(k){return '<option value="'+k+'">'+esc(w(k))+'</option>';}).join('')+'</select></label><input id="spl-query" type="search" aria-label="'+esc(w('search'))+'" placeholder="'+esc(w('search'))+'">'+button('spl-refresh','refresh')+'</div>'+
      '<div class="spl-toolbar">'+button('spl-all','all')+button('spl-none','none')+button('spl-bulk','bulk')+(root.isSystemAdmin()?button('spl-scrape','scrape'):'')+button('spl-history-button','history')+'</div><p class="spl-muted">'+esc(w('fetchSelect'))+'</p><div id="spl-rows"></div><div id="spl-history"></div>';
    el('spl-filter').addEventListener('change',renderRows);el('spl-query').addEventListener('input',renderRows);
    el('spl-refresh').addEventListener('click',function(){load(true);});
    el('spl-all').addEventListener('click',function(){filtered().filter(function(r){return r.state==='ready';}).forEach(function(r){state.selected.add(String(r.item_id));});renderRows();});
    el('spl-none').addEventListener('click',function(){state.selected.clear();renderRows();});
    el('spl-bulk').addEventListener('click',function(){confirmPrices(state.rows.filter(function(r){return state.selected.has(String(r.item_id))&&r.state==='ready';}),true);});
    if(el('spl-scrape'))el('spl-scrape').addEventListener('click',fetchMissing);
    el('spl-history-button').addEventListener('click',history);renderRows();
  }
  function renderRows(){
    var host=el('spl-rows');if(!host||!valid())return;
    el('spl-summary').textContent=state.rows.length+' '+w('count')+' · '+w('ready')+' '+state.rows.filter(function(r){return r.state==='ready';}).length+' · '+w('configured')+' '+state.rows.filter(function(r){return r.state==='configured';}).length+' · '+w('total')+' '+state.selected.size;
    var rows=filtered();if(!rows.length){host.innerHTML='<p>'+esc(w('empty'))+'</p>';return;}
    var keys=['part','cost','dks','ec','proposal','status'];
    host.innerHTML='<table class="spl-table"><thead><tr><th aria-label="'+esc(w('total'))+'"></th>'+keys.map(function(k){return '<th>'+esc(w(k))+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){
      var k=String(r.item_id),allowed=r.state==='ready'||canFetch(r),p=r.edited_jpy==null?r.suggested_jpy:r.edited_jpy;
      var ec=r.ec_price_jpy?money(r.ec_price_jpy)+' · '+w(r.ec_tax_basis==='exclusive'?'taxExclusive':r.ec_tax_basis==='inclusive'?'taxInclusive':'taxUnknown'):w('noEc');
      return '<tr><td><input type="checkbox" data-spl-select="'+esc(k)+'" aria-label="'+esc(r.manufacturer_part_number||r.genuine_part_number||r.dkd_shohin_id)+'" '+(state.selected.has(k)?'checked ':'')+(!allowed||state.busy||state.pending?'disabled':'')+'></td>'+
      '<td data-label="'+esc(w('part'))+'"><strong>'+esc(r.manufacturer_part_number||r.genuine_part_number||'—')+'</strong><small>'+esc(r.genuine_part_number||'')+'</small><small>'+esc(r.manufacturer||'')+' · ID '+esc(r.dkd_shohin_id)+'</small></td>'+
      '<td data-label="'+esc(w('cost'))+'">'+esc(money(r.cost_jpy))+'<small>'+esc(w('floor'))+' '+esc(money(r.minimum_jpy))+'</small></td>'+
      '<td data-label="'+esc(w('dks'))+'">'+esc(money(r.dks_price_jpy))+'<small>'+esc(r.dks_source?w(r.dks_source==='strain3'?'strain':'registered'):'')+' '+esc((r.dks_observed_at||'').slice(0,10))+'</small><small>'+esc(w('target'))+' '+esc(money(r.target_jpy))+'</small></td>'+
      '<td data-label="'+esc(w('ec'))+'">'+esc(ec)+'<small>'+esc(r.ec_seller||'')+' '+esc((r.ec_observed_at||'').slice(0,10))+'</small></td>'+
      '<td data-label="'+esc(w('proposal'))+'">'+(r.state==='ready'?'<input type="number" min="'+esc(r.minimum_jpy)+'" step="100" data-spl-price="'+esc(k)+'" value="'+esc(p)+'" aria-label="'+esc(w('proposal')+' '+r.manufacturer_part_number)+'" '+(state.busy||state.pending?'disabled':'')+'><small data-spl-margin="'+esc(k)+'">'+esc(profit(r,p))+'</small>':esc(money(r.current_rank1_jpy||r.current_base_jpy)))+'</td>'+
      '<td data-label="'+esc(w('status'))+'"><span class="spl-badge spl-'+esc(r.state==='ready'?'ready':r.state==='configured'?'configured':'review')+'">'+esc(w(r.state))+'</span>'+(r.state==='ready'?'<button class="btn-sm-edit" type="button" data-spl-one="'+esc(k)+'" '+(state.busy||state.pending?'disabled':'')+'>'+esc(w('one'))+'</button>':'')+'</td></tr>';
    }).join('')+'</tbody></table>';
    host.querySelectorAll('[data-spl-select]').forEach(function(n){n.addEventListener('change',function(){if(n.checked)state.selected.add(n.dataset.splSelect);else state.selected.delete(n.dataset.splSelect);renderRows();});});
    host.querySelectorAll('[data-spl-price]').forEach(function(n){n.addEventListener('input',function(){var r=state.rows.find(function(r){return String(r.item_id)===n.dataset.splPrice;});r.edited_jpy=Number(n.value);host.querySelector('[data-spl-margin="'+r.item_id+'"]').textContent=profit(r,r.edited_jpy);});});
    host.querySelectorAll('[data-spl-one]').forEach(function(n){n.addEventListener('click',function(){confirmPrices(state.rows.filter(function(r){return String(r.item_id)===n.dataset.splOne;}));});});
    if(el('spl-bulk'))el('spl-bulk').disabled=state.busy||!!state.pending||!state.rows.some(function(r){return r.state==='ready'&&state.selected.has(String(r.item_id));});
  }
  function profit(r,p){return p>0?money(p-r.cost_jpy)+' / '+((p-r.cost_jpy)/p*100).toFixed(1)+'%':'—';}
  function dialog(title,body,saveKey){
    var d=document.createElement('dialog');d.className='spl-dialog';d.dataset.splOwned='1';
    d.innerHTML='<form method="dialog"><h2>'+esc(title)+'</h2>'+body+'<p class="error" id="spl-dialog-error" role="alert"></p><div class="spl-dialog-actions"><button type="button" data-spl-cancel>'+esc(w('cancel'))+'</button><button type="button" data-spl-confirm class="btn-primary">'+esc(w(saveKey))+'</button></div></form>';
    document.body.appendChild(d);if(typeof d.showModal!=='function'){d.remove();status(w('error'),true);return null;}d.showModal();
    d.querySelector('[data-spl-cancel]').addEventListener('click',function(){d.close();});
    d.addEventListener('close',function(){d.querySelectorAll('input').forEach(function(n){n.value='';});d.remove();});return d;
  }
  function confirmPrices(rows,bulk){
    if(state.busy||state.pending||!valid())return;if(!rows.length){status(w('noSelection'),true);return;}
    var items=rows.map(function(r){return {item_id:r.item_id,price_jpy:r.edited_jpy==null?Number(r.suggested_jpy):r.edited_jpy};});
    if(items.some(function(p,i){return !Number.isSafeInteger(p.price_jpy)||p.price_jpy>2147483647||p.price_jpy<Number(rows[i].minimum_jpy)||p.price_jpy%100!==0;})){status(w('invalid'),true);return;}
    var run=state.run,selectedList=state.listId;
    if(bulk&&state.selected.size>rows.length){status(w('review')+' '+(state.selected.size-rows.length)+' '+w('count')+' / '+w('ready')+' '+rows.length+' '+w('count'));}
    var d=dialog(w('confirm'),'<p>'+esc(w('confirmText'))+'</p><p><strong>'+esc((state.lists.find(function(l){return String(l.id)===selectedList;})||{}).list_name||'')+' · '+items.length+' '+esc(w('count'))+'</strong></p><ul class="spl-confirm-items">'+rows.map(function(r,i){return '<li><span>'+esc(r.manufacturer_part_number||r.genuine_part_number)+'<small>ID '+esc(r.dkd_shohin_id)+'</small></span><strong>'+esc(money(items[i].price_jpy))+'</strong></li>';}).join('')+'</ul>','save');
    if(!d)return;
    d.querySelector('[data-spl-confirm]').addEventListener('click',function(){if(state.busy||!valid()||run!==state.run||selectedList!==el('spl-list').value){el('spl-dialog-error').textContent=w('stale');return;}state.pending={operation_id:run,items:items};d.close();commit();},{once:true});
  }
  async function commit(){
    if(state.busy||!state.pending||!valid())return;var pending=state.pending;lock(true);status(w('loading'));
    try{var result=await rpc('commit',pending);if(state.pending!==pending)return;state.pending=null;state.selected.clear();status(w('saved')+' '+result.saved_count+' '+w('count'));state.busy=false;await load(false);status(w('saved')+' '+result.saved_count+' '+w('count'));
    }catch(e){if(!valid()){reset();return;}var code=String(e&&e.code||'');if(/^(22|23|40|42|P0)/.test(code)){state.pending=null;status(errorText(e),true);}else{status(w('unknown'),true);var retry=document.createElement('button');retry.type='button';retry.dataset.splRetry='1';retry.textContent=w('retry');retry.addEventListener('click',commit);el('spl-status').appendChild(retry);}}
    finally{if(valid())lock(false);}
  }
  function historyItem(x){
    var items=(x.items||[]).filter(function(i){return !x.result||(x.result.saved||[]).some(function(s){return String(s.item_id)===String(i.item_id);});});
    return '<li><details><summary>'+esc(new Date(x.created_at).toLocaleString())+' · '+esc(x.list_name)+' · '+esc(w(x.committed_at?'committed':'prepared'))+' '+esc(x.result?x.result.saved_count:x.selected_count)+' '+esc(w('count'))+'</summary><small>'+esc(x.id)+'</small><ul>'+items.map(function(i){var saved=x.result&&(x.result.saved||[]).find(function(s){return String(s.item_id)===String(i.item_id);});return '<li>'+esc(i.manufacturer_part_number||i.genuine_part_number||'—')+' · ID '+esc(i.dkd_shohin_id)+(saved?' · '+esc(money(saved.price_jpy)):'')+'</li>';}).join('')+'</ul></details></li>';
  }
  async function history(){if(state.busy||!valid())return;lock(true);try{var r=await rpc('history',{list_id:Number(state.listId)});el('spl-history').innerHTML='<h3>'+esc(w('history'))+'</h3>'+((r.history||[]).length?'<ul>'+r.history.map(historyItem).join('')+'</ul>':'<p>'+esc(w('historyEmpty'))+'</p>');}catch(e){status(errorText(e),true);}finally{lock(false);}}
  async function credentialCall(action,payload){
    if(!valid()||!root.isSystemAdmin())throw Error('session');
    var r=await root.sb.functions.invoke('sales-pricing-dks-fetch',{body:Object.assign({action:'credentials_'+action},payload||{}),signal:AbortSignal.timeout(35000)});
    if(!valid()||!root.isSystemAdmin())throw Error('session');
    if(r.error)throw r.error;if(!r.data||typeof r.data.configured!=='boolean')throw Error('invalid_response');return r.data;
  }
  async function credentialSettings(){
    if(state.busy||state.pending||!valid()||!root.isSystemAdmin())return;
    var epoch=state.epoch,info;lock(true);status(w('loading'));
    try{info=await credentialCall('status');}catch(e){if(valid()&&epoch===state.epoch)status(errorText(e),true);return;}finally{if(valid()&&epoch===state.epoch)lock(false);}
    if(!valid()||epoch!==state.epoch)return;status('');
    var d=dialog(w('settings'),'<p>'+esc(w('credentialHelp'))+'</p><p><strong>'+esc(w(info.configured?'stored':'notStored'))+'</strong>'+(info.updated_at?'<br>'+esc(new Date(info.updated_at).toLocaleString()):'')+'</p><label>'+esc(w('account'))+'<input value="strain3" readonly autocomplete="off"></label><label>'+esc(w('basicUser'))+'<input name="basic_username" value="daiko-system2" autocomplete="off" maxlength="255" required></label><label>'+esc(w('basicPassword'))+'<input name="basic_password" type="password" autocomplete="off" maxlength="255" required></label><label>'+esc(w('password'))+'<input name="password" type="password" autocomplete="off" maxlength="255" required></label>'+(info.configured?'<p><button type="button" class="btn-sm-edit spl-remove" data-spl-remove>'+esc(w('credentialRemove'))+'</button></p>':''),'credentialSave');
    if(!d)return;
    var saving=false;d.addEventListener('cancel',function(e){if(saving)e.preventDefault();});
    d.querySelector('[data-spl-confirm]').addEventListener('click',async function(){
      if(saving||state.busy||!valid()||!root.isSystemAdmin()||epoch!==state.epoch)return;
      if(!d.querySelector('form').reportValidity())return;
      var credentials={};['basic_username','basic_password','password'].forEach(function(k){credentials[k]=d.querySelector('[name="'+k+'"]').value;});
      if(Object.keys(credentials).some(function(k){return !credentials[k]||/[\r\n]/.test(credentials[k]);})||credentials.basic_username.includes(':')){el('spl-dialog-error').textContent=w('error');return;}
      saving=true;d.querySelectorAll('button,input').forEach(function(n){n.disabled=true;});
      await credentialMutation('save',info,credentials,d,epoch);
    });
    var remove=d.querySelector('[data-spl-remove]');if(remove)remove.addEventListener('click',function(){
      if(state.busy||!valid()||epoch!==state.epoch)return;d.close();
      var confirm=dialog(w('credentialRemove'),'<p>'+esc(w('credentialRemoveHelp'))+'</p>','credentialRemove');if(!confirm)return;
      confirm.querySelector('[data-spl-confirm]').addEventListener('click',function(){if(state.busy||!valid()||epoch!==state.epoch)return;confirm.querySelectorAll('button').forEach(function(n){n.disabled=true;});credentialMutation('remove',info,null,confirm,epoch);},{once:true});
    });
  }
  async function credentialMutation(action,info,credentials,d,epoch){
    var op=crypto.randomUUID(),ok=false;lock(true);status(w('loading'));
    // Clear input nodes before network work; the temporary object is cleared below.
    d.querySelectorAll('input').forEach(function(n){n.value='';});
    try{var result=await credentialCall(action,{operation_id:op,expected_revision:info.revision,credentials:credentials});ok=result.revision===op&&result.configured===(action==='save');}
    catch(e){if(valid()&&epoch===state.epoch){try{var check=await credentialCall('status');ok=check.revision===op&&check.configured===(action==='save');}catch(ignore){}}}
    finally{if(credentials)Object.keys(credentials).forEach(function(k){credentials[k]='';});if(d.open)d.close();if(valid()&&epoch===state.epoch){lock(false);status(w(ok?(action==='save'?'credentialSaved':'credentialRemoved'):'credentialUnknown'),!ok);}}
  }
  async function fetchMissing(){
    if(state.busy||state.pending||!valid()||!root.isSystemAdmin())return;
    var rows=state.rows.filter(function(r){return canFetch(r)&&state.selected.has(String(r.item_id));});
    if(!rows.length){status(w('fetchMissing'),true);return;}
    var capturedRun=state.run,epoch=state.epoch,ok=0,failed=0;lock(true);status(w('loading'));
    try{
      var info=await credentialCall('status');if(!info.configured){status(w('credentialNeeded'),true);return;}
      for(var i=0;i<rows.length;i++){
        if(!valid()||state.run!==capturedRun||epoch!==state.epoch||!root.isSystemAdmin())break;
        status(w('loading')+' '+(i+1)+' / '+rows.length);
        var r=await root.sb.functions.invoke('sales-pricing-dks-fetch',{body:{dkd_shohin_id:rows[i].dkd_shohin_id},signal:AbortSignal.timeout(105000)});
        if(r.error){failed++;break;}if(r.data&&r.data.status==='fetched')ok++;else failed++;
      }
    }catch(e){failed++;}finally{if(valid()&&epoch===state.epoch)lock(false);}
    if(valid()&&epoch===state.epoch){await load(true);status((ok?w('fetchDone'):w('fetchFailed'))+(failed?' '+failed+' '+w('count')+'：'+w('fetchReview'):''),!!failed);}
  }
  root.DcatsSalesPricingLists={enter:enter,reset:reset};
  // Account, permission and screen changes clear financial/credential UI. No
  // session is copied from another browser or persisted in browser storage.
  var screen=el('screen-sales-pricing-mgmt');
  if(screen)new MutationObserver(function(){if(!screen.classList.contains('active')||!valid())reset();}).observe(screen,{attributes:true,attributeFilter:['class']});
  root.addEventListener('pagehide',reset);
})(window);
