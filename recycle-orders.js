(function () {
  "use strict";
  var state = { dialog: null, settings: null, customers: [], categories: [], customerMatches: [], customerIndex: 0, channel: "standard", regularCustomer: "", cart: [], dirty: false, busy: false, pending: null, bindingReview: null, settingsSeq: 0, shippingSeq: 0, shippingCustomerId: "", shippingReady: false, epoch: 0, search: 0, postal: 0, productIndex: 0, cartIndex: 0, postalIndex: 0, view: "entry", actor: "" };
  function actor() { return typeof currentUser !== "undefined" && currentUser ? String(currentUser.id || currentUser.email || "") : ""; }
  function allowed() { return typeof canManageSalesOrders === "function" && canManageSalesOrders(); }
  function regularEntryAllowed() { return typeof canStartInternalCustomerOrderEntry === "function" && canStartInternalCustomerOrderEntry(); }
  function e(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function yen(value) { return value == null ? "未確定" : Number(value).toLocaleString("ja-JP") + "円"; }
  function kind(value) { return typeof productKindLabel === "function" ? productKindLabel(value) : ({ rebuilt: "リビルト品", aftermarket_new: "社外新品", used_core: "中古コア" }[value] || value); }
  function field(id) { var el = document.getElementById("recycle-" + id); return el ? String(el.value == null ? "" : el.value).trim() : ""; }
  function checked(id) { var el = document.getElementById("recycle-" + id); return !!(el && el.checked); }
  function recycleChannel() { return state.channel === "recycle"; }
  function entryAllowed() { return recycleChannel() ? allowed() : regularEntryAllowed(); }
  function recycleReady() { return !!state.settings && state.settings.external_settlement_version === 1; }
  function orderCustomerId() { return recycleChannel() ? String(state.settings?.sales_customer_id || "") : state.regularCustomer; }
  function uuid() { return crypto.randomUUID(); }
  function status(text, error) {
    var el = document.getElementById("recycle-message");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("error", !!error);
    if (state.dialog && state.dialog.open) setEntryPopup("feedback", !!text);
  }
  function input(label, id, type, value, extra) { return "<label><span>" + e(label) + "</span><input id='recycle-" + id + "' type='" + (type || "text") + "' value='" + e(value == null ? "" : value) + "' " + (extra || "") + "></label>"; }
  function button(text, action, extra) { return "<button type='button' data-recycle-action='" + action + "' " + (extra || "") + ">" + e(text) + "</button>"; }
  function option(value, label, selected, disabled) { return "<option value='" + e(value) + "'" + (value === selected ? " selected" : "") + (disabled ? " disabled" : "") + ">" + e(label) + "</option>"; }
  function money(raw, label) { if (!/^\d{1,8}$/.test(String(raw))) throw new Error(label + "を0以上の整数で入力してください。"); return Number(raw); }
  function ownerCurrent() { return state.actor === actor() && entryAllowed(); }
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
    var entry = document.getElementById("recycle-entry-fields"), lockedEntry = state.busy || !!state.pending;
    if (entry) entry.disabled = !entryAllowed() || !orderCustomerId() || (recycleChannel() && !recycleReady()) || lockedEntry;
    var vehicleToggle = state.dialog?.querySelector(".recycle-vehicle-toggle");
    if (vehicleToggle) vehicleToggle.disabled = !entry || entry.disabled;
    var faxHelp = state.dialog?.querySelector("#recycle-fax-order-help");
    if (faxHelp) faxHelp.hidden = recycleChannel() || !regularEntryAllowed();
    var recycleHelp = state.dialog?.querySelector("[data-feature-help]");
    if (recycleHelp) recycleHelp.hidden = !recycleChannel();
    ["entry-channel", "order-customer", "customer-toggle"].forEach(function (id) { var el = document.getElementById("recycle-" + id); if (el) el.disabled = lockedEntry; });
    ["recycle-back", "recycle-settings-open"].forEach(function (id) { var b = document.getElementById(id); if (b) b.disabled = !entry || state.busy || !!state.pending; });
    var check = document.getElementById("recycle-check-result");
    if (check) { check.hidden = !state.pending; check.textContent = state.pending?.action === "standard_place" ? "受注一覧へ" : "結果を確認"; }
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
    if (pending.action === "standard_place") { close(); if (!state.dialog.open) await enterSalesOrderMgmt(); return; }
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
    if (state.busy || state.pending && state.pending.action !== "standard_place") { status("処理結果の確認が終わるまで画面を閉じられません。", true); return; }
    if (state.pending && !window.confirm("受注の登録結果が未確認です。受注一覧を確認してから入力をやり直してください。閉じますか。")) return;
    if (!state.pending && state.dirty && !window.confirm("入力中の受注を閉じますか。未保存の入力は残りません。")) return;
    clearBindingReview(); state.settingsSeq++; state.epoch++; state.dirty = false; state.pending = null; state.cart = []; state.dialog.close();
  }
  async function open() {
    if (!allowed() && !regularEntryAllowed()) return;
    if(state.dialog && state.dialog.open) return;
    if (state.actor && state.actor !== actor()) { state.cart = []; state.pending = null; state.dirty = false; }
    clearBindingReview(); state.actor = actor();
    state.channel = regularEntryAllowed() ? "standard" : "recycle";
    state.regularCustomer = ""; state.settings = null; state.customers = []; state.categories = [];
    state.epoch++; state.settingsSeq++; state.shippingCustomerId = ""; state.shippingReady = false; state.view = "entry";
    if (!state.dialog) {
      state.dialog = document.createElement("dialog"); state.dialog.className = "recycle-dialog"; state.dialog.setAttribute("aria-labelledby", "recycle-title"); document.body.appendChild(state.dialog);
      state.compactEntry = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 800px), (max-width: 1049px) and (max-height: 680px)") : null;
      state.wideEntry = typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 1050px) and (min-height: 720px)") : null;
      [state.compactEntry,state.wideEntry].filter(Boolean).forEach(function (layout) { layout.addEventListener("change", syncEntryLayout); });
      state.dialog.addEventListener("cancel", function (event) { event.preventDefault(); if (state.view !== "entry" && !state.busy && !state.pending) showView("entry"); else close(); });
      state.dialog.addEventListener("input", function (event) {
        var id = event.target.id;
        if (id === "recycle-order-customer") searchCustomerNames(event.target.value);
        if (event.target.closest("#recycle-entry")) state.dirty = true;
        if (["recycle-product-query","recycle-query-type"].includes(id)) resetProductSearch();
        if (id === "recycle-quantity-" + state.cartIndex) updatePackingField();
        if (event.target.closest("#recycle-settings-view")) settingsEdited(event);
      });
      state.dialog.addEventListener("change", function (event) {
        var id = event.target.id;
        if (id === "recycle-core-" + state.cartIndex) { rememberCart(); updateCoreChargeField(); updateReturnField(); }
        if (id === "recycle-entry-channel") changeOrderContext(event.target);
        if (id === "recycle-search-category") resetProductSearch();
        if (id === "recycle-destination") applyOfficeDestination();
        if (["recycle-destination","recycle-carrier","recycle-postal","recycle-address1","recycle-prefecture"].includes(id)) void updateStandardDelivery();
        if (event.target.closest("#recycle-settings-view")) settingsEdited(event);
      });
      state.dialog.addEventListener("focusout", function (event) {
        if (event.target.id === "recycle-order-customer" && !event.relatedTarget?.closest(".recycle-customer-picker")) closeCustomerNames();
      });
      state.dialog.addEventListener("keydown", function (event) {
        if (event.isComposing) return;
        if (event.target.id === "recycle-order-customer") customerPickerKey(event);
        if (event.key === "Enter" && event.target.id === "recycle-product-query") { event.preventDefault(); runAction("products"); }
      });
      state.dialog.addEventListener("pointerdown", function (event) {
        if (event.target.closest("[data-recycle-action='select_customer']")) event.preventDefault();
        else if (!event.target.closest(".recycle-customer-picker")) closeCustomerNames();
      });
      state.dialog.addEventListener("click", function (event) {
        var b = event.target.closest("[data-recycle-action]"); if (b) runAction(b.dataset.recycleAction, b);
      });
    }
    if (!state.dialog.open) state.dialog.showModal();
    state.dialog.innerHTML = "<header class='recycle-header'><div><h2 id='recycle-title' tabindex='-1'>" + e(orderEntryLabels()[0]) + "</h2></div><nav class='recycle-actions' aria-label='社内受注の操作'>" + button("受注入力に戻る", "entry", "id='recycle-back' hidden") + "<button type='button' class='recycle-vehicle-toggle' popovertarget='recycle-vehicle-box'>カルテ・車両</button>" + button("集約先設定", "settings", "id='recycle-settings-open' hidden") + button("結果を確認", "result", "id='recycle-check-result' hidden") + button("閉じる", "close") + "<a class='sales-order-help-link' id='recycle-fax-order-help' hidden data-fax-help-section='order' href='assets/help/fax-order.html#order' target='_blank' rel='noopener noreferrer' aria-label='ヘルプ（別ウィンドウ）'>ヘルプ</a><a class='sales-order-help-link' hidden data-feature-help href='assets/help/features.html?v=1#recycle-entry' target='_blank' rel='noopener noreferrer' aria-label='ヘルプ（別ウィンドウ）'>ヘルプ</a></nav></header><div id='recycle-feedback' class='recycle-entry-popup'><p id='recycle-message' role='status' aria-live='polite'>読み込んでいます。</p><button type='button' class='recycle-feedback-close' popovertarget='recycle-feedback' popovertargetaction='hide'>閉じる</button></div><div id='recycle-body'></div>";
    setButtons();
    var epoch = state.epoch;
    var [cfg, customers, categories] = await Promise.allSettled([
      allowed() ? rpc("settings") : null,
      regularEntryAllowed() ? loadDetailSalesCustomerOptions(function () { return epoch === state.epoch && ownerCurrent(); }) : [],
      regularEntryAllowed() ? loadInternalOrderCategories() : []
    ]);
    if (epoch !== state.epoch || !ownerCurrent()) return;
    state.settings = cfg.status === "fulfilled" ? cfg.value : null;
    state.customers = customers.status === "fulfilled" ? customers.value : [];
    state.categories = categories.status === "fulfilled" ? categories.value : [];
    renderWorkspace();
    if (recycleChannel() && !recycleReady()) status("Recycle+の設定を読み込めませんでした。", true);
    else if (!recycleChannel() && !regularCustomers().length) status("受注先候補を読み込めませんでした。", true);
  }
  async function loadInternalOrderCategories() {
    var result = await sb.from("assy_categories").select("category_code,label_ja,label_en,label_zh")
      .eq("is_active", true).order("sort_order", { ascending: true });
    return result.error ? [] : (result.data || []).filter(function (c) { return c.category_code && c.category_code !== "car_air_conditioner"; });
  }
  function regularCustomers() {
    return state.customers.filter(function (c) { return String(c.id) !== String(state.settings?.sales_customer_id || ""); });
  }
  function renderWorkspace() {
    var body = document.getElementById("recycle-body");
    if (!body) return;
    body.innerHTML = "<div id='recycle-customer-summary'></div><div id='recycle-setup-note'></div>" +
      "<section id='recycle-entry' aria-label='受注入力'>" + entryHtml() + "</section>" +
      "<section id='recycle-settings-view' aria-label='Recycle+の集約先設定' hidden></section>";
    state.cart = []; state.products = []; state.productIndex = 0; state.cartIndex = 0; state.dirty = false; state.office = null; state.deliveryRead = 0;
    syncEntryLayout(); renderCart(); showView("entry", false); refreshSettings();
    focusEntry(orderCustomerId() ? "product-query" : recycleChannel() ? "entry-channel" : "order-customer");
  }
  function changeOrderContext(select) {
    var channel = select.id === "recycle-entry-channel";
    if ((channel && select.value === state.channel) || (!channel && select.value === state.regularCustomer)) return;
    if (state.dirty && !window.confirm("入力済みの受注を破棄して切り替えますか。")) {
      select.value = channel ? state.channel : state.regularCustomer;
      return;
    }
    if (channel) {
      if ((select.value === "recycle" && !allowed()) || (select.value === "standard" && !regularEntryAllowed())) {
        select.value = state.channel;
        return;
      }
      state.channel = select.value;
    } else {
      state.regularCustomer = select.value;
    }
    state.search++; state.postal++; state.shippingSeq++; state.shippingReady = false;
    renderWorkspace();
  }
  function selectedRegularCustomer() {
    return regularCustomers().find(function (c) { return String(c.id) === state.regularCustomer; });
  }
  function customerLabel(c) {
    return c ? [c.source_customer_code, c.customer_name].filter(Boolean).join(" ／ ") : "";
  }
  function customerPickerHtml() {
    return "<div class='recycle-customer-picker'><label for='recycle-order-customer'>得意先</label>" +
      "<div class='recycle-customer-control'><input id='recycle-order-customer' type='text' role='combobox' aria-autocomplete='list' aria-controls='recycle-customer-options' aria-expanded='false' maxlength='160' autocomplete='off' placeholder='得意先名・コードで検索' value='" +
      e(customerLabel(selectedRegularCustomer())) + "'>" + button("▾", "customer_names", "aria-label='得意先候補を表示' id='recycle-customer-toggle' tabindex='-1'") + "</div>" +
      "<div id='recycle-customer-options' class='recycle-customer-options' role='listbox' aria-label='得意先候補' popover='manual' hidden></div></div>";
  }
  function normalizedCustomerSearch(value) {
    return String(value || "").normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g,function (char) {
      return String.fromCharCode(char.charCodeAt(0)-0x60);
    }).replace(/[\s・･]/g,"");
  }
  function searchCustomerNames(query) {
    if (recycleChannel() || state.busy || state.pending) return;
    var needle = normalizedCustomerSearch(query);
    state.customerMatches = regularCustomers().filter(function (customer) {
      return normalizedCustomerSearch(customerLabel(customer)).includes(needle);
    });
    state.customerIndex = 0;
    renderCustomerNames();
  }
  function renderCustomerNames() {
    var input = document.getElementById("recycle-order-customer"), menu = document.getElementById("recycle-customer-options");
    if (!input || !menu) return;
    var size = 5, start = Math.floor(state.customerIndex/size)*size;
    menu.innerHTML = state.customerMatches.slice(start,start+size).map(function (customer, offset) {
      var index = start+offset;
      return button(customerLabel(customer), "select_customer", "role='option' id='recycle-customer-option-"+index+"' aria-selected='"+(state.customerIndex===index)+"' tabindex='-1' data-index='"+index+"'");
    }).join("") || "<p role='status'>該当する得意先がありません。</p>";
    input.setAttribute("aria-expanded","true");
    if (state.customerMatches.length) input.setAttribute("aria-activedescendant","recycle-customer-option-"+state.customerIndex);
    else input.removeAttribute("aria-activedescendant");
    menu.hidden = false;
    if (typeof menu.showPopover === "function" && !menu.matches(":popover-open")) menu.showPopover();
  }
  function closeCustomerNames() {
    var input = document.getElementById("recycle-order-customer"), menu = document.getElementById("recycle-customer-options");
    if (!input || !menu || menu.hidden) return;
    if (typeof menu.hidePopover === "function" && menu.matches(":popover-open")) menu.hidePopover();
    menu.hidden = true;
    input.setAttribute("aria-expanded","false"); input.removeAttribute("aria-activedescendant");
    input.value = customerLabel(selectedRegularCustomer());
  }
  function chooseCustomer(index) {
    var next = state.customerMatches[index];
    if (!next) return;
    closeCustomerNames();
    changeOrderContext({id:"recycle-order-customer",value:String(next.id)});
  }
  function customerPickerKey(event) {
    var input = event.target, open = input.getAttribute("aria-expanded")==="true";
    if (event.key==="ArrowDown" || event.key==="ArrowUp") {
      event.preventDefault();
      if (!open) { searchCustomerNames(""); return; }
      if (!state.customerMatches.length) return;
      state.customerIndex = Math.max(0,Math.min(state.customerMatches.length-1,state.customerIndex+(event.key==="ArrowDown"?1:-1)));
      renderCustomerNames();
    } else if (open && (event.key==="Enter" || event.key==="Escape")) {
      event.preventDefault(); event.stopPropagation();
      if (event.key==="Enter") chooseCustomer(state.customerIndex); else closeCustomerNames();
    }
  }
  function refreshSettings() {
    var cfg = state.settings, labels = orderEntryLabels();
    clearBindingReview();
    var customer = recycleChannel()
      ? "<div class='recycle-bound-customer'><span>受注先</span><strong>" + e(cfg?.customer_name || "未設定") + "</strong>" +
        (cfg?.customer_code ? "<small>" + e(cfg.customer_code) + "</small>" : "") + "</div>"
      : customerPickerHtml();
    document.getElementById("recycle-customer-summary").innerHTML = "<div class='recycle-order-context'><label><span>受注区分</span><select id='recycle-entry-channel'>" +
      (regularEntryAllowed() ? option("standard",labels[1],state.channel) : "") + (allowed() ? option("recycle","Recycle+",state.channel) : "") + "</select></label>" + customer + "</div>";
    document.getElementById("recycle-setup-note").innerHTML = recycleChannel() && (!recycleReady() || !orderCustomerId())
      ? "<p class='recycle-note'>" + (recycleReady() ? "受注先が未設定です。集約先設定で登録済みのブロードリーフの得意先を選択してください。" : "Recycle+の設定を再確認するには、画面を開き直してください。") + "</p>" : "";
    document.getElementById("recycle-settings-view").innerHTML = cfg ? settingsHtml(cfg) : "";
    updateCustomerInfo(); setButtons();
    void loadShippingOptions();
  }
  async function loadShippingOptions() {
    var outbound = document.getElementById("recycle-carrier"), core = document.getElementById("recycle-return-carrier");
    var retry = document.getElementById("recycle-shipping-retry");
    var id = orderCustomerId(), epoch = state.epoch, seq = ++state.shippingSeq;
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
      state.shippingCustomerId = id; state.shippingReady = true; void updateStandardDelivery();
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
    if (view !== "entry") closeCustomerNames();
    var vehicleToggle = state.dialog.querySelector(".recycle-vehicle-toggle");
    if (vehicleToggle) vehicleToggle.hidden = view !== "entry";
    if (view !== "entry") ["entry-extra", "product-box", "postal-box", "cart-extra", "vehicle-box", "office-box"].forEach(function (id) { setEntryPopup(id, false); });
    state.view = view;
    state.dialog.classList.toggle("recycle-entry-dialog",view === "entry");
    var feedback = document.getElementById("recycle-feedback");
    if (view === "entry" && typeof feedback.showPopover === "function") feedback.setAttribute("popover", "auto");
    else feedback.removeAttribute("popover");
    var setupNote = document.getElementById("recycle-setup-note"); if (setupNote) setupNote.hidden = view !== "entry";
    document.getElementById("recycle-entry").hidden = view !== "entry";
    document.getElementById("recycle-settings-view").hidden = view !== "settings";
    document.getElementById("recycle-title").textContent = view === "settings" ? "Recycle+集約先設定" : orderEntryLabels()[0];
    document.getElementById("recycle-back").hidden = view === "entry";
    document.getElementById("recycle-settings-open").hidden = view === "settings" || !recycleChannel() || !recycleReady();
    status(""); state.dialog.scrollTop = 0;
    setButtons();
    if (focus !== false) document.getElementById("recycle-title").focus();
  }
  function settingsHtml(cfg) {
    var html = "<div class='recycle-settings'><h3>ブロードリーフの受注先</h3>";
    if (!cfg.can_configure) return html + "<p>集約先の変更はシステム管理者へ依頼してください。</p></div>";
    var candidates = Array.isArray(cfg.customer_candidates) ? cfg.customer_candidates : [];
    if (cfg.customer_binding_guard_version !== 1) html += "<p class='recycle-note' role='alert'>紐付けの安全確認を利用できません。最新の設定を確認してください。</p>";
    else if (!candidates.length) html += "<p class='recycle-note' role='alert'>紐付け候補がありません。得意先管理で販売王コードと登録内容を確認してください。</p>";
    return html + "<div class='recycle-grid'><label><span>受注先（登録済み候補）</span><select id='recycle-customer-id'><option value=''>得意先を選択してください</option>" +
      candidates.map(function (c) { return option(String(c.id), c.code + " ／ " + c.name, String(cfg.sales_customer_id || "")); }).join("") +
      "</select></label></div><div id='recycle-customer-info' class='recycle-binding-info'></div><div class='recycle-actions'>" +
      button("設定内容を確認して保存", "save_settings", "data-recycle-write") + button("最新の設定を確認", "reload_settings") +
      "</div><div id='recycle-binding-confirm' hidden></div></div>";
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
    return { revision: state.settings.revision, sales_customer_id: field("customer-id") || null };
  }
  async function settingsSaved() {
    var epoch = state.epoch, seq = ++state.settingsSeq, savingActor = state.actor, cfg = await rpc("settings");
    if (epoch === state.epoch && seq === state.settingsSeq && savingActor === actor() && ownerCurrent()) { state.settings = cfg; refreshSettings(); status("設定を保存しました。"); }
  }
  async function prepareSettings() {
    if (!recycleChannel() || !recycleReady() || !state.settings.can_configure || state.settings.customer_binding_guard_version !== 1) throw new Error("紐付けの安全確認を利用できません。最新の設定を確認してください。");
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
  function entryHtml() {
    var prefs = typeof SHIPPING_PREFECTURES !== "undefined" ? SHIPPING_PREFECTURES : [];
    return "<fieldset id='recycle-entry-fields'><legend class='recycle-sr-only'>受注内容</legend><div class='recycle-entry-grid'>" +
      "<section class='recycle-entry-panel recycle-entry-products' aria-labelledby='recycle-products-heading'><div class='recycle-search-head'><h3 id='recycle-products-heading'>商品追加</h3><button type='button' id='recycle-show-products' popovertarget='recycle-product-box' hidden>検索結果</button></div><div class='recycle-search'>" +
      (recycleChannel() ? "<select id='recycle-query-type' aria-label='検索方法'><option value='karte'>カルテ番号</option><option value='part'>品番</option></select>" :
        "<select id='recycle-search-category' aria-label='商品分類'><option value=''>全分類</option>" + state.categories.map(function (c) {
          return option(c.category_code, typeof categoryOptionLabel === "function" ? categoryOptionLabel(c) : c.label_ja || c.category_code, "");
        }).join("") + "</select>") +
      "<input id='recycle-product-query' type='search' maxlength='80'" + (recycleChannel() ? " aria-label='カルテ番号' placeholder='例 22 または 00000-000000000022'" : " aria-label='純正品番・メーカー品番' placeholder='品番を入力して検索'") + ">" + button("検索", "products") + "</div>" +
      "<div id='recycle-product-box' class='recycle-entry-popup' aria-label='商品候補' role='region'><div class='recycle-popup-head recycle-compact-only'><strong>商品候補</strong><button type='button' popovertarget='recycle-product-box' popovertargetaction='hide'>閉じる</button></div><p id='recycle-product-status' role='status'></p><div id='recycle-products'></div></div>" +
      "<div class='recycle-cart-head'><h3 id='recycle-items-heading'>商品明細</h3><div id='recycle-cart-pages'></div><label id='recycle-packing-field' hidden><input type='checkbox' id='recycle-packed-together'>同梱セット</label></div><div id='recycle-cart' aria-labelledby='recycle-items-heading' role='region'></div></section>" +
      "<section class='recycle-entry-panel recycle-entry-address' aria-labelledby='recycle-address-heading'><div class='recycle-address-head'><h3 id='recycle-address-heading'>お届け先</h3><small id='recycle-postal-status' role='status'></small></div><div class='recycle-grid'>" +
      input("直送先会社名", "company", "text", "", "maxlength='120' autocomplete='organization'") + input("宛名・担当者", "recipient", "text", "", "maxlength='80' autocomplete='name'") +
      input("電話番号（必須）", "phone", "tel", "", "maxlength='20' required autocomplete='tel'") +
      "<div class='recycle-postal-field'><label for='recycle-postal'>郵便番号（必須）</label><div class='recycle-postal-row'><input id='recycle-postal' maxlength='8' inputmode='numeric' autocomplete='postal-code' required>" + button("住所検索", "postal") + "</div></div>" +
      "<label><span>都道府県</span><select id='recycle-prefecture'><option value=''>選択してください</option>" + prefs.map(function (p) { return option(String(Array.isArray(p) ? p[0] : p.code), Array.isArray(p) ? p[1] : p.name, ""); }).join("") + "</select></label>" +
      input("住所（必須）", "address1", "text", "", "maxlength='160' required autocomplete='address-line1'") +
      "</div>" +
      "<div id='recycle-postal-box' class='recycle-entry-popup' aria-label='住所候補' role='region'><div class='recycle-popup-head recycle-compact-only'><strong>住所候補</strong><button type='button' popovertarget='recycle-postal-box' popovertargetaction='hide'>閉じる</button></div><div id='recycle-postal-results'></div></div></section>" +
      "<div id='recycle-entry-extra' class='recycle-entry-popup recycle-entry-extra' aria-label='受注・配送の補足' role='region'><div class='recycle-popup-head recycle-compact-only'><strong>受注・配送の補足</strong><button type='button' popovertarget='recycle-entry-extra' popovertargetaction='hide'>閉じる</button></div>" +
      (recycleChannel() ? "<section class='recycle-entry-panel recycle-entry-order' aria-labelledby='recycle-order-heading'><h3 id='recycle-order-heading'>受注情報</h3><div class='recycle-grid'>" +
        input("Recycle+注文番号（任意）", "external", "text", "", "maxlength='120'") + input("元の発注会社（参考）", "buyer", "text", "", "maxlength='200'") +
        input("成立した送料", "shipping", "number", 0, "min='0' max='9999999' step='1'") +
        "<label><span>送料の税</span><select id='recycle-shipping-tax'><option value='excluded'>税別</option><option value='included'>税込</option></select></label></div></section>" :
        "<section class='recycle-entry-panel recycle-extra-actions' aria-label='受注情報'><h3>受注情報</h3><button type='button' popovertarget='recycle-office-box'>営業所受取</button></section>") +
      "<section class='recycle-entry-panel recycle-entry-delivery' aria-labelledby='recycle-delivery-heading'><div class='recycle-delivery-head'><h3 id='recycle-delivery-heading'>配送・メモ</h3>" + button("配送設定を再読込", "retry_shipping", "id='recycle-shipping-retry' hidden") + "</div><div class='recycle-grid'>" +
      input("建物名・部門", "address2", "text", "", "maxlength='120' autocomplete='address-line2'") +
      "<label><span>商品発送時の運送便</span><select id='recycle-carrier' disabled></select></label>" +
      input("お届け希望日", "delivery-date", "date", "") + "<label><span>時間帯</span><select id='recycle-delivery-time'><option value=''>指定なし</option><option value='0812'>午前中</option><option value='1416'>14～16時</option><option value='1618'>16～18時</option><option value='1820'>18～20時</option><option value='1921'>19～21時</option></select></label>" +
      "<label id='recycle-return-field' hidden><span>コア返却時の運送便</span><select id='recycle-return-carrier' disabled></select></label>" +
      "<label><span>注文メモ</span><textarea id='recycle-note' maxlength='500' rows='1'></textarea></label>" + (recycleChannel() ? "" : "<small id='recycle-delivery-quote' role='status'></small>") + "</div></section></div>" + vehicleEntryPanel() + "</div>" +
      "<div class='recycle-entry-footer'><button type='button' class='recycle-compact-only' popovertarget='recycle-entry-extra'>受注・配送の補足</button>" + button("内容を確認して受注登録", "place", "class='customer-order-submit-button' data-recycle-write") + "</div>" + (recycleChannel() ? "" : standardOfficePopover()) + "</fieldset>";
  }
  var vehicleFieldNames = [
    ["vehicle-name", "車名", "vehicle_name", 80], ["vehicle-model", "車両型式", "vehicle_model_code", 40],
    ["vehicle-registration", "初年度登録", "first_registration_month"], ["vehicle-chassis", "車台番号", "chassis_number", 60],
    ["vehicle-engine", "エンジン", "engine_model", 40], ["vehicle-designation", "型式指定番号", "model_designation_number", 20],
    ["vehicle-classification", "類別区分番号", "classification_number", 20]
  ];
  function entryPopover(id, title, content) {
    return "<div id='recycle-" + id + "' class='recycle-entry-popup recycle-extra-popup' role='region' aria-label='" + e(title) + "'><div class='recycle-popup-head'><strong>" +
      e(title) + "</strong><button type='button' popovertarget='recycle-" + id + "' popovertargetaction='hide'>閉じる</button></div>" + content + "</div>";
  }
  function vehicleEntryPanel() {
    return "<section id='recycle-vehicle-box' class='recycle-entry-panel recycle-vehicle-panel recycle-entry-popup' aria-labelledby='recycle-vehicle-heading'>" +
      "<div class='recycle-vehicle-heading'><h3 id='recycle-vehicle-heading'>カルテ・車両情報</h3><button type='button' class='recycle-vehicle-close' popovertarget='recycle-vehicle-box' popovertargetaction='hide'>閉じる</button></div><div class='recycle-grid'>" +
      input("カルテNo.", "staff-karte-number", "text", "", "maxlength='40' autocomplete='off' placeholder='注文書に記載がある場合'") + vehicleFieldNames.map(function (item) {
        return input(item[1], item[0], item[3] ? "text" : "month", "", item[3] ? "maxlength='" + item[3] + "'" : "");
      }).join("") + "</div></section>";
  }
  function standardOfficePopover() {
    var offices = typeof CUSTOMER_ORDER_YAMATO_OFFICES === "undefined" ? [] : CUSTOMER_ORDER_YAMATO_OFFICES;
    return entryPopover("office-box", "営業所受取",
      "<div class='recycle-grid'><label><span>受取方法</span><select id='recycle-destination'><option value='address'>通常住所</option>" +
      offices.map(function (office) { return option(office.code, office.name + "（" + office.code + "）", ""); }).join("") +
      "<option value='custom'>別のヤマト営業所</option></select></label><div id='recycle-office-custom' hidden>" +
      input("営業所コード（6桁）","office-code","text","","inputmode='numeric' maxlength='6'") +
      input("営業所名","office-name","text","","maxlength='80'") +
      "<small>営業所の所在地はお届け先の住所欄に入力してください。</small></div></div>");
  }
  function applyOfficeDestination() {
    var destination = field("destination"), custom = document.getElementById("recycle-office-custom");
    custom.hidden = destination !== "custom";
    var office = typeof customerOrderYamatoOffice === "function" ? customerOrderYamatoOffice(destination) : null;
    var fields = { postal: "postal_code", prefecture: "prefecture_code", address1: "address_line_1", address2: "address_line_2" };
    Object.keys(fields).forEach(function (name) {
      var element = document.getElementById("recycle-" + name);
      if (office) element.value = office[fields[name]] || "";
      else if (state.office && element.value === (state.office[fields[name]] || "")) element.value = "";
    });
    state.office = office;
    var button = document.querySelector("[popovertarget='recycle-office-box']:not([popovertargetaction])");
    if (button) button.textContent = destination === "address" ? "営業所受取" : "営業所受取中";
  }
  function orderAddress() {
    var address = {
      destination_type: "address", company_name: field("company"), recipient_name: field("recipient"), phone_number: field("phone"),
      postal_code: field("postal"), prefecture_code: field("prefecture"), prefecture_name: document.getElementById("recycle-prefecture").selectedOptions[0].text,
      address_line_1: field("address1"), address_line_2: field("address2")
    };
    if (!recycleChannel()) {
      var destination = field("destination");
      if (destination && destination !== "address") {
        address.destination_type = "yamato_office";
        address.yamato_office_code = state.office?.code || field("office-code");
        address.yamato_office_name = state.office?.name || field("office-name");
      }
    }
    address.vehicle_information = Object.fromEntries(vehicleFieldNames.map(function (item, index) {
      var value = field(item[0]).normalize("NFKC");
      return [item[2], index === 1 || index === 3 || index === 4 ? value.toUpperCase() : value];
    }));
    return address;
  }
  function syncEntryLayout() {
    var entry = document.getElementById("recycle-entry-fields");
    if (!entry) return;
    var compact = !!(state.compactEntry && state.compactEntry.matches && typeof entry.showPopover === "function");
    entry.classList.toggle("recycle-entry-compact", compact);
    entry.querySelectorAll(".recycle-entry-popup").forEach(function (el) {
      var usePopover = typeof el.showPopover === "function" && (el.id==="recycle-vehicle-box"
        ? !state.wideEntry?.matches : compact || ["recycle-product-box", "recycle-postal-box", "recycle-office-box"].includes(el.id));
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
    return recycleChannel() && product.core_return_required && !(Number(product.core_charge_jpy) > 0) &&
      (product.handling === "charge_with_return" || product.handling === "charge_no_return");
  }
  function coreHandlingOptions(product) {
    var charge = Number(product.core_charge_jpy);
    var handling = product.handling || "standard";
    var configured = charge > 0;
    var amount = configured ? yen(charge) : "";
    var disabled = !configured && !recycleChannel();
    return option("standard", typeof t === "function" ? t("customer_order_core_return_standard") : "返却要", handling) +
      option("charge_with_return", configured ? (typeof tf === "function" ? tf("customer_order_core_charge_with_return_option", { amount: amount }) : "コア代金を請求（返却後返金・" + amount + "）") : "請求・返却後返金", handling, disabled) +
      option("charge_no_return", configured ? (typeof tf === "function" ? tf("customer_order_core_charge_no_return_option", { amount: amount }) : "コア代金を請求（返却不要・" + amount + "）") : "請求・返却不要", handling, disabled);
  }
  function cartLineChoices() {
    if (state.cart.length < 2) return "";
    var start = Math.floor(state.cartIndex / 3) * 3;
    return "<div class='recycle-cart-review' aria-label='追加済み商品'>" + state.cart.slice(start,start+3).map(function (item,offset) {
      var index = start+offset;
      return button(item.genuine_part_number || item.manufacturer_part_number, "cart_line",
        "data-index='"+index+"'"+(index===state.cartIndex?" aria-current='true'":""));
    }).join("") + "</div>";
  }
  function renderCart() {
    var host = document.getElementById("recycle-cart"); if (!host) return;
    var i = state.cartIndex, p = state.cart[i];
    document.getElementById("recycle-items-heading").textContent = "商品明細" + (state.cart.length ? " (" + state.cart.length + ")" : "");
    document.getElementById("recycle-cart-pages").innerHTML = pages("cart", i, state.cart.length);
    host.innerHTML = p ?
      cartLineChoices() + "<div class='recycle-line'><div class='recycle-line-title'><strong>" + e(p.genuine_part_number || p.manufacturer_part_number) + "</strong>" + (p.karte_number ? "<small>カルテ番号 " + e(p.karte_number) + "</small>" : "") + "</div>" +
      input("数量", "quantity-" + i, "number", p.quantity, "min='1' max='99' step='1'") + input("単価（税抜・コア別）", "price-" + i, "number", p.price, "aria-label='成立単価（税抜・コア代別）' min='0' step='1'" + (recycleChannel() ? " max='99999999'" : " max='2147483647' placeholder='得意先単価'")) +
      "<div id='recycle-cart-extra' class='recycle-line-extra recycle-entry-popup' aria-label='商品情報・コア対応' role='region'><div class='recycle-popup-head recycle-compact-only'><strong>商品情報</strong><button type='button' popovertarget='recycle-cart-extra' popovertargetaction='hide'>閉じる</button></div>" +
      "<p>" + e(p.manufacturer + " / " + p.manufacturer_part_number + " / " + kind(p.product_kind)) + "</p>" +
      (p.core_return_required ? "<div class='recycle-core-controls'><label><span>コア対応</span><select id='recycle-core-" + i + "'>" + coreHandlingOptions(p) + "</select></label><div id='recycle-manual-core-field' hidden>" +
        input("コア代（税抜/個）", "manual-core-" + i, "text", p.manualCoreCharge, "aria-label='コア代金（1個・税抜）' inputmode='numeric' maxlength='8' autocomplete='off'") + "</div></div>" : "<small>コア返却不要</small>") + "</div>" +
      "<button type='button' class='recycle-compact-only' popovertarget='recycle-cart-extra'>商品情報</button>" + button("削除", "remove", "data-index='" + i + "'") + "</div>" :
      "<p>" + (recycleChannel() ? "カルテ番号や品番" : "品番や商品分類") + "から商品を追加してください。</p>";
    syncEntryLayout();
    updateCoreChargeField();
    updateReturnField();
    updatePackingField();
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
  function quantityInCart() {
    return state.cart.reduce(function (total, product, index) {
      var quantity=Number(index===state.cartIndex ? field("quantity-"+index) : product.quantity);
      return total+(Number.isInteger(quantity)&&quantity>=1&&quantity<=99 ? quantity : 0);
    },0);
  }
  function updatePackingField() {
    var toggle=document.getElementById("recycle-packed-together");
    if (!toggle) return;
    var available=quantityInCart()>=2;
    document.getElementById("recycle-packing-field").hidden=!available;
    toggle.disabled=!available;
    if (!available) toggle.checked=false;
  }
  function orderPayload() {
    if (!entryAllowed() || !orderCustomerId() || (recycleChannel() && !recycleReady())) throw new Error("受注先と受注区分を確認してください。");
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
        if (quantity < 1 || quantity > 99) throw new Error("数量は1～99で入力してください。");
        focus = "price-";
        var item = { dkd_shohin_id: p.dkd_shohin_id, product_kind: p.product_kind, quantity: quantity, core_return_handling: p.handling || "standard" };
        if (recycleChannel()) {
          item.unit_price_jpy = money(p.price, "成立単価");
          if (p.karte_number) item.karte_number = p.karte_number;
        } else if (p.price) {
          var unitPrice = Number(p.price);
          if (!/^\d{1,10}$/.test(p.price) || unitPrice > 2147483647) throw new Error("成立単価は0以上の整数で入力してください。");
          item.product_unit_price_jpy = unitPrice;
        }
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
    var address = orderAddress(), karteNo = field("staff-karte-number").normalize("NFKC"), packedTogether = checked("packed-together");
    if (karteNo.length>40 || /[\u0000-\u001f\u007f]/.test(karteNo)) throw new Error("カルテNo.は40文字以内で入力してください。");
    if (packedTogether && quantityInCart()<2) throw new Error("同梱セットには商品が2点以上必要です。");
    if (packedTogether && recycleChannel() && !field("buyer")) {
      setEntryPopup("entry-extra", true); focusEntry("buyer");
      throw new Error("同梱する商品の発注元を入力してください。");
    }
    if (karteNo || packedTogether) address.staff_intake = { karte_number: karteNo, packed_together: packedTogether };
    if (!recycleChannel()) {
      var destinationError = customerOrderDestinationError(address, carrier);
      if (destinationError) throw new Error(destinationError);
    }
    var order = { items: items, shipping_address: address, shipping_method: carrier, core_return_shipping_method: returnCarrier,
      requested_delivery_date: field("delivery-date") || null, delivery_time: field("delivery-time"), note: field("note") };
    if (recycleChannel()) Object.assign(order, {
      settlement_mode: "external", external_order_number: field("external") || null, buyer_reference: field("buyer"),
      shipping_fee_jpy: money(field("shipping"), "送料"), shipping_tax_type: field("shipping-tax")
    });
    return order;
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
    void updateStandardDelivery();
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
      (p.karte_number ? "<small>カルテ番号 " + e(p.karte_number) + "</small>" : "") + "</span><span>販売可能 " + e(p.available_qty) + (recycleChannel() ? "<small>ファクタリング候補 " + (p.factoring_price == null ? "未登録" : e(yen(p.factoring_price))) + "</small>" : "") + "</span>" +
      button("追加", "add", "data-index='" + i + "'" + (Number(p.available_qty) <= 0 ? " disabled" : "")) + "</div>" + pages("product", i, state.products.length) : "";
  }
  function productStatus(text, open) {
    document.getElementById("recycle-product-status").textContent = text;
    document.getElementById("recycle-show-products").hidden = !text && !state.products.length;
    if (open && state.view === "entry") setEntryPopup("product-box", true);
  }
  async function searchStandardProducts(query, category) {
    var normalized = normalizePartQuery(query), result;
    if (!normalized && !category) throw new Error("品番または商品分類を指定してください。");
    if (normalized && normalized.length <= CUSTOMER_CATALOG_SHORT_QUERY_MAX) {
      if (!category) throw new Error("短い品番で検索するには商品分類を選択してください。");
      result = await sb.rpc("search_customer_catalog_products_by_prefix_fast", {
        search_prefix: normalized, category_filter: category, target_sales_customer_id: orderCustomerId(), max_rows: 30
      });
    } else {
      result = query ? await fetchCoreProductMasterMatches(query, category || null, 30, { includeDksProductCode: false, preferPrefix: true }) :
        await fetchCategoryProducts(category, 30);
    }
    if (result.error) throw result.error;
    var products = normalizeCoreProductFastRows(result.data || []);
    await hydrateSalesDaikoVisibility(products);
    products = filterSalesVisibleProducts(products).slice(0, 30);
    var ids = productSearchCardDkdIds(products);
    if (!ids.length) return [];
    var kinds = ["rebuilt", "aftermarket_new"];
    var [availability, variants] = await Promise.all([
      fetchCustomerOrderStockAvailabilityMap(products, kinds),
      sb.from("core_product_variants").select("dkd_shohin_id,product_kind,core_return_required,core_charge_jpy")
        .in("dkd_shohin_id", ids).in("product_kind", kinds).eq("is_active", true)
        .order("product_variant_id", { ascending: true })
    ]);
    if (availability.error) throw availability.error;
    if (variants.error) throw variants.error;
    return products.flatMap(function (product) {
      var dkd = productDkdId(product), rows = (variants.data || []).filter(function (row) { return String(row.dkd_shohin_id) === String(dkd); });
      return kinds.filter(function (productKind) { return rows.some(function (row) { return row.product_kind === productKind; }); }).map(function (productKind) {
        var core = coreReturnPolicyForKind(productKind, rows);
        return Object.assign({}, product, {
          dkd_shohin_id: Number(dkd), product_kind: productKind, core_return_required: core.required,
          core_charge_jpy: core.charge, available_qty: availability.map[dkd]?.[productKind]?.total_available_qty || 0
        });
      });
    }).sort(function (a, b) { return Number(b.available_qty > 0) - Number(a.available_qty > 0); });
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
      if (!recycleChannel()) {
        var candidates = await searchStandardProducts(query, field("search-category"));
        if (!current()) return;
        state.products = candidates;
        renderProducts();
        productStatus(candidates.length ? "" : "該当商品がありません。", true);
        return;
      }
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
  function standardPreviewParams(order) {
    return { target_sales_customer_id: orderCustomerId(), target_items: order.items, target_shipping_address: order.shipping_address,
      target_shipping_method: order.shipping_method, target_core_return_shipping_method: order.core_return_shipping_method };
  }
  async function internalOrderRpc(name, params) {
    if (!regularEntryAllowed()) throw new Error("社内受注を登録する権限がありません。");
    var result = await sb.rpc(name, params);
    if (result.error) throw result.error;
    return Array.isArray(result.data) ? result.data[0] : result.data;
  }
  async function finishOrder(data) {
    state.dirty = false; state.cart = []; state.dialog.close(); state.epoch++;
    await enterSalesOrderMgmt();
    if (data?.id) await loadSalesOrderDetail(data.id);
  }
  async function submitStandardOrder(order, quote, params) {
    state.pending = { action: "standard_place", actor: actor() };
    state.busy = true; setButtons(); status("受注を登録しています。");
    var registered, epoch = state.epoch, owner = actor();
    try {
      registered = await internalOrderRpc("place_internal_customer_order", Object.assign({}, params, {
        target_requested_delivery_date: order.requested_delivery_date, target_delivery_time: order.delivery_time || null,
        target_customer_note: order.note || null, target_preview_token: quote.preview_token, target_idempotency_key: uuid()
      }));
      if (!registered?.id) throw new Error("受注番号を確認できませんでした。");
      state.pending = null;
    } catch (error) {
      if (/^(?:[0-9A-Z]{5}|PGRST\d+)$/.test(error.code || "")) state.pending = null;
      if (owner === actor()) status((error.message || "受注登録の応答を取得できませんでした。") +
        (state.pending ? " 受注一覧で結果を確認してください。" : ""), true);
      return;
    } finally {
      state.busy = false; setButtons();
    }
    if (epoch === state.epoch && ownerCurrent()) await finishOrder(registered);
  }
  async function updateStandardDelivery() {
    if (recycleChannel() || !state.shippingReady) return;
    var output = document.getElementById("recycle-delivery-quote");
    var service = customerOrderDeliveryServiceFromKey(field("carrier"));
    var postal = normalizeCustomerOrderPostalCode(field("postal"));
    var address = (document.getElementById("recycle-prefecture").value ? document.getElementById("recycle-prefecture").selectedOptions[0].text : "") + field("address1");
    var request = ++state.deliveryRead, epoch = state.epoch, owner = actor();
    var date = document.getElementById("recycle-delivery-date"), time = document.getElementById("recycle-delivery-time");
    date.removeAttribute("min"); date.removeAttribute("max"); output.textContent = "";
    date.disabled = false; time.disabled = false;
    Array.from(time.options).forEach(function (choice) { choice.disabled = false; choice.hidden = false; });
    if (!service || (!address && postal.length !== 7)) return;
    try {
      var result = await internalOrderRpc("get_customer_order_delivery_quote", {
        target_postal_code: postal.length === 7 ? postal : null, target_address: address || null,
        target_carrier_name: service.carrier_name, target_service_name: service.service_name, target_shipping_date: null
      });
      if (epoch !== state.epoch || owner !== actor() || request !== state.deliveryRead || !output.isConnected) return;
      if (!result?.available) return;
      var timeCodes = Array.isArray(result.allowed_time_codes) ? result.allowed_time_codes.map(String) : [];
      Array.from(time.options).forEach(function (choice) {
        choice.disabled = !!choice.value && !timeCodes.includes(choice.value); choice.hidden = choice.disabled;
      });
      if (time.value && !timeCodes.includes(time.value)) time.value = "";
      date.disabled = result.requested_date_supported === false;
      time.disabled = date.disabled || !timeCodes.length;
      date.min = result.earliest_delivery_date || "";
      date.max = result.max_requested_delivery_date || "";
      if (date.disabled) { date.value = ""; time.value = ""; }
      else if (!date.value || date.value === date.dataset.automatic || (date.min && date.value < date.min) || (date.max && date.value > date.max)) {
        date.value = result.automatic_requested_delivery_date || "";
        date.dataset.automatic = date.value;
      }
      output.textContent = [result.shipping_date ? "発送予定 " + result.shipping_date : "", date.min ? "最短お届け " + date.min : ""].filter(Boolean).join(" ／ ");
    } catch (_) { /* Dates can still be entered and checked at registration. */ }
  }
  async function place() {
    if (state.busy || state.pending) return;
    var order = orderPayload(), epoch = state.epoch, recycle = recycleChannel(), params = recycle ? null : standardPreviewParams(order);
    status("価格・在庫・配送条件を確認しています。"); state.busy = true; setButtons();
    var quote;
    try {
      quote = recycle ? await rpc("preview", order) : await internalOrderRpc("preview_internal_customer_order", params);
      if (epoch !== state.epoch || !ownerCurrent()) return;
    } finally { state.busy = false; setButtons(); }
    if (!quote?.valid || !quote.preview_token || !Number.isSafeInteger(quote.total_jpy) ||
        (recycle && quote.recycle_policy?.settlement_mode !== "external")) throw new Error("価格と在庫の確認結果を取得できませんでした。");
    if (!recycle && order.items.some(function (item) {
      if (item.product_unit_price_jpy === undefined) return false;
      var confirmed = quote.items.find(function (line) {
        return Number(line.dkd_shohin_id) === item.dkd_shohin_id && line.product_kind === item.product_kind;
      });
      return !confirmed || Number(confirmed.unit_price_jpy) - customerOrderBilledCoreChargePerUnit(confirmed) !== item.product_unit_price_jpy;
    })) throw new Error("入力した単価を確認結果に反映できませんでした。");
    var coreChargeSummary = quote.core_charge_total_jpy > 0 ? "\nコア代金（税抜） " + yen(quote.core_charge_total_jpy) : "";
    var customer = recycle ? state.settings.customer_name : regularCustomers().find(function (c) { return String(c.id) === state.regularCustomer; })?.customer_name;
    var label = recycle ? "Recycle+" : orderEntryLabels()[1];
    var packingSummary = order.shipping_address.staff_intake?.packed_together
      ? "\n同梱セット " + quantityInCart() + "点 ／ 発送用送り状1枚" : "";
    var confirmation = label + " ／ " + customer + "\n合計 " + yen(quote.total_jpy) + coreChargeSummary + packingSummary;
    if (!window.confirm(confirmation + "\nこの内容で受注を登録します。")) { status("入力内容を確認できます。合計 " + yen(quote.total_jpy)); return; }
    if (recycle) await mutate("place", { order: order, preview_token: quote.preview_token }, finishOrder);
    else await submitStandardOrder(order, quote, params);
  }
  function karteItems(recycle) { return Array.isArray(recycle.karte_items) ? recycle.karte_items : []; }
  async function runAction(action, b) {
    try {
      if (action === "close") { close(); return; }
      if (!ownerCurrent()) { status("受注を管理する権限・ログイン状態を確認してください。", true); return; }
      if((state.busy||state.pending) && action !== "result"){status("先に処理結果を確認してください。",true);return;}
      if(action==='save_settings' && state.dirty){status("受注の入力中は条件を変更できません。受注を登録するか、入力を閉じてから変更してください。",true);return;}
      if (action === "result") await checkResult();
      else if (action === "select_customer") chooseCustomer(Number(b.dataset.index));
      else if (action === "customer_names") {
        var picker = document.getElementById("recycle-order-customer");
        if (picker.getAttribute("aria-expanded")==="true") closeCustomerNames();
        else { picker.focus(); searchCustomerNames(""); }
      }
      else if (action === "entry" || action === "settings" && recycleChannel() && recycleReady()) showView(action);
      else if (action === "save_settings") await prepareSettings();
      else if (action === "binding_confirm") await confirmBinding();
      else if (action === "binding_cancel") { clearBindingReview(); setButtons(); }
      else if (action === "reload_settings") await reloadSettings();
      else if (action === "retry_shipping") { status(""); await loadShippingOptions(); }
      else if (action === "products") await searchProducts();
      else if (action === "page") changePage(b);
      else if (action === "cart_line") {
        var index = Number(b.dataset.index);
        if (state.cart[index]) { rememberCart(); state.cartIndex=index; renderCart(); focusEntry("quantity-"+index); }
      }
      else if (action === "postal") await lookupPostal();
      else if (action === "postal_select") { var row = state.postalRows[Number(b.dataset.index)]; if (row && row.postal_code.replace(/[^0-9]/g, "") === field("postal").replace(/[^0-9]/g, "")) applyPostal(row); }
      else if (action === "add") {
        var product = state.products[Number(b.dataset.index)]; if (!product || Number(product.available_qty) <= 0) return;
        rememberCart();
        if (!recycleChannel()) {
          var existing = state.cart.findIndex(function (line) { return line.dkd_shohin_id === product.dkd_shohin_id && line.product_kind === product.product_kind; });
          if (existing >= 0) {
            state.cartIndex = existing; setEntryPopup("product-box", false); renderCart(); focusEntry("quantity-" + existing); return;
          }
        }
        state.cart.push(Object.assign({}, product, { quantity: 1, price: product.factoring_price == null ? "" : String(product.factoring_price) }));
        state.cartIndex = state.cart.length - 1; state.dirty = true;
        setEntryPopup("product-box", false);
        renderCart(); focusEntry("quantity-" + state.cartIndex);
      }
      else if (action === "remove") { rememberCart(); state.cart.splice(state.cartIndex, 1); state.cartIndex = Math.max(0, Math.min(state.cartIndex, state.cart.length - 1)); state.dirty = true; renderCart(); focusEntry(state.cart.length ? "quantity-" + state.cartIndex : "product-query"); }
      else if (action === "place") await place();
    } catch (error) { status(error.message, true); }
  }
  function mountDetail(order, host) {
    var r = order && order.recycle, info = order && order.staff_intake;
    if ((!r && !info) || !allowed()) return;
    var section = document.createElement("section"); section.className = "recycle-detail";
    var karte = r ? karteItems(r) : [];
    var references = [
      r ? "<strong>Recycle+</strong>" : "",
      r?.external_order_number ? "Recycle+注文番号 " + e(r.external_order_number) : "",
      info?.karte_number ? "カルテNo. " + e(info.karte_number) : "",
      karte.length === 1 && karte[0].karte_number !== info?.karte_number ? "カルテ番号 " + e(karte[0].karte_number) : "",
      info?.packed_together ? "<strong>同梱セット（1箱・発送用送り状1枚）</strong>" : ""
    ].filter(Boolean);
    section.innerHTML = (references.length ? "<p>" + references.join(" ／ ") + "</p>" : "") +
      (karte.length > 1 ? "<details><summary>カルテ番号・商品明細（" + karte.length + "件）</summary><ul>" + karte.map(function (item) {
        return "<li>" + e(item.karte_number + " ／ " + item.part_number + " ／ " + kind(item.product_kind)) + "</li>";
      }).join("") + "</ul></details>" : "");
    if (!section.innerHTML) return;
    var navigation = host.querySelector(".sales-order-detail-navigation");
    if (navigation) navigation.before(section); else host.prepend(section);
  }
  function orderEntryLabels() {
    var language = typeof currentLang === "undefined" ? "ja" : currentLang;
    return (language === "en" ? ["Internal Order Entry", "Standard order", "Close"] :
      language === "zh" ? ["内部订单录入", "普通订单", "关闭"] : ["社内受注入力", "通常受注", "閉じる"]);
  }
  function configureEntryButton() {
    var b = document.getElementById("sales-order-recycle-open"), regular = document.getElementById("sales-order-new-internal-order");
    if (!b) return;
    if (regular) regular.hidden = true;
    b.hidden = !allowed() && !regularEntryAllowed();
    b.removeAttribute("data-i18n");
    b.textContent = orderEntryLabels()[0];
    b.onclick = open;
  }
  window.DcatsRecycleOrders = Object.freeze({ open: open, mountDetail: mountDetail, configureEntryButton: configureEntryButton, isBusy: function () { return ownerCurrent() && (state.busy || !!state.pending || state.dirty); } });
}());
