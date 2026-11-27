(function () {
  "use strict";
  var channel = "dcats-hanbaioh25-bridge-v1";
  var active = false;
  var attemptedFiles = new Set();
  var activeCancel;
  function wasAttempted(record, fileName) {
    return !!record && attemptedFiles.has(record.actor_id + ":" + record.device_id + ":" + fileName);
  }
  function ticket(response) {
    var value = response && response.data;
    if (response && response.error || !value || value.ok !== true ||
        typeof value.capability !== "string" || !value.capability.startsWith("v2.") ||
        value.capability.length > 8192) throw new Error("sales_ticket_unavailable");
    return value.capability;
  }

  var testCompany = "D-CATS連携テスト（実データ禁止）";
  var uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var shaPattern = /^[0-9a-f]{64}$/;
  function validateReceipt(data, record, fileName, requestId) {
    var m = /^hanbaioh-sales-test-(9\d{5})-([a-f0-9]{12})-55\.csv$/.exec(fileName || "");
    if (!m || !data || Object.keys(data).sort().join(",") !== "actorId,backupSha256,companyName,deviceId,loginName,processId,receiptVersion,requestId,rowCount,slipNumber,sourceSha256,status,vendorExportSha256" ||
        data.receiptVersion !== 1 || data.requestId !== requestId || data.actorId !== record.actor_id ||
        data.deviceId !== record.device_id || data.companyName !== testCompany ||
        !["import_verified", "already_present", "readback_verified"].includes(data.status) ||
        typeof data.loginName !== "string" || !data.loginName.trim() || data.loginName.length > 100 ||
        data.slipNumber !== m[1] || !shaPattern.test(data.sourceSha256) || data.sourceSha256.slice(0, 12) !== m[2] ||
        !shaPattern.test(data.vendorExportSha256) || data.rowCount !== 1 || !Number.isSafeInteger(data.processId) || data.processId < 1 ||
        (data.status === "import_verified" ? !shaPattern.test(data.backupSha256) : data.backupSha256 !== null)) throw new Error("sales_receipt_unverified");
    return Object.freeze(Object.assign({}, data));
  }
  async function readOnly(options, command) {
    var record = options.record, fileName = options.fileName;
    if (active || !uuidPattern.test(record && record.actor_id) || !uuidPattern.test(record && record.device_id) ||
        !/^hanbaioh-sales-test-9\d{5}-[a-f0-9]{12}-55\.csv$/.test(fileName || "") ||
        typeof options.isCurrent !== "function" || !options.isCurrent()) throw new Error("sales_unavailable");
    active = true;
    var request;
    try {
      var api = window.DcatsHanbaiohTestSalesApi;
      if (window.DcatsQaSalesTrial) api = window.DcatsQaSalesTrial.select(record, api);
      var capability = ticket(await api.issueBinding(record));
      if (!options.isCurrent()) throw new Error("sales_session_changed");
      request = { id: window.crypto.randomUUID(), command: command, deviceId: record.device_id, fileName: fileName, capability: capability };
      return await new Promise(function (resolve, reject) {
        var done = false, timer = window.setTimeout(function () { finish(); }, command === "inspect_dev_order_test_sale" ? 20000 : 180000);
        function finish(value) {
          if (done) return; done = true;
          window.clearTimeout(timer); window.removeEventListener("message", receive);
          if (!options.isCurrent() || !value || value.ok !== true || value.command !== command || !value.data) { reject(new Error("sales_read_unverified")); return; }
          try {
            var data = value.data, m = /^hanbaioh-sales-test-(9\d{5})-([a-f0-9]{12})-55\.csv$/.exec(fileName);
            if (command === "verify_dev_order_test_sale") { resolve(validateReceipt(data, record, fileName, request.id)); return; }
            if (Object.keys(data).sort().join(",") !== "actorId,companyName,deviceId,fileName,loginName,requestId,rowCount,slipNumber,sourceSha256,status" ||
                data.status !== "test_sales_prepared" || data.requestId !== request.id || data.actorId !== record.actor_id ||
                data.deviceId !== record.device_id || data.companyName !== testCompany || data.fileName !== fileName ||
                typeof data.loginName !== "string" || !data.loginName.trim() || data.loginName.length > 100 ||
                data.rowCount !== 1 || data.slipNumber !== m[1] || !shaPattern.test(data.sourceSha256) ||
                data.sourceSha256.slice(0, 12) !== m[2]) throw new Error("sales_stage_unverified");
            resolve(Object.freeze(Object.assign({}, data)));
          } catch (error) { reject(error); }
        }
        function receive(event) {
          if (event.source !== window || event.origin !== window.location.origin) return;
          var value = event.data;
          if (value && value.channel === channel && value.type === "response" && value.response && value.response.id === request.id) finish(value.response);
        }
        activeCancel = function () { finish(); };
        window.addEventListener("message", receive);
        window.postMessage({ channel: channel, type: "request", request: request }, window.location.origin);
      });
    } finally { if (request) request.capability = ""; activeCancel = null; active = false; }
  }

  async function importOnce(options) {
    var fileName = options.fileName;
    var match = /^hanbaioh-sales-test-(9\d{5})-([0-9a-f]{12})-55\.csv$/.exec(fileName || "");
    var record = options.record;
    var api = window.DcatsHanbaiohTestSalesApi;
    if (window.DcatsQaSalesTrial) api = window.DcatsQaSalesTrial.select(record, api);
    if (active || !match || !record || !uuidPattern.test(record.actor_id) || !uuidPattern.test(record.device_id) || typeof options.isCurrent !== "function" ||
        !options.isCurrent() || !api || typeof api.issueBinding !== "function" || typeof api.claimOnce !== "function") {
      throw new Error("sales_unavailable");
    }
    var attemptKey = record.actor_id + ":" + record.device_id + ":" + fileName;
    if (attemptedFiles.has(attemptKey)) throw new Error("sales_already_attempted");
    attemptedFiles.add(attemptKey);
    active = true;
    var id = window.crypto.randomUUID();
    var request;
    try {
      var binding = ticket(await api.issueBinding(record));
      if (!options.isCurrent()) throw new Error("sales_session_changed");
      request = { id: id, command: "import_dev_order_test_sale", deviceId: record.device_id,
        fileName: fileName, capability: binding };
      return await new Promise(function (resolve, reject) {
        var settled = false;
        var phase = 0;
        var handling = false;
        var timer = window.setTimeout(function () { finish(null); }, 720000);
        function finish(response) {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          window.removeEventListener("message", onMessage);
          if (response && response.ok === true && response.command === request.command && response.data) {
            try {
              resolve(response.data.status === "stopped" ? response.data : validateReceipt(response.data, record, fileName, id));
            } catch (error) { reject(error); }
          } else {
            window.postMessage({ channel: channel, type: "sales_cancel", id: id }, window.location.origin);
            reject(new Error("sales_outcome_unverified"));
          }
        }
        activeCancel = function () { finish(null); };
        async function onMessage(event) {
          if (event.source !== window || event.origin !== window.location.origin) return;
          var value = event.data;
          if (!value || value.channel !== channel) return;
          if (value.type === "response" && value.response && value.response.id === id) {
            finish(options.isCurrent() ? value.response : null); return;
          }
          if (value.type !== "sales_ticket_request" || value.id !== id || settled) return;
          var keys = value.kind === "binding" ? "challengeId,channel,id,kind,type" : "challengeId,channel,csvSha256,id,kind,slipNumber,type";
          if (!options.isCurrent() || handling || Object.keys(value).sort().join(",") !== keys ||
              !/^[0-9a-f-]{36}$/.test(value.challengeId) ||
              (phase === 0 ? value.kind !== "binding" : phase === 1 ? value.kind !== "claim" : true) ||
              (value.kind === "claim" && (value.slipNumber !== match[1] ||
                !/^[0-9a-f]{64}$/.test(value.csvSha256) || value.csvSha256.slice(0, 12) !== match[2]))) {
            finish(null); return;
          }
          phase += 1;
          handling = true;
          try {
            var capability = ticket(await (value.kind === "binding" ? api.issueBinding(record) :
              api.claimOnce(record, value.slipNumber, value.csvSha256)));
            if (settled || !options.isCurrent()) { finish(null); return; }
            window.postMessage({ channel: channel, type: "sales_ticket_reply", id: id,
              challengeId: value.challengeId, capability: capability }, window.location.origin);
          } catch { finish(null); }
          finally { handling = false; }
        }
        window.addEventListener("message", onMessage);
        window.postMessage({ channel: channel, type: "request", request: request }, window.location.origin);
      });
    } finally {
      if (request) request.capability = "";
      activeCancel = null;
      active = false;
    }
  }
  window.DcatsHanbaiohTestSalesBridge = Object.freeze({ importOnce: importOnce,
    inspect: function (options) { return readOnly(options, "inspect_dev_order_test_sale"); },
    verify: function (options) { return readOnly(options, "verify_dev_order_test_sale"); },
    wasAttempted: wasAttempted,
    cancelCurrent: function () { if (activeCancel) activeCancel(); },
  });
})();
