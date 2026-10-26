(function(root) {
  "use strict";
  var api = root.PartsfanResearch;
  var words = {
    ja: {stopped:"停止中", title:"適合調査一覧", note:"このPCに予約と取得結果を保存します。複数品番は1件ずつ自動取得します。D-CATSの画面を閉じても、このPCと連携が起動している間は続きます。登録は結果を確認してから行います。", parts:"純正品番（1行に1品番・最大50件）", add:"予約する", empty:"調査の予約・履歴はありません。", refresh:"更新", queued:"予約待ち", running:"取得中", completed:"取得完了", blocked:"本人確認待ち", requires_login:"ログイン確認待ち", paused_budget:"取得上限で停止", manual_review:"内容確認待ち", not_found:"適合情報なし", error:"取得エラー", cancelled:"予約取消", result:"結果・登録", resume:"再開を確認", cancel:"予約取消", status:"取得状況", progress:"進捗・結果", registration:"登録状況", checking:"照合中", unregistered:"未登録", registered:"登録済み", partial:"一部登録", different:"既存データの確認が必要", unknown:"登録状況を確認できません", connection:"PC連携に接続できません。連携の起動と、このPCであることを確認してください。", oldBridge:"PC連携の更新が必要です。", invalid:"メーカーと品番を確認してください（1行に1品番、最大50件）。", added:"予約を受け付けました。同じ品番・メーカーの履歴は再利用します。再取得は結果画面から行えます。", paused:"予約処理を停止しています。対象行の「再開を確認」から状態を確認してください。", saved:"履歴はこのPCに保存されています。", pages:"ページ確認", remaining:"ページ待ち", rows:"行", updated:"更新", unavailable:"操作できませんでした。一覧を更新して状態を確認してください。", pauseFirst:"先に停止した調査を確認してください。", pending:"取得完了後に照合", failedImport:"登録結果は本番データと再照合してください。"},
    en: {stopped:"Paused", title:"Fitment investigations", note:"Reservations and results are saved on this PC. Parts are collected one at a time while this PC and its bridge are running, even after closing D-CATS. Review results before importing.", parts:"Genuine parts (one per line, up to 50)", add:"Queue parts", empty:"No reservations or history.", refresh:"Refresh", queued:"Queued", running:"Collecting", completed:"Collected", blocked:"Human check required", requires_login:"Login check required", paused_budget:"Page limit reached", manual_review:"Review required", not_found:"No fitments", error:"Collection error", cancelled:"Cancelled", result:"Results / import", resume:"Review and resume", cancel:"Cancel reservation", status:"Collection", progress:"Progress / results", registration:"Import status", checking:"Checking", unregistered:"Not imported", registered:"Imported", partial:"Partially imported", different:"Existing data needs review", unknown:"Import status unavailable", connection:"Cannot connect to this PC's bridge. Check that it is running on this PC.", oldBridge:"Update the local bridge.", invalid:"Select a manufacturer and enter up to 50 parts, one per line.", added:"Queued. Existing investigations are reused. Open results to request a fresh collection.", paused:"Queue paused. Review the stopped investigation to resume.", saved:"History is saved on this PC.", pages:"pages checked", remaining:"pages pending", rows:"rows", updated:"Updated", unavailable:"Action failed. Refresh to check its status.", pauseFirst:"Review the stopped investigation first.", pending:"Checked after collection", failedImport:"Recheck the production data to confirm the import."},
    zh: {stopped:"已暂停", title:"适配调查列表", note:"预约和结果保存在本机。零件按顺序逐一获取；本机和连接运行期间，关闭D-CATS后仍会继续。核对结果后再导入。", parts:"原厂零件号（每行一个，最多50个）", add:"预约获取", empty:"暂无预约或历史记录。", refresh:"刷新", queued:"等待获取", running:"获取中", completed:"获取完成", blocked:"等待本人确认", requires_login:"等待登录确认", paused_budget:"达到获取上限", manual_review:"等待核对", not_found:"无适配信息", error:"获取错误", cancelled:"已取消", result:"结果／导入", resume:"确认并继续", cancel:"取消预约", status:"获取状态", progress:"进度／结果", registration:"导入状态", checking:"核对中", unregistered:"未导入", registered:"已导入", partial:"部分导入", different:"需要核对现有数据", unknown:"无法确认导入状态", connection:"无法连接本机。请检查连接是否已启动。", oldBridge:"请更新本机连接。", invalid:"请选择制造商并输入零件号，每行一个，最多50个。", added:"预约已受理；同一零件的历史将被复用。需重新获取时请打开结果。", paused:"预约已暂停。请确认停止的调查后继续。", saved:"历史记录保存在本机。", pages:"页已确认", remaining:"页待确认", rows:"行", updated:"更新", unavailable:"操作失败，请刷新确认状态。", pauseFirst:"请先确认停止的调查。", pending:"获取完成后核对", failedImport:"请重新核对生产数据以确认导入结果。"}
  };
  var active = null, focusBefore = null, snapshot = null, loading = false, generation = 0;
  var detailCache = {}, registrations = {}, timer = null, lastRender = "";
  function label(key) { return (words[root.currentLang] || words.ja)[key] || key; }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function(c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function permitted() { try { return api && api.permitted(); } catch (_) { return false; } }
  function normalized(part) { return String(part || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function parseParts(text, maker) {
    var parts = String(text || "").split(/\r?\n/).map(function(p) { return p.trim(); }).filter(Boolean);
    if (api.makerCodes.indexOf(maker) < 0 || !parts.length || parts.length > 50 || parts.some(function(p) { return !/^[A-Za-z0-9][A-Za-z0-9 .\/-]{1,63}$/.test(p); })) throw new Error("invalid_parts");
    var seen = {};
    return parts.filter(function(p) { var key = normalized(p); if (!key || seen[key]) return false; seen[key] = true; return true; }).map(function(p) { return {part:p, maker:maker}; });
  }
  function sameEvidence(a, b) {
    function text(v) { return v == null ? "" : String(v).trim(); }
    return ["catalog_manufacturer", "normalized_genuine_part_number", "vehicle_manufacturer", "vehicle_type", "model", "engine", "effective_start", "effective_end", "production_period_text", "part_role"].every(function(key) { return text(a[key]) === text(b[key]); }) &&
      ["chassis_range", "grade", "transmission", "production_period_basis"].every(function(key) { return text((a.raw_payload || {})[key]) === text((b.raw_payload || {})[key]); }) && !(b.raw_payload || {}).chassis_range_review;
  }
  function registrationState(rows, stored) {
    var byKey = {}, matched = 0, different = false;
    stored.forEach(function(row) { (byKey[row.source_record_key] || (byKey[row.source_record_key] = [])).push(row); });
    rows.forEach(function(row) {
      var found = byKey[row.source_record_key] || [];
      if (found.length === 1 && sameEvidence(row, found[0])) matched++;
      else if (found.length) different = true;
    });
    return {state:different ? "different" : matched === rows.length ? "registered" : matched ? "partial" : "unregistered", matched:matched, total:rows.length, checkedAt:Date.now()};
  }
  async function detail(job) {
    var cached = detailCache[job.jobId];
    if (cached && cached.updatedAt === job.updatedAt && cached.state === job.state) return cached;
    var result = await api.request("/jobs/" + job.jobId);
    if (!result || result.jobId !== job.jobId || result.part !== job.part || result.maker !== job.maker) throw new Error("job_mismatch");
    detailCache[job.jobId] = result;
    return result;
  }
  async function checkRegistration(job) {
    if (!permitted() || !root.sb) throw new Error("not_authorized");
    var full = await detail(job);
    var rows = api.reviewRows(full.review, full.part, api.makers[api.makerCodes.indexOf(full.maker)]);
    var stored = [];
    for (var offset = 0; offset < rows.length; offset += 100) {
      if (!permitted()) throw new Error("not_authorized");
      var result = await root.sb.from("catalog_vehicle_applications")
        .select("source_record_key,catalog_manufacturer,normalized_genuine_part_number,vehicle_manufacturer,vehicle_type,model,engine,effective_start,effective_end,production_period_text,part_role,raw_payload")
        .eq("source_code", "partsfan").eq("catalog_manufacturer", job.maker.toUpperCase())
        .eq("normalized_genuine_part_number", normalized(job.part))
        .in("source_record_key", rows.slice(offset, offset + 100).map(function(row) { return row.source_record_key; })).range(0, 999);
      if (result.error || !Array.isArray(result.data)) throw new Error("registration_lookup_failed");
      stored = stored.concat(result.data);
    }
    return registrationState(rows, stored);
  }
  function close() {
    generation++;
    if (active) active.remove();
    active = null;
    if (focusBefore && focusBefore.isConnected) focusBefore.focus();
    focusBefore = null;
  }
  function message(text) { if (active) active.querySelector("[data-pfq-message]").textContent = text; }
  function updateEntries() {
    var allowed = permitted();
    document.querySelectorAll(".page-header-right").forEach(function(header) {
      var button = header.querySelector("[data-pfq-entry]");
      if (!button && allowed) {
        button = document.createElement("button"); button.type = "button"; button.className = "btn-sm-edit partsfan-queue-entry";
        button.setAttribute("data-pfq-entry", ""); button.onclick = open; header.classList.add("partsfan-queue-header"); header.prepend(button);
      }
      if (button) {
        button.hidden = !allowed;
        var jobs = snapshot && snapshot.jobs || [];
        var running = jobs.filter(function(j) { return j.state === "running"; }).length;
        var waiting = jobs.filter(function(j) { return j.state === "queued"; }).length;
        var suffix = snapshot && snapshot.paused ? label("stopped") : running ? label("running") : "";
        button.textContent = label("title") + (suffix ? " · " + suffix : "") + (waiting ? " · " + label("queued") + " " + waiting : "");
      }
    });
    if (!allowed) { if (active) close(); if (api) api.close(); }
    if (!allowed) { snapshot = null; detailCache = {}; registrations = {}; }
  }
  function render() {
    if (!active || !snapshot || !permitted()) return;
    active.querySelector("[data-pfq-summary]").textContent = snapshot.paused ? label("paused") + " " + api.stopLabel({state:"blocked", reason:snapshot.pauseReason}) : label("saved");
    var body = active.querySelector("[data-pfq-jobs]");
    var signature = JSON.stringify([root.currentLang, snapshot.jobs, snapshot.jobs.map(function(job) { var r = registrations[job.jobId]; return r && r.version === job.updatedAt ? [r.state,r.matched,r.total] : null; })]);
    if (signature === lastRender) return;
    lastRender = signature;
    var focusedId = document.activeElement && document.activeElement.getAttribute("data-job");
    body.innerHTML = snapshot.jobs.length ? snapshot.jobs.map(function(job) {
      var registration = registrations[job.jobId];
      if (registration && registration.version !== job.updatedAt) registration = null;
      var regLabel = job.state !== "completed" ? label("pending") : registration ? label(registration.state) + (registration.total ? " (" + registration.matched + "/" + registration.total + ")" : "") : label("checking");
      var maker = api.makers[api.makerCodes.indexOf(job.maker)] || job.maker;
      var stamp = job.updatedAt || job.createdAt;
      var date = stamp && Number.isFinite(Date.parse(stamp)) ? new Date(stamp).toLocaleString(root.currentLang || "ja") : "";
      var action = job.state === "queued" ? "cancel" : /^(blocked|requires_login|paused_budget|error)$/.test(job.state) ? "resume" : job.state === "cancelled" ? "" : "view";
      return "<article class='partsfan-queue-row'><div><strong>" + esc(job.part) + "</strong><div>" + esc(maker) + "</div><small>" + esc(label("updated") + " " + date) + "</small></div><div><span class='partsfan-queue-state' data-state='" + esc(job.state) + "'>" + esc(label(job.state)) + (job.queuePosition ? " #" + job.queuePosition : "") + "</span><div>" + esc(job.visitedPages + " " + label("pages") + " / " + job.pendingPages + " " + label("remaining")) + "</div><div>" + esc(job.recordCount + " " + label("rows")) + "</div></div><div><small>" + esc(label("registration")) + "</small><div>" + esc(regLabel) + "</div></div><div class='partsfan-queue-row-actions'>" + (action ? "<button type='button' class='btn-sm-edit' data-pfq-action='" + action + "' data-job='" + esc(job.jobId) + "'>" + esc(label(action === "view" ? "result" : action)) + "</button>" : "") + "</div></article>";
    }).join("") : "<p>" + esc(label("empty")) + "</p>";
    if (focusedId) Array.from(body.querySelectorAll("[data-job]")).some(function(button) { if (button.getAttribute("data-job") !== focusedId) return false; button.focus({preventScroll:true}); return true; });
  }
  async function refresh(force) {
    updateEntries();
    if (!permitted() || loading) return;
    loading = true;
    var ticket = generation;
    try {
      var result = await api.request("/jobs");
      if (!permitted()) return;
      if (!result || result.schemaVersion !== 2 || !Array.isArray(result.jobs)) throw new Error("old_bridge");
      snapshot = result;
      updateEntries(); render();
      if (active) {
        for (var job of result.jobs) {
          if (!active || ticket !== generation || !permitted()) break;
          if (job.state !== "completed") continue;
          var prior = registrations[job.jobId];
          if (!force && prior && prior.version === job.updatedAt && Date.now() - prior.checkedAt < 30000) continue;
          try { registrations[job.jobId] = Object.assign(await checkRegistration(job), {version:job.updatedAt}); }
          catch (_) { registrations[job.jobId] = {state:"unknown", version:job.updatedAt, checkedAt:Date.now()}; }
          if (ticket === generation && permitted()) render();
        }
      }
    } catch (error) {
      if (ticket === generation) message(label(error.message === "old_bridge" ? "oldBridge" : "connection"));
      snapshot = null;
    } finally { loading = false; }
  }
  async function action(event) {
    var button = event.target.closest("[data-pfq-action]");
    if (!button || !snapshot || !permitted()) return;
    var job = snapshot.jobs.find(function(j) { return j.jobId === button.getAttribute("data-job"); });
    if (!job) return;
    button.disabled = true;
    try {
      if (button.getAttribute("data-pfq-action") === "cancel") {
        await api.request("/jobs/" + job.jobId + "/cancel", "POST", {});
        await refresh(true);
      } else {
        if (snapshot.paused && snapshot.pauseJobId && job.state !== "completed" && job.jobId !== snapshot.pauseJobId) { message(label("pauseFirst")); return; }
        var full = await detail(job);
        if (!permitted()) return;
        close(); api.openSaved(full);
      }
    } catch (_) { message(label("unavailable")); }
    finally { if (button.isConnected) button.disabled = false; }
  }
  function open() {
    if (!permitted()) return false;
    api.close(); close(); focusBefore = document.activeElement; lastRender = "";
    active = document.createElement("div");
    active.className = "form-overlay show partsfan-research-overlay";
    active.innerHTML = "<section class='partsfan-research-dialog partsfan-queue-dialog' role='dialog' aria-modal='true' aria-labelledby='pfq-title'><header><h2 id='pfq-title'>" + esc(label("title")) + "</h2><button type='button' data-pfq-close aria-label='" + esc(api.label("close")) + "'>×</button></header><p>" + esc(label("note")) + "</p><form data-pfq-form><div class='partsfan-queue-inputs'><div><label for='pfq-maker'>" + esc(api.label("maker")) + "</label><select id='pfq-maker' required><option value=''>" + esc(api.label("choose")) + "</option>" + api.makers.map(function(maker, index) { return "<option value='" + api.makerCodes[index] + "'>" + esc(maker) + "</option>"; }).join("") + "</select></div><div><label for='pfq-parts'>" + esc(label("parts")) + "</label><textarea id='pfq-parts' rows='3' maxlength='3300' required></textarea></div></div><div class='partsfan-research-actions'><button type='submit' class='btn-primary'>" + esc(label("add")) + "</button><button type='button' class='btn-sm-edit' data-pfq-refresh>" + esc(label("refresh")) + "</button></div></form><p data-pfq-message role='status' aria-live='polite'></p><p data-pfq-summary></p><div data-pfq-jobs aria-label='" + esc(label("title")) + "'></div></section>";
    document.body.appendChild(active);
    active.querySelector("[data-pfq-close]").onclick = close;
    active.querySelector("[data-pfq-refresh]").onclick = function() { message(""); refresh(true); };
    active.querySelector("[data-pfq-jobs]").onclick = action;
    active.querySelector("[data-pfq-form]").onsubmit = async function(event) {
      event.preventDefault();
      if (!permitted()) return;
      var host = active, items;
      try { items = parseParts(host.querySelector("#pfq-parts").value, host.querySelector("#pfq-maker").value); }
      catch (_) { message(label("invalid")); return; }
      var button = host.querySelector("button[type=submit]"); button.disabled = true;
      try {
        await api.request("/queue", "POST", {items:items});
        if (active === host && permitted()) { host.querySelector("#pfq-parts").value = ""; message(label("added")); await refresh(true); }
      } catch (_) { if (active === host) message(label("unavailable")); }
      finally { if (button.isConnected) button.disabled = false; }
    };
    active.addEventListener("click", function(event) { if (event.target === active) close(); });
    active.addEventListener("keydown", function(event) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      var fields = Array.from(active.querySelectorAll("button,input,select,textarea,a[href]")).filter(function(el) { return !el.disabled && el.getClientRects().length; });
      var first = fields[0], last = fields[fields.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    render(); refresh(true); active.querySelector("#pfq-maker").focus();
    return true;
  }
  function invalidate() { registrations = {}; detailCache = {}; refresh(true); }
  root.PartsfanQueue = {open:open, close:close, label:label, parseParts:parseParts, registrationState:registrationState, invalidate:invalidate};
  if (typeof document !== "undefined") {
    function tick() { clearTimeout(timer); updateEntries(); if (!document.hidden) refresh(false); timer = setTimeout(tick, active ? 2000 : 5000); }
    tick();
  }
})(typeof window !== "undefined" ? window : globalThis);
