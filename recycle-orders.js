(function () {
  "use strict";
  var state = { dialog: null, settings: null, cart: [], dirty: false, detailDirty: false, busy: false, pending: null, epoch: 0, search: 0, postal: 0, list: 0, view: "entry", actor: "", rows: [], offset: 0 };
  function actor() { return typeof currentUser !== "undefined" && currentUser ? String(currentUser.id || currentUser.email || "") : ""; }
  function allowed() { return typeof canManageSalesOrders === "function" && canManageSalesOrders(); }
  function e(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function yen(value) { return value == null ? "未確定" : Number(value).toLocaleString("ja-JP") + "円"; }
  function kind(value) { return typeof productKindLabel === "function" ? productKindLabel(value) : ({ rebuilt: "リビルト品", aftermarket_new: "社外新品", used_core: "中古コア" }[value] || value); }
  function field(id) { var el = document.getElementById("recycle-" + id); return el ? el.value.trim() : ""; }
  function checked(id) { var el = document.getElementById("recycle-" + id); return !!(el && el.checked); }
  function uuid() { return crypto.randomUUID(); }
  function localTime() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  function monthDate(last) { var d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth() + (last ? 1 : 0), last ? 0 : 1)).toISOString().slice(0, 10); }
  function status(text, error) { ["recycle-message","recycle-detail-message"].forEach(function(id){var el=document.getElementById(id);if(el){el.textContent=text;el.classList.toggle("error",!!error);}}); }
  function input(label, id, type, value, extra) { return "<label><span>" + e(label) + "</span><input id='recycle-" + id + "' type='" + (type || "text") + "' value='" + e(value == null ? "" : value) + "' " + (extra || "") + "></label>"; }
  function button(text, action, extra) { return "<button type='button' data-recycle-action='" + action + "' " + (extra || "") + ">" + e(text) + "</button>"; }
  function option(value, label, selected) { return "<option value='" + e(value) + "'" + (value === selected ? " selected" : "") + ">" + e(label) + "</option>"; }
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
    if (state.dialog) state.dialog.querySelectorAll("[data-recycle-write]").forEach(function (b) { b.disabled = state.busy || !!state.pending || (b.dataset.recycleAction === "place" && !state.cart.length); });
    var entry = document.getElementById("recycle-entry-fields"); if (entry) entry.disabled = !state.settings.sales_customer_id || state.busy || !!state.pending;
    ["recycle-back", "recycle-list-open", "recycle-settings-open"].forEach(function (id) { var b = document.getElementById(id); if (b) b.disabled = !entry || state.busy || !!state.pending; });
    document.querySelectorAll("[data-recycle-detail-write]").forEach(function (b) { b.disabled = state.busy || !!state.pending; });
    var check = document.getElementById("recycle-check-result"); if (check) check.hidden = !state.pending;
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
    state.epoch++; state.dirty = false; state.cart = []; state.dialog.close();
  }
  async function open() {
    if (!allowed()) return;
    if(state.dialog && state.dialog.open) return;
    if (state.actor && state.actor !== actor()) { state.cart = []; state.pending = null; state.dirty = false; }
    state.actor = actor(); state.epoch++; state.view = "entry";
    if (!state.dialog) {
      state.dialog = document.createElement("dialog"); state.dialog.className = "recycle-dialog"; state.dialog.setAttribute("aria-labelledby", "recycle-title"); document.body.appendChild(state.dialog);
      state.dialog.addEventListener("cancel", function (event) { event.preventDefault(); if (state.view !== "entry" && !state.busy && !state.pending) showView("entry"); else close(); });
      state.dialog.addEventListener("input", function (event) { if (event.target.closest("#recycle-entry")) state.dirty = true; });
      state.dialog.addEventListener("change", function (event) { if (event.target.id.indexOf("recycle-core-") === 0) { rememberCart(); updateReturnField(); } });
      state.dialog.addEventListener("keydown", function (event) { if (event.key === "Enter" && event.target.id === "recycle-product-query") { event.preventDefault(); runAction("products"); } });
      state.dialog.addEventListener("click", function (event) { var b = event.target.closest("[data-recycle-action]"); if (b) runAction(b.dataset.recycleAction, b); });
    }
    if (!state.dialog.open) state.dialog.showModal();
    state.dialog.innerHTML = "<header class='recycle-header'><div><p>Partsman.c Recycle+</p><h2 id='recycle-title' tabindex='-1'>Recycle+受注入力</h2></div><nav class='recycle-actions' aria-label='Recycle+画面'>" + button("受注入力に戻る", "entry", "id='recycle-back' hidden") + button("精算一覧", "settlements", "id='recycle-list-open'") + button("設定", "settings", "id='recycle-settings-open'") + button("閉じる", "close") + "</nav></header><p id='recycle-message' role='status' aria-live='polite'>読み込んでいます。</p>" + button("結果を確認", "result", "id='recycle-check-result' hidden") + "<div id='recycle-body'></div>";
    setButtons();
    var epoch = state.epoch;
    try { state.settings = await rpc("settings"); if (epoch === state.epoch && ownerCurrent()) renderWorkspace(); }
    catch (error) { if (epoch === state.epoch) status(error.message, true); }
  }
  function renderWorkspace() {
    var cfg = state.settings, body = document.getElementById("recycle-body"); if (!body) return;
    body.innerHTML = "<div id='recycle-customer-summary'></div><div id='recycle-setup-note'></div>" +
      "<section id='recycle-entry' aria-label='受注入力'>" + entryHtml(cfg) + "</section>" +
      "<section id='recycle-settings-view' aria-label='集約先・手数料の設定' hidden>" + settingsHtml(cfg) + "</section>" +
      "<section id='recycle-settlements-view' class='recycle-month' aria-label='精算一覧' hidden><h3>受注日で確認する精算一覧</h3><p>受注日で集計します。精算月・売上月とは分けて確認してください。</p><div class='recycle-grid'>" + input("開始日", "from", "date", monthDate(false)) + input("終了日", "to", "date", monthDate(true)) + "</div><div class='recycle-actions'>" + button("一覧を更新", "list") + button("確認用CSV", "csv") + "</div><div id='recycle-totals'></div><div id='recycle-list'></div><div class='recycle-actions'>" + button("前の100件", "previous") + button("次の100件", "next") + "</div></section>";
    state.cart = []; state.products = []; state.dirty = false; state.offset = 0; state.rows = []; refreshSettings(); renderCart(); setButtons(); status(""); showView("entry", false);
    document.getElementById(cfg.sales_customer_id ? "recycle-external" : "recycle-title").focus({ preventScroll: true });
  }
  function refreshSettings() {
    var cfg = state.settings;
    document.getElementById("recycle-customer-summary").innerHTML = "<div class='recycle-summary recycle-customer'><div><span>得意先（固定）</span><strong>ブロードリーフ</strong></div><span>Recycle+成立価格で登録 ／ 手数料 " + e(cfg.fee_rate_percent) + "%" + (cfg.provisional ? "（暫定・見込）" : "") + "</span></div>";
    document.getElementById("recycle-setup-note").innerHTML = cfg.sales_customer_id ? "" : "<div class='recycle-note'><p>受注入力を始めるには、システム管理者によるブロードリーフの初回登録が必要です。</p>" + button("設定を開く", "settings") + "</div>";
    document.getElementById("recycle-settings-view").innerHTML = settingsHtml(cfg);
    document.getElementById("recycle-entry-fields").disabled = !cfg.sales_customer_id;
  }
  function showView(view, focus) {
    state.view = view;
    [["entry", "recycle-entry"], ["settings", "recycle-settings-view"], ["settlements", "recycle-settlements-view"]].forEach(function (pair) { document.getElementById(pair[1]).hidden = pair[0] !== view; });
    document.getElementById("recycle-title").textContent = view === "settings" ? "Recycle+設定" : view === "settlements" ? "Recycle+精算一覧" : "Recycle+受注入力";
    document.getElementById("recycle-back").hidden = view === "entry";
    document.getElementById("recycle-settings-open").hidden = view === "settings";
    document.getElementById("recycle-list-open").hidden = view === "settlements";
    status(""); state.dialog.scrollTop = 0;
    if (focus !== false) document.getElementById("recycle-title").focus();
  }
  function settingsHtml(cfg) {
    var conditions = cfg.fee_basis === "transaction_total" ? "取引税込総額" : "商品税抜額" + (cfg.include_shipping ? "＋送料" : "・送料除外") + (cfg.include_core ? "＋コア代" : "・コア代除外");
    var html = "<div class='recycle-settings'><h3>集約先・手数料条件</h3><p>現在：" + e(conditions) + "</p><p>変更は新しい受注に適用します。過去受注は登録時の条件を保持します。</p>";
    if (!cfg.can_configure) return html + "<p>設定の変更はシステム管理者へ依頼してください。</p></div>";
    if (!cfg.sales_customer_id) html += "<p>販売王の得意先とは別に、D-CATS内の集約先を1件登録します。社内コードBROADLEAFは販売王コードとして使用しません。</p>" + button("D-CATSにブロードリーフを登録", "create_customer", "data-recycle-write");
    html += "<div class='recycle-grid'>" + input("集約先D-CATS ID", "customer-id", "number", cfg.sales_customer_id, "min='1'") + input("手数料率（％）", "rate", "number", cfg.fee_rate_percent, "min='0' max='100' step='0.0001'") +
      "<label><span>算定対象</span><select id='recycle-basis'>" + option("product_net", "値引後の商品税抜額", cfg.fee_basis) + option("transaction_total", "取引税込総額", cfg.fee_basis) + "</select></label>" +
      "<label><span>円未満の端数</span><select id='recycle-rounding'>" + option("floor", "切捨", cfg.rounding) + option("round", "四捨五入", cfg.rounding) + option("ceil", "切上", cfg.rounding) + "</select></label></div>" +
      "<div class='recycle-checks'><label><input id='recycle-include-shipping' type='checkbox'" + (cfg.include_shipping ? " checked" : "") + ">商品額に送料を含む</label><label><input id='recycle-include-core' type='checkbox'" + (cfg.include_core ? " checked" : "") + ">商品額にコア代を含む</label><label><input id='recycle-provisional' type='checkbox'" + (cfg.provisional ? " checked" : "") + ">暫定条件</label></div>" + input("条件・確認根拠", "policy-note", "text", cfg.note, "maxlength='1000'") + button("新しい条件を保存", "save_settings", "data-recycle-write") + "<p class='recycle-note'>販売王は得意先・決済済み精算方式の確認待ちです。通常の掛売CSVへは出力しません。</p></div>";
    return html;
  }
  function entryHtml(cfg) {
    var prefs = typeof SHIPPING_PREFECTURES !== "undefined" ? SHIPPING_PREFECTURES : [];
    return "<fieldset id='recycle-entry-fields'" + (!cfg.sales_customer_id ? " disabled" : "") + "><legend class='recycle-sr-only'>ブロードリーフの受注入力</legend><div class='customer-order-workspace recycle-workspace'><div class='customer-order-cart-pane'><div class='customer-order-section-head'><div><h3>注文内容</h3><p>Recycle+で成立した商品・数量・税抜単価を入力してください。</p></div></div><div class='recycle-grid'>" +
      input("Recycle+注文番号（必須）", "external", "text", "", "maxlength='120' required") + input("元の発注会社（参考）", "buyer", "text", "", "maxlength='200'") +
      "</div><section class='recycle-product-picker' aria-labelledby='recycle-products-title'><h4 id='recycle-products-title'>商品を追加</h4><div class='recycle-search'>" + input("純正品番・メーカー品番", "product-query", "search", "", "maxlength='80' placeholder='品番を入力して検索'") + button("商品を検索", "products") + "</div><div id='recycle-products' aria-live='polite'></div></section><div id='recycle-cart' class='customer-order-cart-list'></div><div class='recycle-grid recycle-fees'>" +
      input("成立した送料", "shipping", "number", 0, "min='0' max='9999999' step='1'") +
      "<label><span>送料の税</span><select id='recycle-shipping-tax'><option value='excluded'>税別</option><option value='included'>税込</option></select></label></div><p id='recycle-preview' class='recycle-preview' role='status'>登録前に価格・在庫・合計を確認します。</p></div><aside class='customer-order-shipping-pane'><div class='customer-order-section-head compact'><div><h3>お届け先</h3><p>注文ごとの直送先を入力してください。</p></div></div><div class='recycle-grid'>" +
      input("直送先会社名", "company", "text", "", "maxlength='120' autocomplete='organization'") + input("宛名・担当者", "recipient", "text", "", "maxlength='80' autocomplete='name'") +
      input("電話番号（必須）", "phone", "tel", "", "maxlength='20' required autocomplete='tel'") + "<div class='recycle-postal-field'><label for='recycle-postal'>郵便番号（必須）</label><div class='recycle-postal-row'><input id='recycle-postal' maxlength='8' inputmode='numeric' autocomplete='postal-code' required>" + button("住所検索", "postal") + "</div><small id='recycle-postal-status' role='status'></small><div id='recycle-postal-results'></div></div>" +
      "<label><span>都道府県</span><select id='recycle-prefecture'><option value=''>選択してください</option>" + prefs.map(function (p) { return option(String(Array.isArray(p) ? p[0] : p.code), Array.isArray(p) ? p[1] : p.name, ""); }).join("") + "</select></label>" +
      input("住所（必須）", "address1", "text", "", "maxlength='160' required autocomplete='address-line1'") + input("建物名・部門", "address2", "text", "", "maxlength='120' autocomplete='address-line2'") +
      "<label><span>商品発送時の運送便</span><select id='recycle-carrier'><option value='ヤマト運輸|宅急便'>ヤマト運輸・宅急便</option><option value='佐川急便|飛脚宅配便'>佐川急便・飛脚宅配便</option></select></label>" +
      "<label id='recycle-return-field' hidden><span>コア返却時の運送便</span><select id='recycle-return-carrier'><option value=''>商品発送と同じ便</option><option value='ヤマト運輸|宅急便'>ヤマト運輸・宅急便</option><option value='佐川急便|飛脚宅配便'>佐川急便・飛脚宅配便</option></select></label>" +
      input("お届け希望日", "delivery-date", "date", "") + "<label><span>時間帯</span><select id='recycle-delivery-time'><option value=''>指定なし</option><option value='0812'>午前中</option><option value='1416'>14～16時</option><option value='1618'>16～18時</option><option value='1820'>18～20時</option><option value='1921'>19～21時</option></select></label>" +
      "<label class='recycle-wide'><span>注文メモ</span><textarea id='recycle-note' maxlength='500' rows='3'></textarea></label></div><p class='recycle-payment-note'>登録後に決済完了を確認してから発送します。</p>" + button("内容を確認して受注登録", "place", "class='customer-order-submit-button' data-recycle-write") + "</aside></div></fieldset>";
  }
  function renderCart() {
    var host = document.getElementById("recycle-cart"); if (!host) return;
    host.innerHTML = state.cart.length ? state.cart.map(function (p, i) {
      return "<div class='recycle-line'><strong>" + e(p.genuine_part_number || p.manufacturer_part_number) + "<small>" + e(p.manufacturer + " / " + p.manufacturer_part_number + " / " + kind(p.product_kind)) + "</small></strong>" + input("数量", "quantity-" + i, "number", p.quantity, "min='1' max='99' step='1'") + input("成立単価（税抜・コア代別）", "price-" + i, "number", p.price, "min='0' max='99999999' step='1'") +
        (p.core_return_required ? "<label><span>コア対応</span><select id='recycle-core-" + i + "'>"+option("standard","返却あり・コア代請求なし",p.handling||"standard") + (p.core_charge_jpy > 0 ? option("charge_with_return","コア代請求・後日返却",p.handling)+option("charge_no_return","コア代請求・返却なし",p.handling) : "") + "</select></label>" : "<span>コア返却不要</span>") + button("削除", "remove", "data-index='" + i + "'") + "</div>";
    }).join("") : "<p>商品を検索するとファクタリング候補を表示します。追加後、実際の成立単価を確認してください。</p>";
    updateReturnField();
    setButtons();
  }
  function hasCoreReturn() { return state.cart.some(function (p) { return p.core_return_required && p.handling !== "charge_no_return"; }); }
  function updateReturnField() { document.getElementById("recycle-return-field").hidden = !hasCoreReturn(); }
  function rememberCart() { state.cart.forEach(function (p, i) { p.quantity = field("quantity-" + i); p.price = field("price-" + i); p.handling = field("core-" + i) || "standard"; }); }
  function orderPayload() {
    rememberCart();
    if (!field("external") || !state.cart.length || (!field("company") && !field("recipient"))) throw new Error("注文番号・宛名・商品を入力してください。");
    var carrier = field("carrier").split("|"), returnCarrier = field("return-carrier").split("|");
    return { external_order_number: field("external"), buyer_reference: field("buyer"), items: state.cart.map(function (p) { return { dkd_shohin_id: p.dkd_shohin_id, product_kind: p.product_kind, quantity: money(p.quantity, "数量"), unit_price_jpy: money(p.price, "成立単価"), core_return_handling: p.handling }; }),
      shipping_address: { destination_type: "address", company_name: field("company"), recipient_name: field("recipient"), phone_number: field("phone"), postal_code: field("postal"), prefecture_code: field("prefecture"), prefecture_name: document.getElementById("recycle-prefecture").selectedOptions[0].text, address_line_1: field("address1"), address_line_2: field("address2") },
      shipping_method: { carrier_name: carrier[0], service_name: carrier[1] }, core_return_shipping_method: hasCoreReturn() && returnCarrier[0] ? { carrier_name: returnCarrier[0], service_name: returnCarrier[1] } : null, shipping_fee_jpy: money(field("shipping"), "送料"), shipping_tax_type: field("shipping-tax"), requested_delivery_date: field("delivery-date") || null, delivery_time: field("delivery-time"), note: field("note") };
  }
  function applyPostal(row) {
    document.getElementById("recycle-postal").value = row.postal_code;
    document.getElementById("recycle-prefecture").value = row.prefecture_code;
    document.getElementById("recycle-address1").value = row.address_line_1;
    document.getElementById("recycle-postal-results").innerHTML = "";
    document.getElementById("recycle-postal-status").textContent = "住所を入力しました。番地・建物名を確認してください。";
    state.dirty = true;
  }
  async function lookupPostal() {
    var postal = field("postal").replace(/[^0-9]/g, ""), epoch = state.epoch, seq = ++state.postal;
    var message = document.getElementById("recycle-postal-status"), results = document.getElementById("recycle-postal-results");
    results.innerHTML = "";
    if (postal.length !== 7) { message.textContent = "郵便番号を7桁で入力してください。"; return; }
    var before = [field("prefecture"), field("address1")].join("|");
    function current() { return seq === state.postal && epoch === state.epoch && ownerCurrent() && field("postal").replace(/[^0-9]/g, "") === postal && [field("prefecture"), field("address1")].join("|") === before; }
    message.textContent = "住所を検索しています。";
    try {
      var rows = [];
      try { rows = await lookupCustomerOrderPostalLocal(postal); } catch (_) { /* Use the shared API fallback. */ }
      if (!rows.length) rows = await lookupCustomerOrderPostalApi(postal);
      if (!current()) return;
      state.postalRows = rows;
      if (rows.length === 1) applyPostal(rows[0]);
      else {
        message.textContent = rows.length ? "住所を選択してください。" : "住所が見つかりません。直接入力してください。";
        results.innerHTML = rows.map(function (row, i) { return button(row.display_address, "postal_select", "data-index='" + i + "'"); }).join("");
      }
    } catch (error) { if (current()) message.textContent = "住所を取得できませんでした。再検索するか、直接入力してください。"; }
  }
  async function searchProducts() {
    var seq = ++state.search, epoch = state.epoch; status("商品を検索しています。");
    try {
      var data = await rpc("products", { query: field("product-query") }); if (seq !== state.search || epoch !== state.epoch || !ownerCurrent()) return;
      var products = data.rows || [], priceMap = {}, priceWarning = "";
      try { if (window.DcatsFactoringPricing) priceMap = await window.DcatsFactoringPricing.prices(products.map(function(p) { return p.dkd_shohin_id; })); }
      catch (_) { priceWarning = " ファクタリング候補を取得できませんでした。成立単価を確認して入力してください。"; }
      if (seq !== state.search || epoch !== state.epoch || !ownerCurrent()) return;
      state.products = products.map(function(p) { var price = priceMap[p.dkd_shohin_id + "|" + p.product_kind]; return Object.assign({}, p, { factoring_price: Number.isSafeInteger(price) && price > 0 && price <= 99999999 ? price : null }); });
      document.getElementById("recycle-products").innerHTML = state.products.map(function (p, i) { return "<div class='recycle-product'><span><strong>" + e(p.genuine_part_number || p.manufacturer_part_number) + "</strong><small>" + e(p.manufacturer + " / " + p.manufacturer_part_number + " / " + kind(p.product_kind)) + "</small></span><span>販売可能 " + e(p.available_qty) + "<small>ファクタリング候補 " + (p.factoring_price == null ? "未登録" : e(yen(p.factoring_price))) + "</small></span>" + button("追加", "add", "data-index='" + i + "'" + (Number(p.available_qty) <= 0 ? " disabled" : "")) + "</div>"; }).join("") || "<p>該当商品がありません。</p>";
      if (state.view === "entry") status("最大30件を表示しています。表示されない場合は品番を詳しく指定してください。" + priceWarning);
    } catch (error) { if (seq === state.search && epoch === state.epoch && ownerCurrent() && state.view === "entry") status(error.message, true); }
  }
  async function place() {
    if (state.busy || state.pending) return;
    var payload = orderPayload(), epoch = state.epoch;
    status("価格・在庫・配送条件を確認しています。"); state.busy = true; setButtons();
    var quote;
    try { quote = await rpc("preview", payload); if (epoch !== state.epoch || !ownerCurrent()) return; }
    catch (error) { status(error.message, true); return; }
    finally { state.busy = false; setButtons(); }
    document.getElementById("recycle-preview").textContent = "商品 " + yen(quote.subtotal_jpy) + " ／ 送料 " + yen(quote.shipping_fee_jpy) + " ／ 消費税 " + yen(quote.tax_jpy) + " ／ 合計 " + yen(quote.total_jpy);
    if (!window.confirm("ブロードリーフのRecycle+受注として合計 " + yen(quote.total_jpy) + " で登録します。決済完了は登録後に別途確認します。")) return;
    await mutate("place", { order: payload, preview_token: quote.preview_token }, async function (data) {
      state.dirty = false; state.cart = []; state.dialog.close(); state.epoch++;
      await enterSalesOrderMgmt(); await loadSalesOrderDetail(data.id);
    });
  }
  async function loadList() {
    var epoch = state.epoch, seq = ++state.list; state.rows = []; status("精算一覧を読み込んでいます。");
    document.getElementById("recycle-totals").textContent = "";
    document.getElementById("recycle-list").textContent = "精算一覧を読み込んでいます。";
    try {
      var data = await rpc("list", { from: field("from"), to: field("to"), offset: state.offset }); if (seq !== state.list || epoch !== state.epoch || !ownerCurrent()) return;
      state.rows = data.rows || [];
      document.getElementById("recycle-totals").textContent = "取消を除く " + data.count + "件 ／ 取引総額 " + yen(data.gross_jpy) + " ／ 手数料見込 " + yen(data.estimated_fee_jpy) + " ／ 確定手数料 " + yen(data.actual_fee_jpy) + " ／ 手数料未確定 " + data.unconfirmed_fee_count + "件";
      document.getElementById("recycle-list").innerHTML = state.rows.map(function (o) { var r = o.recycle; return "<article class='recycle-order-row'><div><strong>" + e(r.external_order_number) + "</strong><span>" + e(o.shipping_address.company_name || o.shipping_address.recipient_name || "-") + "</span><small>" + e(o.order_number) + " / " + e(r.payment_status === "confirmed" ? "決済確認済み" : r.payment_status === "unconfirmed" ? "決済確認待ち" : r.payment_status === "refunded" ? "返金確認済み" : "返金確認待ち") + " / " + e(o.status) + "</small></div><div>取引 " + e(yen(o.total_jpy)) + "<small>手数料 " + e(yen(r.actual_fee_jpy == null ? r.estimated_fee_jpy : r.actual_fee_jpy)) + (r.actual_fee_jpy == null ? "（見込）" : "（確定）") + "</small><small>差引受取 " + e(yen(r.actual_receipt_jpy == null ? r.estimated_receipt_jpy : r.actual_receipt_jpy)) + "</small></div>" + button("受注を開く", "open_order", "data-id='" + o.id + "'") + "</article>"; }).join("") || "<p>この期間の受注はありません。</p>";
      if (state.view === "settlements") status("受注日で集計しています。精算月・売上月とは分けて確認してください。");
    } catch (error) { if (seq === state.list && epoch === state.epoch && ownerCurrent()) { document.getElementById("recycle-list").textContent = "精算一覧を取得できませんでした。「一覧を更新」から再度読み込んでください。"; if (state.view === "settlements") status(error.message, true); } }
  }
  function csvCell(v) { var s = String(v == null ? "" : v); if (/^[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function downloadCsv() {
    if (!state.rows.length) { status("先に一覧を読み込んでください。", true); return; }
    var rows = [["D-CATS注文番号", "Recycle+注文番号", "直送先", "取引総額", "手数料見込", "手数料確定", "差引受取確定", "決済状態"]];
    state.rows.forEach(function (o) { var r = o.recycle; rows.push([o.order_number, r.external_order_number, o.shipping_address.company_name || o.shipping_address.recipient_name, o.total_jpy, r.estimated_fee_jpy, r.actual_fee_jpy, r.actual_receipt_jpy, r.payment_status]); });
    var url = URL.createObjectURL(new Blob(["\ufeff" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    var a = document.createElement("a"); a.href = url; a.download = "recycle-confirmation-" + field("from") + "-page-" + (state.offset / 100 + 1) + ".csv"; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
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
      else if (action === "create_customer") await mutate(action, {}, async function () { state.settings = await rpc("settings"); refreshSettings(); status("ブロードリーフを登録しました。「受注入力に戻る」から入力できます。"); });
      else if (action === "save_settings") await mutate(action, { revision: state.settings.revision, sales_customer_id: field("customer-id") || null, fee_rate_percent: field("rate"), fee_basis: field("basis"), rounding: field("rounding"), include_shipping: checked("include-shipping"), include_core: checked("include-core"), provisional: checked("provisional"), note: field("policy-note") }, async function () { state.settings = await rpc("settings"); refreshSettings(); });
      else if (action === "products") await searchProducts();
      else if (action === "postal") await lookupPostal();
      else if (action === "postal_select") { var row = state.postalRows[Number(b.dataset.index)]; if (row && row.postal_code.replace(/[^0-9]/g, "") === field("postal").replace(/[^0-9]/g, "")) applyPostal(row); }
      else if (action === "add") { var product = state.products[Number(b.dataset.index)]; if (!product || Number(product.available_qty) <= 0) return; rememberCart(); state.cart.push(Object.assign({}, product, { quantity: 1, price: product.factoring_price == null ? "" : String(product.factoring_price) })); state.dirty = true; renderCart(); }
      else if (action === "remove") { rememberCart(); state.cart.splice(Number(b.dataset.index), 1); state.dirty = true; renderCart(); }
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
    section.innerHTML = "<h3>Recycle+決済・手数料</h3><p><strong>売上先：ブロードリーフ</strong> ／ 外部注文番号 " + e(r.external_order_number) + "</p><div class='recycle-summary'><span>手数料率 " + e(r.policy_snapshot.fee_rate_percent) + "%" + (r.policy_snapshot.provisional ? "（暫定）" : "") + "</span><span>見込手数料 " + e(yen(r.estimated_fee_jpy)) + "</span><span>確定手数料 " + e(yen(r.actual_fee_jpy)) + "</span><span>差引受取 " + e(yen(r.actual_receipt_jpy == null ? r.estimated_receipt_jpy : r.actual_receipt_jpy)) + "</span></div><p>" + e(r.policy_snapshot.note) + "</p><p>" + e(r.payment_status === "confirmed" ? "決済確認済み。既存の出荷工程へ進めます。" : r.payment_status === "unconfirmed" ? "決済確認待ち。出荷指示・送り状発行・出荷確定はできません。" : r.payment_status === "refunded" ? "返金確認済み" : "取消済み・返金確認待ち") + "</p>" +
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
  function configureEntryButton() { var b = document.getElementById("sales-order-recycle-open"); if (b) { b.hidden = !allowed(); b.onclick = open; } }
  window.DcatsRecycleOrders = Object.freeze({ open: open, mountDetail: mountDetail, configureEntryButton: configureEntryButton, isBusy: function () { return ownerCurrent() && (state.busy || !!state.pending || state.dirty || state.detailDirty); }, csvCell: csvCell });
}());
