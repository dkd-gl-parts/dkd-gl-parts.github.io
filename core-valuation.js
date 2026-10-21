(function(root) {
  "use strict";
  var active = null;
  var pending = new Map();
  function escape(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function number(value, maximum, decimals, positive, integerDigits, trimSpaces) {
    var text = String(value == null ? "" : value);
    if (trimSpaces) text = text.replace(/^ +| +$/g, "");
    if (!new RegExp("^[0-9]{1," + (integerDigits || (decimals ? 4 : 8)) + "}" + (decimals ? "(\\.[0-9]{1," + decimals + "})?" : "") + "$").test(text)) return null;
    var n = Number(text);
    return Number.isFinite(n) && n <= maximum && (positive ? n > 0 : n >= 0) ? n : null;
  }
  function yen(value) { return value == null ? "未算定" : "¥" + Number(value).toLocaleString("ja-JP"); }
  function resolveVariant(selectedId, rows) {
    if (selectedId != null) return { variantId: selectedId, needsSelection: false };
    var ids = Array.from(new Set((rows || []).map(function(row) { return Number(row.product_variant_id); }).filter(function(id) { return Number.isSafeInteger(id) && id > 0; })));
    return { variantId: ids.length === 1 ? ids[0] : null, needsSelection: ids.length > 1 };
  }
  function draft(data) {
    var stored = data.settings || {};
    var bases = stored.component_bases || {};
    var previous = (data.saved && data.saved.components) || [];
    var current = {};
    (data.context.components || []).filter(function(c) { return !!c.part_kind; }).forEach(function(c) {
      var old = previous.find(function(p) { return String(p.id) === String(c.id); });
      var identityFields = ["component_id", "part_kind", "component_position", "manufacturer", "manufacturer_part_number", "genuine_part_number"];
      var changed = data.stale && (!old || identityFields.some(function(k) { return old[k] !== c[k]; }));
      current[c.id] = changed || bases[c.id] == null || bases[c.id] === "" ? null : bases[c.id];
    });
    return { net_weight_kg: stored.net_weight_kg == null ? "" : stored.net_weight_kg,
      weight_source: stored.weight_source || "", component_bases: current };
  }
  function preview(context, settings) {
    var weight = number(settings.net_weight_kg, 1000, 3, true, 4, false);
    return {
      body_appraisal_jpy: weight == null ? null : Math.floor((Math.round(weight * 1000) * 360 + 500) / 1000),
      components: (context.components || []).filter(function(c) { return !!c.part_kind; }).map(function(c) {
        var base = number((settings.component_bases || {})[c.id], 10000000, 0, false);
        var qty = number(c.quantity, 1000, 3, true, 4, true);
        var rate = number(c.replacement_rate, 100, 0, false, 3, false);
        return Object.assign({}, c, { base_jpy: base, recovery_rate: rate == null ? null : 100 - rate,
          appraisal_jpy: base == null || qty == null || rate == null ? null : Math.floor((base * Math.round(qty * 1000) * (100 - rate) + 50000) / 100000) });
      })
    };
  }
  function valid(instance) { return active === instance && instance.options.isCurrent(); }
  function canEdit(instance) {
    return instance.data && instance.data.can_edit && instance.options.canEdit &&
      (!instance.options.canEditNow || instance.options.canEditNow());
  }
  function clearPending(scope, operationId) {
    var operation = pending.get(scope);
    if (!operation || operation.operation_id !== operationId) return false;
    pending.delete(scope);
    return true;
  }
  function message(instance, text, error) {
    if (!valid(instance)) return;
    var el = instance.host.querySelector("[data-core-message]");
    if (el) { el.textContent = text; el.className = error ? "core-valuation-error" : "core-valuation-message"; }
  }
  async function rpc(instance, action, payload) {
    var result = await instance.options.rpc("manage_core_valuation", {
      action: action, target_dkd_shohin_id: instance.options.productId,
      target_product_variant_id: instance.options.variantId, payload: payload || {}
    });
    if (!result || result.error || !result.data) throw (result && result.error) || new Error("CORE_NO_RESPONSE");
    return result.data;
  }
  function errorText(error) {
    var text = String(error && error.message || error || "");
    if (/CORE_CONTEXT_CHANGED|40001/.test(text)) return "構成部品または評価条件が変更されています。最新の内容を確認してください。";
    if (/42501|CORE_ACCESS_DENIED|permission denied/i.test(text)) return "評価情報を操作する権限がありません。";
    if (/CORE_VARIANT_MISMATCH|CORE_PRODUCT_MISSING/.test(text)) return "商品または在庫区分が変更されています。画面を開き直してください。";
    return "評価情報を取得できませんでした。接続を確認して再読込してください。";
  }
  function updatePreview(instance) {
    if (!valid(instance) || !instance.data) return;
    var result = preview(instance.data.context, instance.settings);
    instance.host.querySelector("[data-core-body-value]").textContent = yen(result.body_appraisal_jpy);
    result.components.forEach(function(c) {
      var el = instance.host.querySelector('[data-core-part-value="' + c.id + '"]');
      if (el) el.textContent = yen(c.appraisal_jpy);
    });
    var save = instance.host.querySelector("[data-core-save]");
    if (save) save.disabled = !canEdit(instance) || !!pending.get(instance.scope) ||
      result.body_appraisal_jpy == null || !String(instance.settings.weight_source || "").trim();
  }
  function render(instance) {
    if (!valid(instance)) return;
    var data = instance.data, settings = instance.settings, values = preview(data.context, settings);
    var editable = canEdit(instance) && !pending.get(instance.scope);
    instance.renderedCanEdit = !!canEdit(instance);
    var disabled = editable ? "" : " disabled";
    var html = '<div class="core-valuation-content"><div data-core-message role="status" aria-live="polite"></div>';
    if (data.context.variant) html += '<div class="core-valuation-context-label">対象在庫: ' + escape(data.context.variant.display_label || "区分標準") + '</div>';
    html += '<div class="core-valuation-body-fields">' +
      '<label>正味CORE重量 (kg)<input data-core-weight type="number" min="0.001" max="1000" step="0.001" value="' + escape(settings.net_weight_kg) + '"' + disabled + '></label>' +
      '<div><span>基準重量単価</span><strong>¥360 / kg</strong></div>' +
      '<div><span>CORE本体評価額</span><strong data-core-body-value>' + yen(values.body_appraisal_jpy) + '</strong></div>' +
      '<label class="core-valuation-source">重量の確認元<input data-core-source maxlength="500" value="' + escape(settings.weight_source) + '"' + disabled + '></label></div>';
    html += '<h4>部品別評価</h4><table class="core-valuation-table"><thead><tr><th>部品・使用位置</th><th>評価基準単価</th><th>数量</th><th>交換率</th><th>良品回収率</th><th>部品評価額</th></tr></thead><tbody>';
    values.components.forEach(function(c) {
      html += '<tr><th scope="row">' + escape(c.name) + '<small>' + escape(c.component_position || "位置指定なし") + '</small></th>' +
        '<td data-label="評価基準単価"><input aria-label="' + escape(c.name + ' 評価基準単価') + '" data-core-base="' + c.id + '" type="number" min="0" max="10000000" step="1" value="' + escape(settings.component_bases[c.id]) + '"' + disabled + '></td>' +
        '<td data-label="数量">' + escape(c.quantity == null ? "未設定" : c.quantity) + '</td>' +
        '<td data-label="交換率">' + escape(c.replacement_rate == null ? "未設定" : c.replacement_rate + "%") + '</td>' +
        '<td data-label="良品回収率">' + (c.recovery_rate == null ? "未設定" : c.recovery_rate + "%") + '</td>' +
        '<td data-label="部品評価額" data-core-part-value="' + c.id + '">' + yen(c.appraisal_jpy) + '</td></tr>';
    });
    if (!values.components.length) html += '<tr><td colspan="6">対象の4部品は未登録です。</td></tr>';
    html += '</tbody></table><div class="core-valuation-actions">';
    html += '<button type="button" data-core-reload>最新の内容を確認</button>';
    if (canEdit(instance)) html += pending.get(instance.scope) ?
      '<button type="button" data-core-status>保存結果を確認</button>' : '<button type="button" data-core-save>評価を保存</button>';
    html += '</div><details class="core-valuation-history"><summary>評価履歴 (' + data.history.length + ')</summary>';
    data.history.forEach(function(h) {
      html += '<details><summary>' + escape(new Date(h.saved_at).toLocaleString("ja-JP")) + ' / ' + escape(h.net_weight_kg) + ' kg / ' + yen(h.body_appraisal_jpy) + '</summary>';
      (h.components || []).forEach(function(c) { html += '<div>' + escape(c.name) + ' / ' + escape(c.component_position || "位置指定なし") + ' : ' + yen(c.appraisal_jpy) + '</div>'; });
      html += '</details>';
    });
    html += '</details></div>';
    instance.content.innerHTML = html;
    instance.host.querySelector("[data-core-weight]").addEventListener("input", function(event) { instance.settings.net_weight_kg = event.target.value; updatePreview(instance); });
    instance.host.querySelector("[data-core-source]").addEventListener("input", function(event) { instance.settings.weight_source = event.target.value; updatePreview(instance); });
    instance.host.querySelectorAll("[data-core-base]").forEach(function(input) {
      input.addEventListener("input", function() { instance.settings.component_bases[input.dataset.coreBase] = input.value === "" ? null : input.value; updatePreview(instance); });
    });
    instance.host.querySelector("[data-core-reload]").addEventListener("click", function() { load(instance); });
    var save = instance.host.querySelector("[data-core-save]");
    if (save) save.addEventListener("click", function() { saveValue(instance); });
    var status = instance.host.querySelector("[data-core-status]");
    if (status) status.addEventListener("click", function() { checkStatus(instance); });
    updatePreview(instance);
    if (pending.get(instance.scope)) message(instance, "保存結果が未確認です。再保存せず、結果を確認してください。", true);
    else if (data.stale) message(instance, "保存後に構成部品または条件が変更されています。現在の条件で再確認してください。", true);
    else if (data.saved) message(instance, "保存済み: " + yen(data.saved.body_appraisal_jpy) + " / " + new Date(data.saved.saved_at).toLocaleString("ja-JP"));
  }
  async function load(instance) {
    if (!valid(instance) || instance.busy) return;
    if (instance.options.needsSelection) {
      instance.content.innerHTML = '<div role="status" class="core-valuation-message">評価する対象在庫を選択してください。</div>';
      return;
    }
    instance.busy = true;
    instance.content.innerHTML = '<div role="status">評価情報を取得中...</div>';
    try {
      var data = await rpc(instance, "get");
      if (!valid(instance)) return;
      if (!data.context || !Array.isArray(data.context.components) || !Array.isArray(data.history)) throw new Error("CORE_INVALID_RESPONSE");
      instance.data = data;
      instance.settings = draft(data);
      render(instance);
    } catch (error) {
      if (!valid(instance)) return;
      instance.content.innerHTML = '<div role="alert" class="core-valuation-error">' + escape(errorText(error)) + '</div><button type="button" data-core-retry>再読込</button>';
      instance.host.querySelector("[data-core-retry]").addEventListener("click", function() { load(instance); });
    } finally { instance.busy = false; }
  }
  async function checkStatus(instance) {
    if (!valid(instance) || instance.busy) return;
    var operation = pending.get(instance.scope);
    if (!operation) return;
    instance.busy = true;
    message(instance, "保存結果を確認中...");
    try {
      var result = await rpc(instance, "status", { operation_id: operation.operation_id });
      if (result.state === "saved") {
        clearPending(instance.scope, operation.operation_id);
        instance.busy = false;
        if (valid(instance)) await load(instance);
      } else if (result.state === "not_found") {
        clearPending(instance.scope, operation.operation_id);
        if (valid(instance)) {
          render(instance);
          message(instance, "未保存であることを確認しました。入力内容を確認して保存してください。", true);
        }
      } else if (valid(instance)) message(instance, "保存完了は確認できませんでした。再送は行っていません。時間をおいて結果を確認してください。", true);
    } catch (error) { message(instance, errorText(error), true); }
    finally { instance.busy = false; }
  }
  async function saveValue(instance) {
    if (!valid(instance) || instance.busy || pending.get(instance.scope)) return;
    if (!canEdit(instance)) {
      render(instance);
      message(instance, "評価情報を編集する権限がありません。", true);
      return;
    }
    var settings = JSON.parse(JSON.stringify(instance.settings));
    var result = preview(instance.data.context, settings);
    var invalidBase = Object.keys(settings.component_bases).some(function(id) {
      var v = settings.component_bases[id];
      return v !== null && v !== "" && number(v, 10000000, 0, false) == null;
    });
    if (result.body_appraisal_jpy == null || !String(settings.weight_source || "").trim() || invalidBase) {
      message(instance, "正味重量・確認元・評価基準単価の入力を確認してください。", true); return;
    }
    var payload = { operation_id: root.crypto.randomUUID(), expected_revision: instance.data.revision,
      dependency_hash: instance.data.context.dependency_hash, settings: settings };
    pending.set(instance.scope, payload);
    instance.busy = true;
    render(instance);
    message(instance, "評価を保存中...");
    try {
      var response = await rpc(instance, "save", payload);
      if (response.state !== "saved") throw new Error("CORE_UNKNOWN_RESULT");
      clearPending(instance.scope, payload.operation_id);
      instance.busy = false;
      if (valid(instance)) await load(instance);
    } catch (error) {
      // An explicit database rejection rolled back; transport failures need a status lookup.
      if (error && /^(22023|22P02|40001|42501)$/.test(error.code || "")) clearPending(instance.scope, payload.operation_id);
      if (valid(instance)) {
        render(instance);
        message(instance, pending.get(instance.scope) ? "保存結果が未確認です。再保存せず、結果を確認してください。" : errorText(error), true);
      }
    } finally { instance.busy = false; }
  }
  function mount(host, options) {
    if (!host) return;
    var scope = JSON.stringify([options.ownerId, options.productId, options.variantId]);
    var key = scope + ":" + options.generation + ":" + !!options.needsSelection;
    if (!options.allowed) { active = null; host.replaceChildren(); host.hidden = true; return; }
    if (active && active.key === key && active.host === host) {
      active.options = options;
      if (active.data && active.renderedCanEdit !== !!canEdit(active)) render(active);
      return;
    }
    host.hidden = false;
    host.innerHTML = '<details class="core-valuation"><summary>CORE評価</summary><div data-core-content></div></details>';
    var instance = { host: host, options: options, key: key, scope: scope, busy: false,
      content: host.querySelector("[data-core-content]"), data: null };
    active = instance;
    host.querySelector("details").addEventListener("toggle", function(event) {
      if (event.target.open && !instance.data) load(instance);
    });
  }
  root.DcatsCoreValuation = Object.freeze({ mount: mount, preview: preview, number: number, draft: draft, resolveVariant: resolveVariant });
})(typeof window === "undefined" ? globalThis : window);
