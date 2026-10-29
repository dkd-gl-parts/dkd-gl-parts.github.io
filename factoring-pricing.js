/* Factoring prices: exact rational arithmetic and independently saved calculation settings. */
(function (root) {
  "use strict";
  var CODE = "RECYCLE_FACTORING";
  var keys = ["tax_rate_percent", "factoring_rate_percent", "sales_fee_rate_percent", "shipping_allocation_rate_percent", "rounding_unit_jpy"];
  function rate(value, maximum) {
    var text = String(value == null ? "" : value).trim();
    if (!/^\d+(\.\d{1,4})?$/.test(text) || Number(text) > maximum) throw new Error("率は0以上、小数点以下4桁までで入力してください。");
    var parts = text.split(".");
    return BigInt(parts[0]) * 10000n + BigInt((parts[1] || "").padEnd(4, "0"));
  }
  function normalize(settings) {
    if (!settings) throw new Error("計算条件を読み込んでください。");
    var values = [rate(settings.tax_rate_percent, 99.9999), rate(settings.factoring_rate_percent, 99.9999),
      rate(settings.sales_fee_rate_percent, 99.9999), rate(settings.shipping_allocation_rate_percent, 100)];
    var unit = Number(settings.rounding_unit_jpy);
    if (![1, 10, 100, 1000].includes(unit)) throw new Error("切上げ単位を選択してください。");
    if (1000000000000n - values[1] * (1000000n + values[0]) - values[2] * 1000000n <= 0n) throw new Error("手数料率が高すぎるため販売価格を計算できません。");
    var result = {};
    keys.slice(0, 4).forEach(function (key, index) { result[key] = Number(values[index]) / 10000; });
    result.rounding_unit_jpy = unit;
    return result;
  }
  function calculate(base, settings) {
    var s = normalize(settings);
    if (base == null || String(base).trim() === "" || Number(base) === 0) return null;
    if (!/^\d+$/.test(String(base)) || !Number.isSafeInteger(Number(base)) || Number(base) < 1 || Number(base) > 2147483647) throw new Error("売値区分1は1円以上の整数で入力してください。");
    var scale = 1000000n, t = rate(s.tax_rate_percent, 99.9999), f = rate(s.factoring_rate_percent, 99.9999),
      fee = rate(s.sales_fee_rate_percent, 99.9999), allocation = rate(s.shipping_allocation_rate_percent, 100), unit = BigInt(s.rounding_unit_jpy);
    var numerator = BigInt(base) * (scale + allocation) * scale;
    var tradeDenominator = scale * scale - f * (scale + t), marketDenominator = tradeDenominator - fee * scale;
    function rounded(denominator) {
      var divisor = denominator * unit, result = (numerator / divisor + (numerator % divisor ? 1n : 0n)) * unit;
      if (result > 2147483647n) throw new Error("計算後の販売価格が上限を超えています。");
      return Number(result);
    }
    var trade = rounded(tradeDenominator), market = rounded(marketDenominator);
    return { trade_price_jpy: trade, marketplace_price_jpy: market, sales_price_jpy: Math.max(trade, market) };
  }
  function createController(options) {
    var doc = options.document, state = { epoch: 0, owner: "", settings: null, busy: false, pending: null, dirty: false, retry: false };
    function el(id) { return doc.getElementById("factoring-" + id); }
    function current(epoch, owner) { return epoch === state.epoch && owner === state.owner && owner === options.owner() && options.allowed(); }
    function message(text) { if (el("status")) el("status").textContent = text; }
    function persist() {
      if (!options.storage || !state.owner) return;
      var key = "dcats.factoring.pending." + state.owner;
      try { if (state.pending) options.storage.setItem(key, JSON.stringify(state.pending)); else options.storage.removeItem(key); }
      catch (_) { /* Keep the operation in memory if browser storage is unavailable. */ }
    }
    function restore() {
      try {
        var raw = options.storage && options.storage.getItem("dcats.factoring.pending." + state.owner), p = raw ? JSON.parse(raw) : null;
        if (p && p.owner === state.owner && /^[0-9a-f-]{36}$/i.test(p.request_id) && Number.isSafeInteger(p.expected_revision) && p.expected_revision > 0) {
          normalize(p.settings); return p;
        }
      } catch (_) { /* Ignore malformed storage; never execute it. */ }
      return null;
    }
    function controls() {
      var editable = options.editable() && state.owner === options.owner() && options.allowed();
      keys.forEach(function (key) { if (el(key)) el(key).disabled = !editable || !state.settings || state.busy || !!state.pending; });
      if (el("save")) { el("save").hidden = !editable; el("save").disabled = !state.settings || state.busy || !!state.pending || !state.dirty; }
      if (el("reload")) el("reload").disabled = state.busy || !!state.pending;
      if (el("receipt")) { el("receipt").hidden = !state.pending; el("receipt").disabled = state.busy || !editable; }
      if (el("retry")) { el("retry").hidden = !state.pending || !state.retry; el("retry").disabled = state.busy || !editable; }
    }
    function fields(settings) { keys.forEach(function (key) { if (el(key)) el(key).value = settings ? settings[key] : ""; }); }
    function readFields() {
      var data = {};
      keys.forEach(function (key) { data[key] = el(key) ? el(key).value : null; });
      return normalize(data);
    }
    function preview(base) {
      if (!state.settings || !current(state.epoch, state.owner)) return null;
      try { return calculate(base, readFields()); } catch (_) { return null; }
    }
    function syncPreview() {
      var result = preview(options.base());
      if (el("breakdown")) el("breakdown").textContent = result
        ? "業販 " + options.yen(result.trade_price_jpy) + " ／ モール " + options.yen(result.marketplace_price_jpy) + " → 共通単価 " + options.yen(result.sales_price_jpy) + (state.dirty ? "（未保存の試算）" : "")
        : "売値区分1と有効な計算条件がそろうと、共通単価を表示します。";
    }
    function refresh() {
      syncPreview(); controls(); options.changed();
    }
    function finish(epoch, owner) {
      if (epoch !== state.epoch || owner !== state.owner) return;
      if (!current(epoch, owner)) { invalidate(); return; }
      state.busy = false; refresh();
    }
    function accept(settings) {
      normalize(settings);
      if (!Number.isSafeInteger(Number(settings.revision)) || Number(settings.revision) < 1) throw new Error("計算条件の保存結果を確認できません。");
      state.settings = settings; state.dirty = false; state.pending = null; state.retry = false; persist(); fields(settings);
      message("計算条件を保存しました。新しく参照する価格に反映されます。"); refresh();
    }
    async function load() {
      if (!options.allowed() || state.busy || state.pending) return;
      if (state.dirty && !options.confirm("未保存の計算条件を破棄して再読込しますか。")) return;
      var epoch = state.epoch, owner = state.owner;
      state.busy = true; state.settings = null; state.dirty = false; fields(null); message("計算条件を読み込んでいます。"); refresh();
      try {
        var settings = await options.rpc("get", {});
        if (!current(epoch, owner)) return;
        normalize(settings); state.settings = settings; fields(settings);
        message("保存すると全商品のファクタリング価格に反映します。登録済み伝票の単価は維持します。");
      } catch (error) { if (current(epoch, owner)) message("計算条件を取得できませんでした。「再読込」で確認してください。 " + (error.message || "")); }
      finally { finish(epoch, owner); }
    }
    async function sendPending() {
      if (state.busy || !state.pending || !options.editable() || !current(state.epoch, state.owner)) return;
      var epoch = state.epoch, owner = state.owner, pending = state.pending;
      state.busy = true; state.retry = false; message("計算条件を保存しています。"); controls();
      try {
        var result = await options.rpc("save", { request_id: pending.request_id, expected_revision: pending.expected_revision, settings: pending.settings });
        if (current(epoch, owner)) accept(result);
      } catch (error) {
        if (!current(epoch, owner)) return;
        if (["22023", "22003", "23514", "40001", "42501", "PGRST202"].includes(error.code)) {
          state.pending = null; persist(); message(error.message || "保存できませんでした。再読込して確認してください。");
        } else message("保存結果がまだ確認できません。「保存結果を確認」で確認してください。");
      } finally { finish(epoch, owner); }
    }
    async function save() {
      if (!state.dirty || !state.settings || state.busy || state.pending || !options.editable() || !current(state.epoch, state.owner)) return;
      try {
        var settings = readFields();
        calculate(options.base(), settings);
        state.pending = { owner: state.owner, request_id: options.uuid(), expected_revision: Number(state.settings.revision), settings: settings };
        persist(); await sendPending();
      } catch (error) { message(error.message); controls(); }
    }
    async function receipt() {
      if (!state.pending || state.busy || !options.editable() || !current(state.epoch, state.owner)) return;
      var epoch = state.epoch, owner = state.owner, pending = state.pending;
      state.busy = true; controls();
      try {
        var result = await options.rpc("receipt", { request_id: pending.request_id });
        if (!current(epoch, owner)) return;
        if (result.saved) accept(result.settings);
        else { state.retry = true; message("保存済みの記録は確認できません。同じ内容で再試行するか、時間をおいて結果を確認してください。"); }
      } catch (error) { if (current(epoch, owner)) message("保存結果を確認できませんでした。時間をおいて再確認してください。"); }
      finally { finish(epoch, owner); }
    }
    function mount() {
      if (!el("pricing-panel") || el("pricing-panel").dataset.bound) return;
      el("pricing-panel").dataset.bound = "true";
      el("pricing-panel").addEventListener("input", function (event) {
        if (!event.target.matches("[data-factoring-input]") || state.busy || state.pending || !options.editable() || !current(state.epoch, state.owner)) return;
        state.dirty = true;
        try { readFields(); message("計算条件は未保存です。「計算条件を保存」で反映します。"); }
        catch (error) { message(error.message); }
        refresh();
      });
      el("save").addEventListener("click", save); el("reload").addEventListener("click", load);
      el("receipt").addEventListener("click", receipt);
      el("retry").addEventListener("click", function () { if (state.retry) sendPending(); });
    }
    async function open() {
      if (!options.allowed()) { invalidate(); return; }
      if (state.owner === options.owner() && (state.busy || state.pending)) { if (el("pricing-panel")) el("pricing-panel").hidden = false; return; }
      state.epoch++; state.owner = options.owner(); state.settings = null; state.dirty = false; state.busy = false; state.retry = false;
      state.pending = restore(); mount();
      if (el("pricing-panel")) el("pricing-panel").hidden = false;
      if (state.pending) {
        fields(state.pending.settings); message("前回の保存結果を確認してください。"); refresh(); await receipt();
      } else await load();
    }
    function close() {
      if (current(state.epoch, state.owner) && options.editable() && (state.busy || state.pending)) { message("計算条件の処理結果を確認してから閉じてください。"); return false; }
      if (state.dirty && !options.confirm("未保存の計算条件を破棄して閉じますか。")) return false;
      invalidate(); return true;
    }
    function invalidate() {
      state.epoch++; state.settings = null; state.owner = ""; state.busy = false; state.pending = null; state.dirty = false; state.retry = false;
      fields(null); if (el("pricing-panel")) el("pricing-panel").hidden = true; message("");
      options.changed();
    }
    return Object.freeze({ open: open, close: close, invalidate: invalidate, load: load, save: save, receipt: receipt, refresh: refresh, syncPreview: syncPreview, preview: preview,
      isBusy: function () { return current(state.epoch, state.owner) && (state.busy || !!state.pending || state.dirty); } });
  }
  var ui = null, authGeneration = 0, authBound = false;
  function controller() {
    if (!ui) ui = createController({
      document: root.document, storage: root.sessionStorage,
      owner: function () { return typeof currentUser !== "undefined" && currentUser ? currentUser.id : ""; },
      allowed: function () {
        var overlay = root.document.getElementById("sales-pricing-overlay");
        return !!overlay && overlay.classList.contains("show") && typeof canViewSalesPricing === "function" && canViewSalesPricing();
      },
      editable: function () { return typeof canManageSalesPricing === "function" && canManageSalesPricing(); },
      base: function () { var input = root.document.getElementById("sales-base-price"); return input ? input.value : ""; },
      changed: function () { if (typeof renderSalesRankPreview === "function") renderSalesRankPreview(); },
      yen: function (n) { return "¥" + n.toLocaleString("ja-JP"); },
      uuid: function () { return root.crypto.randomUUID(); }, confirm: function (text) { return root.confirm(text); },
      rpc: async function (action, payload) { var response = await sb.rpc("factoring_pricing", { action: action, payload: payload }); if (response.error) throw response.error; return response.data; }
    });
    if (!authBound && typeof sb !== "undefined" && sb.auth && sb.auth.onAuthStateChange) {
      authBound = true;
      sb.auth.onAuthStateChange(function (event) {
        if (["SIGNED_OUT", "SIGNED_IN", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) { authGeneration++; ui.invalidate(); }
      });
    }
    return ui;
  }
  async function prices(ids) {
    if (typeof currentUser === "undefined" || !currentUser || typeof canSeeSalesPrice !== "function" || !canSeeSalesPrice()
      || (typeof isCustomerViewer === "function" && isCustomerViewer())) throw new Error("販売価格を参照する権限がありません。");
    controller();
    var owner = currentUser.id, generation = authGeneration, map = {};
    var list = ids === null ? null : Array.from(new Set((ids || []).map(Number).filter(Number.isSafeInteger)));
    var groups = list === null ? [null] : [];
    if (list) for (var offset = 0; offset < list.length; offset += 500) groups.push(list.slice(offset, offset + 500));
    for (var group of groups) {
      var response = await sb.rpc("get_factoring_product_prices", { target_ids: group });
      if (response.error) throw response.error;
      if (generation !== authGeneration || !currentUser || currentUser.id !== owner || !canSeeSalesPrice() || isCustomerViewer()) throw new Error("ログイン状態が変わりました。再読込してください。");
      (response.data || []).forEach(function (row) {
        var value = Number(row.price_jpy);
        if (Number.isSafeInteger(value) && value > 0) map[String(row.dkd_shohin_id) + "|" + row.product_kind] = value;
      });
    }
    return map;
  }
  root.DcatsFactoringPricing = Object.freeze({ code: CODE, normalize: normalize, calculate: calculate, createController: createController, prices: prices,
    open: function () { return controller().open(); }, close: function () { return !ui || ui.close(); },
    preview: function (base) { return ui ? ui.preview(base) : null; },
    refresh: function () { if (ui) ui.refresh(); }, syncPreview: function () { if (ui) ui.syncPreview(); }, isBusy: function () { return !!ui && ui.isBusy(); },
    invalidate: function () { authGeneration++; if (ui) ui.invalidate(); } });
})(window);
