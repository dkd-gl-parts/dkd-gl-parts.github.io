(function(root){
  'use strict';
  var words={
    ja:{recount:'実数確認',needsReview:'要実数確認',countActual:'実際に数えた数量',countHint:'この場所にある、この入荷番号の品物を実際に数えて入力してください。合計在庫は変わりません。',recountRequired:'合計在庫が減ったため、場所別の登録数は要実数確認です。各場所の「実数確認」で数量を確定してください。確認が終わるまで追加登録と移動はできません。',invalidCount:'実数は0以上の範囲内の整数で入力し、作業理由も記入してください。',pallets:'パレティーナ一覧',title:'棚・パレティーナ管理',back:'在庫管理へ戻る',intro:'既存の合計在庫を、置き場所ごとの数量に分けて管理します。場所登録や移動では合計在庫は増減しません。',hint:'入庫・出庫は既存の在庫管理で記録します。ここでは、その在庫の場所を登録・移動・解除します。',search:'検索',query:'品番・メーカー・商品ID・入荷番号',allKinds:'区分すべて',rebuilt:'リビルト',aftermarket_new:'社外新品',oem_new:'純正新品',allLocations:'場所すべて',refresh:'再読込',pallet:'パレティーナを登録',shelves:'棚の正面図',boardHint:'下から01〜06。表示中の商品の数量だけを集計しています。',level:'段目',results:'商品と保管場所',total:'合計在庫',allocated:'場所登録済',unassigned:'未割当',view:'場所を見る',part:'品番',kind:'商品区分',empty:'該当する在庫がありません。条件を変えて検索してください。',loading:'読み込んでいます…',error:'読込に失敗しました。再読込してください。',denied:'在庫を表示する権限がありません。',allProducts:'商品一覧へ戻る',allocate:'既存在庫の場所を登録',transfer:'場所間移動',release:'場所登録を解除',location:'保管場所',source:'元の入荷・パレット番号',round:'コンテナ回数',unknown:'未登録',quantity:'数量',move:'移動',remove:'解除',note:'作業理由・メモ',destination:'移動先・登録先',confirm:'この内容で記録する',cancel:'閉じる',invalid:'数量は範囲内の正の整数で入力し、作業理由も記入してください。',saved:'記録しました。合計在庫は変わっていません。',history:'場所の登録・移動履歴',historyHint:'最新50件を表示します。',noHistory:'場所の履歴はまだありません。',mismatch:'合計在庫より場所登録数が多いため要照合です。従来の出庫・棚卸結果を確認し、不要な場所登録を解除してください。解消するまで追加登録と移動はできません。',noPositions:'場所はまだ登録されていません。未割当の在庫から登録してください。',first:'前へ',next:'次へ',code:'パレティーナ番号',label:'説明',codeHint:'例 GLS-23。半角英数字・ハイフン・アンダーバーで入力します。',invalidCode:'パレティーナ番号を確認してください。棚番号と同じ形式は使用できません。',pending:'処理結果を確認中です。重複を防ぐため、新しい保存を停止しています。',check:'結果を確認する',notFound:'結果をまだ確認できません。再送せず、依頼IDを控えて管理者へ確認してください。',storage:'安全に依頼IDを保存できないため記録を中止しました。ブラウザのセッション保存を有効にしてください。',unknownResult:'通信が途切れたため結果が未確認です。「結果を確認する」を使用し、同じ操作をやり直さないでください。',stale:'在庫または場所の情報が変わりました。再読込して内容を確認してください。',failed:'記録できませんでした。',from:'移動元',releaseHint:'解除した数量は未割当へ戻ります。実際の出庫や合計在庫の減少にはなりません。',readonly:'閲覧のみ',request:'依頼ID',legacy:'従来の保管場所メモ',sourceHint:'GLS-23など、入荷元を追う番号。移動時にも引き継ぎます。',pageHint:'最大50商品ずつ表示します。'},
    en:{recount:'Verify physical count',needsReview:'Count unverified',countActual:'Actual physical quantity',countHint:'Count the items from this receipt reference at this location. Total stock will remain unchanged.',recountRequired:'Total stock decreased. Location quantities need physical verification. Verify every affected location before assigning or transferring more stock.',invalidCount:'Enter a whole count from zero to the available maximum and provide a reason.',pallets:'Pallet locations',title:'Shelf and pallet locations',back:'Back to inventory',intro:'Allocate existing stock to physical locations. Assignments and transfers do not change total inventory.',hint:'Record receipts and shipments in the existing inventory screen. Use this screen to assign, transfer or release locations.',search:'Search',query:'Part, manufacturer, product ID or receipt reference',allKinds:'All conditions',rebuilt:'Rebuilt',aftermarket_new:'Aftermarket new',oem_new:'OEM new',allLocations:'All locations',refresh:'Refresh',pallet:'Add pallet location',shelves:'Shelves from the front',boardHint:'01 is the bottom and 06 is the top. Counts include only the products currently displayed.',level:'level',results:'Products and locations',total:'Total stock',allocated:'Assigned',unassigned:'Unassigned',view:'View locations',part:'Part',kind:'Condition',empty:'No matching stock. Change the search filters.',loading:'Loading…',error:'Loading failed. Please refresh.',denied:'Inventory viewing permission is required.',allProducts:'Back to products',allocate:'Assign existing stock',transfer:'Transfer between locations',release:'Release assignment',location:'Location',source:'Original receipt or pallet reference',round:'Container round',unknown:'Not recorded',quantity:'Quantity',move:'Transfer',remove:'Release',note:'Reason or note',destination:'Destination',confirm:'Record this operation',cancel:'Close',invalid:'Enter a positive whole quantity within the available range and provide a reason.',saved:'Recorded. Total stock is unchanged.',history:'Location history',historyHint:'Showing the latest 50 events.',noHistory:'No location events yet.',mismatch:'Assigned quantities exceed total stock. Reconcile prior shipments or counts and release incorrect assignments. New assignments and transfers are blocked until resolved.',noPositions:'No locations assigned yet. Assign from unassigned stock.',first:'Previous',next:'Next',code:'Pallet code',label:'Description',codeHint:'Example GLS-23. Use ASCII letters, numbers, hyphens and underscores.',invalidCode:'Check the pallet code. Reserved shelf codes cannot be used.',pending:'The result is pending. New saves are blocked to prevent duplicates.',check:'Check result',notFound:'The result is still unknown. Do not resend. Give the request ID to an administrator.',storage:'The request ID cannot be safely saved. Enable session storage before recording.',unknownResult:'Connection lost. Use Check result and do not repeat this operation.',stale:'Stock or location information changed. Refresh and review the new values.',failed:'Operation was not recorded.',from:'Source',releaseHint:'Released quantities become unassigned. This does not record a shipment or reduce total stock.',readonly:'Read only',request:'Request ID',legacy:'Existing location note',sourceHint:'Original reference, such as GLS-23. Preserved during transfers.',pageHint:'Up to 50 products per page.'},
    zh:{recount:'确认实数',needsReview:'实数待确认',countActual:'实际清点数量',countHint:'请清点此位置中属于该入库编号的实际数量。总库存不变。',recountRequired:'总库存减少，位置数量需要重新清点。请确认各受影响位置的实数，完成前不能增加分配或移库。',invalidCount:'请输入范围内从0开始的整数实数，并填写操作原因。',pallets:'托盘位置列表',title:'货架和托盘位置管理',back:'返回库存管理',intro:'将现有库存分配到实际存放位置。登记和移库不会改变总库存。',hint:'入库和出库仍在原库存管理中登记。本页用于登记、移动或解除存放位置。',search:'搜索',query:'品号、厂家、商品ID或入库编号',allKinds:'全部商品类别',rebuilt:'再制造品',aftermarket_new:'副厂新品',oem_new:'原厂新品',allLocations:'全部位置',refresh:'重新加载',pallet:'登记托盘位置',shelves:'货架正面图',boardHint:'由下至上为01至06。数量仅统计当前显示的商品。',level:'层',results:'商品与存放位置',total:'总库存',allocated:'已分配',unassigned:'未分配',view:'查看位置',part:'品号',kind:'商品类别',empty:'没有符合条件的库存，请更改条件。',loading:'加载中…',error:'加载失败，请重新加载。',denied:'没有查看库存的权限。',allProducts:'返回商品列表',allocate:'登记现有库存位置',transfer:'位置间移动',release:'解除位置登记',location:'存放位置',source:'原入库或托盘编号',round:'集装箱批次',unknown:'未登记',quantity:'数量',move:'移动',remove:'解除',note:'操作原因或备注',destination:'目的位置',confirm:'按此内容登记',cancel:'关闭',invalid:'请输入范围内的正整数数量，并填写操作原因。',saved:'已登记，总库存不变。',history:'位置登记与移动记录',historyHint:'显示最新50条。',noHistory:'尚无位置记录。',mismatch:'位置数量超过总库存，需要核对。请确认原出库或盘点结果，并解除错误的位置登记。核对完成前不能增加或移动。',noPositions:'尚未登记位置，请从未分配库存登记。',first:'上一页',next:'下一页',code:'托盘编号',label:'说明',codeHint:'例如GLS-23。使用半角英文字母、数字、连字符和下划线。',invalidCode:'请检查托盘编号，不能使用保留的货架编号格式。',pending:'正在确认处理结果，为避免重复，暂停新的保存。',check:'确认结果',notFound:'尚未确认结果，请勿重新提交，并将请求ID交给管理员。',storage:'无法安全保存请求ID，请启用浏览器会话存储后再登记。',unknownResult:'通信中断，结果未确认。请使用确认结果，不要重复操作。',stale:'库存或位置信息已变化，请重新加载后确认。',failed:'无法登记。',from:'原位置',releaseHint:'解除的数量返回未分配，不会登记出库或减少总库存。',readonly:'仅查看',request:'请求ID',legacy:'原存放位置备注',sourceHint:'用于追踪原入库编号，例如GLS-23。移动时保留。',pageHint:'每页最多显示50个商品。'}
  };
  var state={snapshot:null,selected:'',offset:0,seq:0,working:false,loading:false,pending:null,owner:'',query:'',kind:'',location:'',dialog:null};
  function el(id){return document.getElementById('warehouse-'+id);}
  function w(key){var lang=typeof root.currentLang==='string'?root.currentLang:'ja';return (words[lang]||words.en)[key]||words.ja[key]||key;}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function owner(){return root.userProfile&&String(root.userProfile.id||'')||'';}
  function allowed(){return !!owner()&&typeof root.canViewProductKindStockMgmt==='function'&&root.canViewProductKindStockMgmt();}
  function canManage(){return allowed()&&state.snapshot&&state.snapshot.can_manage===true;}
  function status(s,error){var e=el('status');if(e){e.textContent=s||'';e.className='warehouse-status'+(error?' is-error':'');}}
  function storageKey(id){return 'dcats-warehouse-pending-v1:'+id;}
  function persistPending(p){try{root.sessionStorage.setItem(storageKey(p.owner),JSON.stringify(p));return true;}catch(e){return false;}}
  function clearPending(){var p=state.pending;if(p){try{root.sessionStorage.removeItem(storageKey(p.owner));}catch(e){return false;}}state.pending=null;return true;}
  function restorePending(){try{var raw=root.sessionStorage.getItem(storageKey(state.owner));var p=raw?JSON.parse(raw):null;state.pending=p&&p.owner===state.owner&&/^[0-9a-f-]{36}$/i.test(p.id)?p:null;}catch(e){state.pending=null;}}
  function pendingView(){var e=el('pending');if(!e)return;e.hidden=!state.pending;if(state.pending)e.innerHTML='<strong>'+esc(w('pending'))+'</strong><p>'+esc(w('request'))+': <code>'+esc(state.pending.id)+'</code></p><button type="button" class="btn-primary" data-wh-check>'+esc(w('check'))+'</button>';}
  function currentVariant(){return state.snapshot&&(state.snapshot.variants||[]).find(function(v){return v.variant_id===state.selected;});}
  function locationsOptions(selected){return '<option value="">'+esc(w('destination'))+'</option>'+((state.snapshot&&state.snapshot.locations)||[]).map(function(l){return '<option value="'+esc(l.code)+'"'+(l.code===selected?' selected':'')+'>'+esc(l.code)+'</option>';}).join('');}
  function kindLabel(k){return w(k);}
  function sourceLabel(p){return (p.source_reference||w('unknown'))+' / '+w('round')+' '+(p.container_round||w('unknown'));}
  function render(){
    var host=el('content');if(!host)return;pendingView();var accessButton=el('add-pallet');if(accessButton){accessButton.hidden=!canManage();accessButton.disabled=!!state.pending||state.working;}
    if(!state.snapshot){host.innerHTML=state.loading?'<div class="empty">'+esc(w('loading'))+'</div>':'';return;}
    var s=state.snapshot,visibleIds=(s.variants||[]).slice(0,50).map(function(v){return v.variant_id;}),visiblePositions=(s.positions||[]).filter(function(p){return visibleIds.indexOf(p.variant_id)>=0;}),html='<section class="warehouse-card"><h2>'+esc(w('shelves'))+'</h2><p class="warehouse-hint">'+esc(w('boardHint'))+'</p><div class="warehouse-racks">';
    for(var rack=1;rack<=3;rack++){var r='T0'+rack;html+='<div class="warehouse-rack"><h3>'+r+'</h3>';for(var level=6;level>=1;level--){var code=r+'-0'+level;var uncertain=visiblePositions.some(function(p){return p.location===code&&p.needs_recount;});var n=visiblePositions.filter(function(p){return p.location===code;}).reduce(function(a,p){return a+p.quantity;},0);html+='<button type="button" data-wh-location="'+code+'" class="warehouse-shelf'+(state.location===code?' is-selected':'')+'"><span class="warehouse-level">'+level+' '+esc(w('level'))+'</span><strong>'+code+'</strong><span>'+n+(uncertain?'<em class="warehouse-needs-check">'+esc(w('needsReview'))+'</em>':'')+'</span></button>';}html+='</div>';}
    html+='</div>';var pallets=(s.locations||[]).filter(function(l){return l.type==='pallet';});if(pallets.length){html+='<h3>'+esc(w('pallets'))+'</h3><div class="warehouse-pallets">';pallets.forEach(function(l){var palletUncertain=visiblePositions.some(function(p){return p.location===l.code&&p.needs_recount;});var count=visiblePositions.filter(function(p){return p.location===l.code;}).reduce(function(a,p){return a+p.quantity;},0);html+='<button type="button" class="warehouse-pallet" data-wh-location="'+esc(l.code)+'"><strong>'+esc(l.code)+'</strong><span>'+esc(l.label||'')+'</span><b>'+count+(palletUncertain?'<span class="warehouse-needs-check">'+esc(w('needsReview'))+'</span>':'')+'</b></button>';});html+='</div>';}html+='</section>';
    if(state.selected){var v=currentVariant();html+='<section class="warehouse-card"><button type="button" class="btn-sm-edit" data-wh-all>'+esc(w('allProducts'))+'</button>';
      if(v){html+='<h2>'+esc(v.genuine_part_number||v.manufacturer_part_number||v.product_id)+' <span class="warehouse-kind">'+esc(kindLabel(v.kind))+'</span></h2><p>'+esc([v.manufacturer_part_number,v.manufacturer].filter(Boolean).join(' / '))+'</p><div class="warehouse-totals"><span>'+esc(w('total'))+' <strong>'+esc(v.stock_qty)+'</strong></span><span>'+esc(w('allocated'))+' <strong>'+esc(v.allocated_qty)+'</strong></span><span>'+esc(w('unassigned'))+' <strong>'+esc(v.unassigned_qty)+'</strong></span></div>';
        if(v.unassigned_qty<0||v.needs_recount)html+='<p class="warehouse-warning" role="alert">'+esc(w(v.needs_recount?'recountRequired':'mismatch'))+'</p>';
        if(v.legacy_location)html+='<p class="warehouse-hint">'+esc(w('legacy'))+': '+esc(v.legacy_location)+'</p>';
        if(canManage())html+='<button class="btn-primary" type="button" data-wh-allocate'+(v.unassigned_qty<=0||v.needs_recount||state.pending?' disabled':'')+'>'+esc(w('allocate'))+'</button>';
        var positions=(s.positions||[]).filter(function(p){return p.variant_id===v.variant_id;});html+='<div class="warehouse-positions">';if(!positions.length)html+='<p class="empty">'+esc(w('noPositions'))+'</p>';
        positions.forEach(function(p){html+='<article class="warehouse-position"><div><strong class="warehouse-location-code">'+esc(p.location)+'</strong>'+(p.needs_recount?'<span class="warehouse-needs-check">'+esc(w('needsReview'))+'</span>':'')+'<p>'+esc(sourceLabel(p))+'</p></div><strong class="warehouse-position-qty">'+esc(p.quantity)+'</strong>';
          if(canManage())html+='<div class="warehouse-position-actions"><button class="btn-sm-edit" type="button" data-wh-transfer="'+esc(p.id)+'"'+(v.unassigned_qty<0||v.needs_recount||state.pending?' disabled':'')+'>'+esc(w('move'))+'</button><button class="btn-sm-edit" type="button" data-wh-release="'+esc(p.id)+'"'+(state.pending?' disabled':'')+'>'+esc(w('remove'))+'</button><button class="btn-sm-edit" type="button" data-wh-recount="'+esc(p.id)+'"'+(state.pending?' disabled':'')+'>'+esc(w('recount'))+'</button></div>';html+='</article>';});html+='</div>';
        html+='<h3>'+esc(w('history'))+'</h3><p class="warehouse-hint">'+esc(w('historyHint'))+'</p><ol class="warehouse-history">';if(!(s.history||[]).length)html+='<li>'+esc(w('noHistory'))+'</li>';
        (s.history||[]).forEach(function(h){var a=h.result||{};html+='<li><time>'+esc(new Date(h.created_at).toLocaleString())+'</time> '+esc(w(h.operation))+' <strong>'+esc(h.operation==='recount'?String(a.quantity_before)+' → '+String(a.quantity_after):(a.quantity==null?'':a.quantity))+'</strong> '+esc((a.from_location||w('unassigned'))+' → '+(a.to_location||w('unassigned')))+'<br><span>'+esc(sourceLabel(a))+' / '+esc(a.note||'')+'</span></li>';});html+='</ol>';
      }else html+='<p class="empty">'+esc(w('empty'))+'</p>';html+='</section>';
    }else{
      html+='<section class="warehouse-card"><h2>'+esc(w('results'))+'</h2><p class="warehouse-hint">'+esc(w('pageHint'))+'</p><div class="warehouse-table-wrap"><table class="warehouse-table"><thead><tr>'+['part','kind','total','allocated','unassigned','location'].map(function(k){return '<th>'+esc(w(k))+'</th>';}).join('')+'</tr></thead><tbody>';
      (s.variants||[]).slice(0,50).forEach(function(v){html+='<tr><td><strong>'+esc(v.genuine_part_number||v.product_id)+'</strong><br>'+esc(v.manufacturer_part_number||'')+'</td><td>'+esc(kindLabel(v.kind))+'</td><td>'+esc(v.stock_qty)+'</td><td>'+esc(v.allocated_qty)+(v.needs_recount?'<span class="warehouse-needs-check">'+esc(w('needsReview'))+'</span>':'')+'</td><td class="'+(v.unassigned_qty<0?'warehouse-difference':'')+'">'+esc(v.unassigned_qty)+'</td><td><button class="btn-sm-edit" data-wh-select="'+esc(v.variant_id)+'" type="button">'+esc(w('view'))+'</button></td></tr>';});
      html+='</tbody></table></div>';if(!(s.variants||[]).length)html+='<p class="empty">'+esc(w('empty'))+'</p>';
      html+='<div class="warehouse-pages"><button type="button" class="btn-sm-edit" data-wh-page="-1"'+(state.offset===0?' disabled':'')+'>'+esc(w('first'))+'</button><span>'+esc((s.variants||[]).length?state.offset+1:0)+' - '+esc(state.offset+Math.min(50,(s.variants||[]).length))+'</span><button type="button" class="btn-sm-edit" data-wh-page="1"'+(!s.has_more?' disabled':'')+'>'+esc(w('next'))+'</button></div></section>';
    }
    host.innerHTML=html;var pb=el('add-pallet');if(pb){pb.hidden=!canManage();pb.disabled=!!state.pending||state.working;}
  }

  async function load(){
    if(!allowed()){state.snapshot=null;render();status(w('denied'),true);return;}
    var seq=++state.seq,actor=state.owner;state.loading=true;status(w('loading'));render();
    try{var r=await root.sb.rpc('get_warehouse_stock',{p_query:state.selected?'':state.query,p_kind:state.selected?'':state.kind,p_location:state.selected?'':state.location,p_variant_id:state.selected||null,p_offset:state.selected?0:state.offset,p_limit:50});
      if(seq!==state.seq||actor!==owner()||actor!==state.owner||!allowed())return;
      if(r.error)throw r.error;if(!r.data||!Array.isArray(r.data.variants)||!Array.isArray(r.data.positions)||!Array.isArray(r.data.locations))throw new Error('Invalid warehouse response');
      state.snapshot=r.data;state.loading=false;render();status('');
    }catch(e){if(seq!==state.seq||actor!==owner()||actor!==state.owner)return;state.loading=false;state.snapshot=null;render();status(e&&e.code==='42501'?w('denied'):w('error'),true);}
  }
  function labelField(label,input){return '<label class="warehouse-field"><span>'+esc(label)+'</span>'+input+'</label>';}
  function closeDialog(){var d=el('dialog');if(d&&d.open)d.close();state.dialog=null;}
  function openDialog(operation,positionId){
    if(state.working||state.loading||state.pending||!canManage())return;
    var v=currentVariant(),p=positionId&&(state.snapshot.positions||[]).find(function(x){return x.id===positionId&&x.variant_id===state.selected;});
    if(operation!=='add_pallet'&&(!v||(operation!=='allocate'&&!p)))return;
    if(operation==='allocate'&&(v.unassigned_qty<=0||v.needs_recount)||operation==='transfer'&&(v.unassigned_qty<0||v.needs_recount))return;
    var d={operation:operation,variant_id:v&&v.variant_id,stock_qty:v&&v.stock_qty,allocated_qty:v&&v.allocated_qty,position:p&&Object.assign({},p),max:operation==='allocate'?v.unassigned_qty:operation==='recount'?Math.max(p.quantity,p.quantity+v.unassigned_qty):p&&p.quantity};state.dialog=d;
    var html='<h2 id="warehouse-dialog-title">'+esc(w(operation==='add_pallet'?'pallet':operation))+'</h2>';
    if(operation==='add_pallet'){
      html+=labelField(w('code'),'<input id="warehouse-code" type="text" maxlength="40" autocomplete="off" placeholder="GLS-23" required>');html+='<p class="warehouse-hint">'+esc(w('codeHint'))+'</p>';html+=labelField(w('label'),'<input id="warehouse-label" type="text" maxlength="80">');
    }else{
      html+='<p><strong>'+esc(v.genuine_part_number||v.manufacturer_part_number||v.product_id)+'</strong> / '+esc(kindLabel(v.kind))+'</p>';
      if(p)html+='<p>'+esc(w('from'))+': <strong>'+esc(p.location)+'</strong><br>'+esc(sourceLabel(p))+'</p>';
      if(operation==='allocate'||operation==='transfer')html+=labelField(w('destination'),'<select id="warehouse-destination" required>'+locationsOptions('')+'</select>');
      else html+='<p class="warehouse-warning">'+esc(w(operation==='recount'?'countHint':'releaseHint'))+'</p>';
      html+=labelField(w(operation==='recount'?'countActual':'quantity')+' ('+(operation==='recount'?0:1)+' - '+d.max+')','<input id="warehouse-quantity" type="number" min="'+(operation==='recount'?0:1)+'" max="'+d.max+'" step="1" value="'+(operation==='recount'?p.quantity:1)+'" required>');
      if(operation==='allocate'){
        html+=labelField(w('source'),'<input id="warehouse-source" maxlength="80" placeholder="GLS-23">');html+='<p class="warehouse-hint">'+esc(w('sourceHint'))+'</p>';
        html+=labelField(w('round'),'<input id="warehouse-round" type="number" min="1" max="9999" step="1" placeholder="2">');
      }
      html+=labelField(w('note'),'<textarea id="warehouse-note" maxlength="300" required></textarea>');
    }
    html+='<p id="warehouse-dialog-status" class="warehouse-dialog-status" role="alert"></p><div class="warehouse-dialog-actions"><button type="button" class="btn-sm-edit" data-wh-cancel>'+esc(w('cancel'))+'</button><button type="button" class="btn-primary" data-wh-submit>'+esc(w('confirm'))+'</button></div>';
    var dialog=el('dialog');dialog.innerHTML=html;dialog.showModal();var input=dialog.querySelector('input,select');if(input)input.focus();
  }
  function definitive(error,statusCode){var c=String(error&&error.code||'');return statusCode>=400&&statusCode<500&&(/^(22|23)/.test(c)||c==='42501'||c==='40001'||c==='PGRST202'||c==='PGRST301');}
  async function submit(){
    if(state.working||state.pending||!canManage()||!state.dialog)return;
    var d=state.dialog,payload={operation:d.operation},error=el('dialog-status');
    if(d.operation==='add_pallet'){
      payload.location=el('code').value.trim().toUpperCase();payload.label=el('label').value.trim();
      if(!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(payload.location)||/^T[0-9]{2}-[0-9]{2}$/.test(payload.location)){error.textContent=w('invalidCode');return;}
    }else{
      var qty=el('quantity').value.trim(),note=el('note').value.trim();
      if(!(d.operation==='recount'?/^(0|[1-9][0-9]*)$/:/^[1-9][0-9]*$/).test(qty)||!Number.isSafeInteger(Number(qty))||Number(qty)>d.max||!note){error.textContent=w(d.operation==='recount'?'invalidCount':'invalid');return;}
      payload.variant_id=d.variant_id;payload.quantity=Number(qty);payload.expected_stock_qty=d.stock_qty;payload.note=note;
      if(d.operation==='allocate'||d.operation==='transfer'){payload.location=el('destination').value;if(!payload.location){error.textContent=w('destination');return;}}
      if(d.operation==='allocate'){
        var round=el('round').value.trim();if(round&&(!/^[1-9][0-9]{0,3}$/.test(round)||Number(round)>9999)){error.textContent=w('invalid');return;}
        payload.expected_allocated_qty=d.allocated_qty;payload.source_reference=el('source').value.trim();payload.container_round=round?Number(round):0;
      }else{payload.position_id=d.position.id;payload.expected_revision=d.position.revision;}
    }
    var actor=state.owner;if(!actor||actor!==owner())return;
    var pending={id:root.crypto.randomUUID(),owner:actor,variant_id:payload.variant_id||''};
    if(!persistPending(pending)){error.textContent=w('storage');return;}
    state.pending=pending;state.working=true;pendingView();var buttons=el('dialog').querySelectorAll('button');buttons.forEach(function(b){b.disabled=true;});
    try{
      var r=await root.sb.rpc('apply_warehouse_stock_operation',{p_request_id:pending.id,p_payload:payload});
      if(actor!==owner()||actor!==state.owner)return;
      if(r.error){
        if(definitive(r.error,r.status||0)){
          clearPending();closeDialog();await load();status(r.error.code==='40001'?w('stale'):w('failed')+' '+String(r.error.message||''),true);
        }else{closeDialog();render();status(w('unknownResult'),true);}
        return;
      }
      if(!r.data||r.data.request_id!==pending.id){closeDialog();render();status(w('unknownResult'),true);return;}
      clearPending();closeDialog();await load();status(w('saved'));
    }catch(e){if(actor===owner()&&actor===state.owner){closeDialog();render();status(w('unknownResult'),true);}}
    finally{if(actor===state.owner){state.working=false;render();}}
  }
  async function checkPending(){
    if(state.working||!state.pending||!allowed())return;
    var pending=state.pending,actor=state.owner;state.working=true;pendingView();
    try{var r=await root.sb.rpc('get_warehouse_stock_request',{p_request_id:pending.id});if(actor!==owner()||actor!==state.owner)return;
      if(r.error)throw r.error;if(!r.data||r.data.request_id!==pending.id)throw new Error('Mismatched result');
      if(r.data.found&&r.data.result&&r.data.result.request_id===pending.id){clearPending();await load();status(w('saved'));}else status(w('notFound'),true);
    }catch(e){if(actor===owner()&&actor===state.owner)status(w('unknownResult'),true);}
    finally{if(actor===state.owner){state.working=false;render();}}
  }
  function refreshAccess(){var b=document.getElementById('btn-warehouse-stock-open');if(b){b.hidden=!allowed();b.textContent=w('title');}}
  async function open(){if(!allowed()){status(w('denied'),true);return;}state.owner=owner();state.selected='';state.offset=0;state.query='';state.kind='';state.location='';state.snapshot=null;restorePending();translateChrome();root.showScreen('warehouse-stock');await load();}
  function beforeNavigate(id){
    if(id==='warehouse-stock')return true;
    if(state.working&&id!=='login'&&id!=='boot')return false;
    state.seq++;if(id==='login'||id==='boot'){state.owner='';state.snapshot=null;state.pending=null;state.working=false;var h=el('content');if(h)h.innerHTML='';var p=el('pending');if(p){p.hidden=true;p.innerHTML='';}}
    closeDialog();return true;
  }
  function translateChrome(){document.querySelectorAll('[data-wh-word]').forEach(function(e){e.textContent=w(e.dataset.whWord);});if(el('query'))el('query').placeholder=w('query');if(el('kind'))el('kind').innerHTML=['','rebuilt','aftermarket_new','oem_new'].map(function(k){return '<option value="'+k+'">'+esc(w(k||'allKinds'))+'</option>';}).join('');}
  function init(){
    if(document.getElementById('screen-warehouse-stock'))return;
    var section=document.createElement('div');section.id='screen-warehouse-stock';section.className='screen';
    section.innerHTML='<div class="page-header"><div class="page-header-left"><button class="back-btn" type="button" id="warehouse-back" data-wh-word="back"></button><span class="logo-text" data-wh-word="title"></span></div></div><main class="mgmt-body warehouse-body"><div class="warehouse-intro"><h1 data-wh-word="title"></h1><p data-wh-word="intro"></p><p class="warehouse-hint" data-wh-word="hint"></p></div><form id="warehouse-search-form" class="warehouse-toolbar"><input id="warehouse-query" type="search" maxlength="120" aria-label="Part number"><select id="warehouse-kind" aria-label="Product condition"></select><select id="warehouse-location-filter" aria-label="Location"></select><button class="btn-primary" type="submit" data-wh-word="search"></button><button type="button" class="btn-sm-edit" id="warehouse-refresh" data-wh-word="refresh"></button><button type="button" class="btn-sm-edit" id="warehouse-add-pallet" data-wh-word="pallet" hidden></button></form><div id="warehouse-status" class="warehouse-status" role="status" aria-live="polite"></div><div id="warehouse-pending" class="warehouse-warning" hidden></div><div id="warehouse-content"></div></main><dialog id="warehouse-dialog" class="warehouse-dialog" aria-labelledby="warehouse-dialog-title"></dialog>';
    document.body.appendChild(section);translateChrome();
    document.getElementById('btn-warehouse-stock-open').addEventListener('click',open);
    el('back').addEventListener('click',function(){if(!state.working)root.showScreen('product-kind-stock-mgmt');});
    el('search-form').addEventListener('submit',function(e){e.preventDefault();if(state.working)return;state.query=el('query').value.trim();state.kind=el('kind').value;state.location=el('location-filter').value;state.selected='';state.offset=0;load();});
    el('refresh').addEventListener('click',function(){if(!state.working)load();});el('add-pallet').addEventListener('click',function(){openDialog('add_pallet');});
    section.addEventListener('click',function(e){var target=e.target.closest('button');if(!target||state.working)return;
      if(target.hasAttribute('data-wh-check')){checkPending();return;}
      if(target.hasAttribute('data-wh-submit')){submit();return;}
      if(target.hasAttribute('data-wh-cancel')){closeDialog();return;}
      if(target.hasAttribute('data-wh-select')){state.selected=target.dataset.whSelect;state.offset=0;load();return;}
      if(target.hasAttribute('data-wh-all')){state.selected='';state.offset=0;load();return;}
      if(target.hasAttribute('data-wh-page')){state.offset=Math.max(0,state.offset+Number(target.dataset.whPage)*50);load();return;}
      if(target.hasAttribute('data-wh-location')){state.location=target.dataset.whLocation;state.selected='';state.offset=0;el('location-filter').value=state.location;load();return;}
      if(target.hasAttribute('data-wh-allocate')){openDialog('allocate');return;}
      if(target.hasAttribute('data-wh-transfer')){openDialog('transfer',target.dataset.whTransfer);return;}
      if(target.hasAttribute('data-wh-release')){openDialog('release',target.dataset.whRelease);return;}
      if(target.hasAttribute('data-wh-recount'))openDialog('recount',target.dataset.whRecount);
    });
    el('dialog').addEventListener('cancel',function(e){if(state.working)e.preventDefault();else state.dialog=null;});
    refreshAccess();
  }
  var oldRender=render;render=function(){oldRender();var loc=el('location-filter');if(loc){var value=state.location;loc.innerHTML='<option value="">'+esc(w('allLocations'))+'</option>'+((state.snapshot&&state.snapshot.locations)||[]).map(function(l){return '<option value="'+esc(l.code)+'">'+esc(l.code)+'</option>';}).join('');loc.value=value;}};
  root.DcatsWarehouseStock={open:open,refreshAccess:refreshAccess,beforeNavigate:beforeNavigate,_state:state,_words:words,_load:load,_submit:submit,_checkPending:checkPending,_definitive:definitive,_openDialog:openDialog,_render:render};
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
})(typeof window!=='undefined'?window:globalThis);
