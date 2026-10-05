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
  async function importOnce(options) {
    var fileName = options.fileName;
    var match = /^hanbaioh-sales-test-(9\d{5})-([0-9a-f]{12})-55\.csv$/.exec(fileName || "");
    var record = options.record;
    var api = window.DcatsHanbaiohTestSalesApi;
    if (active || !match || !record || typeof options.isCurrent !== "function" ||
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
            resolve(response.data);
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
    wasAttempted: wasAttempted,
    cancelCurrent: function () { if (activeCancel) activeCancel(); },
  });
})();
