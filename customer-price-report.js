/* Customer-facing price reports. Prices and issued snapshots come only from server RPCs. */
(function() {
  "use strict";

  var state = { preview: null, requestId: null, loading: false, generation: 0, categories: {} };
  var byId = function(id) { return document.getElementById(id); };
  var yen = function(value) { return Number(value).toLocaleString("ja-JP") + "円"; };
  var safe = function(value) { return esc(value == null ? "" : String(value)); };

  function setStatus(message, error) {
    var el = byId("cpr-status");
    el.textContent = message;
    el.classList.toggle("error", !!error);
  }

  function filters() {
    return {
      p_sales_customer_id: Number(byId("cpr-customer").value) || null,
      p_category_code: byId("cpr-category").value || null,
      p_product_kind: byId("cpr-kind").value || null,
      p_part_number: byId("cpr-part-number").value.trim() || null
    };
  }

  function clearPreview(message) {
    state.generation += 1;
    state.preview = null;
    state.requestId = null;
    byId("cpr-issue-button").disabled = true;
    byId("cpr-summary").hidden = true;
    byId("cpr-exclusions").hidden = true;
    byId("cpr-preview-rows").innerHTML = "<tr><td colspan='4' class='cpr-empty'>条件を指定してプレビューを更新してください。</td></tr>";
    setStatus(message || "条件を指定してプレビューを更新してください。", false);
  }

  function kindLabel(kind) {
    return kind === "rebuilt" ? "リビルト" : kind === "new" ? "新品" : kind || "—";
  }

  function categoryLabel(code) {
    return state.categories[code] || code || "—";
  }

  function renderPreview(payload) {
    var rows = Array.isArray(payload.rows) ? payload.rows : [];
    var summary = payload.summary || {};
    var count = Number(summary.included_count) || 0;
    byId("cpr-summary").hidden = false;
    byId("cpr-summary").innerHTML =
      "<span>候補<strong>" + safe(summary.candidate_count || 0) + "件</strong></span>" +
      "<span>掲載<strong>" + safe(count) + "件</strong></span>" +
      "<span>除外<strong>" + safe((Number(summary.candidate_count) || 0) - count) + "件</strong></span>";
    var exclusions = [
      ["非公開", summary.excluded_hidden],
      ["価格非表示", summary.excluded_price_hidden],
      ["価格未設定", summary.excluded_no_price],
      ["0円", summary.excluded_zero],
      ["その他", summary.excluded_other]
    ].filter(function(entry) { return Number(entry[1]) > 0; });
    var exclusionEl = byId("cpr-exclusions");
    exclusionEl.hidden = !exclusions.length;
    exclusionEl.textContent = exclusions.length ? "除外内訳：" + exclusions.map(function(entry) {
      return entry[0] + " " + entry[1] + "件";
    }).join(" / ") : "";
    byId("cpr-preview-rows").innerHTML = rows.length ? rows.slice(0, 200).map(function(row) {
      return "<tr><td>" + safe(row.category_label || categoryLabel(row.category_code)) + "<small>" + safe(kindLabel(row.product_kind)) + "</small></td>" +
        "<td>" + safe(row.gltek_part_number || "—") + "<small>" + safe(row.genuine_part_number || "—") + "</small></td>" +
        "<td>" + safe(row.manufacturer_part_number || "—") + "</td>" +
        "<td>" + safe(yen(row.sales_price_jpy)) + "</td></tr>";
    }).join("") : "<tr><td colspan='4' class='cpr-empty'>掲載できる価格がありません。</td></tr>";
    setStatus(rows.length > 200 ? "先頭200件を表示中。PDFには全" + count + "件を掲載します。" :
      rows.length ? "得意先に適用される販売価格を確認してください。" : "掲載できる品番がありません。", false);
    byId("cpr-issue-button").disabled = !rows.length;
  }

  async function preview() {
    var args = filters();
    if (!args.p_sales_customer_id) { clearPreview("得意先を選択してください。"); return; }
    clearPreview("価格を確認しています…");
    var generation = state.generation;
    var button = byId("cpr-preview-button");
    button.disabled = true;
    try {
      var result = await sb.rpc("get_customer_price_report_preview", args);
      if (result.error) throw result.error;
      if (generation !== state.generation || !isScreenActive("customer-price-report")) return;
      if (!result.data || !Array.isArray(result.data.rows) || !result.data.preview_hash) throw new Error("価格表の応答が不正です");
      state.preview = result.data;
      state.requestId = crypto.randomUUID();
      renderPreview(result.data);
    } catch (error) {
      if (generation === state.generation) setStatus("プレビューに失敗しました：" + (error.message || error), true);
    } finally {
      button.disabled = false;
    }
  }

  function dateLabel(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function printHtml(issue) {
    var customer = issue.customer || {};
    var rows = Array.isArray(issue.rows) ? issue.rows : [];
    var stylesheetUrl = new URL("customer-price-report-print.css", window.location.href).href +
      "?dcats_version=" + encodeURIComponent(APP_VERSION);
    var shipping = customer.shipping_charge_rule === "free" ?
      "送料は無料です。消費税は別途となります。" : "送料・消費税は別途となります。";
    var body = rows.map(function(row, index) {
      return "<tr><td>" + (index + 1) + "</td><td>" + safe(row.category_label || categoryLabel(row.category_code)) +
        "<span class='secondary'>" + safe(kindLabel(row.product_kind)) + "</span></td><td>" +
        safe(row.gltek_part_number || "—") + "</td><td>" + safe(row.genuine_part_number || "—") +
        (row.genuine_part_number_2 ? "<span class='secondary'>" + safe(row.genuine_part_number_2) + "</span>" : "") +
        "</td><td>" + safe(row.manufacturer_part_number || "—") + "</td><td class='price'>" +
        safe(yen(row.sales_price_jpy)) + "</td></tr>";
    }).join("");
    return "<!doctype html><html lang='ja'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>" +
      "<title>販売価格表 " + safe(customer.name) + "</title>" +
      "<link rel='stylesheet' href='" + safe(stylesheetUrl) + "'></head><body>" +
      "<div class='print-toolbar'><button type='button' id='cpr-print'>印刷・PDF保存</button><button type='button' id='cpr-close'>閉じる</button></div>" +
      "<main class='document'><header class='document-head'><div><h1>販売価格表</h1><small>Daiko Catalog &amp; Search System</small></div>" +
      "<div class='document-meta'>発行番号：" + safe(issue.issue_id || "—") + "<br>発行日時：" + safe(dateLabel(issue.issued_at)) +
      "<br>発行者：" + safe(issue.issued_by_name || "—") + "</div></header>" +
      "<div class='customer'>" + safe(customer.name || "—") + " 御中</div>" +
      "<p class='terms'>" + safe(shipping) + " 掲載価格は税抜・円表示です。</p>" +
      "<table class='price-list'><thead><tr><th>No.</th><th>カテゴリ・区分</th><th>G品番</th><th>純正品番</th><th>メーカー品番</th><th>販売価格</th></tr></thead><tbody>" + body + "</tbody></table>" +
      "<footer class='document-footer'>発行時点の価格です。ご注文前に最新の在庫状況と価格をご確認ください。<br>本書に掲載のない品番は価格未設定または公開対象外です。</footer>" +
      "</main></body></html>";
  }

  function writePrintWindow(win, issue) {
    if (!win || win.closed) return false;
    win.document.open();
    win.document.write(printHtml(issue));
    win.document.close();
    try { win.opener = null; } catch (ignore) { /* Browser owns opener restrictions. */ }
    win.document.getElementById("cpr-print").addEventListener("click", function() { win.print(); });
    win.document.getElementById("cpr-close").addEventListener("click", function() { win.close(); });
    return true;
  }

  async function issue() {
    if (state.loading || !state.preview) return;
    var args = filters();
    var snapshotFilters = state.preview.filters || {};
    if (Number(state.preview.customer && state.preview.customer.id) !== args.p_sales_customer_id ||
        (snapshotFilters.category_code || null) !== args.p_category_code ||
        (snapshotFilters.product_kind || null) !== args.p_product_kind ||
        (snapshotFilters.part_number || null) !== args.p_part_number) {
      clearPreview("条件が変わりました。プレビューを更新してください。");
      return;
    }
    var win = window.open("", "_blank");
    if (!win) { setStatus("ポップアップを許可して、もう一度お試しください。", true); return; }
    win.document.body.textContent = "価格表を発行しています…";
    state.loading = true;
    byId("cpr-issue-button").disabled = true;
    try {
      var result = await sb.rpc("issue_customer_price_report", Object.assign({}, args, {
        p_preview_hash: state.preview.preview_hash,
        p_request_id: state.requestId
      }));
      if (result.error) throw result.error;
      if (!result.data || !result.data.issue_id || !Array.isArray(result.data.rows)) throw new Error("発行結果が不正です");
      writePrintWindow(win, result.data);
      setStatus("販売価格表 No." + result.data.issue_id + " を発行しました。別ウィンドウから印刷・PDF保存できます。", false);
      await loadHistory();
    } catch (error) {
      if (!win.closed) win.close();
      var stale = /preview changed/i.test(error.message || "");
      if (stale) clearPreview("価格が変わりました。プレビューを更新してください。");
      else setStatus("発行に失敗しました：" + (error.message || error), true);
    } finally {
      state.loading = false;
      byId("cpr-issue-button").disabled = !(state.preview && state.preview.rows && state.preview.rows.length);
    }
  }

  async function loadHistory() {
    var host = byId("cpr-history-list");
    host.textContent = "履歴を読み込んでいます…";
    var result = await sb.rpc("list_customer_price_report_issues", {
      p_sales_customer_id: Number(byId("cpr-customer").value) || null,
      p_limit: 20
    });
    if (result.error) { host.textContent = "履歴を読み込めませんでした。"; return; }
    var rows = Array.isArray(result.data) ? result.data : [];
    if (!rows.length) { host.innerHTML = "<p class='cpr-history-empty'>発行履歴はありません。</p>"; return; }
    host.innerHTML = rows.map(function(row) {
      return "<div class='cpr-history-item'><div><strong>No." + safe(row.issue_id) + "　" + safe(row.customer_name) +
        "</strong><small>" + safe(dateLabel(row.issued_at)) + " / " + safe(row.item_count) + "件 / " +
        safe(row.issued_by_name || "—") + "</small></div><button class='cpr-secondary' type='button' data-cpr-issue-id='" +
        safe(row.issue_id) + "'>再表示</button></div>";
    }).join("");
  }

  async function reopen(issueId) {
    var win = window.open("", "_blank");
    if (!win) { setStatus("ポップアップを許可して、もう一度お試しください。", true); return; }
    win.document.body.textContent = "保存済み価格表を読み込んでいます…";
    var result = await sb.rpc("get_customer_price_report_issue", { p_issue_id: issueId });
    if (result.error || !result.data || !Array.isArray(result.data.rows)) {
      win.close();
      setStatus("発行履歴を開けませんでした。", true);
      return;
    }
    writePrintWindow(win, result.data);
  }

  async function loadSelectors(preselectedCustomerId) {
    var customerSelect = byId("cpr-customer");
    var categorySelect = byId("cpr-category");
    var results = await Promise.all([
      sb.from("sales_customers").select("id,customer_name").eq("is_active", true).order("customer_name"),
      sb.from("assy_categories").select("category_code,label_ja,sort_order").eq("is_active", true).order("sort_order")
    ]);
    if (results[0].error) throw results[0].error;
    if (results[1].error) throw results[1].error;
    customerSelect.innerHTML = "<option value=''>得意先を選択</option>" + (results[0].data || []).map(function(row) {
      return "<option value='" + safe(row.id) + "'>" + safe(row.customer_name) + "</option>";
    }).join("");
    if (preselectedCustomerId) customerSelect.value = String(preselectedCustomerId);
    state.categories = {};
    categorySelect.innerHTML = "<option value=''>すべて</option>" + (results[1].data || []).map(function(row) {
      state.categories[row.category_code] = row.label_ja || row.category_code;
      return "<option value='" + safe(row.category_code) + "'>" + safe(state.categories[row.category_code]) + "</option>";
    }).join("");
  }

  function enterReportHub() {
    var price = canManageCustomerAccess();
    var ranking = canViewManufacturingReport();
    if (!price && !ranking) { alert(t("err_perm")); return; }
    byId("report-hub-open-price").hidden = !price;
    byId("report-hub-open-ranking").hidden = !ranking;
    showScreen("report-hub");
  }

  async function enterCustomerPriceReport(preselectedCustomerId) {
    if (!canManageCustomerAccess()) { alert(t("err_perm")); return; }
    showScreen("customer-price-report");
    clearPreview("得意先を選択してください。");
    try {
      await loadSelectors(preselectedCustomerId);
      await loadHistory();
    } catch (error) {
      setStatus("選択肢を読み込めませんでした：" + (error.message || error), true);
    }
  }

  function bindEvents() {
    if (!byId("screen-customer-price-report")) return;
    byId("btn-logout-report-hub").addEventListener("click", doLogout);
    byId("report-hub-open-price").addEventListener("click", function() { enterCustomerPriceReport(); });
    byId("report-hub-open-ranking").addEventListener("click", enterManufacturingRankingReport);
    byId("btn-logout-customer-price-report").addEventListener("click", doLogout);
    ["cpr-customer", "cpr-category", "cpr-kind", "cpr-part-number"].forEach(function(id) {
      byId(id).addEventListener(id === "cpr-part-number" ? "input" : "change", function() {
        clearPreview();
        if (id === "cpr-customer") loadHistory();
      });
    });
    byId("cpr-part-number").addEventListener("keydown", function(event) { if (event.key === "Enter") preview(); });
    byId("cpr-preview-button").addEventListener("click", preview);
    byId("cpr-issue-button").addEventListener("click", issue);
    byId("cpr-history-refresh").addEventListener("click", loadHistory);
    byId("cpr-history-list").addEventListener("click", function(event) {
      var button = event.target.closest("[data-cpr-issue-id]");
      if (button) reopen(Number(button.dataset.cprIssueId));
    });
  }

  window.enterReportHub = enterReportHub;
  window.enterCustomerPriceReport = enterCustomerPriceReport;
  bindEvents();
})();
