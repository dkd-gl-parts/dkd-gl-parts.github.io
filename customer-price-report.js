/* Customer-facing price reports. Prices and issued snapshots come only from server RPCs. */
(function() {
  "use strict";

  var state = { preview: null, requestId: null, loading: false, generation: 0, categories: {}, categoryOptions: [], categoryLoad: 0, historyLoad: 0, pendingIssue: null, pendingByActor: {}, view: "included" };
  var byId = function(id) { return document.getElementById(id); };
  var yen = function(value) { return Number(value).toLocaleString("ja-JP") + "円"; };
  var safe = function(value) { return esc(value == null ? "" : String(value)); };

  function isRecycle() { return byId("cpr-report-type").value === "recycle_plus"; }
  function reportActor() { return typeof currentUser !== "undefined" && currentUser ? currentUser.id : ""; }
  function recycleFilters(args) {
    return { category_code: args.p_category_code, product_kind: args.p_product_kind, part_number: args.p_part_number };
  }
  function applyReportType() {
    var recycle = isRecycle();
    byId("cpr-customer-field").hidden = recycle;
    byId("cpr-recycle-brand").hidden = !recycle;
    byId("cpr-title").textContent = recycle ? "Recycle＋向け販売価格表" : "得意先向け販売価格表";
    byId("cpr-description").textContent = recycle ?
      "ファクタリング価格で販売価格表を作成します。発行時点の品番と価格は履歴に保存されます。" :
      "得意先に現在適用される価格だけを掲載します。発行時点の品番と価格は履歴に保存されます。";
    byId("cpr-output-help").textContent = recycle ?
      "現行の基準価格がある商品が対象です。ファクタリング価格未設定・0円は掲載しません。Recycle＋へ掲載する品番を確認してください。" :
      "価格未設定、非公開、0円の品番はPDFに掲載しません。";
  }
  function lockIssueControls(locked) {
    ["cpr-report-type", "cpr-customer", "cpr-category", "cpr-kind", "cpr-part-number", "cpr-part-number-format"].forEach(function(id) {
      byId(id).disabled = locked;
    });
    byId("cpr-preview-button").disabled = locked || (!isRecycle() && !Number(byId("cpr-customer").value));
    byId("cpr-issue-button").disabled = locked || !(state.preview && state.preview.rows.length);
    byId("cpr-receipt-button").hidden = !state.pendingIssue;
  }

  function outputOptions() {
    return { abbreviateMitsubishi: byId("cpr-part-number-format").value === "short" };
  }

  function manufacturerPartNumber(row, options) {
    var part = row.manufacturer_part_number || "—";
    if (!options || !options.abbreviateMitsubishi ||
        String(row.manufacturer || "").trim().toUpperCase() !== "MITSUBISHI") return part;
    return String(part).replace(/^([A-Z])00([0-9]T)/i, "$1$2");
  }

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
    state.view = "included";
    byId("cpr-issue-button").disabled = true;
    byId("cpr-summary").hidden = true;
    byId("cpr-summary").innerHTML = "";
    byId("cpr-exclusions").hidden = true;
    byId("cpr-detail-heading").hidden = true;
    byId("cpr-preview-table").dataset.cprView = "included";
    byId("cpr-detail-column").textContent = "税抜価格";
    byId("cpr-preview-rows").innerHTML = "<tr><td colspan='7' class='cpr-empty'>条件を指定してプレビューを更新してください。</td></tr>";
    setStatus(message || "条件を指定してプレビューを更新してください。", false);
  }

  function kindLabel(kind) {
    return kind === "rebuilt" ? "リビルト" : kind === "new" ? "新品" : kind || "—";
  }

  function categoryLabel(code) {
    return state.categories[code] || code || "—";
  }

  function exclusionLabel(reason) {
    return ({ hidden: "非公開", price_hidden: "価格非表示", no_price: "価格未設定", zero: "0円", other: "その他" })[reason] || "その他";
  }

  function detailRows(payload, view) {
    var included = Array.isArray(payload.rows) ? payload.rows : [];
    var excluded = Array.isArray(payload.excluded_rows) ? payload.excluded_rows : [];
    if (view === "included") return included;
    if (view === "excluded") return excluded;
    return included.concat(excluded).sort(function(a, b) {
      var key = function(row) { return [row.category_code, row.gltek_part_number, row.genuine_part_number,
        row.manufacturer_part_number, row.dkd_shohin_id, row.product_kind].map(function(value) { return String(value || ""); }).join("\u0000"); };
      return key(a).localeCompare(key(b), "ja");
    });
  }

  function renderDetail() {
    var payload = state.preview;
    if (!payload) return;
    var summary = payload.summary || {};
    var view = state.view;
    var rows = detailRows(payload, view);
    var count = view === "included" ? Number(summary.included_count) || 0 :
      view === "excluded" ? (Number(summary.candidate_count) || 0) - (Number(summary.included_count) || 0) :
      Number(summary.candidate_count) || 0;
    var labels = { candidate: "候補", included: "掲載", excluded: "除外" };
    byId("cpr-detail-heading").hidden = false;
    byId("cpr-detail-heading").textContent = labels[view] + "品番 " + count + "件";
    byId("cpr-preview-table").dataset.cprView = view;
    byId("cpr-detail-column").textContent = view === "excluded" ? "除外理由" : view === "candidate" ? "価格／判定" : "税抜価格";
    byId("cpr-summary").querySelectorAll("[data-cpr-view]").forEach(function(button) {
      button.setAttribute("aria-pressed", button.dataset.cprView === view ? "true" : "false");
    });
    byId("cpr-preview-rows").innerHTML = rows.length ? rows.map(function(row) {
      var excluded = !!row.exclusion_reason;
      var detail = excluded ? "<span class='cpr-exclusion-reason'>" + safe(exclusionLabel(row.exclusion_reason)) + "</span>" :
        safe(yen(row.sales_price_jpy)) + (view === "candidate" ? "<small>掲載</small>" : "");
      return "<tr><td>" + safe(row.category_label || categoryLabel(row.category_code)) + "<small>" + safe(kindLabel(row.product_kind)) + "</small></td>" +
        "<td class='cpr-g-part-number'>" + safe(row.gltek_part_number || "—") + "</td>" +
        "<td>" + safe(row.genuine_part_number || "—") + "</td>" +
        "<td>" + safe(manufacturerPartNumber(row, outputOptions())) + "</td>" +
        "<td class='cpr-vehicle-name'>" + safe(row.representative_vehicle_name) + "</td>" +
        "<td class='cpr-vehicle-model'>" + safe(row.representative_vehicle_model) + "</td>" +
        "<td>" + detail + "</td></tr>";
    }).join("") : "<tr><td colspan='7' class='cpr-empty'>" +
      (view === "excluded" ? "除外された品番はありません。" : view === "candidate" ? "候補品番はありません。" : "掲載できる価格がありません。") + "</td></tr>";
    setStatus(view === "excluded" ? "PDFに掲載しない品番と理由を表示しています。" :
      view === "candidate" ? "候補の品番と掲載判定を表示しています。" :
      rows.length ? (payload.report_type === "recycle_plus" ? "Recycle＋向けのファクタリング価格を確認してください。" : "得意先に適用される販売価格を確認してください。") : "掲載できる品番がありません。", false);
  }

  function renderPreview(payload) {
    var rows = Array.isArray(payload.rows) ? payload.rows : [];
    var summary = payload.summary || {};
    var count = Number(summary.included_count) || 0;
    state.preview = payload;
    state.view = "included";
    byId("cpr-summary").hidden = false;
    byId("cpr-summary").innerHTML =
      "<button type='button' data-cpr-view='candidate' aria-pressed='false'>候補<strong>" + safe(summary.candidate_count || 0) + "件</strong></button>" +
      "<button type='button' data-cpr-view='included' aria-pressed='true'>掲載<strong>" + safe(count) + "件</strong></button>" +
      "<button type='button' data-cpr-view='excluded' aria-pressed='false'>除外<strong>" + safe((Number(summary.candidate_count) || 0) - count) + "件</strong></button>";
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
    renderDetail();
    byId("cpr-issue-button").disabled = !rows.length;
  }

  async function preview() {
    if (state.loading || state.pendingIssue) return;
    if (!canManageCustomerAccess()) { clearPreview("価格表を参照する権限がありません。"); return; }
    var args = filters();
    var recycle = isRecycle();
    if (!recycle && !args.p_sales_customer_id) { clearPreview("得意先を選択してください。"); return; }
    var actor = reportActor();
    clearPreview("価格を確認しています…");
    var generation = state.generation;
    var button = byId("cpr-preview-button");
    button.disabled = true;
    try {
      var result = recycle ? await sb.rpc("recycle_price_report", { action: "preview", payload: recycleFilters(args) }) :
        await sb.rpc("get_customer_price_report_preview", args);
      if (result.error) throw result.error;
      if (generation !== state.generation || actor !== reportActor() || !isScreenActive("customer-price-report")) return;
      if (!canManageCustomerAccess()) { clearPreview("価格表を参照する権限がありません。"); return; }
      if (!result.data || !Array.isArray(result.data.rows) || !Array.isArray(result.data.excluded_rows) ||
          (recycle && result.data.report_type !== "recycle_plus") ||
          !result.data.preview_hash || result.data.rows.length !== Number(result.data.summary && result.data.summary.included_count) ||
          result.data.rows.length + result.data.excluded_rows.length !== Number(result.data.summary && result.data.summary.candidate_count)) {
        throw new Error("価格表の明細と件数が一致しません。画面を更新してください");
      }
      state.preview = result.data;
      state.requestId = crypto.randomUUID();
      renderPreview(result.data);
    } catch (error) {
      if (generation === state.generation) setStatus("プレビューに失敗しました：" + (error.message || error), true);
    } finally {
      button.disabled = byId("cpr-category").disabled || (!isRecycle() && !Number(byId("cpr-customer").value));
    }
  }

  function dateLabel(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function filenameDate(value) {
    if (!value) return "";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    var parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    return ["year", "month", "day"].map(function(type) {
      return parts.find(function(part) { return part.type === type; }).value;
    }).join("-");
  }

  function printHtml(issue, options) {
    var recycle = issue.report_type === "recycle_plus";
    var customer = issue.customer || {};
    var reportName = recycle ? "Recycle＋向け販売価格表" : "販売価格表";
    var logoUrl = new URL("assets/recycle-plus-logo.png", window.location.href).href;
    var headingHtml = "<div><p class='document-eyebrow'>PRICE LIST</p><h1>" + safe(reportName) + "</h1></div>";
    if (recycle) headingHtml = "<div class='recycle-brand'><img src='" + safe(logoUrl) + "' alt='Recycle＋' width='79' height='79'>" + headingHtml + "</div>";
    var issuedDate = filenameDate(issue.issued_at);
    var rows = Array.isArray(issue.rows) ? issue.rows : [];
    var stylesheetUrl = new URL("customer-price-report-print.css", window.location.href).href +
      "?dcats_version=" + encodeURIComponent(APP_VERSION);
    var shipping = recycle ? "送料・コア代・取引条件は別途ご確認ください。" : customer.shipping_charge_rule === "free" ?
      "送料は無料です。消費税は別途申し受けます。" : "送料・消費税は別途申し受けます。";
    var groups = new Map();
    rows.forEach(function(row) {
      var key = row.category_code || "";
      if (!groups.has(key)) groups.set(key, {
        label: row.category_label || categoryLabel(row.category_code), rows: []
      });
      groups.get(key).rows.push(row);
    });
    var categorySections = Array.from(groups.values()).map(function(group) {
      var body = group.rows.map(function(row) {
        return "<tr><td>" + safe(row.category_label || categoryLabel(row.category_code)) +
          "<span class='secondary'>" + safe(kindLabel(row.product_kind)) + "</span></td><td class='g-part-number'>" +
          safe(row.gltek_part_number || "—") + "</td><td>" + safe(row.genuine_part_number || "—") +
          (row.genuine_part_number_2 ? "<span class='secondary'>" + safe(row.genuine_part_number_2) + "</span>" : "") +
          "</td><td>" + safe(manufacturerPartNumber(row, options)) + "</td>" +
          "<td class='vehicle-name'>" + safe(row.representative_vehicle_name) + "</td>" +
          "<td class='vehicle-model'>" + safe(row.representative_vehicle_model) + "</td><td class='price'>" +
          safe(yen(row.sales_price_jpy)) + "</td></tr>";
      }).join("");
      return "<section class='category-section'><h2 class='category-heading'>" + safe(group.label) + "</h2>" +
        "<table class='price-list'><thead><tr><th>カテゴリ・区分</th><th>G品番</th><th>純正品番</th><th>メーカー品番</th><th>代表車名</th><th>型式</th><th>販売価格</th></tr></thead><tbody>" +
        body + "</tbody></table></section>";
    }).join("");
    return "<!doctype html><html lang='ja'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>" +
      "<title>" + safe(reportName) + (recycle ? "" : " " + safe(customer.name)) + (issuedDate ? "_" + issuedDate : "") + "</title>" +
      "<link rel='stylesheet' href='" + safe(stylesheetUrl) + "'></head><body" + (recycle ? " class='recycle-document'" : "") + ">" +
      "<div class='print-toolbar'><span class='print-help'>PDF保存時は印刷設定の「ヘッダーとフッター」をオフにしてください。</span><button type='button' id='cpr-print'>印刷・PDF保存</button><button type='button' id='cpr-close'>閉じる</button></div>" +
      "<main class='document'><div class='document-intro'><header class='document-head'>" + headingHtml +
      "<dl class='document-meta'><div><dt>発行日時</dt><dd>" + safe(dateLabel(issue.issued_at)) +
      "</dd></div><div><dt>発行者</dt><dd>" + safe(issue.issued_by_name || "—") + "</dd></div></dl></header>" +
      (recycle ? "<div class='customer'><span class='customer-label'>適用価格</span><strong>ファクタリング</strong></div>" :
      "<div class='customer'><span class='customer-label'>得意先</span><strong>" + safe(customer.name || "—") + "</strong></div>") +
      "<div class='report-notes'><div class='report-note'><strong>価格・送料</strong><p>本書の価格は発行日時点の税抜価格です。" + safe(shipping) + "</p></div>" +
      "<div class='report-note'><strong>ご注文前の確認</strong><p>価格・在庫状況は変動する場合があります。ご注文前に最新の価格と在庫状況をご確認ください。</p></div></div></div>" +
      categorySections +
      "</main></body></html>";
  }

  function writePrintWindow(win, issue, options) {
    if (!win || win.closed) return false;
    win.document.open();
    win.document.write(printHtml(issue, options));
    win.document.close();
    try { win.opener = null; } catch (ignore) { /* Browser owns opener restrictions. */ }
    win.document.getElementById("cpr-print").addEventListener("click", function() { win.print(); });
    win.document.getElementById("cpr-close").addEventListener("click", function() { win.close(); });
    return true;
  }

  async function issue() {
    if (state.loading || state.pendingIssue || !state.preview) return;
    if (!canManageCustomerAccess()) { clearPreview("価格表を発行する権限がありません。"); return; }
    var recycle = isRecycle();
    var options = outputOptions();
    var args = filters();
    var snapshotFilters = state.preview.filters || {};
    if ((recycle ? state.preview.report_type !== "recycle_plus" :
        state.preview.report_type === "recycle_plus" || Number(state.preview.customer && state.preview.customer.id) !== args.p_sales_customer_id) ||
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
    lockIssueControls(true);
    var operation = { requestId: state.requestId, options: options, actor: reportActor() };
    try {
      var result = recycle ? await sb.rpc("recycle_price_report", { action: "issue", payload: Object.assign(recycleFilters(args), {
        preview_hash: state.preview.preview_hash, request_id: state.requestId
      }) }) : await sb.rpc("issue_customer_price_report", Object.assign({}, args, {
        p_preview_hash: state.preview.preview_hash,
        p_request_id: state.requestId
      }));
      if (result.error) throw result.error;
      if (!result.data || !result.data.issue_id || !Array.isArray(result.data.rows)) throw new Error("発行結果が不正です");
      if (recycle && result.data.report_type !== "recycle_plus") throw new Error("発行結果が不正です");
      if (operation.actor !== reportActor() || !canManageCustomerAccess() || !isScreenActive("customer-price-report")) { win.close(); return; }
      writePrintWindow(win, result.data, options);
      setStatus("販売価格表 No." + result.data.issue_id + " を発行しました。別ウィンドウから印刷・PDF保存できます。", false);
      await loadHistory();
    } catch (error) {
      if (!win.closed) win.close();
      var stale = /preview changed/i.test(error.message || "");
      if (stale) clearPreview("価格が変わりました。プレビューを更新してください。");
      else if (recycle && ["22023", "40001", "42501"].indexOf(error.code) < 0) {
        state.pendingByActor[operation.actor] = operation;
        if (operation.actor === reportActor()) {
          state.pendingIssue = operation;
          setStatus("発行結果を確認できませんでした。「発行結果を確認」で保存済みか照会してください。", true);
        }
      }
      else setStatus("発行に失敗しました：" + (error.message || error), true);
    } finally {
      state.loading = false;
      lockIssueControls(!!state.pendingIssue);
    }
  }

  async function checkIssueReceipt() {
    if (!state.pendingIssue || state.pendingIssue.actor !== reportActor() || state.loading) return;
    if (!canManageCustomerAccess()) { setStatus("発行結果を確認する権限がありません。", true); return; }
    var pending = state.pendingIssue;
    var win = window.open("", "_blank");
    if (!win) { setStatus("ポップアップを許可して、もう一度お試しください。", true); return; }
    win.document.body.textContent = "発行結果を確認しています…";
    state.loading = true;
    byId("cpr-receipt-button").disabled = true;
    try {
      var result = await sb.rpc("recycle_price_report", { action: "receipt", payload: { request_id: pending.requestId } });
      if (result.error) throw result.error;
      if (!result.data || typeof result.data.saved !== "boolean" || (result.data.saved &&
          (!result.data.issue || result.data.issue.report_type !== "recycle_plus" || !result.data.issue.issue_id || !Array.isArray(result.data.issue.rows)))) throw new Error("発行結果が不正です");
      if (pending.actor !== reportActor() || !canManageCustomerAccess() || !isScreenActive("customer-price-report")) { win.close(); return; }
      delete state.pendingByActor[pending.actor];
      state.pendingIssue = null;
      if (result.data.saved) {
        writePrintWindow(win, result.data.issue, pending.options);
        setStatus("発行済みのRecycle＋向け販売価格表を開きました。", false);
        await loadHistory();
      } else { win.close(); clearPreview("未発行を確認しました。プレビューを更新してください。"); }
    } catch (error) {
      if (!win.closed) win.close();
      setStatus("発行結果を確認できませんでした。時間をおいて再度照会してください。", true);
    } finally {
      state.loading = false;
      byId("cpr-receipt-button").disabled = false;
      lockIssueControls(!!state.pendingIssue);
    }
  }

  async function loadHistory() {
    var load = ++state.historyLoad;
    var recycle = isRecycle();
    var actor = reportActor();
    var host = byId("cpr-history-list");
    host.textContent = "履歴を読み込んでいます…";
    try {
    var result = recycle ? await sb.rpc("recycle_price_report", { action: "history", payload: { limit: 20 } }) :
      await sb.rpc("list_customer_price_report_issues", {
      p_sales_customer_id: Number(byId("cpr-customer").value) || null,
      p_limit: 20
    });
    if (load !== state.historyLoad || recycle !== isRecycle() || actor !== reportActor()) return;
    if (!canManageCustomerAccess()) { host.textContent = "発行履歴を参照する権限がありません。"; return; }
    if (result.error) { host.textContent = "履歴を読み込めませんでした。"; return; }
    var rows = Array.isArray(result.data) ? result.data : [];
    if (!rows.length) { host.innerHTML = "<p class='cpr-history-empty'>発行履歴はありません。</p>"; return; }
    host.innerHTML = rows.map(function(row) {
      return "<div class='cpr-history-item'><div><strong>No." + safe(row.issue_id) + "　" + safe(recycle ? "Recycle＋向け販売価格表" : row.customer_name) +
        "</strong><small>" + safe(dateLabel(row.issued_at)) + " / " + safe(row.item_count) + "件 / " +
        safe(row.issued_by_name || "—") + "</small></div><button class='cpr-secondary' type='button' data-cpr-issue-id='" +
        safe(row.issue_id) + "' data-cpr-report-type='" + (recycle ? "recycle_plus" : "customer") + "'>再表示</button></div>";
    }).join("");
    } catch (error) { if (load === state.historyLoad) host.textContent = "履歴を読み込めませんでした。"; }
  }

  async function reopen(issueId, reportType) {
    if (!canManageCustomerAccess()) { setStatus("発行履歴を参照する権限がありません。", true); return; }
    var options = outputOptions();
    var actor = reportActor();
    var win = window.open("", "_blank");
    if (!win) { setStatus("ポップアップを許可して、もう一度お試しください。", true); return; }
    win.document.body.textContent = "保存済み価格表を読み込んでいます…";
    try {
    var result = reportType === "recycle_plus" ? await sb.rpc("recycle_price_report", { action: "reopen", payload: { issue_id: issueId } }) :
      await sb.rpc("get_customer_price_report_issue", { p_issue_id: issueId });
    if (result.error || !result.data || !Array.isArray(result.data.rows)) {
      win.close();
      setStatus("発行履歴を開けませんでした。", true);
      return;
    }
    if (actor !== reportActor() || !canManageCustomerAccess() || !isScreenActive("customer-price-report")) { win.close(); return; }
    writePrintWindow(win, result.data, options);
    } catch (error) { if (!win.closed) win.close(); setStatus("発行履歴を開けませんでした。", true); }
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
    state.categoryOptions = (results[1].data || []).map(function(row) {
      state.categories[row.category_code] = row.label_ja || row.category_code;
      return row.category_code;
    });
    categorySelect.innerHTML = "<option value=''>すべて</option>";
    categorySelect.disabled = true;
    await loadVisibleCategories();
  }

  async function loadVisibleCategories() {
    var categorySelect = byId("cpr-category");
    var previewButton = byId("cpr-preview-button");
    var customerId = Number(byId("cpr-customer").value) || null;
    var previous = categorySelect.value;
    var load = ++state.categoryLoad;
    categorySelect.disabled = true;
    previewButton.disabled = true;
    categorySelect.innerHTML = "<option value=''>すべて</option>";
    categorySelect.value = "";
    if (isRecycle()) {
      categorySelect.innerHTML += state.categoryOptions.map(function(code) {
        return "<option value='" + safe(code) + "'>" + safe(state.categories[code]) + "</option>";
      }).join("");
      if (state.categoryOptions.indexOf(previous) >= 0) categorySelect.value = previous;
      categorySelect.disabled = false;
      previewButton.disabled = false;
      return;
    }
    if (!customerId) return;
    try {
      var result = await sb.from("customer_product_visibility")
        .select("visibility_scope,category_code,is_visible")
        .eq("sales_customer_id", customerId)
        .in("visibility_scope", ["all", "category"])
        .limit(2000);
      if (load !== state.categoryLoad || isRecycle() || Number(byId("cpr-customer").value) !== customerId) return;
      if (result.error) throw result.error;
      var rows = result.data || [];
      var visible = state.categoryOptions.filter(function(code) { return customerCategoryIsVisible(code, rows); });
      categorySelect.innerHTML = "<option value=''>すべて</option>" + visible.map(function(code) {
        return "<option value='" + safe(code) + "'>" + safe(state.categories[code]) + "</option>";
      }).join("");
      if (visible.indexOf(previous) >= 0) categorySelect.value = previous;
      categorySelect.disabled = false;
      previewButton.disabled = false;
    } catch (error) {
      if (load !== state.categoryLoad) return;
      categorySelect.innerHTML = "<option value=''>カテゴリ設定を読み込めません</option>";
      setStatus("カテゴリ設定を読み込めませんでした：" + (error.message || error), true);
    }
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
    state.pendingIssue = state.pendingByActor[reportActor()] || null;
    if (state.pendingIssue) {
      byId("cpr-report-type").value = "recycle_plus";
      applyReportType();
      lockIssueControls(true);
      setStatus("前回の発行結果を確認してください。", true);
      return;
    }
    lockIssueControls(false);
    if (preselectedCustomerId) byId("cpr-report-type").value = "customer";
    applyReportType();
    clearPreview(isRecycle() ? "条件を指定してプレビューを更新してください。" : "得意先を選択してください。");
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
    ["cpr-report-type", "cpr-customer", "cpr-category", "cpr-kind", "cpr-part-number"].forEach(function(id) {
      byId(id).addEventListener(id === "cpr-part-number" ? "input" : "change", function() {
        clearPreview();
        if (id === "cpr-report-type") applyReportType();
        if (id === "cpr-customer" || id === "cpr-report-type") {
          loadVisibleCategories();
          loadHistory();
        }
      });
    });
    byId("cpr-part-number").addEventListener("keydown", function(event) { if (event.key === "Enter") preview(); });
    byId("cpr-part-number-format").addEventListener("change", renderDetail);
    byId("cpr-preview-button").addEventListener("click", preview);
    byId("cpr-summary").addEventListener("click", function(event) {
      var button = event.target.closest("[data-cpr-view]");
      if (!button || !state.preview) return;
      state.view = button.dataset.cprView;
      renderDetail();
    });
    byId("cpr-issue-button").addEventListener("click", issue);
    byId("cpr-receipt-button").addEventListener("click", checkIssueReceipt);
    byId("cpr-history-refresh").addEventListener("click", loadHistory);
    byId("cpr-history-list").addEventListener("click", function(event) {
      var button = event.target.closest("[data-cpr-issue-id]");
      if (button) reopen(Number(button.dataset.cprIssueId), button.dataset.cprReportType);
    });
  }

  window.enterReportHub = enterReportHub;
  window.enterCustomerPriceReport = enterCustomerPriceReport;
  bindEvents();
})();
