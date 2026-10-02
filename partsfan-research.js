(function(root) {
  "use strict";
  var makers = ["トヨタ", "レクサス", "三菱", "ホンダ", "ニッサン", "インフィニティ", "スバル", "マツダ", "スズキ", "ダイハツ", "BMW", "メルセデス", "アウディ", "フォルクスワーゲン", "ポルシェ", "ジャガー"];
  var makerCodes = ["toyota", "lexus", "mitsubishi", "honda", "nissan", "infiniti", "subaru", "mazda", "suzuki", "daihatsu", "bmw", "mercedes", "audi", "vw", "porsche", "jaguar"];
  var words = {
    ja: {button:"適合車両を調べる・更新", title:"PARTS FANで適合車両を調べる・更新", part:"純正品番", maker:"自動車メーカー", choose:"選択してください", download:"調査用CSVをダウンロード", external:"PARTS FANで確認する ↗", close:"閉じる", note:"メーカーを指定してPCの調査ツールで収集します。収集結果ファイルを選び、各行と出典を確認して登録してください。未完了・ブロックされた結果は登録できません。", invalid:"純正品番と自動車メーカーを指定してください。", saved:"CSVをダウンロードしました。PCの調査ツールへ読み込んでください。", grade:"グレード", transmission:"ミッション", chassis:"車体番号", source:"出典", reviewFile:"収集結果（applications.review.json）", reviewed:"表示された適合車両と出典を確認しました", import:"確認した結果を適合車両へ登録", imported:"登録完了", badFile:"完了した同じ品番・メーカーの収集結果を選んでください。", adminOnly:"登録はシステム管理者のみ可能です。", vehicleType:"車種/用途", model:"機種/型式", engine:"エンジン", added:"件追加", updated:"件更新"},
    en: {button:"Research / update fitment", title:"Research and update fitment on PARTS FAN", part:"Genuine part number", maker:"Vehicle manufacturer", choose:"Select a manufacturer", download:"Download research CSV", external:"View on PARTS FAN ↗", close:"Close", note:"Run the PC collector for the selected manufacturer, then review each result and its source before importing. Incomplete or blocked runs cannot be imported.", invalid:"Enter a genuine part number and select a vehicle manufacturer.", saved:"CSV downloaded. Load it into the PC research tool.", grade:"Grade", transmission:"Transmission", chassis:"Chassis range", source:"Source / collected at", reviewFile:"Collector result (applications.review.json)", reviewed:"I checked the listed vehicles and sources", import:"Import reviewed fitments", imported:"Import completed", badFile:"Select a completed result for this part and manufacturer.", adminOnly:"Only system administrators can import fitments.", vehicleType:"Vehicle", model:"Model", engine:"Engine", added:"added", updated:"updated"},
    zh: {button:"查询／更新适配车辆", title:"通过PARTS FAN查询及更新适配车辆", part:"原厂零件号", maker:"汽车制造商", choose:"请选择", download:"下载查询CSV", external:"在PARTS FAN确认 ↗", close:"关闭", note:"在电脑工具中采集所选厂商的数据，核对车辆及来源后导入。未完成或受阻的结果不可导入。", invalid:"请输入原厂零件号并选择汽车制造商。", saved:"CSV已下载，请在电脑查询工具中打开。", grade:"配置", transmission:"变速箱", chassis:"车架号码范围", source:"来源／采集时间", reviewFile:"采集结果（applications.review.json）", reviewed:"已核对车辆及来源", import:"导入已核对的适配车辆", imported:"导入完成", badFile:"请选择该零件和厂商的已完成采集结果。", adminOnly:"仅系统管理员可导入。", vehicleType:"车型", model:"型号", engine:"发动机", added:"新增", updated:"更新"}
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
  function normalized(value) { return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function reviewRows(documentValue, part, maker) {
    if (!documentValue || documentValue.format !== "dcats.partsfan.review.v1" || !Array.isArray(documentValue.items)) throw new Error("invalid_review_format");
    var code = makerCodes[makers.indexOf(maker)];
    if (!validPart(clean(part)) || !code) throw new Error("invalid_research_input");
    var matches = documentValue.items.filter(function(item) { return item && item.maker === code && normalized(item.part) === normalized(part); });
    if (matches.length !== 1 || matches[0].status !== "completed" || !Array.isArray(matches[0].records) || !matches[0].records.length || matches[0].records.length > 100) throw new Error("incomplete_review_item");
    var seen = {};
    return matches[0].records.map(function(row) {
      var raw = row && row.raw_payload;
      var url;
      try { url = new URL(raw && raw.source_url); } catch (_) { throw new Error("invalid_source_url"); }
      if (!row || row.source_code !== "partsfan" || row.source_table !== "genuine_applications" || row.part_role !== "partsfan_genuine_application" || row.is_catalog_evidence !== true ||
          row.catalog_manufacturer !== code.toUpperCase() || normalized(row.genuine_part_number) !== normalized(part) || row.normalized_genuine_part_number !== normalized(part) ||
          !/^[0-9a-f]{64}$/.test(row.source_record_key || "") || seen[row.source_record_key] || !clean(row.vehicle_type) || !clean(row.model) || !clean(row.vehicle_manufacturer) ||
          url.origin !== "https://partsfan.com" || url.username || url.password || url.search || url.hash ||
          url.pathname.indexOf("/" + code + "/") !== 0 || url.pathname.indexOf("/pnodetail/") < 0 || normalized(url.pathname.split("/").filter(Boolean).pop()) !== normalized(part) ||
          raw.chassis_range_review || !raw.collected_at || !Number.isFinite(Date.parse(raw.collected_at))) throw new Error("invalid_application_evidence");
      seen[row.source_record_key] = true;
      return row;
    });
  }
  function previewHtml(rows) {
    return "<div class='partsfan-review-scroll'><table><thead><tr><th>" + esc(label("maker")) + "</th><th>" + esc(label("vehicleType")) + "</th><th>" + esc(label("model")) + "</th><th>" + esc(label("engine")) + "</th><th>" + esc(label("chassis")) + "</th><th>" + esc(label("source")) + "</th></tr></thead><tbody>" + rows.map(function(row) {
      var raw = row.raw_payload || {};
      return "<tr><td>" + esc(row.vehicle_manufacturer) + "</td><td>" + esc(row.vehicle_type) + "</td><td>" + esc(row.model) + "</td><td>" + esc(row.engine || "-") + "</td><td>" + esc(raw.chassis_range || "-") + "</td><td><a href='" + esc(raw.source_url) + "' target='_blank' rel='noopener noreferrer'>PARTS FAN ↗</a></td></tr>";
    }).join("") + "</tbody></table></div>";
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
      "<p>" + esc(label("note")) + "</p><label for='pfr-part'>" + esc(label("part")) + "</label><input id='pfr-part' maxlength='64' autocomplete='off'><label for='pfr-maker'>" + esc(label("maker")) + "</label><select id='pfr-maker'><option value=''>" + esc(label("choose")) + "</option>" + makers.map(function(maker) { return "<option value='" + esc(maker) + "'>" + esc(maker) + "</option>"; }).join("") + "</select><p id='pfr-status' role='status' aria-live='polite'></p><div class='partsfan-research-actions'><button type='button' class='btn-primary' id='pfr-download'>" + esc(label("download")) + "</button><a id='pfr-external' target='_blank' rel='noopener noreferrer' aria-disabled='true'>" + esc(label("external")) + "</a></div>" +
      (typeof root.canImportPartsfanFitments === "function" && root.canImportPartsfanFitments()
        ? "<div class='partsfan-review'><label for='pfr-review-file'>" + esc(label("reviewFile")) + "</label><input type='file' id='pfr-review-file' accept='.json,application/json'><div id='pfr-preview'></div><label class='partsfan-review-confirm'><input type='checkbox' id='pfr-confirm'>" + esc(label("reviewed")) + "</label><button type='button' class='btn-primary' id='pfr-import' disabled>" + esc(label("import")) + "</button></div>"
        : "<p>" + esc(label("adminOnly")) + "</p>") + "</section>";
    active = host;
    document.body.appendChild(host);
    var part = host.querySelector("#pfr-part"), maker = host.querySelector("#pfr-maker"), status = host.querySelector("#pfr-status"), external = host.querySelector("#pfr-external");
    var initial = clean(product && product.genuine_part_number);
    part.value = validPart(initial) ? initial : "";
    // Vehicle manufacturer is always an explicit choice; never infer it from a parts brand.
    var reviewFile = host.querySelector("#pfr-review-file"), preview = host.querySelector("#pfr-preview"), confirm = host.querySelector("#pfr-confirm"), importButton = host.querySelector("#pfr-import");
    var readyRows = null, busy = false;
    function resetReview() {
      readyRows = null;
      if (reviewFile) reviewFile.value = "";
      if (preview) preview.innerHTML = "";
      if (confirm) confirm.checked = false;
      if (importButton) importButton.disabled = true;
    }
    function changed() {
      status.textContent = "";
      resetReview();
      if (validPart(clean(part.value)) && makers.indexOf(maker.value) >= 0 && permitted()) {
        external.href = "https://partsfan.com/partinfo/all/" + encodeURIComponent(clean(part.value));
        external.removeAttribute("aria-disabled");
      } else {
        external.removeAttribute("href");
        external.setAttribute("aria-disabled", "true");
      }
    }
    part.addEventListener("input", changed); maker.addEventListener("change", changed); changed();
    if (reviewFile) reviewFile.addEventListener("change", async function() {
      var file = reviewFile.files && reviewFile.files[0];
      readyRows = null;
      preview.innerHTML = "";
      confirm.checked = false;
      importButton.disabled = true;
      if (!file || file.size > 1000000) { status.textContent = label("badFile"); return; }
      try {
        if (!validPart(initial) || normalized(part.value) !== normalized(initial)) throw new Error("part_mismatch");
        readyRows = reviewRows(JSON.parse(await file.text()), part.value, maker.value);
        preview.innerHTML = "<p>" + readyRows.length + " 件</p>" + previewHtml(readyRows);
        status.textContent = "";
      } catch (_) { resetReview(); status.textContent = label("badFile"); }
    });
    if (confirm) confirm.addEventListener("change", function() { importButton.disabled = busy || !confirm.checked || !readyRows; });
    if (importButton) importButton.onclick = async function() {
      if (busy || !readyRows || !confirm.checked || !permitted() || !root.canImportPartsfanFitments()) return;
      busy = true; importButton.disabled = true;
      try {
        var summary = await root.importPartsfanApplications(clean(part.value), makerCodes[makers.indexOf(maker.value)], readyRows);
        status.textContent = label("imported") + "：" + summary.inserted + " " + label("added") + "、" + summary.updated + " " + label("updated");
        resetReview();
      } catch (error) { status.textContent = error && error.message ? error.message : label("badFile"); }
      finally { busy = false; }
    };
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
  root.PartsfanResearch = {label:label, inputCsv:inputCsv, reviewRows:reviewRows, details:details, sourceHtml:sourceHtml, buttonHtml:buttonHtml, bind:bind, open:open, close:close};
})(typeof window !== "undefined" ? window : globalThis);
