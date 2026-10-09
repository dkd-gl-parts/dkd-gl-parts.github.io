(function(root) {
  "use strict";
  var RPC = "manage_account_operation_workspace";
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var WRITE_FUNCTIONS = new Set([
    "invite-internal-user", "invite-customer-user", "manage-customer-users",
    "product-3d-glb", "product-3d-tripo", "ec-price-research-start",
    "issue-concierge-bridge-capability", "enroll-hanbaioh-pilot-device", "review-hanbaioh-pilot-device",
    "issue-hanbaioh-backup-enrollment", "issue-hanbaioh-pilot-login", "issue-hanbaioh-company-operation",
    "issue-hanbaioh-test-sales-binding", "issue-hanbaioh-test-sales-claim",
    "issue-hanbaioh-production-backup-enrollment", "manage-hanbaioh-company-backup-start"
  ]);
  function operationFunction(path) {
    var name = path.replace(/^\/functions\/v1\//, "");
    return path.startsWith("/functions/v1/") && WRITE_FUNCTIONS.has(name) ? name : "";
  }
  async function operationRequestId(operation, body, cryptoApi) {
    var payload;
    try { payload = typeof body === "string" ? JSON.parse(body) : null; } catch (_) {}
    var key = payload && (payload.idempotency_key || payload.request_key || payload.request_id || payload.id);
    if (typeof key !== "string" || !key) return cryptoApi.randomUUID();
    // Bind persistent business keys to the endpoint/action, not every later
    // action on the same receipt. The server also fences changed body bytes.
    var bytes = new TextEncoder().encode(JSON.stringify([operation, payload.action || payload.command || "", key]));
    var hash = new Uint8Array(await cryptoApi.subtle.digest("SHA-256", bytes));
    hash[6] = (hash[6] & 15) | 80; hash[8] = (hash[8] & 63) | 128;
    var hex = Array.from(hash.slice(0, 16), function(byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  }
  function createCoordinator(options) {
    var state = { mode: "read", generation: null, window_count: 0, max_windows: 4, error: "" };
    var client, timer, refreshPromise, requestId;
    var running = false, lifecycle = 0;
    function identity() { return typeof options.windowId === "function" ? options.windowId() : options.windowId; }
    function changed() { if (options.onChange) options.onChange(Object.assign({}, state)); }
    async function command(action, request) {
      if (!client) throw new Error("DCATS_WORKSPACE_NOT_STARTED");
      var started = lifecycle;
      var response;
      try { response = await client.rpc(RPC, {
        target_action: action, target_window_id: identity(),
        target_screen_name: options.screen ? options.screen() : "menu",
        target_generation: state.generation, target_request_id: request || null
      }); } catch (_) {
        if (started === lifecycle) { state.mode = "read"; state.error = "DCATS_WORKSPACE_UNAVAILABLE"; changed(); }
        throw new Error("DCATS_WORKSPACE_UNAVAILABLE");
      }
      if (started !== lifecycle) throw new Error("DCATS_WORKSPACE_SESSION_CHANGED");
      if (response.error) {
        state.mode = "read"; state.error = String(response.error.message || "DCATS_WORKSPACE_UNAVAILABLE");
        changed(); throw new Error(state.error);
      }
      var next = response.data;
      if (!next || !["read", "write"].includes(next.mode) || !Number.isSafeInteger(next.generation)
        || next.max_windows !== 4 || !Number.isInteger(next.window_count) || next.window_count < 0 || next.window_count > 4) {
        state.mode = "read"; state.error = "DCATS_WORKSPACE_INVALID_RESPONSE";
        changed(); throw new Error(state.error);
      }
      state = Object.assign({}, next, { error: "" }); changed();
      return Object.assign({}, state);
    }
    async function refresh() {
      if (!running || refreshPromise) return refreshPromise;
      refreshPromise = command("heartbeat").catch(function() { return Object.assign({}, state); });
      try { return await refreshPromise; } finally { refreshPromise = null; }
    }
    return {
      getState: function() { return Object.assign({}, state); },
      async start(sb) {
        this.stop(); client = sb; running = true;
        var started = lifecycle;
        try { await command("register"); } catch (_) { /* Fail closed. */ }
        if (running && lifecycle === started) timer = (options.setInterval || root.setInterval)(refresh, 30000);
        return Object.assign({}, state);
      },
      stop: function() {
        running = false; lifecycle++;
        if (timer != null) (options.clearInterval || root.clearInterval)(timer);
        timer = null; state.mode = "read"; state.generation = null; changed();
      },
      refresh: refresh,
      register: function() { return command("register"); },
      requestHandoff: function() {
        if (!requestId) requestId = options.randomUUID();
        return command("request_handoff", requestId);
      },
      approveHandoff: function() { return command("approve_handoff", state.handoff_request_id); },
      release: function() { return command("release"); },
      close: function() { return command("close"); },
      requestHeaders: function() {
        var result = { "x-dcats-window-id": identity() };
        if (state.generation != null) result["x-dcats-write-generation"] = String(state.generation);
        return result;
      },
      reportDenied: function() { state.mode = "read"; state.error = "DCATS_READ_ONLY_OR_EXPIRED"; changed(); }
    };
  }
  function holdWindowIdentity(candidate, options) {
    var release;
    var ready = new Promise(function(resolve) {
      function adopt(id) { options.adopt(id); resolve(id); }
      if (!options.locks || typeof options.locks.request !== "function") { adopt(options.randomUUID()); return; }
      function acquire(id) {
        options.locks.request("dcats-work-window-" + id, { ifAvailable: true }, function(lock) {
          if (!lock) { acquire(options.randomUUID()); return; }
          adopt(id);
          return new Promise(function(done) { release = done; });
        }).catch(function() { adopt(options.randomUUID()); });
      }
      acquire(candidate);
    });
    return { ready: ready, release: function() { if (release) release(); } };
  }
  var api = { createCoordinator: createCoordinator, holdWindowIdentity: holdWindowIdentity,
    operationFunction: operationFunction, operationRequestId: operationRequestId };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root.document || !root.crypto || !root.crypto.randomUUID) return;
  var requested = new URLSearchParams(root.location.search).get("dcats_window");
  var windowId = requested && UUID.test(requested) ? requested : null;
  if (!windowId) { try { windowId = root.sessionStorage.getItem("dcats_work_window_v1"); } catch (_) {} }
  if (!windowId || !UUID.test(windowId)) windowId = root.crypto.randomUUID();
  var identityLock = holdWindowIdentity(windowId, {
    locks: root.navigator && root.navigator.locks,
    randomUUID: function() { return root.crypto.randomUUID(); },
    adopt: function(id) {
      windowId = id;
      try { root.sessionStorage.setItem("dcats_work_window_v1", id); } catch (_) {}
      var url = new URL(root.location.href); url.searchParams.set("dcats_window", id);
      root.history.replaceState(root.history.state, "", url.toString());
    }
  });
  var originalFetch = root.fetch.bind(root);
  var baseOrigin = "https://jqoeqximtwfpqwzngutj.supabase.co";
  var notices = [], lastActivity = 0, lastBroadcast = 0;
  var labels = {
    ja: { processing: "外部処理中・更新待機", uncertain: "外部処理の結果確認が必要です", limit: "最大4画面です", unavailable: "更新不可・再接続してください", write: "操作可能", read: "閲覧のみ", open: "別画面を開く", approve: "引継ぎを承認", pending: "切替申請中", request: "操作権限を申請", retry: "再接続", confirm: "入力中の内容を保存してから、更新権限を別の端末へ引き渡してください。", cancel: "キャンセル", transfer: "引き渡す" },
    en: { processing: "External operation in progress", uncertain: "External outcome needs review", limit: "4-window limit reached", unavailable: "Cannot update. Reconnect.", write: "Can edit", read: "Read only", open: "Open window", approve: "Approve handoff", pending: "Handoff pending", request: "Request edit access", retry: "Reconnect", confirm: "Save your changes before handing edit access to another session.", cancel: "Cancel", transfer: "Hand over" },
    zh: { processing: "外部操作正在进行", uncertain: "需要确认外部操作结果", limit: "最多4个窗口", unavailable: "无法更新，请重新连接", write: "可编辑", read: "只读", open: "打开新窗口", approve: "批准移交", pending: "等待移交", request: "申请编辑权限", retry: "重新连接", confirm: "请先保存正在编辑的内容，再将编辑权限移交到其他设备。", cancel: "取消", transfer: "移交" }
  };
  function text(key) { return (labels[root.currentLang] || labels.ja)[key]; }
  var channel = typeof root.BroadcastChannel === "function" ? new root.BroadcastChannel("dcats-workspace-v1") : null;
  function broadcast(data) {
    if (channel && root.currentUser) channel.postMessage(Object.assign({ user_id: root.currentUser.id }, data));
  }
  var coordinator = createCoordinator({
    windowId: function() { return windowId; }, randomUUID: function() { return root.crypto.randomUUID(); },
    screen: function() {
      var screen = root.document.querySelector(".screen.active");
      return screen ? screen.id.replace(/^screen-/, "") : "menu";
    }, onChange: render
  });
  function render(state) {
    root.document.documentElement.dataset.dcatsOperationMode = state.mode;
    notices.forEach(function(row) {
      row.status.textContent = state.error ? text(state.error.includes("DCATS_WINDOW_LIMIT") ? "limit" : "unavailable")
        : text(state.external_uncertain ? "uncertain" : state.external_pending ? "processing" : state.mode === "write" ? "write" : "read") + " " + state.window_count + "/4";
      row.open.textContent = text("open"); row.open.title = text("open");
      row.retry.textContent = text("retry");
      row.open.disabled = !!state.error || state.window_count >= 4;
      row.retry.hidden = !state.error;
      row.handoff.hidden = !!state.error || !!state.external_pending || (state.mode === "write" && !state.handoff_request_id);
      row.handoff.textContent = text(state.mode === "write" ? "approve" : (state.handoff_pending ? "pending" : "request"));
      row.handoff.disabled = state.mode === "read" && state.handoff_pending;
    });
  }
  function confirmHandoff() {
    var dialog = root.document.createElement("dialog"); dialog.className = "dcats-workspace-dialog";
    var message = root.document.createElement("p"); message.textContent = text("confirm");
    var actions = root.document.createElement("div"); actions.className = "dcats-workspace-dialog-actions";
    var cancel = root.document.createElement("button"); cancel.type = "button"; cancel.textContent = text("cancel");
    var approve = root.document.createElement("button"); approve.type = "button"; approve.textContent = text("transfer");
    actions.append(cancel, approve); dialog.append(message, actions); root.document.body.append(dialog);
    return new Promise(function(resolve) {
      var settled = false;
      function finish(value) { if (settled) return; settled = true; dialog.close(); dialog.remove(); resolve(value); }
      cancel.addEventListener("click", function() { finish(false); });
      approve.addEventListener("click", function() { finish(true); });
      dialog.addEventListener("cancel", function(event) { event.preventDefault(); finish(false); });
      dialog.showModal(); cancel.focus();
    });
  }
  function controls() {
    if (notices.length) return;
    root.document.querySelectorAll(".page-header-right").forEach(function(header) {
      var toolbar = root.document.createElement("div"); toolbar.className = "dcats-workspace-controls";
      var status = root.document.createElement("span"); status.className = "dcats-workspace-status"; status.setAttribute("role", "status");
      function button(label) {
        var node = root.document.createElement("button"); node.type = "button"; node.textContent = label; toolbar.append(node); return node;
      }
      toolbar.append(status);
      var open = button("別画面を開く"); open.title = "新しい作業画面を開く";
      open.addEventListener("click", function() {
        var state = coordinator.getState(); if (state.error || state.window_count >= 4) return;
        var url = new URL(root.location.pathname, root.location.origin); url.searchParams.set("dcats_window", root.crypto.randomUUID());
        // noopener intentionally avoids a live handle to another work window.
        root.open(url.toString(), "_blank", "noopener"); broadcast({ type: "refresh" });
      });
      var handoff = button("操作権限を申請");
      handoff.addEventListener("click", async function() {
        handoff.disabled = true;
        try {
          if (coordinator.getState().mode === "write") {
            if (await confirmHandoff()) await coordinator.approveHandoff();
          } else if ((await coordinator.register()).mode !== "write") await coordinator.requestHandoff();
          broadcast({ type: "refresh" });
        } catch (_) { /* Safe status is rendered by the coordinator. */ }
        finally { render(coordinator.getState()); }
      });
      var retry = button("再接続");
      retry.addEventListener("click", function() { coordinator.register().catch(function() {}); });
      header.prepend(toolbar); notices.push({ status: status, open: open, handoff: handoff, retry: retry });
    });
    render(coordinator.getState());
  }
  api.fetch = async function(input, init) {
    var url = new URL(typeof input === "string" ? input : input.url, root.location.href);
    var requestInit = Object.assign({}, init);
    var operation = operationFunction(url.pathname);
    if (url.origin === baseOrigin && (url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/storage/v1/") || operation)) {
      var headers = new Headers(input && input.headers ? input.headers : undefined);
      new Headers(init && init.headers).forEach(function(value, key) { headers.set(key, value); });
      Object.entries(coordinator.requestHeaders()).forEach(function(pair) { headers.set(pair[0], pair[1]); });
      if (operation && !headers.has("x-dcats-request-id")) {
        headers.set("x-dcats-request-id", await operationRequestId(operation, init && init.body, root.crypto));
      }
      if (url.pathname === "/rest/v1/core_products" && init && String(init.method).toUpperCase() === "PATCH") {
        try {
          var payload = JSON.parse(init.body);
          if (Number.isSafeInteger(payload.edit_version)) headers.set("x-dcats-row-version", String(payload.edit_version));
        } catch (_) { /* The database refuses updates without a loaded version. */ }
      }
      requestInit.headers = headers;
    }
    var response = await originalFetch(input, requestInit);
    if (url.origin === baseOrigin && response.status >= 400) {
      try {
        var body = await response.clone().json();
        var code = String(body.message || body.error || "");
        if (/^DCATS_(READ_ONLY|WRITE_LEASE|SESSION_EXPIRED|WINDOW_EXPIRED|EXTERNAL_OPERATION_)/.test(code)) {
          coordinator.reportDenied(); coordinator.refresh();
        }
      } catch (_) {}
    }
    return response;
  };
  var authSubscriptionInstalled = false;
  api.start = async function(sb) {
    await identityLock.ready;
    controls();
    if (!authSubscriptionInstalled && sb.auth && typeof sb.auth.onAuthStateChange === "function") {
      authSubscriptionInstalled = true;
      sb.auth.onAuthStateChange(function(event, session) {
        // Supabase callbacks must not await another Auth call under its lock.
        root.setTimeout(function() {
          if (event === "SIGNED_OUT") {
            coordinator.stop();
            if (typeof root.resetAuthenticatedAppState === "function") root.resetAuthenticatedAppState();
          } else if (session && root.currentUser && session.user.id !== root.currentUser.id) {
            coordinator.stop(); root.location.reload();
          }
        }, 0);
      });
    }
    var state = await coordinator.start(sb); lastActivity = Date.now(); broadcast({ type: "refresh" }); return state;
  };
  api.stop = function() { coordinator.stop(); };
  api.refresh = function() { return coordinator.refresh(); };
  api.updateLabels = function() { render(coordinator.getState()); };
  api.isChildWindow = !!requested;
  api.activity = function() {
    lastActivity = Date.now();
    if (lastActivity - lastBroadcast > 5000) { lastBroadcast = lastActivity; broadcast({ type: "activity", at: lastActivity }); }
  };
  api.lastActivity = function() { return lastActivity; };
  api.snapshotKey = function() { return "dcats_restore_state_v2_" + windowId; };
  api.storageKey = function(name, userId) { return name + ":" + userId + ":" + windowId; };
  if (channel) channel.addEventListener("message", function(event) {
    var value = event.data;
    if (!root.currentUser || !value || value.user_id !== root.currentUser.id) return;
    if (value.type === "refresh") coordinator.refresh();
    if (value.type === "activity" && Number.isFinite(value.at) && Math.abs(Date.now() - value.at) <= 10000) {
      lastActivity = Math.max(lastActivity, value.at);
      if (typeof root.resetAutoLogoutTimer === "function") root.resetAutoLogoutTimer(true);
    }
  });
  root.document.addEventListener("visibilitychange", function() { if (root.document.visibilityState === "visible") coordinator.refresh(); });
  root.addEventListener("pagehide", function(event) {
    if (!event.persisted) { coordinator.close().catch(function() {}); identityLock.release(); }
  });
  root.DcatsWorkspace = api;
})(typeof window === "object" ? window : globalThis);
