/* Persistent request keys are recovery hints; the server owns every permission,
 * hold, rate limit and state transition. No email/name or credential is stored. */
(function(root) {
  "use strict";
  var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var actions = ["invite", "resend_invitation", "send_password_reset"];
  function receipt(value) {
    if (!value || !uuid.test(value.request_id || "") || !Number.isSafeInteger(value.version) || value.version < 1 ||
      ["pending", "needs_review", "accepted", "failed", "cancelled", "completed"].indexOf(value.request_state) < 0 ||
      [value.can_cancel, value.can_reconcile, value.can_request_new].some(function(v) { return typeof v !== "boolean"; })) return null;
    return { request_id: value.request_id, version: value.version, request_state: value.request_state,
      can_cancel: value.can_cancel, can_reconcile: value.can_reconcile, can_request_new: value.can_request_new };
  }
  function problem(code, request) { return { data: { ok: false, error: code, retryable: false, request: request || undefined } }; }
  function create(options) {
    var actor = options.actorId;
    var storageKey = "dcats.internal-account-requests.v1:" + actor;
    function authorized() { if (!actor || !options.stillAuthorized()) throw new Error("forbidden"); }
    function read() {
      var raw = options.storage.getItem(storageKey);
      var values = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(values) || values.some(function(r) { return !r || !uuid.test(r.key || "") ||
        !/^[a-f0-9]{64}$/.test(r.targetHash || "") || !/^[a-f0-9]{64}$/.test(r.payloadHash || "") ||
        actions.indexOf(r.action) < 0 || (r.previousRequestId && !uuid.test(r.previousRequestId)) || (r.request && !receipt(r.request)); })) throw new Error("request_storage_unavailable");
      return values;
    }
    function write(values) {
      var text = JSON.stringify(values);
      options.storage.setItem(storageKey, text);
      if (options.storage.getItem(storageKey) !== text) throw new Error("request_storage_unavailable");
    }
    async function hash(value) {
      var bytes = await options.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
      return Array.from(new Uint8Array(bytes)).map(function(n) { return n.toString(16).padStart(2, "0"); }).join("");
    }
    function canonical(value) {
      return JSON.stringify(Object.keys(value).sort().map(function(key) { return [key, value[key]]; }));
    }
    async function call(body) {
      authorized();
      try {
        var response = await options.invoke(body);
        if (response && response.error && ["FunctionsFetchError", "FunctionsRelayError"].indexOf(response.error.name) >= 0) return problem("reconciliation_required");
        var data = response && response.data;
        if (!data && response && response.error && response.error.context && typeof response.error.context.json === "function") {
          data = await response.error.context.json();
        }
        if (!data || typeof data !== "object") return problem("reconciliation_required");
        if (data.request && !receipt(data.request)) return problem("reconciliation_required");
        return { data: data, error: response && response.error ? { message: "request_failed" } : null };
      } catch (ignore) { return problem("reconciliation_required"); }
    }
    async function lock(callback) {
      if (!options.locks || typeof options.locks.request !== "function") return problem("request_storage_unavailable");
      try { return await options.locks.request(storageKey, async function() { authorized(); return await callback(); }); }
      catch (error) { return problem(error.message === "forbidden" ? "forbidden" : "request_storage_unavailable"); }
    }
    function targetBody(target) {
      return target.id ? { action: "request_status", target_user_id: target.id } :
        { action: "request_status", email: String(target.email || "").trim().toLowerCase() };
    }
    async function lookup(target) {
      var response = await call(targetBody(target));
      if (response.data.error !== "request_not_found") return response.data.ok === true && !receipt(response.data.request) ? problem("reconciliation_required") : response;
      var targetHash = await hash(String(target.email || "").trim().toLowerCase());
      var own = read().filter(function(r) { return r.targetHash === targetHash; }).at(-1);
      if (own) {
        var ownResponse = await call({ action: "request_status", idempotency_key: own.key });
        if (ownResponse.data.error !== "request_not_found") return ownResponse.data.ok === true && !receipt(ownResponse.data.request) ? problem("reconciliation_required") : ownResponse;
      }
      return { data: { ok: true, request: null } };
    }
    async function send(payload, target) {
      // Snapshot the original target and payload before any promise or dialog.
      payload = JSON.parse(JSON.stringify(payload)); target = { id: target.id || "", email: String(target.email || "").trim().toLowerCase() };
      return lock(async function() {
        if (actions.indexOf(payload.action) < 0 || !target.email) return problem("request_invalid");
        var targetHash = await hash(target.email), payloadHash = await hash(canonical(payload));
        var values = read(), own = values.filter(function(r) { return r.targetHash === targetHash; }).at(-1);
        var observed = await lookup(target), current = receipt(observed.data.request);
        if (!observed.data.ok) return observed;
        var previous = null;
        if (current && current.can_request_new) {
          if (!await options.confirmNew(current)) return { data: { cancelled: true } };
          previous = current.request_id; own = null;
        } else if (current && !(current.request_state === "pending" && current.can_cancel && own &&
          own.payloadHash === payloadHash && (!own.request || own.request.request_id === current.request_id))) {
          return problem("reconciliation_required", current);
        }
        if (own && own.payloadHash !== payloadHash) return problem("idempotency_conflict", current);
        authorized();
        if (!own) {
          own = { key: options.crypto.randomUUID(), targetHash: targetHash, payloadHash: payloadHash,
            action: payload.action, createdAt: new Date().toISOString(), request: null, previousRequestId: previous };
          values.push(own);
        }
        write(values); // Failure here prevents the first provider-capable call.
        payload.idempotency_key = own.key;
        if (own.previousRequestId) payload.previous_request_id = own.previousRequestId;
        var result = await call(payload), next = receipt(result.data.request);
        if (next) {
          if (own.request && own.request.request_id !== next.request_id) return problem("reconciliation_required", own.request);
          own.request = next;
          try { write(values); } catch (ignore) { return problem("request_storage_unavailable", next); }
        }
        if (result.data.ok === true && (!next || next.request_state !== "completed" || result.data.delivery_status !== "accepted")) {
          return problem("reconciliation_required", next);
        }
        return result;
      });
    }
    async function control(state, action) {
      var current = receipt(state);
      if (!current || ["request_status", "cancel_request", "reconcile_request"].indexOf(action) < 0) return problem("request_invalid");
      return lock(async function() {
        var result = await call({ action: action, request_id: current.request_id, request_version: current.version });
        var next = receipt(result.data.request);
        if (next && next.request_id !== current.request_id) return problem("reconciliation_required", current);
        if (next) { var values=read();values.forEach(function(r){if(r.request && r.request.request_id===next.request_id)r.request=next;});write(values); }
        return result;
      });
    }
    return { send: send, lookup: function(target) { return lock(function(){ return lookup(target); }); }, control: control };
  }
  root.DcatsInternalAccountRequests = { create: create, receipt: receipt };
  if (typeof module === "object" && module.exports) module.exports = root.DcatsInternalAccountRequests;
})(typeof globalThis !== "undefined" ? globalThis : this);
