(function(root) {
  "use strict";
  var active = null, generation = 0, lastFocus = null;
  var MAX_QUEUE = 20, MAX_FILE = 8 * 1024 * 1024, MAX_TOTAL = 64 * 1024 * 1024;
  var words = {
    ja: { title:"商品撮影・画像整理",close:"閉じる",search:"検索",query:"品番",choose:"品番を選択",capture:"撮影・登録",images:"登録画像",kind:"商品区分",variant:"対象在庫",standard:"区分標準",origin:"登録先",sales:"販売管理",production:"製造管理",rebuilt:"リビルト",aftermarket_new:"社外新品",used_core:"コア",other:"その他",start:"カメラを開始",stop:"カメラを停止",shot:"撮影",files:"端末の写真を追加",pending:"登録前",register:"写真を登録",remove:"除外",retake:"撮り直し",publish:"得意先に公開",caption:"画像名",order:"表示順",selected:"選択",all:"すべて選択",download:"選択画像を保存",delete:"選択画像を削除",save:"変更を保存",reload:"最新の内容を確認",apply:"選択画像の区分を変更",loading:"読み込み中…",empty:"画像がありません",noProduct:"品番を検索・選択してください",noResult:"該当する品番がありません",many:"候補が多いため、品番を絞り込んでください",ready:"",done:"完了",uploading:"登録中",downloading:"取得中",saving:"保存中",error:"処理に失敗しました",denied:"この機能を利用する権限がありません",camera:"カメラを利用できません。端末の写真から追加してください。",secure:"カメラの利用にはHTTPS接続と端末の許可が必要です。",limit:"一度に20枚、合計64MBまで登録できます。",invalid:"対応する画像を追加してください（1枚20MBまで）。",queueConfirm:"未登録の写真・未保存の変更を破棄しますか？",deleteConfirm:"選択した画像登録を削除しますか？ 共用元のファイルは保持されます。",uncertain:"結果を確認できません。再送せず「登録結果を確認」を押してください。",receipt:"登録結果を確認",notSaved:"保存は確認されませんでした。内容を確認して、改めて操作してください。",preview:"拡大表示",chooseImage:"画像を選択してください",tooBig:"選択画像が64MBを超えました。枚数を減らしてください。",publicConfirm:"得意先への公開設定を変更します。保存しますか？",fileLimit:"画像は長辺2048pxのJPEGで登録します。",cameraReady:"カメラ停止中",retry:"再試行",failed:"未登録",registered:"登録済み",noCamera:"カメラからの映像を確認できません。",changed:"品番を変更すると未登録の写真・未保存の変更は破棄されます。続けますか？" },
    en: { title:"Product Photos",close:"Close",search:"Search",query:"Part number",choose:"Select a product",capture:"Capture & Register",images:"Registered Photos",kind:"Product Type",variant:"Stock Variant",standard:"Type Default",origin:"Register To",sales:"Sales",production:"Manufacturing",rebuilt:"Rebuilt",aftermarket_new:"Aftermarket New",used_core:"Core",other:"Other",start:"Start Camera",stop:"Stop Camera",shot:"Capture",files:"Add Device Photos",pending:"Pending",register:"Register Photos",remove:"Remove",retake:"Retake",publish:"Customer Visible",caption:"Image Name",order:"Display Order",selected:"Selected",all:"Select All",download:"Download Selected",delete:"Delete Selected",save:"Save Changes",reload:"Refresh",apply:"Change Selected Type",loading:"Loading…",empty:"No photos",noProduct:"Search and select a product",noResult:"No matching products",many:"Too many matches. Refine the part number.",ready:"",done:"Completed",uploading:"Registering",downloading:"Downloading",saving:"Saving",error:"Operation failed",denied:"You do not have access to this feature",camera:"Camera unavailable. Add photos from your device.",secure:"Camera access requires HTTPS and device permission.",limit:"Up to 20 photos and 64MB per batch.",invalid:"Add a supported image (up to 20MB each).",queueConfirm:"Discard pending photos and unsaved changes?",deleteConfirm:"Delete selected image registrations? Shared source files will be retained.",uncertain:"Result unknown. Do not resend. Check the operation result.",receipt:"Check Operation Result",notSaved:"No saved operation found. Review before trying again.",preview:"Preview",chooseImage:"Select photos",tooBig:"Selection exceeds 64MB. Select fewer photos.",publicConfirm:"Save changes to customer visibility?",fileLimit:"Photos are registered as JPEG, up to 2048px on the longest side.",cameraReady:"Camera stopped",retry:"Retry",failed:"Not registered",registered:"Registered",noCamera:"No camera frame available.",changed:"Changing product discards pending photos and unsaved changes. Continue?" },
    zh: { title:"商品拍摄与图片整理",close:"关闭",search:"搜索",query:"品号",choose:"选择商品",capture:"拍摄与登记",images:"已登记图片",kind:"商品分类",variant:"库存对象",standard:"分类标准",origin:"登记位置",sales:"销售管理",production:"生产管理",rebuilt:"再制造",aftermarket_new:"副厂新品",used_core:"旧件",other:"其他",start:"启动相机",stop:"停止相机",shot:"拍摄",files:"添加设备图片",pending:"待登记",register:"登记图片",remove:"移除",retake:"重拍",publish:"对客户公开",caption:"图片名称",order:"显示顺序",selected:"已选择",all:"全选",download:"下载所选图片",delete:"删除所选图片",save:"保存修改",reload:"刷新",apply:"修改所选分类",loading:"读取中…",empty:"没有图片",noProduct:"请搜索并选择商品",noResult:"没有匹配的商品",many:"结果过多，请缩小品号范围",ready:"",done:"完成",uploading:"登记中",downloading:"下载中",saving:"保存中",error:"操作失败",denied:"无权使用此功能",camera:"无法使用相机，请添加设备图片。",secure:"相机需要HTTPS连接和设备许可。",limit:"每批最多20张、合计64MB。",invalid:"请添加支持的图片（每张最多20MB）。",queueConfirm:"放弃未登记图片和未保存修改？",deleteConfirm:"删除所选图片登记？共享原文件将保留。",uncertain:"无法确认结果，请勿重复发送。请确认操作结果。",receipt:"确认操作结果",notSaved:"未发现已保存操作。请确认后重新操作。",preview:"放大查看",chooseImage:"请选择图片",tooBig:"所选图片超过64MB，请减少数量。",publicConfirm:"保存客户公开设置的修改？",fileLimit:"图片以最长边2048px的JPEG格式登记。",cameraReady:"相机已停止",retry:"重试",failed:"未登记",registered:"已登记",noCamera:"无法读取相机画面。",changed:"更换商品会丢弃未登记图片和未保存修改。继续？" }
  };
  Object.assign(words.ja,{cancel:"保留操作を取り消す",cancelConfirm:"保留操作を取り消しますか？ すでに完了していた場合は結果を表示します。",unresolved:"結果はまだ確定していません。再送せず、時間をおいて確認するか保留操作を取り消してください。",holdClose:"結果不明の操作を保留したまま閉じますか？ 次回この画面で結果を確認できます。",finishUpload:"アップロード済み画像を登録",uploadReady:"画像のアップロードを確認しました。登録または保留操作の取り消しを選んでください。",cancelled:"保留操作を取り消しました。",storage:"操作の復旧情報を保存できません。ブラウザの保存設定を確認してください。"});
  Object.assign(words.en,{cancel:"Cancel Pending Operation",cancelConfirm:"Cancel this pending operation? If already completed, its result will be shown.",unresolved:"Result is not final. Do not resend. Check later or cancel the pending operation.",holdClose:"Close with the operation pending? You can check its result next time.",finishUpload:"Register Uploaded Photo",uploadReady:"Upload confirmed. Register the photo or cancel the pending operation.",cancelled:"Pending operation cancelled.",storage:"Cannot save recovery information. Check browser storage settings."});
  Object.assign(words.zh,{cancel:"取消待确认操作",cancelConfirm:"取消此待确认操作？若已完成，将显示结果。",unresolved:"结果尚未确定。请勿重复发送，请稍后确认或取消操作。",holdClose:"保留待确认操作并关闭？下次可继续确认结果。",finishUpload:"登记已上传图片",uploadReady:"已确认上传。请选择登记或取消操作。",cancelled:"已取消待确认操作。",storage:"无法保存恢复信息，请检查浏览器存储设置。"});
  words.ja.common="品番共通";words.en.common="All Stock Variants";words.zh.common="商品共用";
  function tr(key) { var lang = typeof currentLang === "string" ? currentLang : "ja"; return (words[lang] || words.ja)[key] || words.ja[key] || key; }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function(c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function allowed() { return typeof canUseProductPhotoTools === "function" && canUseProductPhotoTools(); }
  function owner() { return typeof userProfile !== "undefined" && userProfile ? String(userProfile.id || "") : ""; }
  function current(s) { return active === s && s.owner === owner() && allowed(); }
  function el(id) { return document.getElementById("photo-tools-" + id); }
  function status(message, error) { if (!active) return; el("status").textContent = message || ""; el("status").classList.toggle("error", !!error); }
  function button(action, label, extra) { return '<button type="button" data-photo-action="' + action + '"' + (extra || "") + '>' + esc(tr(label)) + '</button>'; }
  function options(kinds, value) { return kinds.map(function(k) { return '<option value="' + k + '"' + (k === value ? " selected" : "") + '>' + esc(tr(k)) + '</option>'; }).join(""); }
  function productName(p) { return p.genuine_part_number || p.manufacturer_part_number || p.gltek_part_number || ""; }
  function productSub(p) { return [p.manufacturer,p.manufacturer_part_number,p.gltek_part_number].filter(Boolean).join(" / "); }
  function check(s) { if (!current(s)) throw new Error(tr("denied")); }
  function pendingKey(s) {return "dcats-product-photo-pending:"+s.owner;}
  function hold(s,op) {
    try {root.sessionStorage.setItem(pendingKey(s),JSON.stringify({actor:s.owner,operation:op}));}
    catch(e){throw new Error(tr("storage"));}
  }
  function held(s) {
    var raw=root.sessionStorage.getItem(pendingKey(s));if(!raw)return null;
    var data=JSON.parse(raw);
    if(data.actor!==s.owner||!data.operation||["upload","register","update","delete"].indexOf(data.operation.action)<0)throw new Error(tr("storage"));
    return data.operation;
  }
  function clearHeld(s) {root.sessionStorage.removeItem(pendingKey(s));}
  function confirmAction(s,message,command) {
    if(s.confirmPanel)return Promise.resolve(false);
    return new Promise(function(resolve){
      var panel=document.createElement('div');panel.className='photo-tools-confirm';panel.setAttribute('role','alertdialog');panel.setAttribute('aria-modal','true');
      var box=document.createElement('div'),text=document.createElement('p'),no=document.createElement('button'),yes=document.createElement('button');
      text.id='photo-tools-confirm-message';text.textContent=message;panel.setAttribute('aria-describedby',text.id);
      no.type=yes.type='button';no.textContent=tr('close');yes.textContent=tr(command||'save');yes.className=command==='delete'?'danger':'primary';yes.dataset.photoConfirm='yes';
      function finish(value){panel.remove();s.confirmPanel=null;s.confirmResolve=null;resolve(value);}
      no.addEventListener('click',function(){finish(false);});yes.addEventListener('click',function(){finish(true);});
      box.append(text,no,yes);panel.appendChild(box);s.host.appendChild(panel);s.confirmPanel=panel;s.confirmResolve=finish;no.focus();
    });
  }
  function removePendingPhoto(s,request) {var index=s.queue.findIndex(function(q){return q.request===request;});if(index>=0){URL.revokeObjectURL(s.queue[index].url);s.queue.splice(index,1);}}
  async function rpc(s, action, payload) {
    check(s);
    var response = await sb.rpc("product_photo_tools", { action:action, payload:payload || {} });
    check(s);
    if (response.error) throw Object.assign(new Error(response.error.message || tr("error")), {code:response.error.code});
    return response.data;
  }
  function stopCamera(s) {
    s.cameraGeneration++;
    if (s.stream) s.stream.getTracks().forEach(function(t) { t.stop(); });
    s.stream = null;
    var video = el("video"); if (video) video.srcObject = null;
    if (active === s) { el("camera-idle").hidden = false; updateControls(); }
  }
  function dirty(s) { return s.queue.length > 0 || s.edits.size > 0; }
  function release(s) {
    if(s.confirmResolve)s.confirmResolve(false);
    stopCamera(s); clearInterval(s.timer);
    s.queue.forEach(function(item) { URL.revokeObjectURL(item.url); });
    s.urls.forEach(function(url) { URL.revokeObjectURL(url); });
    s.queue.length = 0; s.edits.clear(); s.images.length = 0;
  }
  function close(force) {
    var s = active; if (!s) return true;
    if (!force && s.busy) return false;
    if (!force && s.uncertain && !root.confirm(tr("holdClose"))) return false;
    if (!force && !s.uncertain && dirty(s) && !root.confirm(tr("queueConfirm"))) return false;
    active = null; generation++; release(s); s.host.remove();
    if (!force && lastFocus && document.contains(lastFocus)) lastFocus.focus();
    return true;
  }
  function updateControls() {
    var s = active; if (!s) return;
    var blocked=s.busy||s.initializing||!!s.uncertain||!s.authorized;
    s.host.querySelectorAll("button,input,select").forEach(function(node) { node.disabled = blocked; });
    s.host.querySelector('[data-photo-action="close"]').disabled=s.busy;
    var hasProduct = !!s.product;
    ["kind","variant","origin","files"].forEach(function(id) { el(id).disabled = blocked || !hasProduct; });
    s.host.querySelectorAll('[data-photo-action="start"]').forEach(function(n) { n.disabled = blocked || !hasProduct; });
    s.host.querySelectorAll('[data-photo-action="shot"],[data-photo-action="stop"]').forEach(function(n) { n.disabled = blocked || !s.stream; });
    s.host.querySelectorAll('[data-photo-action="register"]').forEach(function(n) { n.disabled = blocked || !s.queue.length; });
    ["download","delete","apply"].forEach(function(a) { s.host.querySelectorAll('[data-photo-action="'+a+'"]').forEach(function(n) { n.disabled = blocked || !s.selection.size; }); });
    s.host.querySelectorAll('[data-photo-action="save"]').forEach(function(n) { n.disabled = blocked || !s.edits.size; });
    el("receipt").hidden = !s.uncertain; el("receipt").disabled = s.busy||s.initializing||!s.authorized;
    el("cancel-pending").hidden=!s.uncertain;el("cancel-pending").disabled=s.busy||s.initializing||!s.authorized;
    el("finish-upload").hidden=!(s.uncertain&&s.uncertain.action==='upload'&&s.uncertain.uploaded);el("finish-upload").disabled=s.busy||s.initializing||!s.authorized;
    el("selected").textContent = tr("selected") + " " + s.selection.size;
    s.host.querySelectorAll('[data-photo-queue-public]').forEach(function(n) { var q=s.queue[Number(n.dataset.photoQueuePublic)]; if(q && ["rebuilt","aftermarket_new"].indexOf(q.kind)<0)n.disabled=true; });
    s.host.querySelectorAll('[data-photo-edit="show_in_customer"]').forEach(function(n) { var i=s.images.find(function(row){return String(row.id)===n.dataset.photoId;});if(i && ["rebuilt","aftermarket_new"].indexOf(editFor(i).product_kind)<0)n.disabled=true; });
  }
  function variants() {
    var s = active, kind = el("kind").value;
    el("variant").innerHTML = '<option value="">'+esc(tr("common"))+'</option>' + s.variants.filter(function(v) { return v.kind === kind; }).map(function(v) { return '<option value="'+v.id+'">'+esc(v.label || tr("standard"))+'</option>'; }).join("");
  }
  function makeHost() {
    var host = document.createElement("div"); host.className = "product-photo-tools";
    host.setAttribute("role","dialog"); host.setAttribute("aria-modal","true"); host.setAttribute("aria-labelledby","photo-tools-title");
    host.innerHTML = '<div class="photo-tools-shell"><header class="photo-tools-header"><h2 id="photo-tools-title">'+esc(tr("title"))+'</h2>'+button("close","close")+'</header>'+
      '<div class="photo-tools-status" id="photo-tools-status" role="status" aria-live="polite"></div><div class="photo-tools-recovery"><button id="photo-tools-receipt" data-photo-action="receipt" type="button" hidden>'+esc(tr("receipt"))+'</button><button id="photo-tools-finish-upload" data-photo-action="finish-upload" type="button" hidden>'+esc(tr("finishUpload"))+'</button><button id="photo-tools-cancel-pending" data-photo-action="cancel-pending" type="button" hidden>'+esc(tr("cancel"))+'</button></div>'+
      '<div class="photo-tools-product"><form id="photo-tools-search-form"><label for="photo-tools-query">'+esc(tr("query"))+'</label><input id="photo-tools-query" autocomplete="off" maxlength="80" placeholder="31400-58J10"><button type="submit">'+esc(tr("search"))+'</button></form><div id="photo-tools-results" class="photo-tools-results"></div><div id="photo-tools-product-title" class="photo-tools-product-title">'+esc(tr("noProduct"))+'</div></div>'+
      '<div class="photo-tools-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-photo-action="capture" id="photo-tools-capture-tab">'+esc(tr("capture"))+'</button><button type="button" role="tab" aria-selected="false" data-photo-action="images" id="photo-tools-images-tab">'+esc(tr("images"))+' <span id="photo-tools-image-count">0</span></button></div>'+
      '<div class="photo-tools-scroll"><section id="photo-tools-capture" role="tabpanel" aria-labelledby="photo-tools-capture-tab"><div class="photo-tools-fields"><label>'+esc(tr("kind"))+'<select id="photo-tools-kind">'+options(["rebuilt","aftermarket_new","used_core","other"],"rebuilt")+'</select></label><label>'+esc(tr("variant"))+'<select id="photo-tools-variant"></select></label><label>'+esc(tr("origin"))+'<select id="photo-tools-origin">'+options(["sales","production"],"sales")+'</select></label></div>'+
      '<div class="photo-tools-capture-layout"><div class="photo-tools-camera"><div class="photo-tools-video"><video id="photo-tools-video" autoplay playsinline muted></video><span id="photo-tools-camera-idle">'+esc(tr("cameraReady"))+'</span></div><div class="photo-tools-camera-actions">'+button("start","start")+button("stop","stop")+button("shot","shot",' class="primary"')+'</div><label class="photo-tools-file">'+esc(tr("files"))+'<input type="file" id="photo-tools-files" accept="image/jpeg,image/png,image/webp,image/gif" multiple></label><div class="photo-tools-note">'+esc(tr("fileLimit"))+'</div></div><div class="photo-tools-pending"><div class="photo-tools-section-title"><h3>'+esc(tr("pending"))+' <span id="photo-tools-pending-count">0</span></h3>'+button("register","register",' class="primary"')+'</div><div id="photo-tools-queue" class="photo-tools-gallery"></div></div></div></section>'+
      '<section id="photo-tools-images" role="tabpanel" aria-labelledby="photo-tools-images-tab" hidden><div class="photo-tools-toolbar"><label><input type="checkbox" id="photo-tools-select-all">'+esc(tr("all"))+'</label><strong id="photo-tools-selected"></strong>'+button("download","download")+button("delete","delete",' class="danger"')+button("reload","reload")+button("save","save",' class="primary"')+'</div><div class="photo-tools-bulk"><select id="photo-tools-bulk-kind" aria-label="'+esc(tr("kind"))+'">'+options(["rebuilt","aftermarket_new","used_core","other"],"rebuilt")+'</select>'+button("apply","apply")+'</div><div id="photo-tools-gallery" class="photo-tools-gallery"></div></section></div>'+
      '<div id="photo-tools-preview" class="photo-tools-preview" hidden><button type="button" data-photo-action="close-preview">'+esc(tr("close"))+'</button><img alt=""></div></div>';
    return host;
  }
  async function open(product, origin, initialTab) {
    if (!allowed()) return;
    if (active && !close()) return;
    lastFocus = document.activeElement;
    var s = {host:makeHost(),owner:owner(),token:++generation,authorized:false,initializing:true,busy:false,uncertain:null,stream:null,cameraGeneration:0,product:null,variants:[],images:[],queue:[],urls:[],selection:new Set(),edits:new Map(),searchSeq:0,productSeq:0};
    active = s; document.body.appendChild(s.host); bind(s); el("origin").value = origin === "production" ? "production" : "sales";
    s.timer = setInterval(function() { if (!current(s)) close(true); },500);
    updateControls(); el("query").focus(); status(tr("loading"));
    try {
      var access = await rpc(s,"access"); if (!current(s) || access.actor_id !== s.owner) throw new Error(tr("denied"));
      var pending=held(s);
      s.uncertain=pending;s.authorized=true;updateControls();status("");
      var target=pending?(pending.payload.product_id||(pending.registration&&pending.registration.product_id)):(product&&product.dkd_shohin_id);
      if (target) await selectProduct(s,target,true);
      if(pending){s.uncertain=pending;status(tr("uncertain"),true);updateControls();}
    } catch (e) { if (current(s)) status(e.message,true); }
    finally {if(current(s)){s.initializing=false;if(initialTab==="images"&&!s.uncertain)setTab("images");updateControls();}}
  }
  function setTab(tab) {
    var s = active; if (!s || s.initializing || s.busy || s.uncertain) return;
    el("capture").hidden = tab !== "capture"; el("images").hidden = tab !== "images";
    el("capture-tab").setAttribute("aria-selected",String(tab === "capture")); el("images-tab").setAttribute("aria-selected",String(tab === "images"));
    if (tab !== "capture") stopCamera(s);
  }
  async function search(s) {
    if (!current(s) || s.initializing || s.busy || s.uncertain) return;
    var seq = ++s.searchSeq, text = el("query").value.trim(); status(tr("loading"));
    try {
      var results = await rpc(s,"search",{query:text}); if (seq !== s.searchSeq) return;
      el("results").innerHTML = results.slice(0,30).map(function(p) { return '<button type="button" data-photo-product="'+p.dkd_shohin_id+'"><strong>'+esc(productName(p))+'</strong><span>'+esc(productSub(p))+'</span></button>'; }).join("");
      status(results.length > 30 ? tr("many") : results.length ? "" : tr("noResult"));
    } catch (e) { if (current(s) && seq === s.searchSeq) status(e.message,true); }
  }
  async function selectProduct(s,id,initial) {
    if (!current(s) || s.busy || (!initial&&(s.initializing||s.uncertain))) return;
    if (dirty(s) && !root.confirm(tr("changed"))) return;
    stopCamera(s); s.queue.forEach(function(q) { URL.revokeObjectURL(q.url); }); s.queue=[]; s.edits.clear(); s.selection.clear();
    var seq=++s.productSeq; s.searchSeq++; s.product=null; s.images=[]; renderQueue(); renderGallery(); updateControls(); status(tr("loading"));
    el("product-title").textContent=tr("noProduct");
    try {
      var data=await rpc(s,"images",{product_id:Number(id)}); if (seq !== s.productSeq) return;
      s.product=data.product; s.variants=data.variants || []; s.images=data.images || [];
      el("results").innerHTML=""; el("product-title").textContent=productName(s.product)+" · "+productSub(s.product);
      variants(); renderGallery(); updateControls(); status(""); await signPreviews(s,seq);
    } catch(e) { if(current(s) && seq===s.productSeq) status(e.message,true); }
  }
  async function signPreviews(s,seq) {
    var paths=Array.from(new Set(s.images.map(function(i){return i.storage_path;}).filter(Boolean)));
    if(!paths.length)return;
    try {
      for(var offset=0;offset<paths.length;offset+=100) {
        var response=await sb.storage.from("product-images").createSignedUrls(paths.slice(offset,offset+100),300);
        if(!current(s)||s.productSeq!==seq)return;
        if(response.error)throw new Error(response.error.message);
        (response.data||[]).forEach(function(entry){ if(entry.signedUrl) s.host.querySelectorAll("[data-photo-path]").forEach(function(node){if(node.dataset.photoPath===entry.path)node.src=entry.signedUrl;}); });
      }
    } catch(e) { if(current(s)&&seq===s.productSeq)status(e.message,true); }
  }
  function renderQueue() {
    var s=active;if(!s)return;
    el("pending-count").textContent=s.queue.length;
    el("queue").innerHTML=s.queue.map(function(q,index){return '<article class="photo-tools-item"><button class="photo-tools-thumb" type="button" data-photo-preview="queue:'+index+'" aria-label="'+esc(tr("preview"))+'"><img src="'+q.url+'" alt="'+esc(q.caption)+'"></button><strong>'+esc(tr(q.kind))+' · '+esc(tr(q.origin))+'</strong><label>'+esc(tr("caption"))+'<input data-photo-queue-caption="'+index+'" maxlength="200" value="'+esc(q.caption)+'"></label><label class="photo-tools-check"><input type="checkbox" data-photo-queue-public="'+index+'"'+(q.publish?' checked':'')+(["rebuilt","aftermarket_new"].indexOf(q.kind)<0?' disabled':'')+'>'+esc(tr("publish"))+'</label><div class="photo-tools-item-actions"><button type="button" data-photo-remove="'+index+'">'+esc(tr("remove"))+'</button><button type="button" data-photo-retake="'+index+'">'+esc(tr("retake"))+'</button></div><span class="photo-tools-item-status">'+esc(q.state||"")+'</span></article>';}).join("") || '<div class="photo-tools-empty">'+esc(tr("empty"))+'</div>';
    updateControls();
    s.queue.forEach(function(q,index){if(["rebuilt","aftermarket_new"].indexOf(q.kind)<0)s.host.querySelector('[data-photo-queue-public="'+index+'"]').disabled=true;});
  }
  function editFor(i) { return active.edits.get(String(i.id)) || {id:i.id,revision:i.revision,product_kind:i.product_kind,show_in_customer:!!i.show_in_customer,caption:i.caption||"",sort_order:i.sort_order||0}; }
  function renderGallery() {
    var s=active;if(!s)return;
    el("image-count").textContent=s.images.length;
    el("gallery").innerHTML=s.images.map(function(i){var edit=editFor(i),key=String(i.id);return '<article class="photo-tools-item"><label class="photo-tools-check"><input type="checkbox" data-photo-select="'+key+'"'+(s.selection.has(key)?' checked':'')+'>'+esc(tr("selected"))+'</label><button class="photo-tools-thumb" type="button" data-photo-preview="image:'+key+'" aria-label="'+esc(tr("preview"))+'"><img data-photo-path="'+esc(i.storage_path||"")+'" alt="'+esc(edit.caption||tr(i.product_kind))+'" loading="lazy"></button><label>'+esc(tr("kind"))+'<select data-photo-edit="product_kind" data-photo-id="'+key+'">'+options(["rebuilt","aftermarket_new","used_core","other"],edit.product_kind)+'</select></label><label>'+esc(tr("caption"))+'<input data-photo-edit="caption" data-photo-id="'+key+'" value="'+esc(edit.caption)+'" maxlength="200"></label><label class="photo-tools-check"><input type="checkbox" data-photo-edit="show_in_customer" data-photo-id="'+key+'"'+(edit.show_in_customer?' checked':'')+(["rebuilt","aftermarket_new"].indexOf(edit.product_kind)<0?' disabled':'')+'>'+esc(tr("publish"))+'</label><label>'+esc(tr("order"))+'<input type="number" min="0" max="999999" step="1" data-photo-edit="sort_order" data-photo-id="'+key+'" value="'+edit.sort_order+'"></label><small>'+esc(tr(i.image_origin==='production'?'production':'sales'))+'</small></article>';}).join("")||'<div class="photo-tools-empty">'+esc(s.product?tr("empty"):tr("noProduct"))+'</div>';
    updateControls();
    s.images.forEach(function(i){if(["rebuilt","aftermarket_new"].indexOf(editFor(i).product_kind)<0){var n=s.host.querySelector('[data-photo-id="'+i.id+'"][data-photo-edit="show_in_customer"]');if(n)n.disabled=true;}});
  }
  async function normalize(source) {
    var bitmap;
    if(source instanceof Blob) {
      if(!/^image\/(jpeg|png|webp|gif)$/.test(source.type)||source.size>20*1024*1024)throw new Error(tr("invalid"));
      bitmap=await createImageBitmap(source,{imageOrientation:"from-image"});
    } else bitmap=source;
    try {
      var width=bitmap.videoWidth||bitmap.width,height=bitmap.videoHeight||bitmap.height;
      if(!width||!height||width*height>36000000)throw new Error(tr("invalid"));
      var ratio=Math.min(1,2048/Math.max(width,height)),canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
      var ctx=canvas.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      var blob=await new Promise(function(resolve){canvas.toBlob(resolve,"image/jpeg",0.9);});
      canvas.width=canvas.height=0;
      if(!blob||blob.size>MAX_FILE)throw new Error(tr("invalid"));return blob;
    } finally {if(source instanceof Blob && bitmap && bitmap.close)bitmap.close();}
  }
  function captureTarget(s) { return {id:s.product.dkd_shohin_id,kind:el("kind").value,origin:el("origin").value,variant:el("variant").value?Number(el("variant").value):null}; }
  async function addPhoto(s,source,name,target) {
    if(s.queue.length>=MAX_QUEUE)throw new Error(tr("limit"));
    var blob=await normalize(source);check(s);
    if(!s.product||s.product.dkd_shohin_id!==target.id) return;
    if(s.queue.length>=MAX_QUEUE||s.queue.reduce(function(n,q){return n+q.blob.size;},0)+blob.size>MAX_TOTAL)throw new Error(tr("limit"));
    s.queue.push({blob:blob,url:URL.createObjectURL(blob),request:crypto.randomUUID(),caption:(name||tr("shot")).slice(0,200),kind:target.kind,origin:target.origin,variant:target.variant,publish:false,uploaded:false,state:""});renderQueue();
  }
  async function startCamera(s) {
    if(!current(s)||s.initializing||s.busy||s.uncertain||!s.product)return;
    stopCamera(s);var seq=++s.cameraGeneration;
    if(!root.isSecureContext||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){status(tr("secure"),true);return;}
    status(tr("loading"));
    try {
      var stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1440}}});
      if(!current(s)||s.cameraGeneration!==seq||document.hidden){stream.getTracks().forEach(function(t){t.stop();});return;}
      s.stream=stream;el("video").srcObject=stream;await el("video").play();
      if(!current(s)||s.cameraGeneration!==seq)return;
      el("camera-idle").hidden=true;status("");updateControls();
    } catch(e) {if(current(s)&&seq===s.cameraGeneration){stopCamera(s);status(tr("camera"),true);}}
  }
  async function shot(s) {
    if(!s.stream||!s.product||s.initializing||s.busy||s.uncertain)return;
    if(!el("video").videoWidth){status(tr("noCamera"),true);return;}
    s.busy=true;updateControls();var target=captureTarget(s);
    try {await addPhoto(s,el("video"),tr("shot")+" "+(s.queue.length+1),target);status("");}
    catch(e){if(current(s))status(e.message,true);}finally{if(current(s)){s.busy=false;updateControls();}}
  }
  async function addFiles(s,files) {
    if(!current(s)||s.initializing||s.busy||s.uncertain||!s.product)return;
    if(files.length+s.queue.length>MAX_QUEUE){status(tr("limit"),true);return;}
    var target=captureTarget(s);s.busy=true;updateControls();
    try {for(var file of files){check(s);await addPhoto(s,file,file.name,target);}status("");}
    catch(e){if(current(s))status(e.message,true);}finally{if(current(s)){s.busy=false;updateControls();}}
  }
  async function write(s,action,payload) {
    var op={action:action,payload:JSON.parse(JSON.stringify(payload))};
    hold(s,op);
    try{var result=await rpc(s,action,payload);clearHeld(s);return result;}
    catch(e){
      if(!current(s))throw e;
      // Transport/unknown failures never trigger an automatic mutation resend.
      if(!e.code || !/^(22|23|40|42|57|P0)/.test(e.code)){s.uncertain=op;status(tr("uncertain"),true);}
      else clearHeld(s);
      throw e;
    }
  }
  async function refresh(s) {
    var data=await rpc(s,"images",{product_id:s.product.dkd_shohin_id});
    s.images=data.images||[];s.selection.clear();s.edits.clear();renderGallery();await signPreviews(s,s.productSeq);
    root.dispatchEvent(new CustomEvent("dcats:product-photos-changed",{detail:{productId:s.product.dkd_shohin_id}}));
  }
  async function register(s) {
    if(!s.queue.length||s.initializing||s.busy||s.uncertain||!s.product)return;
    s.busy=true;stopCamera(s);updateControls();var product=s.product.dkd_shohin_id,items=s.queue.slice(),done=0;
    try{
      for(var q of items){
        check(s);status(tr("uploading")+" "+(done+1)+" / "+items.length);
        var registration={product_id:product,request_id:q.request,product_kind:q.kind,origin:q.origin,variant_id:q.variant,show_in_customer:q.publish,caption:q.caption};
        if(!q.uploaded){
          var ticket=await rpc(s,"upload",{product_id:product,request_id:q.request});
          if(!ticket.uploaded){
            var uploadOperation={action:'upload',payload:{product_id:product,request_id:q.request},registration:registration};hold(s,uploadOperation);
            var response;
            try{response=await sb.storage.from(ticket.bucket).upload(ticket.path,q.blob,{contentType:"image/jpeg",upsert:false});check(s);}
            catch(error){if(current(s)){s.uncertain=uploadOperation;status(tr("uncertain"),true);}throw error;}
            if(response.error){q.state=tr("failed");s.uncertain=uploadOperation;status(tr("uncertain"),true);throw new Error(response.error.message);}
          }
          q.uploaded=true;
        }
        await write(s,"register",registration);
        s.queue.splice(s.queue.indexOf(q),1);URL.revokeObjectURL(q.url);done++;renderQueue();
      }
      await refresh(s);status(tr("done")+" "+done+" / "+items.length);
    }catch(e){if(current(s)&&!s.uncertain)status(e.message,true);}
    finally{if(current(s)){s.busy=false;renderQueue();updateControls();}}
  }
  function selectedRows(s) {return s.images.filter(function(i){return s.selection.has(String(i.id));}).map(function(i){return {id:i.id,revision:i.revision};});}
  async function mutate(s,action,rows) {
    if(!rows.length||s.initializing||s.busy||s.uncertain)return;
    if(rows.length>100){status(tr("chooseImage")+" (1–100)",true);return;}
    if(action==='delete'&&!await confirmAction(s,tr("deleteConfirm"),'delete'))return;
    if(action==='update'&&rows.some(function(r){var i=s.images.find(function(v){return v.id===r.id;});return i&&!!i.show_in_customer!==r.show_in_customer;})&&!await confirmAction(s,tr("publicConfirm")))return;
    if(!current(s))return;
    s.busy=true;updateControls();status(tr("saving"));
    try{await write(s,action,{product_id:s.product.dkd_shohin_id,request_id:crypto.randomUUID(),rows:rows});await refresh(s);status(tr("done"));}
    catch(e){if(current(s)&&!s.uncertain)status(e.message,true);}
    finally{if(current(s)){s.busy=false;updateControls();}}
  }
  async function receipt(s) {
    if(!s.uncertain||s.initializing||s.busy)return;s.busy=true;updateControls();
    try{
      var op=s.uncertain;
      if(op.action==='upload'){
        var upload=await rpc(s,"upload",op.payload),pending=s.queue.find(function(q){return q.request===op.payload.request_id;});
        if(pending)pending.uploaded=upload.uploaded===true;
        op.uploaded=upload.uploaded===true;hold(s,op);status(upload.uploaded?tr("uploadReady"):tr("unresolved"),!upload.uploaded);return;
      }
      var data=await rpc(s,"receipt",{request_id:op.payload.request_id});
      if(data.saved){
        removePendingPhoto(s,op.payload.request_id);clearHeld(s);s.uncertain=null;await refresh(s);renderQueue();status(tr("done"));
      }else if(data.cancelled){removePendingPhoto(s,op.payload.request_id);clearHeld(s);s.uncertain=null;renderQueue();status(tr("cancelled"));}
      else status(tr("unresolved"),true);
    }catch(e){if(current(s))status(tr("uncertain"),true);}finally{if(current(s)){s.busy=false;updateControls();}}
  }
  async function cancelPending(s) {
    if(!s.uncertain||s.initializing||s.busy||!await confirmAction(s,tr("cancelConfirm"),'cancel')||!current(s))return;
    s.busy=true;updateControls();var request=s.uncertain.payload.request_id;
    try{var data=await rpc(s,'cancel',{request_id:request});removePendingPhoto(s,request);clearHeld(s);s.uncertain=null;await refresh(s);renderQueue();status(tr(data.saved?'done':'cancelled'));}
    catch(e){if(current(s))status(tr("uncertain"),true);}finally{if(current(s)){s.busy=false;updateControls();}}
  }
  async function finishUpload(s) {
    if(!s.uncertain||s.initializing||s.busy||s.uncertain.action!=='upload'||!s.uncertain.uploaded||!s.uncertain.registration)return;
    var registration=s.uncertain.registration;s.busy=true;updateControls();
    try{await write(s,'register',registration);s.uncertain=null;removePendingPhoto(s,registration.request_id);await refresh(s);renderQueue();status(tr("done"));}
    catch(e){if(current(s))status(e.message,true);}finally{if(current(s)){s.busy=false;updateControls();}}
  }
  function safeName(text) {return String(text||"photo").replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").replace(/[. ]+$/g,"").slice(0,100)||"photo";}
  async function download(s) {
    var rows=selectedRows(s);if(!rows.length||s.initializing||s.busy||s.uncertain)return;
    if(rows.length>100){status(tr("chooseImage")+" (1–100)",true);return;}
    s.busy=true;updateControls();var files={},total=0;
    try{
      var manifest=await rpc(s,"download",{product_id:s.product.dkd_shohin_id,rows:rows});
      var name=safeName(productName(s.product));
      for(var i=0;i<manifest.length;i++){
        check(s);status(tr("downloading")+" "+(i+1)+" / "+manifest.length);
        var item=manifest[i],response=await sb.storage.from("product-images").download(item.path);check(s);
        if(response.error)throw new Error(response.error.message);
        var blob=response.data;total+=blob.size;if(total>MAX_TOTAL)throw new Error(tr("tooBig"));
        var ext=(item.path.match(/\.(jpg|jpeg|png|webp|gif)$/i)||[])[1]||"jpg";
        files[name+"_"+safeName(tr(item.kind))+"_"+String(i+1).padStart(3,"0")+"."+ext]=new Uint8Array(await blob.arrayBuffer());
      }
      check(s);var names=Object.keys(files),output=names.length===1?new Blob([files[names[0]]]):new Blob([root.fflate.zipSync(files,{level:0})],{type:"application/zip"});
      var url=URL.createObjectURL(output),a=document.createElement("a");s.urls.push(url);a.href=url;a.download=names.length===1?names[0]:name+"_photos.zip";document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(url);},30000);status(tr("done")+" "+names.length);
    }catch(e){if(current(s))status(e.message,true);}finally{if(current(s)){s.busy=false;updateControls();}}
  }
  function bind(s) {
    el("search-form").addEventListener("submit",function(e){e.preventDefault();search(s);});
    el("kind").addEventListener("change",variants);
    el("files").addEventListener("change",function(){var files=Array.from(this.files||[]);this.value="";addFiles(s,files);});
    el("select-all").addEventListener("change",function(){s.selection.clear();if(this.checked)s.images.forEach(function(i){s.selection.add(String(i.id));});s.host.querySelectorAll("[data-photo-select]").forEach(function(n){n.checked=s.selection.has(n.dataset.photoSelect);});updateControls();});
    s.host.addEventListener("input",function(e){var n=e.target;if(n.dataset.photoQueueCaption!=null)s.queue[Number(n.dataset.photoQueueCaption)].caption=n.value;});
    s.host.addEventListener("change",function(e){
      var n=e.target;if(n.dataset.photoQueuePublic!=null){s.queue[Number(n.dataset.photoQueuePublic)].publish=n.checked;return;}
      if(n.dataset.photoSelect){if(n.checked)s.selection.add(n.dataset.photoSelect);else s.selection.delete(n.dataset.photoSelect);updateControls();return;}
      if(n.dataset.photoEdit){var image=s.images.find(function(i){return String(i.id)===n.dataset.photoId;});if(!image)return;var edit=Object.assign({},editFor(image));edit[n.dataset.photoEdit]=n.type==='checkbox'?n.checked:n.type==='number'?Number(n.value):n.value;
        if(["rebuilt","aftermarket_new"].indexOf(edit.product_kind)<0)edit.show_in_customer=false;
        s.edits.set(String(image.id),edit);
        var checkbox=s.host.querySelector('[data-photo-id="'+image.id+'"][data-photo-edit="show_in_customer"]');checkbox.checked=edit.show_in_customer;checkbox.disabled=["rebuilt","aftermarket_new"].indexOf(edit.product_kind)<0;updateControls();
      }
    });
    s.host.addEventListener("click",function(e){
      var n=e.target.closest("button");if(!n||n.disabled||!current(s))return;
      if(n.dataset.photoProduct){selectProduct(s,n.dataset.photoProduct);return;}
      if(n.dataset.photoPreview){var parts=n.dataset.photoPreview.split(":"),img=parts[0]==='queue'?s.queue[Number(parts[1])]:s.images.find(function(i){return String(i.id)===parts[1];});var src=parts[0]==='queue'?img.url:n.querySelector("img").getAttribute("src");if(src){el("preview").querySelector("img").src=src;el("preview").hidden=false;el("preview").querySelector("button").focus();}return;}
      if(n.dataset.photoRemove!=null||n.dataset.photoRetake!=null){var index=Number(n.dataset.photoRemove!=null?n.dataset.photoRemove:n.dataset.photoRetake);URL.revokeObjectURL(s.queue[index].url);s.queue.splice(index,1);renderQueue();if(n.dataset.photoRetake!=null)startCamera(s);return;}
      var action=n.dataset.photoAction;
      if(action==='close')close();else if(action==='capture'||action==='images')setTab(action);
      else if(action==='start')startCamera(s);else if(action==='stop')stopCamera(s);else if(action==='shot')shot(s);else if(action==='register')register(s);
      else if(action==='download')download(s);else if(action==='delete')mutate(s,'delete',selectedRows(s));
      else if(action==='save')mutate(s,'update',Array.from(s.edits.values()));
      else if(action==='receipt')receipt(s);
      else if(action==='cancel-pending')cancelPending(s);
      else if(action==='finish-upload')finishUpload(s);
      else if(action==='close-preview'){el("preview").hidden=true;el("preview").querySelector("img").removeAttribute("src");}
      else if(action==='reload'){if(!s.edits.size||root.confirm(tr("queueConfirm"))){s.busy=true;updateControls();refresh(s).then(function(){status("");}).catch(function(error){if(current(s))status(error.message,true);}).finally(function(){if(current(s)){s.busy=false;updateControls();}});}}
      else if(action==='apply'){var kind=el("bulk-kind").value;s.images.forEach(function(i){if(s.selection.has(String(i.id))){var edit=Object.assign({},editFor(i),{product_kind:kind});if(["rebuilt","aftermarket_new"].indexOf(kind)<0)edit.show_in_customer=false;s.edits.set(String(i.id),edit);}});renderGallery();signPreviews(s,s.productSeq);}
    });
    s.host.addEventListener("keydown",function(e){
      if(e.key==='Escape'){e.preventDefault();if(s.confirmResolve)s.confirmResolve(false);else if(!el("preview").hidden){el("preview").hidden=true;el("images-tab").focus();}else close();}
      if(e.key==='Tab'){var list=Array.from((s.confirmPanel||s.host).querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')).filter(function(n){return n.getClientRects().length>0;});if(!list.length)return;var first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    });
  }
  document.addEventListener("visibilitychange",function(){if(active&&document.hidden)stopCamera(active);});
  root.addEventListener("beforeunload",function(e){if(active&&(dirty(active)||active.busy||active.uncertain)){e.preventDefault();e.returnValue="";}});
  root.DcatsProductPhotoTools=Object.freeze({open:open,close:close,forceClose:function(){close(true);},isBusy:function(){return !!(active&&(active.busy||active.uncertain));}});
  if(typeof module!=="undefined"&&module.exports)module.exports={safeName:safeName,normalize:normalize};
})(typeof window!=="undefined"?window:globalThis);
