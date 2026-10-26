(function () {
  "use strict";
  var sessions = new Set();
  function actor() { return typeof currentUser !== "undefined" && currentUser ? currentUser.id : ""; }
  function allowed() { return !!actor() && typeof canManageSalesOrders === "function" && canManageSalesOrders(); }
  function admin() { return typeof isSystemAdmin === "function" && isSystemAdmin(); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; }); }
  function input(label, name, type, value, attrs) { return "<label><span>" + esc(label) + "</span><input data-ra-field='" + name + "' type='" + type + "' value='" + esc(value) + "' " + (attrs || "") + "></label>"; }
  function button(label, action, attrs) { return "<button type='button' data-ra-action='" + action + "' " + (attrs || "") + ">" + esc(label) + "</button>"; }
  function current(s) { return s.owner === actor() && allowed() && s.host.isConnected; }
  function field(s, name) { var e = s.host.querySelector("[data-ra-field='" + name + "']"); return e ? e.value.trim() : ""; }
  function message(s, text) { var e = s.host.querySelector("[data-ra-message]"); if (e && current(s)) e.textContent = text; }
  function controls(s) {
    s.host.querySelectorAll("[data-ra-action]").forEach(function (b) { b.disabled = s.busy || (!!s.pending && b.dataset.raAction !== "result") || (!!s.dirty && b.dataset.raAction === "reload"); });
    var result = s.host.querySelector("[data-ra-action='result']"); if (result) result.hidden = !s.pending;
  }
  async function rpc(action, payload, id) {
    if (!allowed()) throw new Error("販売王連携を管理する権限がありません。");
    var r = await sb.rpc("recycle_accounting_workspace", { target_action:action, target_payload:payload || {}, target_request_id:id || null });
    if (r.error) { var error = new Error(r.error.message || "処理できませんでした。"); error.code = r.error.code; throw error; }
    return Array.isArray(r.data) ? r.data[0] : r.data;
  }
  async function load(s) {
    var data = await rpc("get", { order_id:s.order.id });
    if (!current(s)) return;
    s.data = data;
    s.cfg = data.can_configure && admin() ? await rpc("config") : null;
    if (current(s)) render(s);
  }
  function render(s) {
    var data = s.data, pkg = data.package, f = pkg && pkg.financial_snapshot;
    var html = "<h4>販売王へ売上・入金を連携</h4><p class='recycle-note'>売上総額を保ち、実際の差引入金は「振込」、ファクタリング手数料控除は「その他」で分けます。「その他」の費用・税の会計連携設定は別途確認してください。</p>";
    if (s.cfg) html += "<details><summary>販売王の連携設定（管理者）</summary><p>テスト会社で売上・入金・残高・会計連携を確認した後に有効にします。販売王のブロードリーフ得意先を登録し、発行されたコードを入力してください。</p><div class='recycle-grid'>" + input("登録済みのブロードリーフ得意先コード", "customer-code", "text", s.cfg.external_customer_code, "maxlength='13'") + input("台帳・税計算・その他区分の確認根拠", "config-note", "text", s.cfg.verification_note, "maxlength='1000'") + "</div><label class='recycle-accounting-check'><input data-ra-field='enabled' type='checkbox'" + (s.cfg.enabled ? " checked" : "") + ">専用連携を有効にする</label>" + button("連携設定を保存", "config") + "</details>";
    if (!pkg) {
      html += "<p>" + (data.enabled ? "専用連携は有効です。" : "専用連携は未設定・無効です。") + " 出荷・決済確認・手数料確定後に、実際の着金を入力して連携データを固定します。</p><div class='recycle-grid'>" + input("実際の着金日（決済確認日とは別）", "received-on", "date", "") + input("実際の差引入金額", "received-amount", "number", "", "min='0' step='1'") + input("銀行明細・精算明細の確認根拠", "bank-reference", "text", "", "maxlength='200'") + "</div>" + button("売上・入金データを固定する", "prepare");
    } else {
      html += "<p>売上 " + esc(f.gross_jpy) + "円 ／ 手数料 " + esc(f.fee_jpy) + "円 ／ 差引入金 " + esc(f.net_jpy) + "円</p><p>売上日 " + esc(f.sale_date) + " ／ 着金日 " + esc(f.received_on) + "</p>";
      if (f.received_on < f.sale_date) html += "<p class='recycle-note'>着金が売上より先のため、その間は前受の状態になります。両方の日付以降の元帳で残高を確認してください。</p>";
      ["sales", "receipts"].forEach(function (kind) {
        var label = kind === "sales" ? "売上" : "入金", status = pkg[kind + "_state"], canReceipt = kind === "sales" || pkg.sales_state === "verified";
        html += "<details><summary>" + label + "伝票：" + esc(status === "verified" ? "CSV照合済み" : status === "unknown" ? "結果未確認・再取込しない" : "未照合") + "</summary><p>" + esc(f[kind === "sales" ? "sales_voucher" : "receipts_voucher"]) + " ／ " + (kind === "sales" ? "売上伝票（消費税特例対応形式）56列" : "入金伝票13列") + "、Shift_JIS、見出しなし。保存だけでは登録済みになりません。</p>";
        if (canReceipt) html += button("同じ" + label + "CSVを保存", "download_" + kind);
        if (!pkg.reconciled_at && canReceipt && status !== "verified") html += button(label + "の取込着手・結果不明を記録", "unknown_" + kind) +
          (kind === "sales" ? "<label><span>販売王から出力した売上CSVの形式</span><select data-ra-field='format-sales'><option value='sales_standard_55'>売上伝票・標準55列（特例対応列を含まない）</option><option value='sales_special_56'>消費税特例対応形式・56列</option></select></label>" : "") +
          input("販売王から独立に出力した" + label + "CSV（見出しなし）", "file-" + kind, "file", "", "accept='.csv,.txt'") + input("独立出力の確認根拠", "reference-" + kind, "text", "", "maxlength='500'") + button(label + "CSVを照合", "readback_" + kind);
        html += "</details>";
      });
      if (pkg.reconciled_at) html += "<p>販売王の売上・入金CSVと、担当者が確認した得意先元帳の売掛残高0円を記録済みです。</p>";
      else html += "<details><summary>最後に売掛残高を確認</summary><p>売上・入金の両方を読み戻した後、販売王のブロードリーフ得意先元帳で確認します。請求締切や伝票別の消込済み状態とは別の確認です。</p><div class='recycle-grid'>" + input("残高の確認基準日", "balance-on", "date", "") + input("販売王に表示された売掛残高", "balance", "number", "", "step='1'") + input("得意先元帳・確認結果の根拠", "balance-reference", "text", "", "maxlength='1000'") + "</div>" + button("売掛残高0円の照合を記録", "reconcile") + "</details>";
    }
    s.host.innerHTML = html + "<p data-ra-message role='status' aria-live='polite'></p><div class='recycle-actions'>" + button("処理結果を確認", "result", "hidden") + button("最新状態を確認", "reload") + "</div>";
    controls(s);
  }
  async function readFile(s, kind) {
    var inputEl = s.host.querySelector("[data-ra-field='file-" + kind + "']"), file = inputEl && inputEl.files && inputEl.files[0];
    if (!file || file.size > 1000000) throw new Error("1MB以下の読戻しCSVを選択してください。");
    var bytes = await file.arrayBuffer(), text;
    try { text = new TextDecoder("utf-8", { fatal:true }).decode(bytes); }
    catch (_) { text = new TextDecoder("shift_jis", { fatal:true }).decode(bytes); }
    return text;
  }
  async function mutate(s, action, payload) {
    s.pending = { action:action, payload:payload, id:crypto.randomUUID() };
    try {
      await rpc(action, payload, s.pending.id);
      s.pending = null; s.dirty = false;
      if (current(s)) await load(s);
      message(s, "記録しました。CSVの保存・照合と実際の取込は区別して確認してください。");
    } catch (error) {
      if (/^(?:[0-9A-Z]{5}|PGRST\d+)$/.test(error.code || "")) s.pending = null;
      throw error;
    }
  }
  async function act(s, action) {
    if (!current(s) || s.busy || (s.pending && action !== "result")) return;
    s.busy = true; controls(s);
    try {
      var p = { order_id:s.order.id }, split = action.split("_"), kind = split[1];
      if (action === "reload") { if (s.dirty) throw new Error("入力中の内容を記録してから更新してください。"); await load(s); }
      else if (action === "result") {
        if (!s.pending) return;
        var r = await rpc("result", { request_id:s.pending.id });
        if (!current(s)) return;
        if (!r.found) throw new Error("完了記録はまだ確認できません。再送せず、後で結果を確認してください。");
        s.pending = null; s.dirty = false; await load(s); message(s, "保存済みの処理結果を確認しました。");
      } else if (action === "config") {
        await mutate(s, "save_config", { revision:s.cfg.revision, enabled:s.host.querySelector("[data-ra-field='enabled']").checked, external_customer_code:field(s,"customer-code"), verification_note:field(s,"config-note") });
      } else if (action === "prepare") {
        if (!window.confirm("売上・入金データを固定します。作成後は決済・手数料・売上日を変更できません。")) return;
        Object.assign(p, { received_on:field(s,"received-on"), received_amount_jpy:field(s,"received-amount"), bank_reference:field(s,"bank-reference") }); await mutate(s, action, p);
      } else if (split[0] === "download") {
        if (typeof prepareDcatsHanbaiouExportDirectory !== "function") throw new Error("販売王CSVの業務用保存先を確認できません。");
        var directory = await prepareDcatsHanbaiouExportDirectory();
        if (!current(s)) return;
        var data = await rpc("download", Object.assign(p, {kind:kind}));
        if (current(s)) { await downloadSalesAccountingExportFile(data,directory); message(s,"同じCSVを保存しました。二重取込や結果不明時の再取込はしないでください。"); }
      } else if (split[0] === "readback") {
        var text = await readFile(s,kind);
        if (!current(s)) return;
        await mutate(s,"readback",Object.assign(p,{kind:kind,file_text:text,export_format:kind==='sales'?field(s,"format-sales"):"receipts_13",reference:field(s,"reference-"+kind)}));
      } else if (split[0] === "unknown") await mutate(s,"mark_unknown",Object.assign(p,{kind:kind}));
      else if (action === "reconcile") await mutate(s,action,Object.assign(p,{balance_on:field(s,"balance-on"),balance_jpy:field(s,"balance"),reference:field(s,"balance-reference")}));
    } catch (error) { message(s,error.message + (s.pending ? " 結果を確認するまで再送できません。" : "")); }
    finally { s.busy = false; if(current(s)) controls(s); }
  }
  function mount(order, host) {
    if (!order || !order.recycle || !allowed()) return;
    sessions.forEach(function (old) { if (!old.host.isConnected && !old.pending) sessions.delete(old); });
    var section = document.createElement("section"); section.className = "recycle-accounting";
    section.innerHTML = "<h4>販売王連携</h4><p data-ra-message role='status'>連携状態を読み込んでいます。</p>"; host.appendChild(section);
    var s;
    sessions.forEach(function(old){if(old.owner===actor() && old.order.id===order.id && old.pending) s=old;});
    if(s) { s.host=section; s.order=order; }
    else s = { order:order, host:section, owner:actor(), busy:false, dirty:false, pending:null };
    sessions.add(s);
    section.addEventListener("input", function () { s.dirty = true; controls(s); });
    section.addEventListener("click", function (event) { var b = event.target.closest("[data-ra-action]"); if (b) act(s,b.dataset.raAction); });
    load(s).catch(function (error) { message(s,error.message); });
  }
  window.DcatsRecycleAccounting = Object.freeze({ mount:mount, isBusy:function () { var busy=false; sessions.forEach(function(s){if(s.owner===actor() && allowed() && (s.busy || s.pending || (s.host.isConnected && s.dirty))) busy=true;}); return busy; } });
}());
