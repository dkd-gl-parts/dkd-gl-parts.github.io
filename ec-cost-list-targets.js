(function(root) {
  "use strict";
  var messages = {
    title: ["原価計算リストから追加", "Add from a saved cost list", "从成本清单添加"],
    help: ["保存済みリストを選ぶと、現在の商品マスターで追加内容を確認します。", "Choose a saved list to check its items against the current product master.", "选择已保存清单，按当前商品主数据核对添加内容。"],
    rules: ["重複品番・削除済み対象は追加しません。同じ純正品番でもメーカー品番が異なる商品は区別します。原価・数量・在庫・既存の調査条件や履歴は変更しません。", "Duplicate numbers and removed targets are excluded. Different manufacturer numbers remain distinct even when they share an OEM number. Costs, quantities, stock, existing research settings and history are preserved.", "不添加重复品号或已删除的对象。即使原厂品号相同，制造商品号不同的商品仍分别处理。成本、数量、库存及现有调查条件和历史保持不变。"],
    choose: ["保存済みリストを選択", "Choose a saved list", "选择已保存清单"],
    empty: ["利用できる保存済みリストがありません。", "No saved lists are available.", "没有可用的已保存清单。"],
    loading: ["追加内容を確認しています…", "Checking items…", "正在核对添加内容…"],
    lists_loading: ["保存済みリストを読み込んでいます…", "Loading saved lists…", "正在读取已保存清单…"],
    load_error: ["読み込めませんでした。再確認してください。", "Could not load the list. Check again.", "读取失败，请重新核对。"],
    permission: ["原価計算の閲覧権限と価格調査の編集権限が必要です。", "Cost-list access and price-research editing permission are required.", "需要成本清单查看权限和价格调查编辑权限。"],
    stale: ["リスト・商品・調査対象または調査条件が変わりました。追加内容を再確認してください。", "The list, products, targets or settings changed. Check the items again.", "清单、商品、调查对象或条件已更改，请重新核对。"],
    unknown: ["追加結果を確認できません。自動再送はしません。再確認して、保存済み対象と照合してください。", "The result could not be confirmed. The request will not be retried automatically. Check again against saved targets.", "无法确认添加结果，不会自动重发。请重新核对已保存对象。"],
    added: ["調査対象に {n} 件追加しました。", "Added {n} research targets.", "已添加 {n} 个调查对象。"],
    add: ["追加予定", "To add", "待添加"], duplicate: ["重複・追加なし", "Duplicate / excluded", "重复／不添加"],
    review: ["要確認・追加なし", "Needs review / excluded", "需确认／不添加"],
    confirm: ["新規対象 {n} 件を追加", "Add {n} new targets", "添加 {n} 个新对象"],
    cancel: ["閉じる", "Close", "关闭"], recheck: ["再確認", "Check again", "重新核对"],
    number: ["検索する品番", "Research number", "调查品号"], source: ["元の取込品番", "Original import number", "原始导入品号"],
    status: ["判定", "Decision", "判定"], reason: ["理由", "Reason", "原因"],
    new: ["新規追加", "New target", "新对象"],
    existing_target: ["同じ商品IDが登録済み", "Product ID already saved", "商品ID已存在"],
    existing_number: ["同じ品番が登録済み", "Part number already saved", "品号已存在"],
    list_duplicate: ["リスト内で重複", "Repeated in this list", "清单内重复"],
    disabled_target: ["削除済み対象（自動復活しません）", "Removed target (kept removed)", "已删除对象（不自动恢复）"],
    missing_master: ["商品マスターを確認できません", "Product master unavailable", "无法确认商品主数据"],
    unconfirmed_master: ["商品マスターが確認待ち", "Product master awaiting confirmation", "商品主数据待确认"],
    missing_number: ["検索できる品番がありません", "No usable research number", "没有可用的调查品号"],
    missing_category: ["カテゴリが未設定", "Category missing", "类别未设置"],
    number_collision: ["同品番でメーカー・カテゴリの確認が必要", "Same number needs manufacturer/category review", "相同品号需确认制造商和类别"],
    pending: ["保存していない調査対象があります。調査条件を保存してから追加してください。", "There are unsaved targets. Save research settings before adding this list.", "存在未保存的调查对象，请先保存调查条件。"],
    saving: ["新しい調査対象を追加しています…", "Adding new targets…", "正在添加新调查对象…"]
  };
  Object.keys(messages).forEach(function(key) {
    ["ja", "en", "zh"].forEach(function(lang, i) {
      if (root.TRANSLATIONS && root.TRANSLATIONS[lang]) root.TRANSLATIONS[lang]["ec_cost_" + key] = messages[key][i];
    });
  });
  var state = { seq: 0, busy: false, committing: false, preview: null, context: "", userId: "", opener: null };
  function el(id) { return document.getElementById("ec-cost-" + id); }
  function label(key, values) {
    var lang = root.currentLang === "zh" ? 2 : root.currentLang === "ja" ? 0 : 1;
    var text = (messages[key] || messages.load_error)[lang];
    Object.keys(values || {}).forEach(function(name) { text = text.replace("{" + name + "}", String(values[name])); });
    return text;
  }
  function escape(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function(c) { return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; }); }
  function allowed() { return !!(root.currentUser && root.canUseRakutenResearch() && root.canViewManufacturingCostMgmt()); }
  function context() {
    return JSON.stringify([root.currentUser && root.currentUser.id, el("list").value,
      root.getEcMallSelectedProviders().slice().sort(), root.getEcMallSellerIds().slice().sort(), root.getEcMallIncludeUsed(),
      (root.rakutenTargets || []).map(function(t) { return [t.id, t.target_key, t.search_number]; })]);
  }
  function status(key, error, values) {
    el("status").textContent = key ? label(key, values) : "";
    el("status").classList.toggle("is-error", !!error);
  }
  function controls() {
    el("list").disabled = state.busy;
    el("recheck").disabled = state.busy;
    el("close").disabled = state.committing;
    el("add").disabled = state.busy || !state.preview || !state.preview.counts.add || !allowed();
    el("add").textContent = label("confirm", { n: state.preview ? state.preview.counts.add : 0 });
    el("dialog").setAttribute("aria-busy", String(state.busy));
  }
  function render() {
    var p = state.preview;
    el("summary").innerHTML = p ? ["add", "duplicate", "review"].map(function(key) {
      return "<div class='ec-cost-stat'><strong>" + escape(p.counts[key]) + "</strong><span>" + escape(label(key)) + "</span></div>";
    }).join("") : "";
    el("results").innerHTML = p && p.rows.length ? "<table><thead><tr><th>" + escape(label("number")) + "</th><th>" + escape(label("source")) + "</th><th>" + escape(label("status")) + "</th><th>" + escape(label("reason")) + "</th></tr></thead><tbody>" + p.rows.map(function(row) {
      return "<tr><td data-label='" + escape(label("number")) + "'><strong>" + escape(row.search_number || row.manufacturer_part_number || "—") + "</strong><small>DKD " + escape(row.dkd_shohin_id) + " · " + escape(row.manufacturer) + " · " + escape(row.category) + "</small></td><td data-label='" + escape(label("source")) + "'>" + escape((row.import_part_numbers || []).join(" / ") || "—") + "</td><td data-label='" + escape(label("status")) + "' class='ec-cost-" + escape(row.status) + "'>" + escape(label(row.status)) + "</td><td data-label='" + escape(label("reason")) + "'>" + escape(label(row.reason)) + "</td></tr>";
    }).join("") + "</tbody></table>" : "";
    controls();
  }
  function clearPreview() { state.preview = null; state.context = ""; render(); }
  function args(commit) {
    return { p_list_id: Number(el("list").value), p_provider_keys: root.getEcMallSelectedProviders(),
      p_seller_ids: root.getEcMallSellerIds(), p_include_used: root.getEcMallIncludeUsed(),
      p_commit: commit, p_expected_token: commit ? state.preview.token : null };
  }
  async function preview() {
    if (state.busy || !allowed()) { if (!allowed()) { clearPreview(); status("permission", true); } return; }
    clearPreview();
    if (!el("list").value) { status("", false); return; }
    var seq = ++state.seq, snapshot = context();
    state.busy = true; status("loading", false); controls();
    try {
      var result = await root.sb.rpc("import_ec_targets_from_cost_list", args(false));
      if (seq !== state.seq || !el("dialog").open) return;
      if (!allowed() || context() !== snapshot) { status("stale", true); return; }
      if (result.error) throw result.error;
      if (!result.data || !result.data.counts || !Array.isArray(result.data.rows) || !result.data.token) throw Error("Invalid preview");
      state.preview = result.data; state.context = snapshot; status("", false);
    } catch (error) {
      if (seq === state.seq) status(error.code === "42501" ? "permission" : "load_error", true);
    } finally { if (seq === state.seq) { state.busy = false; render(); } }
  }
  async function open() {
    if (!allowed() || state.busy || root.rakutenApiBusy) return;
    if ((root.rakutenTargets || []).some(function(t) { return !t.id; })) { root.setRakutenStatus(label("pending"), true); return; }
    var dialog = el("dialog");
    if (!dialog || typeof dialog.showModal !== "function") { root.setRakutenStatus(label("load_error"), true); return; }
    state.opener = document.activeElement; state.userId = root.currentUser.id;
    clearPreview(); el("list").innerHTML = "<option value=''>" + escape(label("choose")) + "</option>";
    refresh(); dialog.showModal(); status("lists_loading", false);
    var seq = ++state.seq; state.busy = true; controls();
    try {
      var rows = [], offset = 0;
      while (true) {
        var result = await root.sb.from("manufacturing_cost_lists").select("id,list_name,product_kind")
          .eq("is_active", true).order("updated_at", { ascending: false }).order("id", { ascending: true }).range(offset, offset + 99);
        if (seq !== state.seq || !dialog.open) return;
        if (result.error) throw result.error;
        if (!allowed() || root.currentUser.id !== state.userId) { status("permission", true); return; }
        rows = rows.concat(result.data || []);
        if (!result.data || result.data.length < 100) break;
        offset += 100;
        if (offset >= 2000) throw Error("List limit");
      }
      el("list").innerHTML += rows.map(function(row) {
        var kind = row.product_kind ? (root.productKindLabel ? root.productKindLabel(row.product_kind) : row.product_kind) : "";
        return "<option value='" + escape(row.id) + "'>" + escape(row.list_name + (kind ? " / " + kind : "")) + "</option>";
      }).join("");
      status(rows.length ? "" : "empty", false);
    } catch (error) { if (seq === state.seq) status(error.code === "42501" ? "permission" : "load_error", true); }
    finally { if (seq === state.seq) { state.busy = false; controls(); el("list").focus(); } }
  }
  function close() {
    if (state.committing) return;
    ++state.seq; state.busy = false; clearPreview(); el("dialog").close();
    if (state.opener && state.opener.isConnected) state.opener.focus();
  }
  async function commit() {
    if (state.busy || !state.preview || !state.preview.counts.add) return;
    if (!allowed() || root.currentUser.id !== state.userId || context() !== state.context) { clearPreview(); status("stale", true); return; }
    var request = args(true), expected = state.preview.counts.add;
    state.busy = true; state.committing = true; status("saving", false); controls();
    try {
      var result = await root.sb.rpc("import_ec_targets_from_cost_list", request);
      if (result.error) throw result.error;
      if (!result.data || result.data.inserted !== expected || !Array.isArray(result.data.targets) || result.data.targets.length !== expected) throw Error("Unconfirmed result");
      if (!allowed() || !root.currentUser || root.currentUser.id !== state.userId) { clearPreview(); status("permission", true); return; }
      result.data.targets.forEach(function(row) {
        if (!(root.rakutenTargets || []).some(function(target) { return target.target_key === row.target_key || String(target.dkd_shohin_id) === String(row.dkd_shohin_id); }))
          root.rakutenTargets.push(root.ecMallTargetFromDb(row));
      });
      root.renderRakutenTargets(); root.setRakutenStatus(label("added", { n: expected }), false);
      state.committing = false; close();
    } catch (error) {
      clearPreview(); status(error.code === "40001" || /EC_COST_STALE_PREVIEW/.test(error.message || "") ? "stale" : error.code === "42501" ? "permission" : "unknown", true);
    } finally { state.busy = false; state.committing = false; controls(); }
  }
  function refresh() {
    document.querySelectorAll("[data-ec-cost-label]").forEach(function(node) { node.textContent = label(node.dataset.ecCostLabel); });
    var entry = document.getElementById("btn-ec-cost-list-targets");
    if (entry) entry.disabled = !allowed();
    el("results").setAttribute("aria-label", label("title"));
    render();
  }
  var button = document.getElementById("btn-ec-cost-list-targets");
  if (button) button.addEventListener("click", open);
  el("list").addEventListener("change", preview);
  el("recheck").addEventListener("click", function() { if (!el("list").options.length || el("list").options.length === 1) { close(); open(); } else preview(); });
  el("close").addEventListener("click", close);
  el("add").addEventListener("click", commit);
  el("dialog").addEventListener("cancel", function(event) { event.preventDefault(); close(); });
  root.DcatsEcCostListTargets = { refresh: refresh };
  refresh();
})(window);
