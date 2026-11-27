(function (global) {
  "use strict";
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var SHA = /^[0-9a-f]{64}$/;
  var CATEGORIES = ["sales", "customers", "products"];
  var CONTEXT_FIELDS = ["actorId", "sessionId", "deviceId", "companyKey", "companyUserId", "revision"];
  var stages = {
    import: ["preflight", "login", "backup", "import", "readback", "verify", "record"],
    export: ["preflight", "login", "export", "verify"]
  };
  var expected = {
    preflight: "ready", login: "login_verified", backup: "backup_verified",
    import: "import_observed", readback: "readback_verified", verify: "content_verified",
    record: "completion_recorded", export: "export_verified", transfer: "transfer_verified"
  };
  var exclusive = new Set();
  function fail(code) { var e = new Error(code); e.code = code; return e; }
  function text(v, limit) { return typeof v === "string" && v.length > 0 && v.length <= limit && !/[\x00-\x1f\x7f]/.test(v); }
  function context(c) {
    if (!c || c.roleCode !== "system_admin" || !UUID.test(c.actorId) || !UUID.test(c.sessionId) || !UUID.test(c.deviceId) ||
        !text(c.companyKey, 128) || !text(c.companyUserId, 80) || !text(c.revision, 128)) throw fail("business_context_unavailable");
    var out = { roleCode: c.roleCode };
    CONTEXT_FIELDS.forEach(function (k) { out[k] = c[k]; });
    return Object.freeze(out);
  }
  function same(a, b) { return a.roleCode === b.roleCode && CONTEXT_FIELDS.every(function (k) { return a[k] === b[k]; }); }
  function intent(message) {
    var s = String(message || "").normalize("NFKC").trim().replace(/[。.!！?？]+$/g, "").trim();
    if (/^(はい|お願いします|やって(?:ほしい|ください)?|実行(?:して(?:ください)?)?|取り込んで(?:ください)?|出力して(?:ください)?|お願い(?:します)?|yes|please do|go ahead|do it|执行|开始|请执行)$/i.test(s)) return "approve";
    if (/^(いいえ|やめ(?:て|る)|キャンセル|取り消(?:し|して)|説明だけ|案内だけ|no|cancel|不要|取消)$/i.test(s)) return "cancel";
    return "question";
  }
  // This controller schedules fixed, reviewed adapters. It never interprets AI
  // text as a command, a file path, a role, or evidence of vendor registration.
  function create(options) {
    if (!options || typeof options.currentContext !== "function" || typeof options.resolveTarget !== "function" ||
        typeof options.runStage !== "function" || typeof options.randomUUID !== "function") throw fail("business_adapter_unavailable");
    var now = options.now || Date.now, changed = options.changed || function () {};
    var job = null, sequence = 0, active = false, lastTime = 0;
    function clock() { var n = now(); if (!Number.isSafeInteger(n) || n < 1 || n < lastTime) throw fail("business_clock_changed"); lastTime = n; return n; }
    function snapshot() {
      if (!job) return Object.freeze({ state: "idle", busy: false });
      return Object.freeze({ id: job.id, direction: job.direction, category: job.category, state: job.state,
        stage: job.stage, companyLabel: job.companyLabel, userLabel: job.userLabel,
        targetLabel: job.targetLabel, count: job.count, expiresAt: job.expiresAt,
        busy: active, consumed: job.consumed, retryPermitted: false,
        mayHaveWritten: job.mayHaveWritten, error: job.error || null, result: job.result || null });
    }
    function publish(state, stage, error) { if (job) { job.state = state; job.stage = stage || null; job.error = error || null; } changed(snapshot()); }
    function requireCurrent(j, token, requireDeadline) {
      if (job !== j || token !== sequence || j.controller.signal.aborted || !same(j.context, context(options.currentContext())) ||
          requireDeadline && clock() >= (j.consumed ? j.executionExpiresAt : j.expiresAt)) throw fail("business_request_stale");
    }
    async function propose(request) {
      if (active || job && job.consumed && !["completed", "cancelled", "stopped"].includes(job.state)) throw fail("business_outcome_requires_check");
      if (!request || !stages[request.direction] || !CATEGORIES.includes(request.category)) throw fail("business_request_invalid");
      var c = context(options.currentContext()), token = ++sequence;
      var resolved = await options.resolveTarget(Object.freeze({ direction: request.direction, category: request.category }), c);
      if (token !== sequence || !same(c, context(options.currentContext()))) throw fail("business_request_stale");
      if (!resolved || resolved.testCompany !== true || !text(resolved.companyLabel, 120) || !text(resolved.userLabel, 80) ||
          !text(resolved.targetLabel, 200) || !Number.isSafeInteger(resolved.count) || resolved.count < 1 || resolved.count > 1000000 ||
          request.direction === "import" && !SHA.test(resolved.sourceSha256)) throw fail("business_target_unverified");
      var id = options.randomUUID(); if (!UUID.test(id)) throw fail("business_request_invalid");
      job = { id: id, context: c, direction: request.direction, category: request.category,
        companyLabel: resolved.companyLabel, userLabel: resolved.userLabel, targetLabel: resolved.targetLabel,
        count: resolved.count, sourceSha256: request.direction === "import" ? resolved.sourceSha256 : null,
        target: resolved.handle, expiresAt: clock() + 180000, state: "offered", stage: null,
        consumed: false, mayHaveWritten: false, controller: new AbortController(), evidence: [], result: null };
      publish("offered"); return snapshot();
    }
    function bound(j) {
      return Object.freeze({ operationId: j.id, context: j.context, direction: j.direction, category: j.category,
        sourceSha256: j.sourceSha256, count: j.count, target: j.target, signal: j.controller.signal,
        expiresAt: j.executionExpiresAt, evidence: Object.freeze(j.evidence.slice()) });
    }
    function validateReceipt(j, stage, receipt) {
      if (!receipt || receipt.verified !== true || receipt.operationId !== j.id || receipt.category !== j.category ||
          receipt.status !== expected[stage] || receipt.companyKey !== j.context.companyKey ||
          receipt.companyUserId !== j.context.companyUserId || receipt.deviceId !== j.context.deviceId ||
          stage !== "preflight" && receipt.actorId !== j.context.actorId ||
          j.direction === "import" && receipt.sourceSha256 !== j.sourceSha256) throw fail("business_result_unverified");
      if (["readback", "verify", "export", "transfer"].includes(stage) && (receipt.count !== j.count || !SHA.test(receipt.sha256))) throw fail("business_content_mismatch");
      if (["verify", "transfer"].includes(stage) && receipt.matched !== true) throw fail("business_content_mismatch");
      return Object.freeze({ status: receipt.status, operationId: j.id, category: j.category,
        ...(receipt.sha256 ? { sha256: receipt.sha256 } : {}), ...(Number.isSafeInteger(receipt.count) ? { count: receipt.count } : {}) });
    }
    async function execute(id) {
      var j = job, token = sequence;
      if (!j || j.id !== id || j.state !== "offered" || j.consumed || active) throw fail("business_approval_unavailable");
      requireCurrent(j, token, true);
      var lock = j.context.actorId + ":" + j.context.deviceId;
      if (exclusive.has(lock)) throw fail("business_operation_busy");
      // Consume before awaiting any side effect. A changed UUID or another
      // affirmative reply cannot resubmit an operation with an unknown result.
      j.executionExpiresAt = clock() + 900000;
      j.consumed = true; active = true; exclusive.add(lock); publish("running", "preflight");
      try {
        for (var stage of (options.atomicTransfer === true ? ["preflight", "login", j.direction === "import" ? "transfer" : "export"] : stages[j.direction])) {
          requireCurrent(j, token, true);
          j.stage = stage;
          if (["backup", "import", "export", "record", "transfer"].includes(stage)) j.mayHaveWritten = true;
          publish("running", stage);
          var receipt = await options.runStage(stage, bound(j));
          requireCurrent(j, token, true);
          j.evidence.push(validateReceipt(j, stage, receipt));
        }
        j.result = j.evidence[j.evidence.length - 1]; publish("completed");
      } catch (error) {
        publish(j.mayHaveWritten ? "outcome_unknown" : j.controller.signal.aborted ? "cancelled" : "stopped", j.stage,
          text(error && error.code, 100) ? error.code : "business_operation_failed");
      } finally { active = false; exclusive.delete(lock); changed(snapshot()); }
      return snapshot();
    }
    async function reply(message, offeredId) {
      var action = intent(message);
      if (!job || job.state !== "offered" || offeredId !== job.id || action === "question") return { handled: false };
      if (action === "cancel") { cancel(); return { handled: true, result: snapshot() }; }
      return { handled: true, result: await execute(offeredId) };
    }
    function cancel() {
      if (!job) return;
      job.controller.abort(); sequence += 1;
      publish(active && job.mayHaveWritten ? "outcome_unknown" : "cancelled", job.stage);
    }
    function reset() {
      if (active || job && job.state === "outcome_unknown") throw fail("business_outcome_requires_check");
      if (job) job.controller.abort(); job = null; sequence += 1; changed(snapshot());
    }
    return Object.freeze({ propose: propose, reply: reply, execute: execute, cancel: cancel, reset: reset, snapshot: snapshot });
  }
  global.DcatsConciergeBusinessFlow = Object.freeze({ create: create, intent: intent });
})(typeof window !== "undefined" ? window : globalThis);
