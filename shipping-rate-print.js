(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else {
    root.DcatsShippingRatePrint = factory();
    root.DcatsShippingRatePrint.bindPreview(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
  var TEXT = {
    ja: { title: "お客様向け送料のご案内", scope: "全都道府県・全サイズ", help: "A4・横向き・倍率100%・ヘッダーとフッターなし", print: "印刷 / PDF保存", close: "閉じる", destination: "お届け先", origin: "発", excluded: "税抜", included: "税込", unknown: "税区分未設定", island: "離島送料", inquiry: "要確認", missing: "—：設定なし（無料ではありません）", description: "当社から商品を発送する際に、お客様へご請求する送料です。金額単位：円。", created: "作成日時", overflow: "A4一枚に収まりません。送料の登録内容を確認してください。" },
    en: { title: "Shipping Charges for Customers", scope: "All prefectures and package sizes", help: "A4 · Landscape · Scale 100% · No headers or footers", print: "Print / Save PDF", close: "Close", destination: "Destination", origin: " origin", excluded: "Tax excluded", included: "Tax included", unknown: "Tax unspecified", island: "Remote islands", inquiry: "Confirm rate", missing: "—: Not configured (not free)", description: "These are the shipping charges billed to customers when we dispatch goods. Amounts in JPY.", created: "Created", overflow: "This list does not fit one A4 page. Review the shipping master." },
    zh: { title: "客户运费说明", scope: "全部都道府县・全部尺寸", help: "A4・横向・缩放100%・无页眉页脚", print: "打印 / 保存PDF", close: "关闭", destination: "目的地", origin: "发", excluded: "未税", included: "含税", unknown: "税区分未设置", island: "离岛运费", inquiry: "请确认", missing: "—：未设置（并非免费）", description: "以下为本公司发货时向客户收取的运费。金额单位：日元。", created: "生成时间", overflow: "无法排在一张A4纸上。请检查运费登记内容。" }
  };
  var SERVICES = ["宅急便", "宅急便タイムサービス", "宅急便コンパクト", "ネコポス"];
  var REGIONS = [
    { labels: ["北海道", "Hokkaido", "北海道"], codes: [1] },
    { labels: ["北東北", "Northern Tohoku", "北东北"], codes: [2, 3, 5] },
    { labels: ["南東北", "Southern Tohoku", "南东北"], codes: [4, 6, 7] },
    { labels: ["関東", "Kanto", "关东"], codes: [8, 9, 10, 11, 12, 13, 14, 19] },
    { labels: ["信越", "Shinetsu", "信越"], codes: [15, 20] },
    { labels: ["北陸", "Hokuriku", "北陆"], codes: [16, 17, 18] },
    { labels: ["中部", "Chubu", "中部"], codes: [21, 22, 23, 24] },
    { labels: ["関西", "Kansai", "关西"], codes: [25, 26, 27, 28, 29, 30] },
    { labels: ["中国", "Chugoku", "中国地方"], codes: [31, 32, 33, 34, 35] },
    { labels: ["四国", "Shikoku", "四国"], codes: [36, 37, 38, 39] },
    { labels: ["九州", "Kyushu", "九州"], codes: [40, 41, 42, 43, 44, 45, 46] },
    { labels: ["沖縄", "Okinawa", "冲绳"], codes: [47] }
  ];
  function safe(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function(c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; });
  }
  function amount(value, inquiry) {
    return value == null ? inquiry : value.toLocaleString("ja-JP");
  }
  function customerNoteText(value) {
    return String(value == null ? "" : value).replace(/契約運賃|お客様向け運賃/g, "お客様向け送料");
  }
  function serviceRank(name) { var n = SERVICES.indexOf(name); return n < 0 ? SERVICES.length : n; }
  function buildModel(rows, prefectures) {
    var active = rows.filter(function(row) { return row.is_active === true; });
    if (!active.length) throw new Error("EMPTY");
    var columns = new Map(), destinations = new Map(), notes = [], noteIds = new Map();
    active.forEach(function(row) {
      var pref = Number(row.prefecture_code);
      if (!Number.isInteger(pref) || pref < 1 || pref > 47 || !prefectures[pref] ||
          !row.carrier_name || !row.service_name || !row.package_size_label ||
          [row.standard_fee_jpy, row.remote_island_fee_jpy].some(function(n) { return n != null && (!Number.isSafeInteger(n) || n < 0); })) throw new Error("INVALID");
      var groupKey = JSON.stringify([row.carrier_name, row.service_name, row.origin_region || "", row.tax_type || "unknown"]);
      var key = JSON.stringify([groupKey, row.package_size_label]);
      if (!columns.has(key)) columns.set(key, { key: key, groupKey: groupKey, carrier: row.carrier_name, service: row.service_name, origin: row.origin_region || "", tax: row.tax_type || "unknown", size: row.package_size_label, weight: row.max_weight_kg, noteIds: new Set() });
      var column = columns.get(key);
      if (column.weight !== row.max_weight_kg) throw new Error("INCONSISTENT_LIMIT");
      var note = { island: row.remote_island_fee_jpy, condition: row.remote_island_condition || "", text: row.note || "" };
      var noteKey = JSON.stringify(note);
      if (!noteIds.has(noteKey)) { noteIds.set(noteKey, notes.length + 1); notes.push(note); }
      var noteId = noteIds.get(noteKey);
      column.noteIds.add(noteId);
      if (!destinations.has(pref)) destinations.set(pref, new Map());
      if (destinations.get(pref).has(key)) throw new Error("DUPLICATE");
      destinations.get(pref).set(key, { fee: row.standard_fee_jpy, noteId: noteId });
    });
    var ordered = Array.from(columns.values()).sort(function(a, b) {
      return a.carrier.localeCompare(b.carrier, "ja") || serviceRank(a.service) - serviceRank(b.service) ||
        a.service.localeCompare(b.service, "ja") || a.origin.localeCompare(b.origin, "ja") ||
        a.tax.localeCompare(b.tax, "ja") || a.size.localeCompare(b.size, "ja", { numeric: true });
    });
    var groups = [], last;
    ordered.forEach(function(column) {
      if (!last || last.key !== column.groupKey) {
        last = { key: column.groupKey, carrier: column.carrier, service: column.service, origin: column.origin, tax: column.tax, columns: [], noteIds: new Set() };
        groups.push(last);
      }
      last.columns.push(column);
      column.noteIds.forEach(function(id) { last.noteIds.add(id); });
    });
    var lines = [], lineKeys = new Map();
    Array.from({ length: 47 }, function(_, index) { return index + 1; }).forEach(function(pref) {
      var cells = ordered.map(function(column) { return destinations.has(pref) ? destinations.get(pref).get(column.key) || null : null; });
      var lineKey = JSON.stringify(cells);
      if (!lineKeys.has(lineKey)) { lineKeys.set(lineKey, lines.length); lines.push({ prefectures: [], cells: cells }); }
      lines[lineKeys.get(lineKey)].prefectures.push({ code: pref, label: prefectures[pref] });
    });
    return { columns: ordered, groups: groups, lines: lines, notes: notes, sourceCount: active.length, destinationCount: destinations.size };
  }
  function documentHtml(model, options) {
    var lang = TEXT[options.lang] ? options.lang : "ja", text = TEXT[lang];
    var units = { ja: "サイズ：3辺合計(cm) / 重量上限(kg)", en: "Size: total dimensions (cm) / maximum weight (kg)", zh: "尺寸：三边合计(cm) / 重量上限(kg)" }[lang];
    function common(field) { var values = Array.from(new Set(model.groups.map(function(group) { return group[field]; }))); return values.length === 1 ? values[0] : ""; }
    var commonCarrier = common("carrier"), commonOrigin = common("origin"), commonTax = common("tax");
    var summary = [commonCarrier, commonOrigin ? commonOrigin + text.origin : "", commonTax ? text[commonTax] || text.unknown : ""].filter(Boolean).join(" · ");
    var stylesheet = new URL("shipping-rate-print.css", options.baseUrl).href + "?v=" + encodeURIComponent(options.version);
    var script = new URL("shipping-rate-print.js", options.baseUrl).href + "?v=" + encodeURIComponent(options.version);
    var groupHeader = model.groups.map(function(group) {
      var tax = text[group.tax] || text.unknown;
      var detail = [!commonOrigin && group.origin ? group.origin + text.origin : "", !commonTax ? tax : ""].filter(Boolean).join(" · ");
      return "<th scope='colgroup' colspan='" + group.columns.length + "'>" + safe((commonCarrier ? "" : group.carrier + " / ") + group.service) +
        (group.noteIds.size === 1 ? " <sup>" + Array.from(group.noteIds)[0] + "</sup>" : "") +
        (detail ? "<span class='group-detail'>" + safe(detail) + "</span>" : "") + "</th>";
    }).join("");
    var sizes = model.columns.map(function(column) {
      var numeric = /^(\d+)サイズ$/.exec(column.size);
      return "<th scope='col'>" + (numeric ? "<span class='size-value'>" + numeric[1] + "</span>" : safe(column.size)) + (column.weight != null ? "<small>" + safe(column.weight) + "kg</small>" : "") + "</th>";
    }).join("");
    var body = REGIONS.map(function(region) {
      return model.lines.map(function(line) {
        var prefectures = line.prefectures.filter(function(pref) { return region.codes.indexOf(pref.code) >= 0; });
        if (!prefectures.length) return "";
        var destinations = "<span class='destination-region'><strong class='region-heading'>" + safe(region.labels[lang === "en" ? 1 : lang === "zh" ? 2 : 0]) +
          "</strong><span class='region-prefectures'>" + prefectures.map(function(pref) { return "<span class='prefecture'>" + safe(pref.label) + "</span>"; }).join("・") + "</span></span>";
        return "<tr><th scope='row' class='destinations'>" + destinations + "</th>" +
          line.cells.map(function(cell, index) {
            var group = model.groups.find(function(g) { return g.key === model.columns[index].groupKey; });
            return "<td>" + (cell ? safe(amount(cell.fee, text.inquiry)) + (group.noteIds.size > 1 ? "<sup>" + cell.noteId + "</sup>" : "") : "—") + "</td>";
          }).join("") + "</tr>";
      }).join("");
    }).join("");
    var notes = model.notes.map(function(note, index) {
      return "<li><b>" + (index + 1) + "</b> " + safe(text.island + ": " + amount(note.island, text.inquiry)) +
        (note.condition ? " / " + safe(customerNoteText(note.condition)) : "") + (note.text ? " / " + safe(customerNoteText(note.text)) : "") + "</li>";
    }).join("");
    var date = new Date(options.createdAt || Date.now()).toLocaleString(lang === "en" ? "en-GB" : "ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    return "<!doctype html><html lang='" + lang + "'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<title>" + safe(text.title) + "</title><link rel='stylesheet' href='" + safe(stylesheet) + "'><script defer src='" + safe(script) + "'></script></head><body>" +
      "<div class='print-toolbar'><span>" + safe(text.help) + "</span><button id='shipping-print-now' disabled>" + safe(text.print) + "</button><button id='shipping-print-close'>" + safe(text.close) + "</button><p id='shipping-print-error' role='alert' hidden>" + safe(text.overflow) + "</p></div>" +
      "<div id='shipping-print-page-probe' aria-hidden='true'></div><main class='shipping-print-sheet' id='shipping-print-sheet'>" +
      "<header><div><p class='eyebrow'>D-CATS</p><h1>" + safe(text.title) + "</h1></div><div class='meta'><p class='summary'>" + safe(summary) + "</p><p>" + safe(text.scope) + "</p><p>" + safe(text.created + ": " + date + " JST") + "</p></div></header>" +
      "<p class='scope-note'>" + safe(text.description) + " " + safe(units) + "</p><table><caption class='sr-only'>" + safe(text.scope) + "</caption><colgroup><col class='destination-column'>" + model.columns.map(function(column) { return model.groups.find(function(group) { return group.key === column.groupKey; }).columns.length === 1 ? "<col class='single-size-column'>" : "<col>"; }).join("") +
      "</colgroup><thead><tr><th scope='col' rowspan='2'>" + safe(text.destination) + "</th>" + groupHeader + "</tr><tr>" + sizes + "</tr></thead><tbody>" + body +
      "</tbody></table><footer><p>" + safe(text.missing) + "</p><ol class='rate-notes'>" + notes + "</ol></footer></main></body></html>";
  }
  function bindPreview(win) {
    var doc = win.document;
    function bind() {
      var sheet = doc.getElementById("shipping-print-sheet");
      if (!sheet) return;
      var button = doc.getElementById("shipping-print-now"), warning = doc.getElementById("shipping-print-error");
      function fit() {
        var probe = doc.getElementById("shipping-print-page-probe").getBoundingClientRect(), fits = false;
        for (var percent = 100; percent >= 40; percent -= 5) {
          sheet.className = "shipping-print-sheet fit-" + percent;
          var bounds = sheet.getBoundingClientRect();
          if (bounds.width <= probe.width + 1 && bounds.height <= probe.height - 2) { fits = true; break; }
        }
        button.disabled = !fits;
        warning.hidden = fits;
        sheet.dataset.fitsA4 = String(fits);
        return fits;
      }
      button.addEventListener("click", function() { if (fit()) win.print(); });
      doc.getElementById("shipping-print-close").addEventListener("click", function() { win.close(); });
      win.addEventListener("beforeprint", fit);
      fit();
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit);
    }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", bind, { once: true });
    else bind();
  }
  return { buildModel: buildModel, documentHtml: documentHtml, bindPreview: bindPreview };
});
