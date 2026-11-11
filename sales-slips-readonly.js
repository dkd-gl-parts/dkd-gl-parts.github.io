/* Read-only sales evidence. Only the two dedicated read RPCs are permitted here. */
(function(root) {
  "use strict";
  var integer = /^-?\d+$/;
  var identifier = /^[1-9]\d*$/;
  function money(value) {
    if (value === null || value === undefined) return "—";
    if (typeof value !== "string" || !integer.test(value)) throw new Error("Invalid money contract");
    return BigInt(value).toLocaleString("ja-JP") + " 円";
  }
  function validDate(value) {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var d = new Date(value + "T00:00:00Z");
    return !isNaN(d.valueOf()) && d.toISOString().slice(0,10) === value;
  }
  function checkHeader(row) {
    if (!row || typeof row.id !== "string" || !identifier.test(row.id) ||
        !["sale","return"].includes(row.slip_type) ||
        !["per_slip","per_closing"].includes(row.tax_timing) ||
        !["final","pending_closing"].includes(row.tax_state) ||
        typeof row.slip_number !== "string" || typeof row.customer_code !== "string" ||
        typeof row.customer_name !== "string" || !row.recorded_on || !validDate(row.recorded_on) ||
        typeof row.amount_basis_jpy !== "string") throw new Error("Invalid header contract");
    ["amount_basis_jpy","net_amount_jpy","tax_jpy","total_jpy"].forEach(function(k) { money(row[k]); });
    if (row.tax_timing === "per_closing" && (row.tax_state !== "pending_closing" ||
        row.net_amount_jpy !== null || row.tax_jpy !== null || row.total_jpy !== null)) throw new Error("Unfinalized tax contract");
    if (row.tax_timing === "per_slip" && (row.tax_state !== "final" ||
        [row.net_amount_jpy,row.tax_jpy,row.total_jpy].some(function(v){return typeof v !== "string";}))) throw new Error("Final tax contract");
    ["original_slip_id","reversal_slip_id"].forEach(function(k) {
      if (row[k] !== null && (typeof row[k] !== "string" || !identifier.test(row[k]))) throw new Error("Invalid linked ID");
    });
    return row;
  }
  function checkEnvelope(data) {
    if (!data || data.contract_version !== 1 || typeof data.posting_enabled !== "boolean") throw new Error("Invalid response contract");
  }
  function create(options) {
    var host = options.host, doc = host.ownerDocument;
    var life = 0, listSeq = 0, detailSeq = 0, owner = null, cursor = null, filters = null, ui = null;
    function allowed() { return !!options.currentUserId() && options.canRead() === true; }
    function live(stamp) { return stamp === life && owner === options.currentUserId() && allowed() && options.active(); }
    function node(tag, text, className) {
      var el = doc.createElement(tag);
      if (text !== undefined) el.textContent = text;
      if (className) el.className = className;
      return el;
    }
    function button(text, action) {
      var el = node("button",text); el.type = "button"; el.addEventListener("click",action); return el;
    }
    function status(text, error) { ui.status.textContent = text; ui.status.className = error ? "slip-status slip-error" : "slip-status"; }
    function reset() {
      life++; listSeq++; detailSeq++; owner = null; cursor = null; filters = null; ui = null; host.replaceChildren();
    }
    function invalidate(stamp) {
      if (stamp === life && (!allowed() || owner !== options.currentUserId())) reset();
    }
    function failure(error) {
      var code = error && error.code;
      if (code === "42501" || code === "PGRST301" || code === "PGRST302") return "閲覧権限またはログイン状態を確認してください。";
      if (code === "PGRST202" || code === "42883") return "売上伝票の参照機能は準備中です。";
      return "売上伝票を取得できませんでした。表示内容は確定していません。";
    }
    async function read(name, payload) {
      if (!["list_sales_slips_readonly","get_sales_slip_readonly"].includes(name)) throw new Error("Read RPC only");
      var result = await options.rpc(name,payload);
      if (!result || result.error) throw result && result.error || new Error("Missing response");
      return result.data;
    }
    function posting(data) {
      ui.posting.textContent = data.posting_enabled
        ? "閲覧専用：この画面では登録・取消・更新を行いません。"
        : "売上計上機能はOFFです。この画面は保存済み伝票の閲覧専用です。";
    }
    function cell(row, text) { var td = node("td",text); row.append(td); return td; }
    function table(headers) {
      var wrap = node("div",undefined,"slip-table-scroll"), el=node("table");
      var head=node("thead"), tr=node("tr"); headers.forEach(function(t){var th=node("th",t);th.scope="col";tr.append(th);});
      head.append(tr); var body=node("tbody"); el.append(head,body); wrap.append(el); return {wrap:wrap,body:body};
    }
    function renderRows(rows) {
      ui.list.replaceChildren();
      if (!rows.length) { ui.list.append(node("p","条件に一致する売上伝票はありません。")); return; }
      var t=table(["伝票番号","売上日","得意先","区分","明細金額（保存値）","税額","合計"]);
      rows.forEach(function(r) {
        var tr=node("tr");
        cell(tr,"").append(button(r.slip_number,function(){return detail(r.id);}));
        cell(tr,r.recorded_on); cell(tr,r.customer_code + " " + r.customer_name);
        cell(tr,r.slip_type === "return" ? "取消（赤伝票）" : r.reversal_slip_id ? "売上（取消済み）" : "売上");
        cell(tr,money(r.amount_basis_jpy));
        cell(tr,r.tax_state === "pending_closing" ? "締め時に確定" : money(r.tax_jpy));
        cell(tr,r.tax_state === "pending_closing" ? "締め時に確定" : money(r.total_jpy));
        t.body.append(tr);
      });
      ui.list.append(t.wrap);
    }
    function readFilters() {
      var f={p_search:ui.search.value.trim(),p_from:ui.from.value || null,p_to:ui.to.value || null,p_slip_type:ui.type.value,p_limit:50};
      if (f.p_search.length > 80 || !validDate(f.p_from) || !validDate(f.p_to) ||
          (f.p_from && f.p_to && f.p_from > f.p_to) || !["all","sale","return"].includes(f.p_slip_type)) return null;
      return f;
    }
    async function list(next) {
      var stamp=life;
      if (!live(stamp)) { invalidate(stamp); return; }
      var current=readFilters();
      if (!current) { status("検索条件を確認してください。日付は開始日から終了日の順に指定してください。",true);return; }
      var after=next && JSON.stringify(current)===JSON.stringify(filters) ? cursor : null;
      filters=current; cursor=null;
      var seq=++listSeq; detailSeq++;
      ui.list.replaceChildren(); ui.detail.replaceChildren(); ui.next.hidden=true; ui.next.disabled=true;
      ui.list.setAttribute("aria-busy","true"); status("売上伝票を読み込んでいます。",false);
      try {
        var data=await read("list_sales_slips_readonly",Object.assign({},current,{p_before_id:after}));
        if (!live(stamp) || seq!==listSeq) { invalidate(stamp);return; }
        checkEnvelope(data);
        if (!Array.isArray(data.rows) || data.rows.length>50 || typeof data.has_more!=="boolean") throw new Error("Invalid list");
        var ids=new Set(); data.rows.forEach(function(r){checkHeader(r);if(ids.has(r.id))throw new Error("Duplicate ID");ids.add(r.id);});
        if (data.has_more && (!data.rows.length || data.next_before_id!==data.rows[data.rows.length-1].id)) throw new Error("Invalid cursor");
        if (!data.has_more && data.next_before_id!==null) throw new Error("Unexpected cursor");
        posting(data); renderRows(data.rows);
        cursor=data.next_before_id; ui.next.hidden=!data.has_more; ui.next.disabled=!data.has_more;
        status(data.rows.length + " 件を表示しています。",false);
      } catch(error) {
        if (live(stamp) && seq===listSeq) { ui.list.replaceChildren();status(failure(error),true); }
        else invalidate(stamp);
      } finally { if(live(stamp) && seq===listSeq)ui.list.setAttribute("aria-busy","false"); }
    }
    function pair(dl,label,value) { dl.append(node("dt",label),node("dd",value == null ? "—" : String(value))); }
    function renderDetail(data) {
      var r=data.slip;
      var title=node("h2",r.slip_number); title.tabIndex=-1;
      var dl=node("dl",undefined,"slip-facts");
      pair(dl,"区分",r.slip_type==="return" ? "取消（赤伝票）" : r.reversal_slip_id ? "売上（取消済み）" : "売上");
      pair(dl,"売上日",r.recorded_on); pair(dl,"得意先",r.customer_code+" "+r.customer_name);
      pair(dl,"請求先コード",r.billing_customer_code); pair(dl,"会社コード",r.selling_company_code);
      pair(dl,"税計算",r.tax_timing==="per_closing" ? "締め時一括・締め時に確定" : "伝票ごと・確定");
      pair(dl,"明細金額（保存値）",money(r.amount_basis_jpy));
      pair(dl,"税抜金額",r.tax_state==="pending_closing" ? "締め時に確定" : money(r.net_amount_jpy));
      pair(dl,"税額",r.tax_state==="pending_closing" ? "締め時に確定" : money(r.tax_jpy));
      pair(dl,"合計",r.tax_state==="pending_closing" ? "締め時に確定" : money(r.total_jpy));
      if(r.correction_reason)pair(dl,"取消理由",r.correction_reason);
      var t=table(["行","種類・品番","数量","単価","金額（保存値）","税区分","原価"]);
      data.items.forEach(function(i) {
        var tr=node("tr");cell(tr,String(i.line_no));
        cell(tr,({product:"商品",shipping:"送料",core:"コア代金",discount:"値引"})[i.line_kind] + " " + (i.product_label || ""));
        cell(tr,i.quantity===null ? "—" : String(i.quantity));
        cell(tr,money(i.unit_price_jpy));cell(tr,money(i.amount_jpy));
        cell(tr,({excluded:"外税",included:"内税",none:"非課税"})[i.tax_mode] + " " + String(i.tax_rate_basis_points/100) + "%");
        cell(tr,i.cost_state==="unknown" ? "未確定" : i.cost_state==="not_applicable" ? "対象外" : money(i.cost_total_jpy));
        t.body.append(tr);
      });
      ui.detail.replaceChildren(title,dl,t.wrap);
      if(r.original_slip_id)ui.detail.append(button("元の売上伝票を見る",function(){return detail(r.original_slip_id);}));
      if(r.reversal_slip_id)ui.detail.append(button("取消の赤伝票を見る",function(){return detail(r.reversal_slip_id);}));
      title.focus();
    }
    async function detail(id) {
      var stamp=life;
      if(!live(stamp)){invalidate(stamp);return;}
      if(typeof id!=="string" || !identifier.test(id))return;
      var seq=++detailSeq;ui.detail.replaceChildren(node("p","伝票明細を読み込んでいます。"));ui.detail.setAttribute("aria-busy","true");
      try {
        var data=await read("get_sales_slip_readonly",{p_slip_id:id});
        if(!live(stamp) || seq!==detailSeq){invalidate(stamp);return;}
        checkEnvelope(data);
        if(data.status==="not_found") {ui.detail.replaceChildren(node("p","この伝票は表示できません。"));return;}
        if(data.status!=="found" || !data.slip || data.slip.id!==id)throw new Error("Invalid detail");
        checkHeader(data.slip);
        if(!Array.isArray(data.items) || !data.items.length || data.items.length!==data.slip.item_count || data.items.length>1000)throw new Error("Invalid items");
        var lineNumbers=new Set();
        data.items.forEach(function(i) {
          if(!Number.isInteger(i.line_no)||i.line_no<1||lineNumbers.has(i.line_no)||!["product","shipping","core","discount"].includes(i.line_kind) ||
            !["known","unknown","not_applicable"].includes(i.cost_state) || !["excluded","included","none"].includes(i.tax_mode) ||
            ![0,800,1000].includes(i.tax_rate_basis_points) || typeof i.amount_jpy!=="string" ||
            (i.quantity!==null&&!Number.isInteger(i.quantity)))throw new Error("Invalid item");
          lineNumbers.add(i.line_no);
          ["unit_price_jpy","amount_jpy","cost_total_jpy"].forEach(function(k){money(i[k]);});
          if(i.cost_state==="unknown" && i.cost_total_jpy!==null || i.cost_state==="known" && typeof i.cost_total_jpy!=="string")throw new Error("Invalid cost");
        });
        posting(data);renderDetail(data);
      } catch(error) {
        if(live(stamp)&&seq===detailSeq)ui.detail.replaceChildren(node("p",failure(error),"slip-error"));else invalidate(stamp);
      } finally {if(live(stamp)&&seq===detailSeq)ui.detail.setAttribute("aria-busy","false");}
    }
    async function enter() {
      reset(); if(!allowed() || !options.active())return;
      owner=options.currentUserId();
      var title=node("h1","売上伝票"), note=node("p",undefined,"slip-posting");
      var form=node("form",undefined,"slip-filters");
      var search=node("input");search.type="search";search.maxLength=80;search.value="";search.name="search";
      var from=node("input");from.type="date";from.value="";from.name="from";
      var to=node("input");to.type="date";to.value="";to.name="to";
      var type=node("select");type.name="type";
      [["all","すべて"],["sale","売上"],["return","取消（赤伝票）"]].forEach(function(v){var o=node("option",v[1]);o.value=v[0];type.append(o);});
      type.value="all";
      [[search,"伝票番号・得意先"],[from,"売上日（開始）"],[to,"売上日（終了）"],[type,"区分"]].forEach(function(v){var l=node("label",v[1]);l.append(v[0]);form.append(l);});
      var submit=node("button","検索");submit.type="submit";form.append(submit);
      form.addEventListener("submit",function(e){e.preventDefault();return list(false);});
      var message=node("p",undefined,"slip-status");message.setAttribute("role","status");message.setAttribute("aria-live","polite");
      var rows=node("section");rows.setAttribute("aria-label","売上伝票一覧");
      var next=button("次の50件",function(){return list(true);});next.hidden=true;
      var detailHost=node("section",undefined,"slip-detail");detailHost.setAttribute("aria-label","売上伝票詳細");detailHost.setAttribute("aria-live","polite");
      ui={search:search,from:from,to:to,type:type,status:message,posting:note,list:rows,next:next,detail:detailHost};
      host.replaceChildren(title,note,form,message,rows,next,detailHost);
      await list(false);
    }
    return {enter:enter,reset:reset};
  }
  function createAccessGate(options) {
    var generation=0, verifiedKey=null, postingEnabled=false;
    function allowed() {
      return options.canRead() === true && options.contextKey() !== null && (
        options.isSystemAdmin() === true ||
        (verifiedKey !== null && verifiedKey === options.contextKey() && postingEnabled === true)
      );
    }
    function notify() { if (options.changed) options.changed(allowed()); }
    function reset() {
      generation++; verifiedKey=null; postingEnabled=false;
      if (options.changed) options.changed(false);
    }
    async function refresh() {
      var ticket=++generation, key=options.contextKey();
      verifiedKey=null; postingEnabled=false; notify();
      if (options.canRead() !== true || key === null) return false;
      if (options.isSystemAdmin() === true) return true;
      var timer=null;
      var schedule=options.setTimeout || root.setTimeout;
      var cancel=options.clearTimeout || root.clearTimeout;
      try {
        // Read only the flag; do not fetch sales data to decide whether to show its entry.
        var result=await Promise.race([
          options.rpc("get_sales_slip_readonly_access",{}),
          new Promise(function(resolve,reject) { timer=schedule(function(){reject(new Error("Flag lookup timeout"));},10000); })
        ]);
        if (ticket !== generation || key !== options.contextKey() || options.canRead() !== true) return false;
        var data=result && !result.error && result.data;
        if (data && data.contract_version === 1 && typeof data.posting_enabled === "boolean") {
          verifiedKey=key; postingEnabled=data.posting_enabled;
        }
      } catch (error) {
        if (ticket !== generation || key !== options.contextKey()) return false;
      } finally {
        if (timer !== null) cancel(timer);
      }
      if (ticket !== generation || key !== options.contextKey()) return false;
      notify(); return allowed();
    }
    return {allowed:allowed,refresh:refresh,reset:reset};
  }
  root.DcatsSalesSlipsReadonly={create:create,createAccessGate:createAccessGate};
})(typeof window!=="undefined" ? window : globalThis);
