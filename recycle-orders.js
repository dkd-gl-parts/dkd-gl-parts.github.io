(function () {
  "use strict";
  var state = { dialog: null, settings: null, cart: [], dirty: false, detailDirty: false, busy: false, pending: null, bindingReview: null, settingsSeq: 0, shippingSeq: 0, shippingCustomerId: "", shippingReady: false, epoch: 0, search: 0, postal: 0, list: 0, productIndex: 0, cartIndex: 0, postalIndex: 0, view: "entry", actor: "", rows: [], listQuery: null, offset: 0 };
  function actor() { return typeof currentUser !== "undefined" && currentUser ? String(currentUser.id || currentUser.email || "") : ""; }
  function allowed() { return typeof canManageSalesOrders === "function" && canManageSalesOrders(); }
  function regularEntryAllowed() { return typeof canStartInternalCustomerOrderEntry === "function" && canStartInternalCustomerOrderEntry(); }
  function e(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function yen(value) { return value == null ? "未確定" : Number(value).toLocaleString("ja-JP") + "円"; }
  function kind(value) { return typeof productKindLabel === "function" ? productKindLabel(value) : ({ rebuilt: "リビルト品", aftermarket_new: "社外新品", used_core: "中古コア" }[value] || value); }
  function field(id) { var el = document.getElementById("recycle-" + id); return el ? String(el.value == null ? "" : el.value).trim() : ""; }
  function checked(id) { var el = document.getElementById("recycle-" + id); return !!(el && el.checked); }
  function feeReady() { var p = state.settings && state.settings.fee_conditions; return !!(state.settings && state.settings.fee_policy_version === 2 && p && p.policy_version === 2 && Number.isFinite(p.factoring_rate_percent) && Number.isFinite(p.sales_fee_rate_percent)); }
  function routeLabel(route) { return route === "normal" ? "通常受注" : route === "marketplace" ? "MP経由" : "未区分（従来方式）"; }
  function feeConditions(cfg) { var p = cfg.fee_policy_version === 2 && cfg.fee_conditions; return p ? "決済 " + p.factoring_rate_percent + "％ ／ MP " + p.sales_fee_rate_percent + "％（MP経由のみ）" : "従来方式 " + cfg.fee_rate_percent + "％"; }
  function feeBreakdownText(r) { return r.order_route === "normal" || r.order_route === "marketplace" ? "決済 " + yen(r.estimated_factoring_fee_jpy) + " ／ MP " + yen(r.estimated_marketplace_fee_jpy) : "従来方式・内訳未区分 " + yen(r.estimated_fee_jpy); }
  function updateRouteSummary() {
    var el = document.getElementById("recycle-route-summary"); if (!el) return;
    var p = state.settings && state.settings.fee_conditions;
    el.textContent = p ? routeLabel(checked("marketplace") ? "marketplace" : "normal") + " ／ 決済 " + p.factoring_rate_percent + "％・" + (checked("marketplace") ? "MP " + p.sales_fee_rate_percent + "％" : "MP手数料なし") : "手数料条件を確認できません。";
  }
  function uuid() { return crypto.randomUUID(); }
  function localTime() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  function monthDate(last) { var d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth() + (last ? 1 : 0), last ? 0 : 1)).toISOString().slice(0, 10); }
  function status(text, error) {
    ["recycle-message", "recycle-detail-message"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.classList.toggle("error", !!error);
      if (id === "recycle-message" && state.dialog && state.dialog.open) setEntryPopup("feedback", !!text);
    });
  }
  function input(label, id, type, value, extra) { return "<label><span>" + e(label) + "</span><input id='recycle-" + id + "' type='" + (type || "text") + "' value='" + e(value == null ? "" : value) + "' " + (extra || "") + "></label>"; }
  function button(text, action, extra) { return "<button type='button' data-recycle-action='" + action + "' " + (extra || "") + ">" + e(text) + "</button>"; }
  function option(value, label, selected, disabled) { return "<option value='" + e(value) + "'" + (value === selected ? " selected" : "") + (disabled ? " disabled" : "") + ">" + e(label) + "</option>"; }
  function money(raw, label) { if (!/^\d{1,8}$/.test(String(raw))) throw new Error(label + "を0以上の整数で入力してください。"); return Number(raw); }
  function ownerCurrent() { return state.actor === actor() && allowed(); }
  async function rpc(action, payload, requestId) {
    if (!allowed()) throw new Error("受注を管理する権限がありません。");
    var result = await sb.rpc("recycle_workspace", { target_action: action, target_payload: payload || {}, target_request_id: requestId || null });
    if (result.error) { var err = new Error(result.error.message || "処理できませんでした。"); err.code = result.error.code; throw err; }
    return Array.isArray(result.data) ? result.data[0] : result.data;
  }
  async function mutate(action, payload, after) {
    if (state.busy || state.pending) return;
    state.busy = true;
    var epoch = state.epoch, owner = actor(), requestId = uuid();
    state.pending = { action: action, payload: payload, requestId: requestId, after: after, actor: owner };
    status("処理しています。"); setButtons();
    try {
      var data = await rpc(action, payload, requestId);
      state.pending = null;
      if (owner !== actor() || epoch !== state.epoch) return;
      status("保存しました。");
      if (after) await after(data);
    } catch (error) {
      if (/^(?:[0-9A-Z]{5}|PGRST\d+)$/.test(error.code || "")) state.pending = null;
      if (owner === actor()) status(error.message + (state.pending ? " 結果を確認するまで次の保存はできません。" : ""), true);
    } finally { state.busy = false; setButtons(); }
  }
  function setButtons() {
    if (state.dialog) state.dialog.querySelectorAll("[data-recycle-write]").forEach(function (b) { b.disabled = state.busy || !!state.pending || (b.dataset.recycleAction === "place" && (!state.cart.length || !state.shippingReady)); });
    var entry = document.getElementById("recycle-entry-fields"); if (entry) entry.disabled = !state.settings || !state.settings.sales_customer_id || !feeReady() || state.busy || !!state.pending;
    ["recycle-back", "recycle-list-open", "recycle-settings-open"].forEach(function (id) { var b = document.getElementById(id); if (b) b.disabled = !entry || state.busy || !!state.pending; });
    document.querySelectorAll("[data-recycle-detail-write]").forEach(function (b) { b.disabled = state.busy || !!state.pending; });
    var check = document.getElementById("recycle-check-result"); if (check) check.hidden = !state.pending;
    var csv = state.dialog && state.dialog.querySelector("[data-recycle-action='csv']"); if (csv) csv.disabled = !state.rows.length;
    ["from","to","list-route"].forEach(function (id) { var el = document.getElementById("recycle-" + id); if (el) el.disabled = state.busy || !!state.pending; });
    var settings = document.getElementById("recycle-settings-view"), locked = state.busy || !!state.pending || !!state.bindingReview;
    if (settings) {
      settings.querySelectorAll("input,select,textarea").forEach(function (el) { if (!el.closest("#recycle-binding-confirm")) el.disabled = locked; });
      settings.querySelectorAll("[data-recycle-action='save_settings'],[data-recycle-action='reload_settings']").forEach(function (el) { el.disabled = locked || !state.settings || !state.settings.can_configure; });
      var save = settings.querySelector("[data-recycle-action='save_settings']");
      if (save) save.disabled = save.disabled || state.settings.customer_binding_guard_version !== 1 || !selectedCustomer();
      var confirm = settings.querySelector("[data-recycle-action='binding_confirm']");
      if (confirm) confirm.disabled = state.busy || !!state.pending || !state.bindingReview || !checked("binding-ack");
    }
  }
  async function checkResult() {
    var pending = state.pending; if (!pending || state.busy || pending.actor !== actor()) return;
    state.busy = true;
    try {
      var result = await rpc("result", { request_id: pending.requestId });
      if (!result.found) { status("完了記録はまだ確認できません。再送せず、時間をおいて結果を確認してください。", true); return; }
      state.pending = null; status("保存済みの結果を確認しました。");
      if (pending.after) await pending.after(result.response);
    } catch (error) { status(error.message, true); }
    finally { state.busy = false; setButtons(); }
  }
  function close() {
    if (state.busy || state.pending) { status("処理結果の確認が終わるまで画面を閉じられません。", true); return; }
    if (state.dirty && !window.confirm("入力中のRecycle+受注を閉じますか。未保存の入力は残りません。")) return;
    clearBindingReview(); state.settingsSeq++; state.epoch++; state.dirty = false; state.cart = []; state.dialog.close();
  }
  async function open() {
    if (!allowed()) return;
    if(state.dialog && state.dialog.open) return;
    if (state.actor && state.actor !== actor()) { state.cart = []; state.pending = null; state.dirty = false; }
    clearBindingReview(); state.actor = actor(); state.epoch++; state.settingsSeq++; state.shippingCustomerId = ""; state.shippingReady = false; state.view = "entry";
    if (!state.dialog) {
      state.dialog = document.createElement("dialog"); state.dialog.className = "recycle-dialog"; state.dialog.setAttribute("aria-labelledby", "recycle-title"); document.body.appendChild(state.dialog);
      state.compactEntry = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 800px), (max-width: 1049px) and (max-height: 680px)") : null;
      if (state.compactEntry) state.compactEntry.addEventListener("change", syncEntryLayout);
      state.dialog.addEventListener("cancel", function (event) { event.preventDefault(); if (state.view !== "entry" && !state.busy && !state.pending) showView("entry"); else close(); });
      state.dialog.addEventListener("input", function (event) { if (event.target.closest("#recycle-entry")) state.dirty = true; if (["recycle-product-query","recycle-query-type"].includes(event.target.id)) resetProductSearch(); if (event.target.closest("#recycle-settings-view")) settingsEdited(event); if (["recycle-from","recycle-to"].includes(event.target.id)) clearList(); });
      state.dialog.addEventListener("change", function (event) { if (event.target.id === "recycle-core-" + state.cartIndex) { rememberCart(); updateCoreChargeField(); updateReturnField(); } if (event.target.id === "recycle-marketplace") { state.dirty = true; updateRouteSummary(); } if (event.target.id === "recycle-list-route") { state.offset = 0; loadList(); } if (event.target.closest("#recycle-settings-view")) settingsEdited(event); });
      state.dialog.addEventListener("keydown", function (event) { if (event.key === "Enter" && !event.isComposing && event.target.id === "recycle-product-query") { event.preventDefault(); runAction("products"); } });
      state.dialog.addEventListener("click", function (event) { var b = event.target.closest("[data-recycle-action]"); if (b) runAction(b.dataset.recycleAction, b); });
    }
    if (!state.dialog.open) state.dialog.showModal();
    state.dialog.innerHTML = "<header class='recycle-header'><div><p>Partsman.c Recycle+</p><h2 id='recycle-title' tabindex='-1'>Recycle+受注入力</h2></div><nav class='recycle-actions' aria-label='Recycle+画面'>" + button("受注入力に戻る", "entry", "id='recycle-back' hidden") + button("精算一覧", "settlements", "id='recycle-list-open'") + button("設定", "settings", "id='recycle-settings-open'") + button("結果を確認", "result", "id='recycle-check-result' hidden") + button("閉じる", "close") + "</nav></header><div id='recycle-feedback' class='recycle-entry-popup'><p id='recycle-message' role='status' aria-live='polite'>読み込んでいます。</p><button type='button' class='recycle-feedback-close' popovertarget='recycle-feedback' popovertargetaction='hide'>閉じる</button></div>" + "<div id='recycle-body'></div>";
    setButtons();
    var epoch = state.epoch, seq = state.settingsSeq, openingActor = state.actor;
    try { var cfg = await rpc("settings"); if (epoch === state.epoch && seq === state.settingsSeq && openingActor === actor() && ownerCurrent()) { state.settings = cfg; renderWorkspace(); } }
    catch (error) { if (epoch === state.epoch && seq === state.settingsSeq && openingActor === actor() && ownerCurrent()) status(error.message, true); }
  }
  function renderWorkspace() {
    var cfg = state.settings, body = document.getElementById("recycle-body"); if (!body) return;
    body.innerHTML = "<div id='recycle-customer-summary'></div><div id='recycle-setup-note'></div>" +
      "<section id='recycle-entry' aria-label='受注入力'>" + entryHtml(cfg) + "</section>" +
      "<section id='recycle-settings-view' aria-label='集約先・手数料の設定' hidden>" + settingsHtml(cfg) + "</section>" +
      "<section id='recycle-settlements-view' class='recycle-month' aria-label='精算一覧' hidden><h3>受注日で確認する精算一覧</h3><div class='recycle-list-filters'>" + input("開始日", "from", "date", monthDate(false)) + input("終了日", "to", "date", monthDate(true)) + "<label><span>受注区分</span><select id='recycle-list-route'><option value='all'>すべて</option><option value='normal'>通常受注</option><option value='marketplace'>MP経由</option><option value='unknown'>未区分（従来方式）</option></select></label></div><div class='recycle-actions'>" + button("一覧を更新", "list") + button("確認用CSV", "csv") + "</div><div id='recycle-totals'></div><div id='recycle-list'></div><div class='recycle-actions'>" + button("前の100件", "previous") + button("次の100件", "next") + "</div></section>";
    state.cart = []; state.products = []; state.productIndex = 0; state.cartIndex = 0; state.dirty = false; state.offset = 0; state.rows = []; state.listQuery = null; syncEntryLayout(); refreshSettings(); renderCart(); setButtons(); status(""); showView("entry", false);
    document.getElementById(cfg.sales_customer_id ? "recycle-product-query" : "recycle-title").focus({ preventScroll: true });
  }
  function refreshSettings() {
    var cfg = state.settings;
    clearBindingReview();
    document.getElementById("recycle-customer-summary").innerHTML = "<div class='recycle-summary recycle-customer'><div><span>受注先</span><strong>" + e(cfg.sales_customer_id ? cfg.customer_name || "得意先を確認してください" : "未設定") + "</strong>" + (cfg.customer_code ? "<small><span class='recycle-code-label'>得意先コード </span>" + e(cfg.customer_code) + "</small>" : "") + "</div><span class='recycle-customer-fees'>共通単価 ／ " + e(feeConditions(cfg)) + (cfg.provisional ? "（見込）" : "") + "</span></div>";
    document.getElementById("recycle-setup-note").innerHTML = !cfg.sales_customer_id ? "<div class='recycle-note'><p>受注先が未設定です。登録済みのブロードリーフの得意先を選択してください。</p>" + button("設定を開く", "settings") + "</div>" : !feeReady() ? "<p class='recycle-note' role='alert'>受注区分ごとの手数料条件を確認できません。最新の設定を確認してください。</p>" : "";
    document.getElementById("recycle-settings-view").innerHTML = settingsHtml(cfg);
    document.getElementById("recycle-entry-fields").disabled = !cfg.sales_customer_id;
    document.getElementById("recycle-entry-fees").textContent = "共通単価 ／ " + feeConditions(cfg) + (cfg.provisional ? "（見込）" : "");
    updateCustomerInfo(); updateRouteSummary(); setButtons();
    void loadShippingOptions();
  }
  async function loadShippingOptions() {
    var outbound = document.getElementById("recycle-carrier"), core = document.getElementById("recycle-return-carrier");
    var retry = document.getElementById("recycle-shipping-retry");
    var id = String(state.settings.sales_customer_id || ""), epoch = state.epoch, seq = ++state.shippingSeq;
    var preserve = state.shippingCustomerId === id;
    var previous = [preserve ? outbound.value : "", preserve ? core.value : ""];
    state.shippingReady = false;
    outbound.disabled = true; core.disabled = true; retry.hidden = true;
    setButtons();
    if (!id) { outbound.innerHTML = ""; core.innerHTML = ""; return; }
    function current() { return seq === state.shippingSeq && epoch === state.epoch && ownerCurrent() && state.dialog.open; }
    try {
      var reads = await Promise.all([
        sb.from("customer_display_settings").select("default_outbound_carrier_name,default_outbound_service_name,default_core_return_carrier_name,default_core_return_service_name").eq("sales_customer_id", id).maybeSingle(),
        ensureCustomerAccessShippingServices()
      ]);
      if (!current()) return;
      if (reads[0].error) throw reads[0].error;
      var saved = reads[0].data || {}, defaults = defaultCustomerDisplaySettings();
      var available = customerAccessShippingServices;
      var returnServices = customerOrderCoreReturnDeliveryServices(available);
      function renderCarrier(select, services, priorKey, prefix) {
        var keys = services.map(customerOrderDeliveryServiceKey);
        var configured = customerOrderDeliveryServiceKey({
          carrier_name: saved[prefix + "carrier_name"] || defaults[prefix + "carrier_name"],
          service_name: saved[prefix + "service_name"] || defaults[prefix + "service_name"]
        });
        var selected = keys.indexOf(priorKey) >= 0 ? priorKey : configured;
        select.innerHTML = services.map(function (row) {
          var duplicateName = services.some(function (other) { return other.carrier_name !== row.carrier_name && other.service_name === row.service_name; });
          var label = duplicateName ? row.service_name + "（" + row.carrier_name + "）" : row.service_name;
          return option(customerOrderDeliveryServiceKey(row), label, selected);
        }).join("");
        if (keys.indexOf(selected) < 0) select.selectedIndex = -1;
        select.disabled = false;
      }
      renderCarrier(outbound, available, previous[0], "default_outbound_");
      renderCarrier(core, returnServices, previous[1], "default_core_return_");
      state.shippingCustomerId = id; state.shippingReady = true;
    } catch (error) {
      if (!current()) return;
      outbound.innerHTML = ""; core.innerHTML = "";
      retry.hidden = false;
      if (state.view === "entry") status("得意先情報の運送便を読み込めませんでした。配送設定を再読込してください。", true);
    } finally {
      if (current()) setButtons();
    }
  }
  function showView(view, focus) {
    clearBindingReview();
    if (view !== "entry") ["entry-extra", "product-box", "postal-box", "cart-extra"].forEach(function (id) { setEntryPopup(id, false); });
    state.view = view;
    state.dialog.classList.toggle("recycle-entry-dialog",view === "entry");
    var feedback = document.getElementById("recycle-feedback");
    if (view === "entry" && typeof feedback.showPopover === "function") feedback.setAttribute("popover", "auto");
    else feedback.removeAttribute("popover");
    var setupNote = document.getElementById("recycle-setup-note"); if (setupNote) setupNote.hidden = view !== "entry";
    [["entry", "recycle-entry"], ["settings", "recycle-settings-view"], ["settlements", "recycle-settlements-view"]].forEach(function (pair) { document.getElementById(pair[1]).hidden = pair[0] !== view; });
    document.getElementById("recycle-title").textContent = view === "settings" ? "Recycle+設定" : view === "settlements" ? "Recycle+精算一覧" : "Recycle+受注入力";
    document.getElementById("recycle-back").hidden = view === "entry";
    document.getElementById("recycle-settings-open").hidden = view === "settings";
    document.getElementById("recycle-list-open").hidden = view === "settlements";
    status(""); state.dialog.scrollTop = 0;
    setButtons();
    if (focus !== false) document.getElementById("recycle-title").focus();
  }
  function settingsHtml(cfg) {
    var currentFees = cfg.fee_policy_version === 2 && cfg.fee_conditions;
    var conditions = currentFees ? "決済：取引税抜額 ／ MP：商品税込額（送料・コア代を除外、MP経由のみ）" : cfg.fee_basis === "transaction_total" ? "取引税込総額" : "商品税抜額" + (cfg.include_shipping ? "＋送料" : "・送料除外") + (cfg.include_core ? "＋コア代" : "・コア代除外");
    var html = "<div class='recycle-settings'><h3>集約先・手数料条件</h3><p>現在：" + e(conditions) + "</p><p>変更は新しい受注に適用します。過去受注は登録時の条件を保持します。</p>";
    if (!cfg.can_configure) return html + "<p>設定の変更はシステム管理者へ依頼してください。</p></div>";
    var candidates = Array.isArray(cfg.customer_candidates) ? cfg.customer_candidates : [];
    html += "<p class='recycle-binding-policy'>通常は初回に一度設定します。変更しても過去の受注先は変更しません。</p>";
    if (cfg.customer_binding_guard_version !== 1) html += "<p class='recycle-note' role='alert'>紐付けの安全確認を利用できません。最新の設定を確認してください。</p>";
    else if (!candidates.length) html += "<p class='recycle-note' role='alert'>紐付けできる得意先がありません。得意先管理で販売王コードと登録内容を確認してください。</p>";
    html += "<div class='recycle-grid'><label><span>受注先（登録済み候補）</span><select id='recycle-customer-id'><option value=''>得意先を選択してください</option>" + candidates.map(function (c) { return option(String(c.id), c.code + " ／ " + c.name, String(cfg.sales_customer_id || "")); }).join("") + "</select></label>" + (currentFees ? "<dl class='recycle-fee-rates'><div><dt>決済手数料率</dt><dd>" + e(currentFees.factoring_rate_percent) + "％</dd></div><div><dt>MP販売手数料率</dt><dd>" + e(currentFees.sales_fee_rate_percent) + "％</dd></div></dl>" : input("手数料率（％）", "rate", "number", cfg.fee_rate_percent, "min='0' max='100' step='0.0001'")) + "</div><div id='recycle-customer-info' class='recycle-binding-info'></div><div class='recycle-grid'>";
    if (!currentFees) html += "<label><span>算定対象</span><select id='recycle-basis'>" + option("product_net", "値引後の商品税抜額", cfg.fee_basis) + option("transaction_total", "取引税込総額", cfg.fee_basis) + "</select></label>";
    html += "<label><span>円未満の端数（見込）</span><select id='recycle-rounding'>" + option("floor", "切捨", cfg.rounding) + option("round", "四捨五入", cfg.rounding) + option("ceil", "切上", cfg.rounding) + "</select></label></div><div class='recycle-checks'>";
    if (!currentFees) html += "<label><input id='recycle-include-shipping' type='checkbox'" + (cfg.include_shipping ? " checked" : "") + ">商品額に送料を含む</label><label><input id='recycle-include-core' type='checkbox'" + (cfg.include_core ? " checked" : "") + ">商品額にコア代を含む</label>";
    var note = currentFees && /^暫定10%。商品税抜額/.test(cfg.note || "") ? currentFees.note : cfg.note;
    html += "<label><input id='recycle-provisional' type='checkbox'" + (cfg.provisional ? " checked" : "") + ">暫定条件</label></div>" + input("条件・確認根拠", "policy-note", "text", note, "maxlength='1000'") + "<div class='recycle-actions'>" + button("設定内容を確認して保存", "save_settings", "data-recycle-write") + button("最新の設定を確認", "reload_settings") + "</div><div id='recycle-binding-confirm' hidden></div><p class='recycle-note'>通常の掛売CSVへは出力しません。締め日以降の受注確認は、請求機能が整うまでの暫定チェックです。</p></div>";
    return html;
  }
  function selectedCustomer() {
    var candidates = state.settings && state.settings.customer_candidates;
    if (!Array.isArray(candidates)) return null;
    var matches = candidates.filter(function (c) { return String(c.id) === field("customer-id"); });
    return matches.length === 1 ? matches[0] : null;
  }
  function closingLabel(code) { return String(code) === "31" ? "末日締め" : String(code) === "0" ? "都度（締め日なし）" : /^([1-9]|[12][0-9]|30)$/.test(String(code)) ? code + "日締め" : "締め日未確認"; }
  function updateCustomerInfo() {
    var host = document.getElementById("recycle-customer-info"), customer = selectedCustomer();
    if (host) host.textContent = customer ? "得意先コード " + customer.code + " ／ 請求先コード " + customer.billing_customer_code + " ／ " + closingLabel(customer.closing_code) : "";
  }
  function clearBindingReview() {
    state.bindingReview = null;
    var host = document.getElementById("recycle-binding-confirm"); if (host) { host.hidden = true; host.innerHTML = ""; }
  }
  function settingsEdited(event) {
    if (!event.target.closest("#recycle-binding-confirm")) { clearBindingReview(); updateCustomerInfo(); }
    setButtons();
  }
  function settingsPayload() {
    return { revision: state.settings.revision, sales_customer_id: field("customer-id") || null, fee_rate_percent: feeReady() ? state.settings.fee_rate_percent : field("rate"), fee_basis: feeReady() ? state.settings.fee_basis : field("basis"), rounding: field("rounding"), include_shipping: feeReady() ? state.settings.include_shipping : checked("include-shipping"), include_core: feeReady() ? state.settings.include_core : checked("include-core"), provisional: checked("provisional"), note: field("policy-note") };
  }
  async function settingsSaved() {
    var epoch = state.epoch, seq = ++state.settingsSeq, savingActor = state.actor, cfg = await rpc("settings");
    if (epoch === state.epoch && seq === state.settingsSeq && savingActor === actor() && ownerCurrent()) { state.settings = cfg; refreshSettings(); status("設定を保存しました。"); }
  }
  async function prepareSettings() {
    if (!state.settings.can_configure || state.settings.customer_binding_guard_version !== 1) throw new Error("紐付けの安全確認を利用できません。最新の設定を確認してください。");
    if (!selectedCustomer()) throw new Error("表示された候補から得意先を選択してください。");
    var payload = settingsPayload();
    if (String(state.settings.sales_customer_id || "") === payload.sales_customer_id) { await mutate("save_settings", payload, settingsSaved); return; }
    var epoch = state.epoch, seq = ++state.settingsSeq;
    state.busy = true; setButtons(); status("紐付け先と締め日以降の受注を確認しています。");
    try {
      var preview = await rpc("binding_preview", { sales_customer_id: payload.sales_customer_id });
      if (epoch !== state.epoch || seq !== state.settingsSeq || !ownerCurrent()) return;
      if (JSON.stringify(settingsPayload()) !== JSON.stringify(payload)) throw new Error("設定内容が変わりました。もう一度確認してください。");
      if (!preview || typeof preview.token !== "string" || !preview.next_customer || String(preview.next_customer.id) !== payload.sales_customer_id) throw new Error("紐付けの確認結果を取得できませんでした。");
      state.bindingReview = { payload: payload, preview: preview };
      var host = document.getElementById("recycle-binding-confirm"), previous = preview.previous_customer, next = preview.next_customer;
      host.hidden = false; host.className = "recycle-binding-confirm";
      host.innerHTML = "<h4 id='recycle-binding-title'>受注先の紐付けを確認</h4><p>" + e(previous ? previous.code + " ／ " + previous.name : "未設定") + " → <strong>" + e(next.code + " ／ " + next.name) + "</strong></p>" +
        (Number(preview.affected_order_count) > 0 ? "<div class='recycle-note' role='alert'><strong>締め処理への影響を確認してください。</strong><p>締め日以降など、確認が必要な受注が " + e(preview.affected_order_count) + " 件あります。</p>" + (Array.isArray(preview.warnings) ? preview.warnings : []).filter(function (w) { return Number(w.order_count) > 0; }).map(function (w) { return "<p>" + e(w.customer_code + " ／ " + w.customer_name) + "<br>" + e(w.closing_date ? w.closing_date + " 以降（締め日を含む・日本時間）" : "都度・締め日未設定のため全受注を確認") + " ／ " + e(w.order_count) + " 件" + (w.first_order_date && w.last_order_date ? "<br>受注日 " + e(w.first_order_date) + " ～ " + e(w.last_order_date) : "") + "</p>"; }).join("") + "</div>" : "") +
        "<p>変更は今後の受注に適用します。過去の受注先は変更しません。</p><label class='recycle-binding-ack'><input id='recycle-binding-ack' type='checkbox'>得意先コード・名称と注意事項を確認しました</label><div class='recycle-actions'>" + button("戻って確認", "binding_cancel") + button("この得意先に紐付ける", "binding_confirm", "data-recycle-write disabled") + "</div>";
      host.setAttribute("role", "region"); host.setAttribute("aria-labelledby", "recycle-binding-title");
      host.setAttribute("tabindex", "-1"); host.focus({ preventScroll: true }); if (host.scrollIntoView) host.scrollIntoView({ block: "start" }); status("");
    } finally { state.busy = false; setButtons(); }
  }
  async function confirmBinding() {
    var review = state.bindingReview;
    if (!review || !checked("binding-ack")) throw new Error("紐付け先と注意事項を確認してください。");
    if (!selectedCustomer() || JSON.stringify(settingsPayload()) !== JSON.stringify(review.payload)) { clearBindingReview(); throw new Error("設定内容が変わりました。もう一度確認してください。"); }
    var payload = Object.assign({}, review.payload, { binding_confirmation: review.preview.token, binding_confirmed: true });
    clearBindingReview(); await mutate("save_settings", payload, settingsSaved);
  }
  async function reloadSettings() {
    var epoch = state.epoch, seq = ++state.settingsSeq; state.busy = true; setButtons(); status("設定を確認しています。");
    try { var cfg = await rpc("settings"); if (epoch === state.epoch && seq === state.settingsSeq && ownerCurrent()) { state.settings = cfg; refreshSettings(); status("最新の設定を確認しました。"); } }
    finally { state.busy = false; setButtons(); }
  }
  function entryHtml(cfg) {
    var prefs = typeof SHIPPING_PREFECTURES !== "undefined" ? SHIPPING_PREFECTURES : [];
    return "<fieldset id='recycle-entry-fields'" + (!cfg.sales_customer_id ? " disabled" : "") + "><legend class='recycle-sr-only'>ブロードリーフの受注入力</legend><div class='recycle-entry-grid'>" +
      "<section class='recycle-entry-panel recycle-entry-products' aria-labelledby='recycle-products-heading'><div class='recycle-search-head'><h3 id='recycle-products-heading'>商品追加</h3><button type='button' id='recycle-show-products' popovertarget='recycle-product-box' hidden>検索結果</button></div><div class='recycle-search'>" +
      "<select id='recycle-query-type' aria-label='検索方法'><option value='karte'>カルテ番号</option><option value='part'>品番</option></select>" +
      "<input id='recycle-product-query' type='search' aria-label='カルテ番号' maxlength='80' placeholder='例 22 または 00000-000000000022'>" + button("検索", "products") + "</div>" +
      "<div id='recycle-product-box' class='recycle-entry-popup' aria-label='商品候補' role='region'><div class='recycle-popup-head recycle-compact-only'><strong>商品候補</strong><button type='button' popovertarget='recycle-product-box' popovertargetaction='hide'>閉じる</button></div><p id='recycle-product-status' role='status'></p><div id='recycle-products'></div></div>" +
      "<div class='recycle-cart-head'><h3 id='recycle-items-heading'>商品明細</h3><div id='recycle-cart-pages'></div></div><div id='recycle-cart' aria-labelledby='recycle-items-heading' role='region'></div></section>" +
      "<section class='recycle-entry-panel recycle-entry-address' aria-labelledby='recycle-address-heading'><div class='recycle-address-head'><h3 id='recycle-address-heading'>お届け先</h3><small id='recycle-postal-status' role='status'></small></div><div class='recycle-grid'>" +
      input("直送先会社名", "company", "text", "", "maxlength='120' autocomplete='organization'") + input("宛名・担当者", "recipient", "text", "", "maxlength='80' autocomplete='name'") +
      input("電話番号（必須）", "phone", "tel", "", "maxlength='20' required autocomplete='tel'") +
      "<div class='recycle-postal-field'><label for='recycle-postal'>郵便番号（必須）</label><div class='recycle-postal-row'><input id='recycle-postal' maxlength='8' inputmode='numeric' autocomplete='postal-code' required>" + button("住所検索", "postal") + "</div></div>" +
      "<label><span>都道府県</span><select id='recycle-prefecture'><option value=''>選択してください</option>" + prefs.map(function (p) { return option(String(Array.isArray(p) ? p[0] : p.code), Array.isArray(p) ? p[1] : p.name, ""); }).join("") + "</select></label>" +
      input("住所（必須）", "address1", "text", "", "maxlength='160' required autocomplete='address-line1'") +
      "</div>" +
      "<div id='recycle-postal-box' class='recycle-entry-popup' aria-label='住所候補' role='region'><div class='recycle-popup-head recycle-compact-only'><strong>住所候補</strong><button type='button' popovertarget='recycle-postal-box' popovertargetaction='hide'>閉じる</button></div><div id='recycle-postal-results'></div></div></section>" +
      "<div id='recycle-entry-extra' class='recycle-entry-popup recycle-entry-extra' aria-label='受注・配送の補足' role='region'><div class='recycle-popup-head recycle-compact-only'><strong>受注・配送の補足</strong><button type='button' popovertarget='recycle-entry-extra' popovertargetaction='hide'>閉じる</button></div>" +
      "<section class='recycle-entry-panel recycle-entry-order' aria-labelledby='recycle-order-heading'><h3 id='recycle-order-heading'>受注情報</h3><div class='recycle-grid'>" +
      input("Recycle+注文番号（任意）", "external", "text", "", "maxlength='120'") + input("元の発注会社（参考）", "buyer", "text", "", "maxlength='200'") +
      input("成立した送料", "shipping", "number", 0, "min='0' max='9999999' step='1'") +
      "<label><span>送料の税</span><select id='recycle-shipping-tax'><option value='excluded'>税別</option><option value='included'>税込</option></select></label></div><div class='recycle-route'><label><input id='recycle-marketplace' type='checkbox'>マーケットプレイス経由</label><span id='recycle-route-summary' aria-live='polite'></span></div><p id='recycle-entry-fees' class='recycle-compact-only recycle-fee-subtotals'></p></section>" +
      "<section class='recycle-entry-panel recycle-entry-delivery' aria-labelledby='recycle-delivery-heading'><div class='recycle-delivery-head'><h3 id='recycle-delivery-heading'>配送・メモ</h3>" + button("配送設定を再読込", "retry_shipping", "id='recycle-shipping-retry' hidden") + "</div><div class='recycle-grid'>" +
      input("建物名・部門", "address2", "text", "", "maxlength='120' autocomplete='address-line2'") +
      "<label><span>商品発送時の運送便</span><select id='recycle-carrier' disabled></select></label>" +
      input("お届け希望日", "delivery-date", "date", "") + "<label><span>時間帯</span><select id='recycle-delivery-time'><option value=''>指定なし</option><option value='0812'>午前中</option><option value='1416'>14～16時</option><option value='1618'>16～18時</option><option value='1820'>18～20時</option><option value='1921'>19～21時</option></select></label>" +
      "<label id='recycle-return-field' hidden><span>コア返却時の運送便</span><select id='recycle-return-carrier' disabled></select></label>" +
      "<label><span>注文メモ</span><textarea id='recycle-note' maxlength='500' rows='1'></textarea></label></div></section></div></div>" +
      "<div class='recycle-entry-footer'><button type='button' class='recycle-compact-only' popovertarget='recycle-entry-extra'>受注・配送の補足</button>" + button("内容を確認して受注登録", "place", "class='customer-order-submit-button' data-recycle-write") + "</div></fieldset>";
  }
  function syncEntryLayout() {
    var entry = document.getElementById("recycle-entry-fields");
    if (!entry) return;
    var compact = !!(state.compactEntry && state.compactEntry.matches && typeof entry.showPopover === "function");
    entry.classList.toggle("recycle-entry-compact", compact);
    entry.querySelectorAll(".recycle-entry-popup").forEach(function (el) {
      var usePopover = typeof el.showPopover === "function" && (compact || el.id === "recycle-product-box" || el.id === "recycle-postal-box");
      if (usePopover && !el.hasAttribute("popover")) el.setAttribute("popover", "auto");
      else if (!usePopover) el.removeAttribute("popover");
    });
  }
  function setEntryPopup(id, open) {
    var popup = document.getElementById("recycle-" + id);
    if (!popup || !popup.hasAttribute("popover") || popup.matches(":popover-open") === open) return;
    if (open) popup.showPopover();
    else popup.hidePopover();
  }
  function focusEntry(id) {
    var el = document.getElementById("recycle-" + id);
    if (el) el.focus({preventScroll:true});
  }
  function pages(type, index, count) {
    if (count < 2) return "";
    return "<div class='recycle-pages' aria-label='表示切替'>" +
      button("前へ", "page", "data-type='" + type + "' data-direction='-1'" + (index ? "" : " disabled")) +
      "<span>" + (index + 1) + " / " + count + "</span>" +
      button("次へ", "page", "data-type='" + type + "' data-direction='1'" + (index + 1 < count ? "" : " disabled")) + "</div>";
  }
  function changePage(b) {
    var step = Number(b.dataset.direction), type = b.dataset.type, host;
    if (type === "product") {
      state.productIndex += step; renderProducts(); host = document.getElementById("recycle-products");
    } else if (type === "cart") {
      rememberCart(); state.cartIndex += step; renderCart(); host = document.getElementById("recycle-cart-pages");
    } else if (type === "postal") {
      state.postalIndex += step; renderPostal(); host = document.getElementById("recycle-postal-results");
    }
    var focus = host && (host.querySelector("[data-direction='" + step + "']:enabled") || host.querySelector(".recycle-pages button:enabled"));
    if (focus) focus.focus({preventScroll:true});
  }
  function needsManualCoreCharge(product) {
    return product.core_return_required && !(Number(product.core_charge_jpy) > 0) &&
      (product.handling === "charge_with_return" || product.handling === "charge_no_return");
  }
  function coreHandlingOptions(product) {
    var charge = Number(product.core_charge_jpy);
    var handling = product.handling || "standard";
    var configured = charge > 0;
    var amount = configured ? yen(charge) : "";
    return option("standard", typeof t === "function" ? t("customer_order_core_return_standard") : "返却要", handling) +
      option("charge_with_return", configured ? (typeof tf === "function" ? tf("customer_order_core_charge_with_return_option", { amount: amount }) : "コア代金を請求（返却後返金・" + amount + "）") : "請求・返却後返金", handling) +
      option("charge_no_return", configured ? (typeof tf === "function" ? tf("customer_order_core_charge_no_return_option", { amount: amount }) : "コア代金を請求（返却不要・" + amount + "）") : "請求・返却不要", handling);
  }
  function renderCart() {
    var host = document.getElementById("recycle-cart"); if (!host) return;
    var i = state.cartIndex, p = state.cart[i];
    document.getElementById("recycle-items-heading").textContent = "商品明細" + (state.cart.length ? " (" + state.cart.length + ")" : "");
    document.getElementById("recycle-cart-pages").innerHTML = pages("cart", i, state.cart.length);
    host.innerHTML = p ?
      "<div class='recycle-line'><div class='recycle-line-title'><strong>" + e(p.genuine_part_number || p.manufacturer_part_number) + "</strong>" + (p.karte_number ? "<small>カルテ番号 " + e(p.karte_number) + "</small>" : "") + "</div>" +
      input("数量", "quantity-" + i, "number", p.quantity, "min='1' max='99' step='1'") + input("単価（税抜・コア別）", "price-" + i, "number", p.price, "aria-label='成立単価（税抜・コア代別）' min='0' max='99999999' step='1'") +
      "<div id='recycle-cart-extra' class='recycle-line-extra recycle-entry-popup' aria-label='商品情報・コア対応' role='region'><div class='recycle-popup-head recycle-compact-only'><strong>商品情報</strong><button type='button' popovertarget='recycle-cart-extra' popovertargetaction='hide'>閉じる</button></div>" +
      "<p>" + e(p.manufacturer + " / " + p.manufacturer_part_number + " / " + kind(p.product_kind)) + "</p>" +
      (p.core_return_required ? "<div class='recycle-core-controls'><label><span>コア対応</span><select id='recycle-core-" + i + "'>" + coreHandlingOptions(p) + "</select></label><div id='recycle-manual-core-field' hidden>" +
        input("コア代（税抜/個）", "manual-core-" + i, "text", p.manualCoreCharge, "aria-label='コア代金（1個・税抜）' inputmode='numeric' maxlength='8' autocomplete='off'") + "</div></div>" : "<small>コア返却不要</small>") + "</div>" +
      "<button type='button' class='recycle-compact-only' popovertarget='recycle-cart-extra'>商品情報</button>" + button("削除", "remove", "data-index='" + i + "'") + "</div>" :
      "<p>カルテ番号や品番から商品を追加してください。</p>";
    syncEntryLayout();
    updateCoreChargeField();
    updateReturnField();
    setButtons();
  }
  function updateCoreChargeField() {
    var field = document.getElementById("recycle-manual-core-field");
    if (field) field.hidden = !needsManualCoreCharge(state.cart[state.cartIndex]);
  }
  function hasCoreReturn() { return state.cart.some(function (p) { return p.core_return_required && p.handling !== "charge_no_return"; }); }
  function updateReturnField() { document.getElementById("recycle-return-field").hidden = !hasCoreReturn(); }
  function rememberCart() {
    var i = state.cartIndex, p = state.cart[i];
    if (!p || !document.getElementById("recycle-quantity-" + i)) return;
    p.quantity = field("quantity-" + i);
    p.price = field("price-" + i);
    p.handling = field("core-" + i) || "standard";
    p.manualCoreCharge = field("manual-core-" + i);
  }
  function orderPayload() {
    if (!feeReady()) throw new Error("受注区分ごとの手数料条件を確認できません。最新の設定を確認してください。");
    rememberCart();
    if (!state.cart.length) { focusEntry("product-query"); throw new Error("商品を追加してください。"); }
    if ((!field("company") && !field("recipient")) || !field("phone") || !field("postal") || !field("prefecture") || !field("address1")) {
      focusEntry(["phone","postal","prefecture","address1"].find(function (id) { return !field(id); }) || "company");
      throw new Error("届け先の会社名または宛名と、電話番号・郵便番号・都道府県・住所を入力してください。");
    }
    var items = state.cart.map(function (p, i) {
      var focus = "quantity-";
      try {
        var quantity = money(p.quantity, "数量");
        focus = "price-";
        var unitPrice = money(p.price, "成立単価");
        var item = { dkd_shohin_id: p.dkd_shohin_id, product_kind: p.product_kind, quantity: quantity, unit_price_jpy: unitPrice, core_return_handling: p.handling || "standard", karte_number: p.karte_number || undefined };
        if (needsManualCoreCharge(p)) {
          focus = "manual-core-";
          if (!/^\d{1,8}$/.test(String(p.manualCoreCharge)) || Number(p.manualCoreCharge) === 0) {
            throw new Error("商品明細のコア代金（1個・税抜）は1～99,999,999円の整数で入力してください。");
          }
          item.manual_core_charge_jpy = Number(p.manualCoreCharge);
        }
        return item;
      } catch (error) {
        state.cartIndex = i; renderCart(); focusEntry(focus + i);
        throw error;
      }
    });
    var carrier = customerOrderDeliveryServiceFromKey(field("carrier"));
    var returnCarrier = hasCoreReturn() ? customerOrderDeliveryServiceFromKey(field("return-carrier")) : null;
    if (!state.shippingReady || !carrier || (hasCoreReturn() && !returnCarrier)) {
      if (state.shippingReady) { setEntryPopup("entry-extra", true); focusEntry(carrier ? "return-carrier" : "carrier"); }
      throw new Error("得意先情報の運送便を確認し、配送サービスを選択してください。");
    }
    return { external_order_number: field("external") || null, buyer_reference: field("buyer"), is_marketplace: checked("marketplace"), items: items,
      shipping_address: { destination_type: "address", company_name: field("company"), recipient_name: field("recipient"), phone_number: field("phone"), postal_code: field("postal"), prefecture_code: field("prefecture"), prefecture_name: document.getElementById("recycle-prefecture").selectedOptions[0].text, address_line_1: field("address1"), address_line_2: field("address2") },
      shipping_method: carrier, core_return_shipping_method: returnCarrier, shipping_fee_jpy: money(field("shipping"), "送料"), shipping_tax_type: field("shipping-tax"), requested_delivery_date: field("delivery-date") || null, delivery_time: field("delivery-time"), note: field("note") };
  }
  function renderPostal() {
    var i = state.postalIndex, row = state.postalRows[i];
    document.getElementById("recycle-postal-results").innerHTML = row ?
      button(row.display_address, "postal_select", "data-index='" + i + "'") + pages("postal", i, state.postalRows.length) : "";
  }
  function applyPostal(row) {
    setEntryPopup("postal-box", false);
    document.getElementById("recycle-postal").value = row.postal_code;
    document.getElementById("recycle-prefecture").value = row.prefecture_code;
    document.getElementById("recycle-address1").value = row.address_line_1;
    document.getElementById("recycle-postal-results").innerHTML = "";
    document.getElementById("recycle-postal-status").textContent = "番地・建物名を確認してください。";
    state.dirty = true;
  }
  async function lookupPostal() {
    var postal = field("postal").replace(/[^0-9]/g, ""), epoch = state.epoch, seq = ++state.postal;
    var message = document.getElementById("recycle-postal-status"), results = document.getElementById("recycle-postal-results");
    results.innerHTML = "";
    setEntryPopup("postal-box", false);
    if (postal.length !== 7) { message.textContent = "郵便番号を7桁で入力してください。"; return; }
    var before = [field("prefecture"), field("address1")].join("|");
    function current() { return seq === state.postal && epoch === state.epoch && ownerCurrent() && field("postal").replace(/[^0-9]/g, "") === postal && [field("prefecture"), field("address1")].join("|") === before; }
    message.textContent = "住所を検索しています。";
    try {
      var rows = [];
      try { rows = await lookupCustomerOrderPostalLocal(postal); } catch (_) { /* Use the shared API fallback. */ }
      if (!rows.length) rows = await lookupCustomerOrderPostalApi(postal);
      if (!current()) return;
      state.postalRows = rows; state.postalIndex = 0;
      if (rows.length === 1) applyPostal(rows[0]);
      else {
        message.textContent = rows.length ? "住所を選択してください。" : "住所が見つかりません。直接入力してください。";
        renderPostal();
        if (rows.length && state.view === "entry") setEntryPopup("postal-box", true);
      }
    } catch (error) { if (current()) message.textContent = "住所を取得できませんでした。再検索するか、直接入力してください。"; }
  }
  function normalizeOrderKarte(value) {
    var number = value.normalize("NFKC").trim().replace(/[‐‑–−]/g, "-");
    return /^[0-9]{1,12}$/.test(number) ? "00000-" + number.padStart(12, "0") : number;
  }
  function resetProductSearch() {
    state.search++;
    state.products = [];
    state.productIndex = 0;
    var query = document.getElementById("recycle-product-query"), karte = field("query-type") === "karte";
    query.setAttribute("aria-label", karte ? "カルテ番号" : "純正品番・メーカー品番");
    setEntryPopup("product-box", false);
    query.placeholder = karte ? "例 22 または 00000-000000000022" : "品番を入力して検索";
    document.getElementById("recycle-product-status").textContent = "";
    renderProducts();
  }
  function renderProducts() {
    var i = state.productIndex, p = state.products[i], host = document.getElementById("recycle-products");
    document.getElementById("recycle-show-products").hidden = !p;
    host.innerHTML = p ? "<div class='recycle-product'><span><strong>" + e(p.genuine_part_number || p.manufacturer_part_number) + "</strong><small>" + e(p.manufacturer + " / " + p.manufacturer_part_number + " / " + kind(p.product_kind)) + "</small>" +
      (p.karte_number ? "<small>カルテ番号 " + e(p.karte_number) + "</small>" : "") + "</span><span>販売可能 " + e(p.available_qty) + "<small>ファクタリング候補 " + (p.factoring_price == null ? "未登録" : e(yen(p.factoring_price))) + "</small></span>" +
      button("追加", "add", "data-index='" + i + "'" + (Number(p.available_qty) <= 0 ? " disabled" : "")) + "</div>" + pages("product", i, state.products.length) : "";
  }
  function productStatus(text, open) {
    document.getElementById("recycle-product-status").textContent = text;
    document.getElementById("recycle-show-products").hidden = !text && !state.products.length;
    if (open && state.view === "entry") setEntryPopup("product-box", true);
  }
  async function searchProducts() {
    resetProductSearch();
    var seq = state.search, epoch = state.epoch, query = field("product-query"), byKarte = field("query-type") === "karte";
    var karte = byKarte ? normalizeOrderKarte(query) : "";
    var current = function () { return seq === state.search && epoch === state.epoch && ownerCurrent() && state.dialog.open; };
    if (byKarte && !/^[0-9]{5}-[0-9]{12}$/.test(karte)) {
      productStatus("カルテ番号は短縮番号か、5桁-12桁の形式で入力してください。", true);
      return;
    }
    productStatus("商品を検索しています。", true);
    try {
      var data = await rpc("products", byKarte ? { karte_number: karte } : { query: query });
      if (!current()) return;
      var products = data.rows || [], priceMap = {}, priceWarning = "";
      try { if (products.length && window.DcatsFactoringPricing) priceMap = await window.DcatsFactoringPricing.prices(products.map(function(p) { return p.dkd_shohin_id; })); }
      catch (_) { priceWarning = " 成立単価を確認して入力してください。"; }
      if (!current()) return;
      state.products = products.map(function(p) {
        var price = priceMap[p.dkd_shohin_id + "|" + p.product_kind];
        return Object.assign({}, p, { karte_number: karte, factoring_price: Number.isSafeInteger(price) && price > 0 && price <= 99999999 ? price : null });
      });
      renderProducts();
      productStatus(products.length ?
        (products.length === 30 ? "先頭30件を表示しています。" : "") + priceWarning :
        byKarte ? "このカルテに対応する受注商品が見つかりません。品番でも検索できます。" : "該当商品がありません。");
    } catch (error) { if (current()) productStatus(error.message || "商品を検索できませんでした。"); }
  }
  async function place() {
    if (state.busy || state.pending) return;
    var payload = orderPayload(), epoch = state.epoch;
    status("価格・在庫・配送条件を確認しています。"); state.busy = true; setButtons();
    var quote;
    try { quote = await rpc("preview", payload); if (epoch !== state.epoch || !ownerCurrent()) return; }
    catch (error) { status(error.message, true); return; }
    finally { state.busy = false; setButtons(); }
    var fees = quote.fee_breakdown, route = payload.is_marketplace ? "marketplace" : "normal";
    if (!fees || !quote.recycle_policy || quote.recycle_policy.policy_version !== 2 || fees.is_marketplace !== payload.is_marketplace || fees.order_route !== route ||
      ![quote.total_jpy,fees.estimated_factoring_fee_jpy,fees.estimated_marketplace_fee_jpy,fees.estimated_fee_jpy].every(Number.isSafeInteger) ||
      fees.estimated_factoring_fee_jpy < 0 || fees.estimated_marketplace_fee_jpy < 0 || fees.estimated_fee_jpy !== fees.estimated_factoring_fee_jpy + fees.estimated_marketplace_fee_jpy) throw new Error("受注区分と手数料の確認結果が一致しません。最新の設定を確認してください。");
    var coreChargeSummary = quote.core_charge_total_jpy > 0 ? "\nコア代金（税抜） " + yen(quote.core_charge_total_jpy) : "";
    var confirmation = routeLabel(route) + " ／ 合計 " + yen(quote.total_jpy) + coreChargeSummary + "\n手数料見込：" + feeBreakdownText(fees) + " ／ 合計 " + yen(fees.estimated_fee_jpy) + "\n差引受取見込 " + yen(quote.total_jpy - fees.estimated_fee_jpy);
    if (!window.confirm(confirmation + "\nこの区分・金額でブロードリーフのRecycle+受注を登録します。決済完了は登録後に別途確認します。")) { status("入力内容を確認できます。取引総額 " + yen(quote.total_jpy) + " ／ 手数料見込 " + yen(fees.estimated_fee_jpy)); return; }
    await mutate("place", { order: payload, preview_token: quote.preview_token }, async function (data) {
      state.dirty = false; state.cart = []; state.dialog.close(); state.epoch++;
      await enterSalesOrderMgmt(); await loadSalesOrderDetail(data.id);
    });
  }
  function clearList() {
    state.list++; state.rows = []; state.listQuery = null; state.offset = 0;
    var totals = document.getElementById("recycle-totals"), list = document.getElementById("recycle-list");
    if (totals) totals.textContent = ""; if (list) list.textContent = "集計条件が変更されています。"; setButtons();
  }
  function karteItems(recycle) { return Array.isArray(recycle.karte_items) ? recycle.karte_items : []; }
  function karteList(recycle) { return Array.from(new Set(karteItems(recycle).map(function (item) { return item.karte_number; }))).join(" / "); }
  async function loadList() {
    var epoch = state.epoch, seq = ++state.list; state.rows = []; status("精算一覧を読み込んでいます。");
    state.listQuery = null; setButtons();
    var query = { from: field("from"), to: field("to"), route: field("list-route") || "all", offset: state.offset };
    document.getElementById("recycle-totals").textContent = "";
    document.getElementById("recycle-list").textContent = "精算一覧を読み込んでいます。";
    try {
      var data = await rpc("list", query); if (seq !== state.list || epoch !== state.epoch || !ownerCurrent() || query.from !== field("from") || query.to !== field("to") || query.route !== (field("list-route") || "all")) return;
      state.rows = data.rows || []; state.listQuery = query;
      document.getElementById("recycle-totals").innerHTML = "<p>取消を除く " + e(data.count) + "件 ／ 通常 " + e(data.normal_count || 0) + "件・MP " + e(data.marketplace_count || 0) + "件・未区分 " + e(data.unknown_count || 0) + "件</p><dl class='recycle-totals-grid'><div><dt>取引総額</dt><dd>" + e(yen(data.gross_jpy)) + "</dd></div><div><dt>手数料見込</dt><dd>" + e(yen(data.estimated_fee_jpy)) + "</dd></div><div><dt>確定手数料</dt><dd>" + e(yen(data.actual_fee_jpy)) + "</dd></div><div><dt>手数料未確定</dt><dd>" + e(data.unconfirmed_fee_count) + "件</dd></div></dl><p class='recycle-fee-subtotals'>見込内訳：決済 " + e(yen(data.estimated_factoring_fee_jpy)) + " ／ MP " + e(yen(data.estimated_marketplace_fee_jpy)) + (data.unknown_count ? " ／ 従来方式・未区分 " + e(yen(data.estimated_legacy_fee_jpy)) : "") + "</p>";
      document.getElementById("recycle-list").innerHTML = state.rows.map(function (o) { var r = o.recycle; return "<article class='recycle-order-row'><div><strong>" + e(karteItems(r)[0]?.karte_number || r.external_order_number || o.order_number) + "</strong><span class='recycle-route-label'>" + e(routeLabel(r.order_route)) + "</span><span>" + e(o.shipping_address.company_name || o.shipping_address.recipient_name || "-") + "</span><small>" + e(o.order_number) + " / " + e(r.payment_status === "confirmed" ? "決済確認済み" : r.payment_status === "unconfirmed" ? "決済確認待ち" : r.payment_status === "refunded" ? "返金確認済み" : "返金確認待ち") + " / " + e(o.status) + "</small></div><div>取引 " + e(yen(o.total_jpy)) + "<small>手数料 " + e(yen(r.actual_fee_jpy == null ? r.estimated_fee_jpy : r.actual_fee_jpy)) + (r.actual_fee_jpy == null ? "（見込）" : "（確定）") + "</small><small>見込内訳：" + e(feeBreakdownText(r)) + "</small><small>差引受取 " + e(yen(r.actual_receipt_jpy == null ? r.estimated_receipt_jpy : r.actual_receipt_jpy)) + (r.actual_receipt_jpy == null ? "（見込）" : "（確定）") + "</small></div>" + button("受注を開く", "open_order", "data-id='" + o.id + "'") + "</article>"; }).join("") || "<p>この条件の受注はありません。</p>";
      setButtons();
      if (state.view === "settlements") status("受注日で集計しています。精算月・売上月とは分けて確認してください。");
    } catch (error) { if (seq === state.list && epoch === state.epoch && ownerCurrent()) { document.getElementById("recycle-list").textContent = "精算一覧を取得できませんでした。「一覧を更新」から再度読み込んでください。"; if (state.view === "settlements") status(error.message, true); } }
  }
  function csvCell(v) { var s = String(v == null ? "" : v); if (/^[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function downloadCsv() {
    if (!state.rows.length || !state.listQuery) { status("先に一覧を読み込んでください。", true); return; }
    var rows = [["D-CATS注文番号", "Recycle+注文番号", "受注区分", "直送先", "取引総額", "決済手数料見込", "MP手数料見込", "従来方式手数料見込", "手数料合計見込", "差引受取見込", "手数料確定（控除額合計）", "差引受取確定", "決済状態", "カルテ番号"]];
    state.rows.forEach(function (o) { var r = o.recycle; rows.push([o.order_number, r.external_order_number, routeLabel(r.order_route), o.shipping_address.company_name || o.shipping_address.recipient_name, o.total_jpy, r.estimated_factoring_fee_jpy, r.estimated_marketplace_fee_jpy, r.estimated_legacy_fee_jpy, r.estimated_fee_jpy, r.estimated_receipt_jpy, r.actual_fee_jpy, r.actual_receipt_jpy, r.payment_status, karteList(r)]); });
    var url = URL.createObjectURL(new Blob(["\ufeff" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    var a = document.createElement("a"); a.href = url; a.download = "recycle-confirmation-" + state.listQuery.from + "-" + state.listQuery.route + "-page-" + (state.listQuery.offset / 100 + 1) + ".csv"; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    status("表示中の最大100件を確認用CSVへ出力しました。販売王の取込用CSVではありません。");
  }
  async function runAction(action, b) {
    try {
      if (action === "close") { close(); return; }
      if (!ownerCurrent()) { status("受注を管理する権限・ログイン状態を確認してください。", true); return; }
      if((state.busy||state.pending) && action !== "result"){status("先に処理結果を確認してください。",true);return;}
      if(action==='save_settings' && state.dirty){status("受注の入力中は条件を変更できません。受注を登録するか、入力を閉じてから変更してください。",true);return;}
      if (action === "result") await checkResult();
      else if (action === "entry" || action === "settings") showView(action);
      else if (action === "settlements") { showView(action); await loadList(); }
      else if (action === "save_settings") await prepareSettings();
      else if (action === "binding_confirm") await confirmBinding();
      else if (action === "binding_cancel") { clearBindingReview(); setButtons(); }
      else if (action === "reload_settings") await reloadSettings();
      else if (action === "retry_shipping") { status(""); await loadShippingOptions(); }
      else if (action === "products") await searchProducts();
      else if (action === "page") changePage(b);
      else if (action === "postal") await lookupPostal();
      else if (action === "postal_select") { var row = state.postalRows[Number(b.dataset.index)]; if (row && row.postal_code.replace(/[^0-9]/g, "") === field("postal").replace(/[^0-9]/g, "")) applyPostal(row); }
      else if (action === "add") {
        var product = state.products[Number(b.dataset.index)]; if (!product || Number(product.available_qty) <= 0) return;
        rememberCart();
        state.cart.push(Object.assign({}, product, { quantity: 1, price: product.factoring_price == null ? "" : String(product.factoring_price) }));
        state.cartIndex = state.cart.length - 1; state.dirty = true;
        setEntryPopup("product-box", false);
        renderCart(); focusEntry("quantity-" + state.cartIndex);
      }
      else if (action === "remove") { rememberCart(); state.cart.splice(state.cartIndex, 1); state.cartIndex = Math.max(0, Math.min(state.cartIndex, state.cart.length - 1)); state.dirty = true; renderCart(); focusEntry(state.cart.length ? "quantity-" + state.cartIndex : "product-query"); }
      else if (action === "place") await place();
      else if (action === "list" || action === "next" || action === "previous") { state.offset = action === "list" ? 0 : Math.max(0, state.offset + (action === "next" ? 100 : -100)); await loadList(); }
      else if (action === "csv") downloadCsv();
      else if (action === "open_order") { if (state.dirty && !confirm("未保存の受注入力を閉じて受注詳細を開きますか。")) return; state.dirty = false; state.dialog.close(); state.epoch++; await loadSalesOrderDetail(Number(b.dataset.id)); }
    } catch (error) { status(error.message, true); }
  }
  function mountDetail(order, host) {
    state.detailDirty = false;
    var r = order && order.recycle; if (!r || !allowed()) return;
    var section = document.createElement("section"); section.className = "recycle-detail";
    var confirmationNote = r.policy_snapshot.confirmation_note;
    var karte = karteItems(r);
    var references = (r.external_order_number ? " ／ Recycle+注文番号 " + e(r.external_order_number) : "") +
      (karte.length === 1 ? " ／ カルテ番号 " + e(karte[0].karte_number) : "");
    var karteDetails = karte.length > 1 ? "<details><summary>カルテ番号・商品明細（" + karte.length + "件）</summary><ul>" + karte.map(function (item) {
      return "<li>" + e(item.karte_number + " ／ " + item.part_number + " ／ " + kind(item.product_kind)) + "</li>";
    }).join("") + "</ul></details>" : "";
    section.innerHTML = "<h3>Recycle+決済・手数料</h3><p><strong>売上先：ブロードリーフ</strong>" + references + " ／ <strong>" + e(routeLabel(r.order_route)) + "</strong></p>" + karteDetails + "<div class='recycle-summary'><span>見込内訳：" + e(feeBreakdownText(r)) + "</span><span>見込手数料合計 " + e(yen(r.estimated_fee_jpy)) + "</span><span>確定手数料 " + e(yen(r.actual_fee_jpy)) + "</span><span>差引受取 " + e(yen(r.actual_receipt_jpy == null ? r.estimated_receipt_jpy : r.actual_receipt_jpy)) + (r.actual_receipt_jpy == null ? "（見込）" : "（確定）") + "</span></div><p>" + e(r.policy_snapshot.note) + "</p>" + (confirmationNote && !/^暫定10%。商品税抜額/.test(confirmationNote) ? "<p>条件・確認根拠：" + e(confirmationNote) + "</p>" : "") + "<p>" + e(r.payment_status === "confirmed" ? "決済確認済み。既存の出荷工程へ進めます。" : r.payment_status === "unconfirmed" ? "決済確認待ち。出荷指示・送り状発行・出荷確定はできません。" : r.payment_status === "refunded" ? "返金確認済み" : "取消済み・返金確認待ち") + "</p>" +
      (r.payment_status === "unconfirmed" && order.status !== "cancelled" ? "<details><summary>決済完了を確認</summary><div class='recycle-grid'>" + input("決済金額", "paid-amount", "number", order.total_jpy, "min='0' step='1'") + input("決済完了日時", "paid-at", "datetime-local", localTime()) + input("決済参照番号", "payment-reference", "text", "", "maxlength='120'") + input("確認した画面・明細などの根拠", "payment-evidence", "text", "", "maxlength='1000'") + "</div>" + button("決済完了を記録", "confirm_payment", "data-recycle-detail-write") + "</details>" : "") +
      (r.payment_status === "confirmed" && ["accepted", "submitted"].includes(order.status) ? "<details><summary>決済確認を解除</summary>" + input("解除理由", "clear-reason", "text", "", "maxlength='500'") + button("確認を解除", "clear_payment", "data-recycle-detail-write") + "</details>" : "") +
      "<details><summary>精算明細の確定手数料を記録</summary><div class='recycle-grid'>" + input("確定手数料（控除額合計）", "actual-fee", "number", r.actual_fee_jpy, "min='0' step='1'") + input("うち税額（不明なら空欄）", "fee-tax", "number", r.actual_fee_tax_jpy, "min='0' step='1'") + input("精算明細番号・根拠", "settlement-reference", "text", r.settlement_reference, "maxlength='120'") + "</div>" + button("手数料を確定", "settle", "data-recycle-detail-write") + "</details>" +
      (r.payment_status === "refund_pending" ? "<details><summary>外部での返金完了を確認</summary>" + input("返金参照番号", "refund-reference", "text", "", "maxlength='120'") + button("返金確認を記録", "confirm_refund", "data-recycle-detail-write") + "</details>" : "") +
      "<p class='recycle-note'>" + e(r.accounting_note) + "</p><p id='recycle-detail-message' role='status'></p>" + button("処理結果を確認", "detail_result", "id='recycle-detail-result'");
    var panels = host.querySelector(".sales-order-detail-navigation"); if (panels) panels.before(section); else host.prepend(section);
    section.addEventListener("input", function () { state.actor = actor(); state.detailDirty = true; });
    section.addEventListener("click", async function (event) {
      var b = event.target.closest("[data-recycle-action]"); if (!b) return;
      if (b.dataset.recycleAction === "detail_result") { await checkResult(); return; }
      state.actor = actor(); var action = b.dataset.recycleAction, payload = { order_id: order.id, fingerprint: r.fingerprint };
      try {
        if (action === "confirm_payment") Object.assign(payload, { amount_jpy: money(field("paid-amount"), "決済金額"), paid_at: new Date(field("paid-at")).toISOString(), reference: field("payment-reference"), evidence: field("payment-evidence") });
        if (action === "clear_payment") payload.reason = field("clear-reason");
        if (action === "settle") Object.assign(payload, { actual_fee_jpy: money(field("actual-fee"), "確定手数料"), fee_tax_jpy: field("fee-tax") || null, reference: field("settlement-reference") });
        if (action === "confirm_refund") payload.reference = field("refund-reference");
        await mutate(action, payload, async function () { if(Number(salesOrderSelectedId)===Number(order.id)) await loadSalesOrderDetail(order.id); });
        var message = document.getElementById("recycle-detail-message"); if (message && state.pending) message.textContent = "結果未確認です。「処理結果を確認」で確認してください。";
      } catch (error) { var el = document.getElementById("recycle-detail-message"); if (el) el.textContent = error.message; }
    });
    if (r.payment_status !== "confirmed") host.querySelectorAll("#sales-order-issue-dispatch,#sales-order-print-dispatch,#sales-order-open-shipping-documents,[data-sales-order-action='prepare_shipping']").forEach(function (b) { b.disabled = true; b.title = "Recycle+の決済完了確認が必要です。"; });
    setButtons();
  }
  function orderEntryLabels() {
    var language = typeof currentLang === "undefined" ? "ja" : currentLang;
    return (language === "en" ? ["Internal Order Entry", "FAX / Email", "Close"] :
      language === "zh" ? ["内部订单录入", "传真・邮件", "关闭"] : ["社内受注入力", "通常（FAX・メール）", "閉じる"]);
  }
  function chooseInternalOrderType() {
    if (!allowed()) return;
    if (!regularEntryAllowed()) { void open(); return; }
    var labels = orderEntryLabels(), dialog = document.createElement("dialog");
    dialog.className = "recycle-intake-dialog";
    dialog.setAttribute("aria-labelledby", "recycle-intake-title");
    dialog.innerHTML = "<header><h2 id='recycle-intake-title'>" + e(labels[0]) + "</h2>" + button(labels[2], "intake-close") +
      "</header><div class='recycle-intake-options'>" + button(labels[1], "intake-regular") + button("Recycle+", "intake-recycle") + "</div>";
    dialog.addEventListener("close", function () { dialog.remove(); });
    dialog.addEventListener("click", function (event) {
      var choice = event.target.closest("[data-recycle-action]");
      if (!choice) return;
      dialog.close();
      if (choice.dataset.recycleAction === "intake-regular" && regularEntryAllowed()) void enterInternalCustomerOrderEntry();
      if (choice.dataset.recycleAction === "intake-recycle" && allowed()) void open();
    });
    document.body.append(dialog);
    dialog.showModal();
  }
  function configureEntryButton() {
    var b = document.getElementById("sales-order-recycle-open"), regular = document.getElementById("sales-order-new-internal-order");
    if (!b) return;
    var recycleAllowed = allowed(), regularAllowed = regularEntryAllowed();
    if (regular) regular.hidden = !regularAllowed || recycleAllowed;
    b.hidden = !recycleAllowed;
    b.removeAttribute("data-i18n");
    b.textContent = regularAllowed && recycleAllowed ? orderEntryLabels()[0] :
      typeof t === "function" ? t("sales_order_recycle_entry") : "Recycle+受注入力";
    b.onclick = chooseInternalOrderType;
  }
  window.DcatsRecycleOrders = Object.freeze({ open: open, mountDetail: mountDetail, configureEntryButton: configureEntryButton, isBusy: function () { return ownerCurrent() && (state.busy || !!state.pending || state.dirty || state.detailDirty); }, csvCell: csvCell });
}());
