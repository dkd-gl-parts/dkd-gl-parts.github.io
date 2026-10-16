(function () {
  "use strict";
  var STATUS = ["new", "reviewing", "needs_info", "in_progress", "resolved", "declined"];
  var COPY = {
    ja: {
      intro: "送信された相談・AI回答・エラーと、確定した依頼を確認できます。入力途中の下書きは記録しません。導入前の質問ログはありません。",
      requests: "受付済みの依頼", messages: "すべての相談ログ", refresh: "更新", more: "さらに表示", all: "すべて",
      question: "質問", bug: "修正依頼", suggestion: "改善提案", failed: "回答エラー", processing: "処理中・結果未確定", completed: "回答済み",
      new: "新規", reviewing: "確認中", needs_info: "追加情報待ち", in_progress: "対応中", resolved: "対応完了", declined: "見送り",
      loading: "読み込み中…", empty: "該当する記録はありません。", choose: "左の一覧から選択してください。", sender: "送信者", screen: "対象画面", date: "送信日時", content: "相談・依頼の内容", answer: "AI回答（参考）", error: "記録されたエラー", state: "状態", note: "対応メモ（最大2000文字）", save: "状態・メモを保存", saving: "保存中…", saved: "保存しました。", unread: "未読", summary: "新規依頼 {new} ／ 未読の依頼 {requests} ／ 未読の相談 {messages}",
      image: "添付画像を表示", noImage: "画像はありません。", linked: "確定した依頼を開く", linkedLog: "元の相談ログを開く", events: "対応履歴", handoff: "この開発タスクへ渡す文面を作成", handoffInfo: "引き渡し先：D-CATS コンシェルジュ・3Dキャラ開発。文面と画像を確認し、このタスクへ貼り付けてください。自動送信・自動修正はしません。", prepared: "引き渡し文面を準備しました（未送信）。", copy: "文面をコピー", copied: "コピーしました。この開発タスクへ貼り付けてください（未送信）。", copyFallback: "コピーできませんでした。文面を選択して手動でコピーしてください。", conflict: "内容が更新されています。一覧を更新して確認してください。", failure: "読み込み・保存に失敗しました。結果不明の場合は一覧を更新して確認してください。", denied: "システム管理者権限が必要です。", historyEmpty: "履歴はありません。", reference: "参照番号"
    },
    en: {
      intro: "Review submitted messages, AI replies/errors and confirmed requests. Unsent drafts are not recorded. Questions from before logging was introduced are unavailable.",
      requests: "Confirmed requests", messages: "All message logs", refresh: "Refresh", more: "Load more", all: "All", question: "Question", bug: "Bug report", suggestion: "Suggestion", failed: "Reply error", processing: "Processing / outcome unknown", completed: "Answered", new: "New", reviewing: "Reviewing", needs_info: "Needs information", in_progress: "In progress", resolved: "Resolved", declined: "Declined", loading: "Loading…", empty: "No matching records.", choose: "Choose an item from the list.", sender: "Sender", screen: "Screen", date: "Submitted", content: "Submitted message", answer: "AI reply (reference only)", error: "Recorded error", state: "Status", note: "Response note (up to 2000 characters)", save: "Save status / note", saving: "Saving…", saved: "Saved.", unread: "Unread", summary: "New requests {new} / unread requests {requests} / unread messages {messages}", image: "Show attached image", noImage: "No image.", linked: "Open confirmed request", linkedLog: "Open original message", events: "History", handoff: "Prepare handoff to this development task", handoffInfo: "Destination: D-CATS コンシェルジュ・3Dキャラ開発. Review and paste the text and any image into that task. Nothing is sent or modified automatically.", prepared: "Handoff prepared (not sent).", copy: "Copy handoff text", copied: "Copied. Paste it into the development task (not sent).", copyFallback: "Copy failed. Select and copy the text manually.", conflict: "This item changed. Refresh and review it.", failure: "The operation failed. If its outcome is unknown, refresh the list to check.", denied: "System administrator access is required.", historyEmpty: "No history.", reference: "Reference"
    },
    zh: {
      intro: "查看已发送的咨询、AI回答/错误及已确认的请求。不记录未发送的草稿，也没有启用日志之前的问题。",
      requests: "已确认的请求", messages: "全部咨询日志", refresh: "刷新", more: "显示更多", all: "全部", question: "问题", bug: "修正请求", suggestion: "改善建议", failed: "回答错误", processing: "处理中／结果未确定", completed: "已回答", new: "新建", reviewing: "确认中", needs_info: "等待补充信息", in_progress: "处理中", resolved: "已完成", declined: "不采纳", loading: "加载中…", empty: "没有相应记录。", choose: "请从列表中选择。", sender: "发送者", screen: "页面", date: "发送时间", content: "咨询或请求内容", answer: "AI回答（仅供参考）", error: "记录的错误", state: "状态", note: "处理备注（最多2000字符）", save: "保存状态和备注", saving: "保存中…", saved: "已保存。", unread: "未读", summary: "新请求 {new} ／ 未读请求 {requests} ／ 未读咨询 {messages}", image: "显示附件图片", noImage: "没有图片。", linked: "打开已确认的请求", linkedLog: "打开原咨询日志", events: "处理记录", handoff: "生成转交此开发任务的文字", handoffInfo: "转交目标：D-CATS コンシェルジュ・3Dキャラ開発。请检查文字及图片后粘贴到该任务。不会自动发送或修改。", prepared: "已准备转交文字（未发送）。", copy: "复制文字", copied: "已复制。请粘贴到开发任务（未发送）。", copyFallback: "无法复制。请选择文字并手动复制。", conflict: "记录已更新，请刷新后确认。", failure: "操作失败。结果不确定时，请刷新列表确认。", denied: "需要系统管理员权限。", historyEmpty: "没有记录。", reference: "参考编号"
    }
  };
  function mount(host, options) {
    if (!host || !options || typeof options.context !== "function" || typeof options.send !== "function") return null;
    var initial = options.context(), owner = initial && initial.id;
    if (!owner || !initial.admin) { host.replaceChildren(); return null; }
    var doc = host.ownerDocument, words = COPY[initial.language] || COPY.ja;
    var stopped = false, listToken = 0, detailToken = 0, summaryToken = 0, mode = "requests", items = [], page = [], current = null;
    function t(key) { return words[key] || key; }
    function el(tag, text, cls) { var n = doc.createElement(tag); if (text !== undefined && text !== null) n.textContent = text; if (cls) n.className = cls; return n; }
    function valid() {
      var c = options.context();
      if (stopped || !c || c.id !== owner || !c.admin) { destroy(); return false; }
      return true;
    }
    function destroy() { stopped = true; listToken++; detailToken++; summaryToken++; current = null; items = []; page = []; host.replaceChildren(); }
    async function send(command) {
      if (!valid()) throw new Error("stale_session");
      var r = await options.send(command);
      if (!valid()) throw new Error("stale_session");
      if (r && r.error && /^(forbidden|system_admin_required|invalid_authorization|missing_authorization)$/.test(r.error.message)) { destroy(); throw r.error; }
      if (!r || r.error || !r.data || r.data.ok !== true) throw r && r.error || new Error("request_failed");
      return r.data;
    }
    function admin(operation, extra) { return send(Object.assign({ action: "admin", operation: operation }, extra || {})); }
    function button(key, fn) { var n = el("button", t(key)); n.type = "button"; n.addEventListener("click", fn); return n; }
    function errorText(error) { return t(error && error.message === "version_conflict" ? "conflict" : error && /forbidden|system_admin/.test(error.message) ? "denied" : "failure"); }
    function date(value) { var d = new Date(value); return isNaN(d.getTime()) ? "" : d.toLocaleString(initial.language === "ja" ? "ja-JP" : initial.language === "zh" ? "zh-CN" : "en-US"); }
    function uuid() { if (!window.crypto || typeof window.crypto.randomUUID !== "function") throw new Error("secure_random_unavailable"); return window.crypto.randomUUID(); }
    host.replaceChildren(); host.classList.add("dcats-concierge-admin");
    host.appendChild(el("p", t("intro"), "concierge-admin-intro"));
    var summary = el("p", t("loading"), "concierge-admin-summary"); summary.setAttribute("role", "status"); host.appendChild(summary);
    var toolbar = el("div", null, "concierge-admin-toolbar"), requestTab = button("requests", function () { switchMode("requests"); }), messageTab = button("messages", function () { switchMode("messages"); });
    toolbar.appendChild(requestTab); toolbar.appendChild(messageTab);
    var filter = el("select"); filter.setAttribute("aria-label", t("state")); toolbar.appendChild(filter);
    filter.addEventListener("change", function () { loadList(false); });
    var refresh = button("refresh", function () { refreshSummary(); loadList(false); }); toolbar.appendChild(refresh); host.appendChild(toolbar);
    var layout = el("div", null, "concierge-admin-layout"), listPanel = el("section", null, "concierge-admin-list-panel"), listStatus = el("p"), list = el("ul", null, "concierge-admin-list"), more = button("more", function () { loadList(true); }), detail = el("section", null, "concierge-admin-detail");
    more.hidden = true;
    listStatus.setAttribute("role", "status"); detail.setAttribute("aria-live", "polite");
    listPanel.appendChild(listStatus); listPanel.appendChild(list); listPanel.appendChild(more); layout.appendChild(listPanel); layout.appendChild(detail); host.appendChild(layout);
    async function refreshSummary() {
      var token = ++summaryToken;
      try { var r = await admin("summary"); if (token !== summaryToken) return; summary.textContent = t("summary").replace("{new}", Number(r.request_new) || 0).replace("{requests}", Number(r.request_unread) || 0).replace("{messages}", Number(r.message_unread) || 0); }
      catch (error) { if (valid() && token === summaryToken) summary.textContent = errorText(error); }
    }
    function switchMode(next) {
      if (!valid()) return;
      mode = next; detailToken++; current = null; detail.replaceChildren(el("p", t("choose")));
      requestTab.setAttribute("aria-pressed", String(mode === "requests")); messageTab.setAttribute("aria-pressed", String(mode === "messages"));
      filter.replaceChildren();
      (mode === "requests" ? ["all"].concat(STATUS) : ["all", "question", "bug", "suggestion", "failed", "processing"]).forEach(function (s) { var o = el("option", t(s)); o.value = s; filter.appendChild(o); });
      filter.value = "all"; loadList(false);
    }
    async function loadList(append) {
      if (!valid()) return;
      if (!append) { items = []; page = []; list.replaceChildren(); more.hidden = true; }
      var token = ++listToken, selectedMode = mode, command = selectedMode === "requests" ? { action: "list", status: filter.value } : { action: "admin", operation: "messages", kind: filter.value };
      if (append && items.length) command.before_no = items[items.length - 1][selectedMode === "requests" ? "request_no" : "log_no"];
      refresh.disabled = true; more.disabled = true; listStatus.textContent = t("loading");
      try {
        var r = await send(command); if (token !== listToken) return;
        page = Array.isArray(r.items) ? r.items : []; items = append ? items.concat(page) : page.slice(); list.replaceChildren();
        items.forEach(function (row) {
          var li = el("li"), b = button(null, function () { openDetail(selectedMode === "requests" ? "request" : "message", row.id); });
          b.textContent = (row.unread ? t("unread") + " · " : "") + "#" + (row.request_no || row.log_no) + " " + (row.title || row.question || "").slice(0, 160);
          b.appendChild(el("span", t(row.status || row.state) + " · " + date(row.created_at))); li.appendChild(b); list.appendChild(li);
        });
        listStatus.textContent = items.length ? "" : t("empty"); more.hidden = page.length < 30;
      } catch (error) { if (valid() && token === listToken) listStatus.textContent = errorText(error); }
      finally { if (valid() && token === listToken) { refresh.disabled = false; more.disabled = false; } }
    }
    function field(label, text) { detail.appendChild(el("h3", t(label))); detail.appendChild(el("div", text || "—", "concierge-admin-text")); }
    async function openDetail(source, id) {
      if (!valid()) return;
      var token = ++detailToken; current = null; detail.replaceChildren(el("p", t("loading")));
      try {
        var r = await admin(source, { id: id }); if (token !== detailToken) return;
        var row = source === "message" ? r.message : r.request;
        if (!row || row.id !== id) throw new Error("invalid_response");
        current = { source: source, row: row, token: token };
        renderDetail(r); refreshSummary();
      } catch (error) { if (valid() && token === detailToken) detail.replaceChildren(el("p", errorText(error))); }
    }
    function renderDetail(data) {
      var selected = current, row = selected.row, source = selected.source;
      function still() { return valid() && current === selected && selected.token === detailToken; }
      detail.replaceChildren(el("h2", row.title || t(row.kind || "question")));
      field("reference", "#" + (row.request_no || row.log_no) + " · " + row.id);
      field("sender", source === "message" ? row.reporter_name : data.reporter_name);
      field("date", date(row.created_at)); field("screen", window.DcatsConciergeRequestsUi && window.DcatsConciergeRequestsUi.screenLabel ? window.DcatsConciergeRequestsUi.screenLabel(row.screen_id, initial.language) : row.screen_id); field("state", t(row.status || row.state)); field("content", row.question || row.description);
      var log = source === "message" ? row : data.message;
      if (log && log.response && log.response.answer) field("answer", log.response.answer);
      if (log && log.error_code) field("error", log.error_code);
      if (source === "message" && row.request_id) detail.appendChild(button("linked", function () { openDetail("request", row.request_id); }));
      if (source === "request" && log) detail.appendChild(button("linkedLog", function () { openDetail("message", row.id); }));
      var feedback = el("p"); feedback.setAttribute("role", "status");
      if (log && log.has_image || row.has_attachment) {
        var preview = el("img"); preview.alt = t("image"); preview.hidden = true; preview.className = "concierge-admin-image";
        var showImage = button("image", async function () {
          showImage.disabled = true;
          try {
            var result = log && log.has_image ? await admin("image", { id: row.id }) : await send({ action: "image", id: row.id });
            if (!still()) return;
            if (result.image && typeof result.image === "string" && result.image.length <= 2796204 && /^[A-Za-z0-9+/]+={0,2}$/.test(result.image) && result.image.indexOf("iVBORw0KGgo") === 0) preview.src = "data:image/png;base64," + result.image;
            else if (result.url && /^https:\/\/jqoeqximtwfpqwzngutj\.supabase\.co\/storage\/v1\/object\/sign\/concierge-request-images\//.test(result.url)) preview.src = result.url;
            else throw new Error("invalid_image");
            preview.hidden = false;
          } catch (error) { if (still()) feedback.textContent = errorText(error); }
          finally { if (still()) showImage.disabled = false; }
        }); detail.appendChild(showImage); detail.appendChild(preview);
      }
      if (source === "request") {
        var status = el("select"); status.setAttribute("aria-label", t("state"));
        STATUS.forEach(function (s) { var o = el("option", t(s)); o.value = s; status.appendChild(o); }); status.value = row.status;
        var noteLabel = el("label", t("note")), note = el("textarea"); note.maxLength = 2000; note.rows = 3; noteLabel.appendChild(note);
        var pending = null, save = button("save", async function () {
          if (!still()) return;
          if (!pending && !note.value.trim()) { feedback.textContent = t("note"); note.focus(); return; }
          if (!pending) pending = { action: "update", id: row.id, expected_version: row.version, operation_id: uuid(), status: status.value, note: note.value.trim() };
          save.disabled = true; status.disabled = true; note.disabled = true; feedback.textContent = t("saving");
          try { await send(pending); if (!still()) return; feedback.textContent = t("saved"); openDetail("request", row.id); loadList(false); }
          catch (error) { if (still()) { feedback.textContent = errorText(error); save.disabled = false; } }
        }); detail.appendChild(status); detail.appendChild(noteLabel); detail.appendChild(save);
        var history = el("details"), historyTitle = el("summary", t("events")); history.appendChild(historyTitle);
        (data.events || []).forEach(function (event) { history.appendChild(el("p", date(event.created_at) + " · " + t(event.to_status || event.event_type) + (event.note ? "\n" + event.note : ""), "concierge-admin-text")); });
        if (!(data.events || []).length) history.appendChild(el("p", t("historyEmpty"))); detail.appendChild(history);
      }
      var handoffArea = el("section", null, "concierge-admin-handoff"), preparedText = el("textarea"); preparedText.readOnly = true; preparedText.rows = 12; preparedText.hidden = true; preparedText.setAttribute("aria-label", t("handoff"));
      var operationId = null, prepare = button("handoff", async function () {
        if (!still()) return;
        prepare.disabled = true;
        try {
          operationId = operationId || uuid();
          var result = await admin("handoff", { id: row.id, source_kind: source, expected_version: row.version, operation_id: operationId });
          if (!still()) return;
          if (typeof result.package_text !== "string" || result.package_text.length > 18000 || result.sent !== false) throw new Error("invalid_response");
          preparedText.value = result.package_text; preparedText.hidden = false; copy.hidden = false; feedback.textContent = t("prepared");
        } catch (error) { if (still()) feedback.textContent = errorText(error); }
        finally { if (still()) prepare.disabled = false; }
      });
      var copy = button("copy", async function () {
        if (!still() || !preparedText.value) return;
        try { await window.navigator.clipboard.writeText(preparedText.value); if (still()) feedback.textContent = t("copied"); }
        catch (error) { if (still()) { preparedText.focus(); preparedText.select(); feedback.textContent = t("copyFallback"); } }
      }); copy.hidden = true;
      handoffArea.appendChild(el("p", t("handoffInfo"))); handoffArea.appendChild(prepare); handoffArea.appendChild(preparedText); handoffArea.appendChild(copy); detail.appendChild(handoffArea); detail.appendChild(feedback);
    }
    switchMode("requests"); refreshSummary();
    return Object.freeze({ destroy: destroy });
  }
  window.DcatsConciergeAdmin = Object.freeze({ mount: mount });
}());
