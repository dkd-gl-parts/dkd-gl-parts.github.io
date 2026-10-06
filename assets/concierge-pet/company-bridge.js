(function () {
  "use strict";
  var channel = "dcats-hanbaioh25-bridge-v1";
  var commands = Object.freeze({ products: "prepare_hanbaioh_products", customers: "prepare_hanbaioh_customers", sales: "prepare_hanbaioh_sales" });
  var active = false, cancel, loginAttempts = new Set();
  var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function actorKey(record) { return record.actor_id + ":" + record.device_id; }
  function validRecord(record) { return record && uuid.test(record.actor_id) && uuid.test(record.device_id); }
  function requireCurrent(options) {
    if (!validRecord(options.record) || typeof options.isCurrent !== "function" || !options.isCurrent()) throw new Error("company_session_changed");
  }
  function issuedTicket(result, request) {
    var value = result && result.data, expires = value && Date.parse(value.expires_at);
    if (result && result.error || !value || value.ok !== true || value.request_id !== request.request_id || value.device_id !== request.device_id ||
        typeof value.expires_at !== "string" || !Number.isFinite(expires) || new Date(expires).toISOString() !== value.expires_at || expires <= Date.now() || expires > Date.now() + 180000 ||
        typeof value.capability !== "string" || value.capability.length > 8192 || !/^v2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{86}$/.test(value.capability)) throw new Error("company_ticket_unavailable");
    return value.capability;
  }
  function nativeRequest(request, options) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = window.setTimeout(function () { finish(null); }, request.command === "login_hanbaioh_company" ? 210000 : 30000);
      function finish(response) {
        if (settled) return; settled = true;
        window.clearTimeout(timer); window.removeEventListener("message", onMessage); cancel = null;
        if (response && options.isCurrent() && response.ok === true && response.command === request.command) resolve(response.data);
        else reject(new Error("company_result_unverified"));
      }
      function onMessage(event) {
        if (event.source !== window || event.origin !== window.location.origin) return;
        var message = event.data;
        if (message && message.channel === channel && message.type === "response" && message.response && message.response.id === request.id) finish(message.response);
      }
      cancel = function () { finish(null); };
      window.addEventListener("message", onMessage);
      window.postMessage({ channel: channel, type: "request", request: request }, window.location.origin);
    });
  }
  async function run(options, category) {
    requireCurrent(options);
    var api = window.DcatsHanbaiohCompanyApi;
    if (active || !api || typeof api.issue !== "function" || category !== "account" && !Object.hasOwn(commands, category)) throw new Error("company_operation_unavailable");
    var isLogin = category === "account", key = actorKey(options.record);
    if (isLogin && loginAttempts.has(key)) throw new Error("company_login_already_attempted");
    active = true;
    var request, body, bytes;
    try {
      body = { command: isLogin ? "login_hanbaioh_company" : commands[category], request_id: window.crypto.randomUUID(), device_id: options.record.device_id };
      if (!isLogin) {
        var file = options.file;
        if (!file || typeof file.name !== "string" || file.name.length < 1 || file.name.length > 200 || /[\\/:\x00-\x1f\x7f]/.test(file.name) || !file.name.endsWith(".csv") ||
            !Number.isSafeInteger(file.size) || file.size < 1 || file.size > 25 * 1024 * 1024 || typeof file.arrayBuffer !== "function") throw new Error("company_csv_unavailable");
        bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length !== file.size) throw new Error("company_csv_unavailable");
        body.file_name = file.name;
        body.source_sha256 = Array.from(new Uint8Array(await window.crypto.subtle.digest("SHA-256", bytes)), function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
        bytes.fill(0); bytes = null;
      }
      requireCurrent(options);
      // Mark before native submission. An uncertain result must never cause an
      // automatic second sign-in, including after the settings panel reopens.
      var capability = issuedTicket(await api.issue(options.record, body), body);
      requireCurrent(options);
      request = { id: body.request_id, command: body.command, deviceId: body.device_id, capability: capability };
      if (!isLogin) request.fileName = body.file_name;
      if (isLogin) loginAttempts.add(key);
      var data = await nativeRequest(request, options);
      requireCurrent(options);
      if (isLogin) {
        if (!data || data.status !== "ui_login_verified" || data.code !== "HANBAIOH_CONTROLLED_UI_LOGIN_VERIFIED" || data.sessionRecorded !== true) throw new Error("company_result_unverified");
        return { status: "login_verified" };
      }
      var job = data && data.job;
      if (!job || job.status !== "validated_waiting_for_backup" || job.actorId !== options.record.actor_id || job.deviceId !== body.device_id || job.category !== category ||
          job.direction !== "import" || job.sourceSha256 !== body.source_sha256 || job.fileName !== body.file_name || !/^[0-9a-f]{64}$/.test(job.jobId)) throw new Error("company_result_unverified");
      return { status: "prepared", category: category, reused: data.reused === true };
    } finally { bytes && bytes.fill(0); if (request) request.capability = ""; active = false; }
  }
  window.DcatsHanbaiohCompanyBridge = Object.freeze({
    loginOnce: function (options) { return run(options, "account"); },
    prepareCsv: function (options) { return run(options, options.category); },
    wasLoginAttempted: function (record) { return validRecord(record) && loginAttempts.has(actorKey(record)); },
    cancelCurrent: function () { if (cancel) cancel(); }
  });
})();
