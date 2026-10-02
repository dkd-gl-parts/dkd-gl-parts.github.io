(function(root) {
  "use strict";
  var makers = ["トヨタ", "レクサス", "三菱", "ホンダ", "ニッサン", "インフィニティ", "スバル", "マツダ", "スズキ", "ダイハツ", "BMW", "メルセデス", "アウディ", "フォルクスワーゲン", "ポルシェ", "ジャガー"];
  var words = {
    ja: {button:"適合車両を調べる", title:"PARTS FANで適合車両を調べる", part:"純正品番", maker:"自動車メーカー", choose:"選択してください", download:"調査用CSVをダウンロード", external:"PARTS FANで確認する ↗", close:"閉じる", note:"自動車メーカーを指定し、CSVをPCの調査ツールで実行してください。結果は内容を確認してから登録します。", invalid:"純正品番と自動車メーカーを指定してください。", saved:"CSVをダウンロードしました。PCの調査ツールへ読み込んでください。", grade:"グレード", transmission:"ミッション", chassis:"車台番号範囲", source:"出典・収集日時"},
    en: {button:"Research vehicle fitment", title:"Research fitment on PARTS FAN", part:"Genuine part number", maker:"Vehicle manufacturer", choose:"Select a manufacturer", download:"Download research CSV", external:"View on PARTS FAN ↗", close:"Close", note:"Select the vehicle manufacturer and run the CSV in the PC research tool. Review the results before registering them.", invalid:"Enter a genuine part number and select a vehicle manufacturer.", saved:"CSV downloaded. Load it into the PC research tool.", grade:"Grade", transmission:"Transmission", chassis:"Chassis range", source:"Source / collected at"},
    zh: {button:"查询适配车辆", title:"通过PARTS FAN查询适配车辆", part:"原厂零件号", maker:"汽车制造商", choose:"请选择", download:"下载查询CSV", external:"在PARTS FAN确认 ↗", close:"关闭", note:"请选择汽车制造商，在电脑查询工具中运行CSV。确认结果后再登记。", invalid:"请输入原厂零件号并选择汽车制造商。", saved:"CSV已下载，请在电脑查询工具中打开。", grade:"配置", transmission:"变速箱", chassis:"车架号码范围", source:"来源／采集时间"}
  };
  var active = null, previousFocus = null;
  function label(key) { return (words[root.currentLang] || words.ja)[key] || key; }
  function clean(value) { return typeof value === "string" ? value.trim() : ""; }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function(c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function permitted() { return typeof root.canManageProductSpecs === "function" && root.canManageProductSpecs(); }
  function validPart(part) { return /^[A-Za-z0-9][A-Za-z0-9 .\/-]{1,63}$/.test(part); }
  function inputCsv(part, maker) {
    part = clean(part); maker = clean(maker);
    if (!validPart(part) || makers.indexOf(maker) < 0) throw new Error("invalid_research_input");
    function cell(value) { return '"' + value.replace(/"/g, '""') + '"'; }
    return "\ufeff品番,メーカー\r\n" + cell(part) + "," + cell(maker) + "\r\n";
  }
  function details(payload) {
    payload = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
    var result = {};
    ["grade", "transmission", "chassis_range", "vehicle_list_chassis_range", "detail_chassis_range", "representative_model_note"].forEach(function(key) {
      var value = clean(payload[key]);
      result[key] = value.length <= 300 ? value : "";
    });
    result.chassis_range_review = clean(payload.chassis_range_review) === "vehicle_list_vs_detail_conflict";
    result.source_url = "";
    try {
      var url = new URL(clean(payload.source_url));
      if (url.origin === "https://partsfan.com" && !url.username && !url.password && !url.search && !url.hash && /^\/[A-Za-z0-9_%./+\-=]*$/.test(url.pathname) && /\/(crossp|crosstp|pnodetail)\//.test(url.pathname)) result.source_url = url.href;
    } catch (_) {}
    var date = clean(payload.collected_at);
    result.collected_at = date.length <= 64 && Number.isFinite(Date.parse(date)) ? date : "";
    return result;
  }
  function sourceHtml(row) {
    var info = details(row.partsfan_details);
    var html = info.source_url ? "<a href='" + esc(info.source_url) + "' target='_blank' rel='noopener noreferrer'>PARTS FAN ↗</a>" : "PARTS FAN";
    if (info.collected_at) html += "<div class='component-sub'>" + esc(new Date(info.collected_at).toLocaleString((root.currentLang === "en" ? "en" : root.currentLang === "zh" ? "zh" : "ja") + "-JP", {timeZone:"Asia/Tokyo"})) + "</div>";
    if (info.representative_model_note) html += "<div class='component-sub'>" + esc(info.representative_model_note) + "</div>";
    return html;
  }
  function buttonHtml() {
    return permitted() ? "<div class='partsfan-research-actions'><button class='btn-sm-edit' type='button' data-partsfan-research>" + esc(label("button")) + "</button></div>" : "";
  }
  function bind(host, product) {
    if (!host) return;
    Array.prototype.forEach.call(host.querySelectorAll("[data-partsfan-research]"), function(button) {
      button.onclick = function() { if (permitted()) open(product); };
    });
  }
  function close() {
    if (active) active.remove();
    active = null;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    previousFocus = null;
  }
  function open(product) {
    if (!permitted()) return false;
    close();
    previousFocus = document.activeElement;
    var host = document.createElement("div");
    host.className = "form-overlay show partsfan-research-overlay";
    host.innerHTML = "<section class='partsfan-research-dialog' role='dialog' aria-modal='true' aria-labelledby='partsfan-research-title'><header><h2 id='partsfan-research-title'>" + esc(label("title")) + "</h2><button type='button' data-pfr-close aria-label='" + esc(label("close")) + "'>×</button></header>" +
      "<p>" + esc(label("note")) + "</p><label for='pfr-part'>" + esc(label("part")) + "</label><input id='pfr-part' maxlength='64' autocomplete='off'><label for='pfr-maker'>" + esc(label("maker")) + "</label><select id='pfr-maker'><option value=''>" + esc(label("choose")) + "</option>" + makers.map(function(maker) { return "<option value='" + esc(maker) + "'>" + esc(maker) + "</option>"; }).join("") + "</select><p id='pfr-status' role='status' aria-live='polite'></p><div class='partsfan-research-actions'><button type='button' class='btn-primary' id='pfr-download'>" + esc(label("download")) + "</button><a id='pfr-external' target='_blank' rel='noopener noreferrer' aria-disabled='true'>" + esc(label("external")) + "</a></div></section>";
    active = host;
    document.body.appendChild(host);
    var part = host.querySelector("#pfr-part"), maker = host.querySelector("#pfr-maker"), status = host.querySelector("#pfr-status"), external = host.querySelector("#pfr-external");
    var initial = clean(product && product.genuine_part_number);
    part.value = validPart(initial) ? initial : "";
    // Vehicle manufacturer is always an explicit choice; never infer it from a parts brand.
    function changed() {
      status.textContent = "";
      if (validPart(clean(part.value)) && makers.indexOf(maker.value) >= 0 && permitted()) {
        external.href = "https://partsfan.com/partinfo/all/" + encodeURIComponent(clean(part.value));
        external.removeAttribute("aria-disabled");
      } else {
        external.removeAttribute("href");
        external.setAttribute("aria-disabled", "true");
      }
    }
    part.addEventListener("input", changed); maker.addEventListener("change", changed); changed();
    external.addEventListener("click", function(event) { if (!permitted() || external.getAttribute("aria-disabled") === "true") event.preventDefault(); });
    host.querySelector("#pfr-download").onclick = function() {
      if (!permitted()) { close(); return; }
      try {
        var value = inputCsv(part.value, maker.value);
        var url = URL.createObjectURL(new Blob([value], {type:"text/csv;charset=utf-8"}));
        var link = document.createElement("a");
        link.href = url; link.download = "partsfan-" + clean(part.value).replace(/[^A-Za-z0-9-]/g, "_") + ".csv";
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
        status.textContent = label("saved");
      } catch (_) { status.textContent = label("invalid"); }
    };
    host.querySelector("[data-pfr-close]").onclick = close;
    host.addEventListener("click", function(event) { if (event.target === host) close(); });
    host.addEventListener("keydown", function(event) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      var fields = Array.prototype.slice.call(host.querySelectorAll("button,input,select,a[href]")).filter(function(x) { return !x.disabled; });
      var first = fields[0], last = fields[fields.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    part.focus();
    return true;
  }
  root.PartsfanResearch = {label:label, inputCsv:inputCsv, details:details, sourceHtml:sourceHtml, buttonHtml:buttonHtml, bind:bind, open:open, close:close};
})(typeof window !== "undefined" ? window : globalThis);
