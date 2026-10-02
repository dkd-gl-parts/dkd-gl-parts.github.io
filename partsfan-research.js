(function(root) {
  "use strict";
  var makers = ["トヨタ", "レクサス", "三菱", "ホンダ", "ニッサン", "インフィニティ", "スバル", "マツダ", "スズキ", "ダイハツ", "BMW", "メルセデス", "アウディ", "フォルクスワーゲン", "ポルシェ", "ジャガー"];
  var makerCodes = ["toyota", "lexus", "mitsubishi", "honda", "nissan", "infiniti", "subaru", "mazda", "suzuki", "daihatsu", "bmw", "mercedes", "audi", "vw", "porsche", "jaguar"];
  var words = {
    ja: {button:"適合車両を更新", title:"PARTS FANの適合車両を更新", part:"純正品番", maker:"自動車メーカー", choose:"選択してください", start:"データを取得", retry:"もう一度取得", resume:"続きから取得", humanResume:"確認後に再開", humanChecked:"専用Chromeで状態を確認し、閉じました", openProfile:"専用Chromeを開く", close:"閉じる", note:"メーカーを指定してデータを取得します。結果と出典を確認した後に登録できます。", invalid:"純正品番と自動車メーカーを指定してください。", running:"データ取得中です。画面を閉じてもPC側の処理は続きます。", ready:"取得が完了しました。内容を確認してください。", unavailable:"PCのPARTS FAN連携が起動していません。連携を起動してから押し直してください。", disconnected:"PCとの接続が切れました。連携状態を確認して押し直してください。", blocked:"PARTS FANがアクセスを制限しました。自動再試行は行いません。専用Chromeで状態を確認し、閉じてから再開してください。", challenge:"Cloudflareの検証が自動通過しませんでした。専用Chromeで状態を確認し、閉じてから再開してください。", captcha:"CAPTCHAまたはアクセス上限が表示されました。ご本人が専用Chromeで対応し、閉じてから再開してください。", budget:"1回の取得上限に達しました。続きから取得できます。", manual:"この品番のサイト構造を自動確認できませんでした。出典を手動で確認してください。", notFound:"この品番の適合情報は見つかりませんでした。", failed:"データ取得に失敗しました。PC連携と専用Chromeの状態を確認して押し直してください。", profileOpened:"専用Chromeを開きました。確認後に閉じてください。", grade:"グレード", transmission:"ミッション", chassis:"車体番号", source:"出典", period:"年式（生産期間）", yearUnknown:"年式未確認", reviewed:"表示された適合車両と出典を確認しました", import:"確認した結果を適合車両へ登録", imported:"登録完了", importConflict:"既存の車体番号に要確認・不一致の行があります。登録は行われていません。出典を確認して問題を解消した後、押し直してください。", importAmbiguous:"既存の適合車両と一意に対応付けられません。登録は行われていません。管理者が既存行を確認してください。", importFailed:"登録に失敗しました。データを確認してから押し直してください。", badResult:"取得結果を確認できませんでした。再取得してください。", adminOnly:"登録はシステム管理者のみ可能です。", vehicleType:"車種/用途", model:"機種/型式", engine:"エンジン", added:"件追加", updated:"件更新"},
    en: {button:"Update fitment", title:"Update PARTS FAN fitment", part:"Genuine part number", maker:"Vehicle manufacturer", choose:"Select a manufacturer", start:"Get data", retry:"Try again", resume:"Continue collection", humanResume:"Resume after checking", humanChecked:"I checked and closed the dedicated Chrome", openProfile:"Open dedicated Chrome", close:"Close", note:"Collect fitments for the selected manufacturer, then review the vehicles and sources before importing.", invalid:"Enter a genuine part number and select a vehicle manufacturer.", running:"Collection is running on this PC. It continues if you close this dialog.", ready:"Collection completed. Review the results.", unavailable:"The local PARTS FAN bridge is not running. Start it and retry.", disconnected:"Connection to the PC was lost. Check the bridge and retry.", blocked:"PARTS FAN limited access. Check the dedicated Chrome, close it, then resume. No automatic retry occurs.", challenge:"Cloudflare verification did not pass automatically. Check the dedicated Chrome, close it, then resume.", captcha:"CAPTCHA or a daily limit appeared. Complete any required action yourself in the dedicated Chrome, close it, then resume.", budget:"The per-run page limit was reached. You can continue.", manual:"This part's site structure could not be verified automatically. Review the source manually.", notFound:"No fitment was found for this part.", failed:"Collection failed. Check the local bridge and dedicated Chrome, then retry.", profileOpened:"Dedicated Chrome opened. Close it after checking.", grade:"Grade", transmission:"Transmission", chassis:"Chassis range", source:"Source / collected at", period:"Model year (production period)", yearUnknown:"Year unverified", reviewed:"I checked the listed vehicles and sources", import:"Import reviewed fitments", imported:"Import completed", importConflict:"Existing chassis evidence conflicts with the new result. Nothing was imported. Review and resolve it, then retry.", importAmbiguous:"The existing fitment cannot be matched uniquely. Nothing was imported. An administrator must review the rows.", importFailed:"Import failed. Check the data and retry.", badResult:"The collection result could not be verified. Collect again.", adminOnly:"Only system administrators can import fitments.", vehicleType:"Vehicle", model:"Model", engine:"Engine", added:"added", updated:"updated"},
    zh: {button:"更新适配车辆", title:"更新PARTS FAN适配车辆", part:"原厂零件号", maker:"汽车制造商", choose:"请选择", start:"获取数据", retry:"重新获取", resume:"继续获取", humanResume:"确认后继续", humanChecked:"已检查并关闭专用Chrome", openProfile:"打开专用Chrome", close:"关闭", note:"指定制造商获取数据，核对车辆和来源后再导入。", invalid:"请输入原厂零件号并选择汽车制造商。", running:"本机正在获取数据。关闭此窗口后处理仍会继续。", ready:"获取完成，请核对内容。", unavailable:"本机PARTS FAN连接未启动。启动后重试。", disconnected:"与本机连接中断。检查后重试。", blocked:"PARTS FAN限制了访问。请检查专用Chrome，关闭后继续；不会自动重试。", challenge:"Cloudflare验证未自动通过。请检查专用Chrome，关闭后继续。", captcha:"出现CAPTCHA或访问上限。请自行在专用Chrome处理，关闭后继续。", budget:"达到单次访问上限，可以继续。", manual:"无法自动确认该零件的网站结构，请手动核对来源。", notFound:"未找到该零件的适配信息。", failed:"获取失败。检查本机连接及专用Chrome后重试。", profileOpened:"已打开专用Chrome，检查后请关闭。", grade:"配置", transmission:"变速箱", chassis:"车架号码范围", source:"来源／采集时间", period:"年款（生产期间）", yearUnknown:"年款未确认", reviewed:"已核对车辆及来源", import:"导入已核对的适配车辆", imported:"导入完成", importConflict:"现有车架号码证据与新结果冲突，未导入任何记录。请核对并解决后重试。", importAmbiguous:"无法唯一对应现有适配车辆，未导入任何记录。请管理员检查。", importFailed:"导入失败。请检查数据后重试。", badResult:"无法验证获取结果，请重新获取。", adminOnly:"仅系统管理员可导入。", vehicleType:"车型", model:"型号", engine:"发动机", added:"新增", updated:"更新"}
  };
  var active = null, previousFocus = null, pollTimer = null;
  var bridgeBase = "http://127.0.0.1:37644";
  function label(key) { return (words[root.currentLang] || words.ja)[key] || key; }
  function clean(value) { return typeof value === "string" ? value.trim() : ""; }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function(c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function permitted() { return typeof root.canManageProductSpecs === "function" && root.canManageProductSpecs() && typeof root.canImportPartsfanFitments === "function" && root.canImportPartsfanFitments(); }
  function validPart(part) { return /^[A-Za-z0-9][A-Za-z0-9 .\/-]{1,63}$/.test(part); }
  async function bridgeRequest(path, method, body) {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 5000);
    try {
      var response = await fetch(bridgeBase + path, {
        method: method || "GET", mode: "cors", credentials: "omit", cache: "no-store",
        referrerPolicy: "no-referrer", targetAddressSpace: "loopback", signal: controller.signal,
        headers: {"Content-Type": "application/json", "X-Dcats-Partsfan-Request": "1"},
        body: body ? JSON.stringify(body) : undefined
      });
      var value = await response.json();
      if (!response.ok) throw new Error(value && value.error || "bridge_http_error");
      return value;
    } finally { clearTimeout(timeout); }
  }
  function stopLabel(job) {
    var reason = job && job.reason || "";
    if (reason === "cloudflare_verification_pending") return label("challenge");
    if (/^captcha|^http_block_(403|429|5\d\d)$|human_check_required/.test(reason)) return label("captcha");
    if (job && job.state === "paused_budget") return label("budget");
    if (job && job.state === "manual_review") return label("manual") + " (" + reason + ")";
    if (job && job.state === "not_found") return label("notFound");
    if (job && (job.state === "blocked" || job.state === "requires_login")) return label("blocked");
    return label("failed") + (reason ? " (" + reason + ")" : "");
  }
  function importErrorLabel(error) {
    var reason = error && error.message || "";
    if (/production_period_change_requires_manual_resolution/.test(reason)) {
      return root.currentLang === "en" ? "The verified production period differs from the existing record. Review it before importing." :
        root.currentLang === "zh" ? "已核实的生产期间与现有记录不一致，请核对后再导入。" :
        "確認済みの年式が既存記録と異なります。内容を確認してから登録してください。";
    }
    if (/reviewed_chassis_conflict_requires_manual_resolution|chassis_change_requires_manual_resolution/.test(reason)) return label("importConflict");
    if (/legacy_application_match_ambiguous|existing_application_identity_mismatch/.test(reason)) return label("importAmbiguous");
    return label("importFailed");
  }
  function normalized(value) { return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function validPeriod(row) {
    var start = clean(row.effective_start), end = clean(row.effective_end);
    var period = typeof row.production_period_text === "string" ? row.production_period_text : "";
    var basis = clean(row.raw_payload && row.raw_payload.production_period_basis);
    if (!start) return !end && !period && !basis;
    if (!/^(19|20)\d{2}\/(0[1-9]|1[0-2])$/.test(start) ||
        (end && (!/^(19|20)\d{2}\/(0[1-9]|1[0-2])$/.test(end) || end < start))) return false;
    return period === (start + " - " + end) && (basis === "application_row" || basis === "vehicle_model_page");
  }
  function reviewRows(documentValue, part, maker) {
    if (!documentValue || documentValue.format !== "dcats.partsfan.review.v1" || !Array.isArray(documentValue.items)) throw new Error("invalid_review_format");
    var code = makerCodes[makers.indexOf(maker)];
    if (!validPart(clean(part)) || !code) throw new Error("invalid_research_input");
    var matches = documentValue.items.filter(function(item) { return item && item.maker === code && normalized(item.part) === normalized(part); });
    if (matches.length !== 1 || matches[0].status !== "completed" || !Array.isArray(matches[0].records) || !matches[0].records.length || matches[0].records.length > 500) throw new Error("incomplete_review_item");
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
          raw.chassis_range_review || !raw.collected_at || !Number.isFinite(Date.parse(raw.collected_at)) ||
          !validPeriod(row)) throw new Error("invalid_application_evidence");
      seen[row.source_record_key] = true;
      return row;
    });
  }
  function previewHtml(rows) {
    return "<div class='partsfan-review-scroll'><table><thead><tr><th>" + esc(label("maker")) + "</th><th>" + esc(label("vehicleType")) + "</th><th>" + esc(label("model")) + "</th><th>" + esc(label("engine")) + "</th><th>" + esc(label("period")) + "</th><th>" + esc(label("chassis")) + "</th><th>" + esc(label("source")) + "</th></tr></thead><tbody>" + rows.map(function(row) {
      var raw = row.raw_payload || {};
      return "<tr><td>" + esc(row.vehicle_manufacturer) + "</td><td>" + esc(row.vehicle_type) + "</td><td>" + esc(row.model) + "</td><td>" + esc(row.engine || "-") + "</td><td>" + esc(row.production_period_text || label("yearUnknown")) + "</td><td>" + esc(raw.chassis_range || "-") + "</td><td>PARTS FAN</td></tr>";
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
    var date = clean(payload.collected_at);
    result.collected_at = date.length <= 64 && Number.isFinite(Date.parse(date)) ? date : "";
    return result;
  }
  function sourceHtml(row) {
    var info = details(row.partsfan_details);
    var html = "PARTS FAN";
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
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
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
      "<p>" + esc(label("note")) + "</p><label for='pfr-part'>" + esc(label("part")) + "</label><input id='pfr-part' maxlength='64' autocomplete='off' readonly><label for='pfr-maker'>" + esc(label("maker")) + "</label><select id='pfr-maker'><option value=''>" + esc(label("choose")) + "</option>" + makers.map(function(maker) { return "<option value='" + esc(maker) + "'>" + esc(maker) + "</option>"; }).join("") + "</select>" +
      "<p id='pfr-status' role='status' aria-live='polite'></p><div class='partsfan-research-actions'><button type='button' class='btn-primary' id='pfr-start'>" + esc(label("start")) + "</button><button type='button' id='pfr-open-profile' hidden>" + esc(label("openProfile")) + "</button></div>" +
      "<label class='partsfan-review-confirm' id='pfr-human-wrap' hidden><input type='checkbox' id='pfr-human-confirm'>" + esc(label("humanChecked")) + "</label>" +
      (typeof root.canImportPartsfanFitments === "function" && root.canImportPartsfanFitments()
        ? "<div class='partsfan-review' id='pfr-review' hidden><div id='pfr-preview'></div><label class='partsfan-review-confirm'><input type='checkbox' id='pfr-confirm'>" + esc(label("reviewed")) + "</label><button type='button' class='btn-primary' id='pfr-import' disabled>" + esc(label("import")) + "</button></div>"
        : "<p>" + esc(label("adminOnly")) + "</p>") + "</section>";
    active = host;
    document.body.appendChild(host);
    var part = host.querySelector("#pfr-part"), maker = host.querySelector("#pfr-maker"), status = host.querySelector("#pfr-status");
    var startButton = host.querySelector("#pfr-start"), profileButton = host.querySelector("#pfr-open-profile");
    var humanWrap = host.querySelector("#pfr-human-wrap"), humanConfirm = host.querySelector("#pfr-human-confirm");
    var initial = clean(product && product.genuine_part_number);
    part.value = validPart(initial) ? initial : "";
    // Vehicle manufacturer is always an explicit choice; never infer it from a parts brand.
    var review = host.querySelector("#pfr-review"), preview = host.querySelector("#pfr-preview");
    var confirm = host.querySelector("#pfr-confirm"), importButton = host.querySelector("#pfr-import");
    var readyRows = null, busy = false, jobId = null, generation = 0;
    function resetReview() {
      readyRows = null;
      if (preview) preview.innerHTML = "";
      if (review) review.hidden = true;
      if (confirm) confirm.checked = false;
      if (importButton) importButton.disabled = true;
    }
    function changed() {
      generation++;
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
      jobId = null;
      status.textContent = "";
      resetReview();
      startButton.hidden = false; startButton.disabled = false; startButton.textContent = label("start");
      profileButton.hidden = true; humanWrap.hidden = true; humanConfirm.checked = false;
      if (validPart(part.value) && makers.indexOf(maker.value) >= 0) {
        var ticket = generation;
        bridgeRequest("/current").then(function(job) {
          if (active !== host || ticket !== generation || !job ||
              job.part !== clean(part.value) || job.maker !== makerCodes[makers.indexOf(maker.value)]) return;
          jobId = job.jobId;
          renderJob(job, ticket);
        }).catch(function() { /* The user can still start a new collection. */ });
      }
    }
    part.addEventListener("input", changed); maker.addEventListener("change", changed); changed();
    function renderJob(job, ticket) {
      if (active !== host || ticket !== generation) return;
      if (!job || job.jobId !== jobId || job.part !== clean(part.value) || job.maker !== makerCodes[makers.indexOf(maker.value)]) {
        status.textContent = label("badResult"); startButton.disabled = false; startButton.textContent = label("retry"); return;
      }
      resetReview();
      if (job.state === "running") {
        status.textContent = label("running");
        humanWrap.hidden = true; profileButton.hidden = true; humanConfirm.checked = false;
        startButton.hidden = false; startButton.disabled = true;
        pollTimer = setTimeout(async function() {
          try { renderJob(await bridgeRequest("/jobs/" + jobId), ticket); }
          catch (_) {
            if (active === host && ticket === generation) {
              status.textContent = label("disconnected"); startButton.disabled = false; startButton.textContent = label("retry");
            }
          }
        }, 1500);
        return;
      }
      if (job.state === "completed") {
        try {
          readyRows = reviewRows(job.review, part.value, maker.value);
          preview.innerHTML = "<p>" + readyRows.length + " 件</p>" + previewHtml(readyRows);
          if (review) review.hidden = false;
          status.textContent = label("ready");
          startButton.hidden = false; startButton.disabled = false; startButton.textContent = label("retry");
          profileButton.hidden = true; humanWrap.hidden = true;
        } catch (_) { status.textContent = label("badResult"); startButton.disabled = false; startButton.textContent = label("retry"); }
        return;
      }
      status.textContent = stopLabel(job);
      var human = job.state === "blocked" || job.state === "requires_login";
      humanWrap.hidden = !human; humanConfirm.checked = false;
      profileButton.hidden = !(human || job.state === "manual_review");
      startButton.hidden = false;
      startButton.disabled = human;
      startButton.textContent = human ? label("humanResume") : job.state === "paused_budget" ? label("resume") : label("retry");
    }
    async function collect() {
      if (busy || !permitted() || !validPart(initial) || normalized(part.value) !== normalized(initial) || makers.indexOf(maker.value) < 0) {
        status.textContent = label("invalid"); return;
      }
      var checked = !humanWrap.hidden && humanConfirm.checked;
      if (!humanWrap.hidden && !checked) return;
      busy = true; startButton.disabled = true; resetReview();
      var ticket = ++generation;
      status.textContent = label("running");
      try {
        var job = await bridgeRequest("/jobs", "POST", {part: clean(part.value), maker: makerCodes[makers.indexOf(maker.value)], after_human_check: checked});
        if (active !== host || ticket !== generation) return;
        jobId = job.jobId;
        renderJob(job, ticket);
      } catch (error) {
        if (active !== host || ticket !== generation) return;
        status.textContent = error && error.message === "another_collection_running" ? label("running") : label("unavailable");
        startButton.disabled = false; startButton.textContent = label("retry");
      } finally { busy = false; }
    }
    startButton.onclick = collect;
    humanConfirm.onchange = function() { startButton.disabled = !humanConfirm.checked; };
    profileButton.onclick = async function() {
      profileButton.disabled = true;
      try { await bridgeRequest("/profile", "POST"); status.textContent = label("profileOpened"); }
      catch (_) { status.textContent = label("failed"); }
      finally { profileButton.disabled = false; }
    };
    if (confirm) confirm.addEventListener("change", function() { importButton.disabled = busy || !confirm.checked || !readyRows; });
    if (importButton) importButton.onclick = async function() {
      if (busy || !readyRows || !confirm.checked || !permitted() || !root.canImportPartsfanFitments()) return;
      busy = true; importButton.disabled = true;
      try {
        var summary = await root.importPartsfanApplications(clean(part.value), makerCodes[makers.indexOf(maker.value)], readyRows);
        status.textContent = label("imported") + "：" + summary.inserted + " " + label("added") + "、" + summary.updated + " " + label("updated");
        resetReview();
      } catch (error) { status.textContent = importErrorLabel(error); importButton.disabled = false; }
      finally { busy = false; }
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
  root.PartsfanResearch = {label:label, reviewRows:reviewRows, details:details, sourceHtml:sourceHtml, buttonHtml:buttonHtml, bind:bind, open:open, close:close, stopLabel:stopLabel, importErrorLabel:importErrorLabel};
})(typeof window !== "undefined" ? window : globalThis);
