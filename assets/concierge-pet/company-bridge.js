(function () {
  "use strict";
  var channel = "dcats-hanbaioh25-bridge-v1";
  var commands = Object.freeze({ products: "prepare_hanbaioh_products", customers: "prepare_hanbaioh_customers", sales: "prepare_hanbaioh_sales" });
  var exportCommands = Object.freeze({ products: "export_hanbaioh_products", customers: "export_hanbaioh_customers", sales: "export_hanbaioh_sales" });
  var exportFields = Object.freeze({ products: 67, customers: 118, sales: 55 });
  var active = false, cancel, loginAttempts = new Set(), verifiedLogins = new Set(), exportAttempts = new Map();
  var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function actorKey(record) { return record.actor_id + ":" + record.device_id; }
  function validRecord(record) { return record && uuid.test(record.actor_id) && uuid.test(record.device_id); }
  function exportKey(record, category) { return actorKey(record) + ":" + category; }
  function previousExport(record, category) {
    if (!validRecord(record) || !Object.hasOwn(exportCommands, category)) return null;
    var key = exportKey(record, category), id = exportAttempts.get(key);
    if (!id) { try { id = window.sessionStorage.getItem("dcats-company-export:" + key); } catch {} }
    return typeof id === "string" && uuid.test(id) ? id : null;
  }
  function rememberExport(record, category, id) {
    // Store only the original job ID, never a permit, password or CSV contents.
    // Keep it across a page reload so uncertain output cannot be resubmitted.
    try { window.sessionStorage.setItem("dcats-company-export:" + exportKey(record, category), id); }
    catch { throw new Error("company_operation_unavailable"); }
    exportAttempts.set(exportKey(record, category), id);
  }
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
  async function issueEnrollmentTicket(api, record, request) {
    var result;
    try { result = await api.issue(record, request); }
    catch { throw new Error("company_issuer_unavailable"); }
    if (result && result.error || result && result.data && result.data.ok === false) {
      // Only fixed categories cross into the UI. Never echo an Auth response,
      // server exception, signed ticket, or arbitrary error text.
      var status = result.error && result.error.context && result.error.context.status;
      var code = result.data && result.data.error;
      if (status === 401 || code === "authentication_required") throw new Error("company_authentication_required");
      if (status === 403 || code === "forbidden") throw new Error("company_not_authorized");
      if (status === 409 || code === "company_binding_unavailable") throw new Error("company_binding_unavailable");
      throw new Error("company_issuer_unavailable");
    }
    return issuedTicket(result, request);
  }
  function nativeRequest(request, options) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var isReadiness = request.command === "read_hanbaioh_company_backup_readiness";
      var isBackupSetup = request.command === "open_hanbaioh_company_backup_setup";
      var isExport = request.command.startsWith("export_hanbaioh_") || request.command === "read_hanbaioh_company_export" || isReadiness;
      var timer = window.setTimeout(function () { finish(null); }, isBackupSetup ? 610000 : isReadiness ? 20000 : request.command === "login_hanbaioh_company" || isExport ? 210000 : request.command === "read_hanbaioh_company_device" ? 5000 : 30000);
      var watch = window.setInterval(function () { if (!options.isCurrent()) finish(null); }, 250);
      function finish(response) {
        if (settled) return; settled = true;
        window.clearTimeout(timer); window.clearInterval(watch); window.removeEventListener("message", onMessage); window.removeEventListener("pagehide", stop); cancel = null;
        if (isExport) window.postMessage({channel:channel,type:"company_export_cancel",id:request.id},window.location.origin);
        if (isBackupSetup) window.postMessage({channel:channel,type:"company_backup_setup_cancel",id:request.id},window.location.origin);
        if (response && options.isCurrent() && response.ok === true && response.command === request.command) resolve(response.data);
        else {
          var code = response && response.error && response.error.code;
          if (isBackupSetup && code === "REQUEST_REJECTED" && options.isCurrent()) { reject(new Error("company_extension_update_required")); return; }
          if (request.command === "read_hanbaioh_company_device" && options.isCurrent()) {
            if (code === "REQUEST_REJECTED") reject(new Error(response.error.message === "company_device_unavailable" ? "company_device_unavailable" : "company_extension_update_required"));
            else if (code === "NATIVE_HOST_UNAVAILABLE") reject(new Error("company_native_host_unavailable"));
            else reject(new Error("company_bridge_unavailable"));
          } else reject(new Error("company_result_unverified"));
        }
      }
      function onMessage(event) {
        if (event.source !== window || event.origin !== window.location.origin) return;
        var message = event.data;
        if (message && message.channel === channel && message.type === "response" && message.response &&
            (message.response.id === request.id ||
             // Older extensions reject this new discovery command without an
             // ID. Accept that rejection only as a failure of this preflight;
             // it cannot authorize or complete any native operation.
             (request.command === "read_hanbaioh_company_device" || isBackupSetup) && !message.response.id && message.response.ok === false && message.response.error && message.response.error.code === "REQUEST_REJECTED")) finish(message.response);
      }
      function stop() { finish(null); }
      cancel = stop;
      window.addEventListener("pagehide", stop);
      window.addEventListener("message", onMessage);
      window.postMessage({ channel: channel, type: "request", request: request }, window.location.origin);
    });
  }
  async function readDeviceFromPc(options) {
    if(active || !options || !uuid.test(options.actorId) || typeof options.isCurrent!=="function" || !options.isCurrent()) throw new Error("company_operation_unavailable");
    active=true;
    try {
      var record=await nativeRequest({id:window.crypto.randomUUID(),command:"read_hanbaioh_company_device",actorId:options.actorId},options);
      if(!validRecord(record)||record.actor_id!==options.actorId||Object.keys(record).sort().join(",")!=="actor_id,device_id,public_key_sha256,public_key_spki"||
         !/^[0-9a-f]{64}$/.test(record.public_key_sha256)||typeof record.public_key_spki!=="string"||record.public_key_spki.length>2048||!record.public_key_spki.startsWith("-----BEGIN PUBLIC KEY-----")||!options.isCurrent())throw new Error("company_device_unavailable");
      return record;
    } finally { active=false; }
  }
  async function openBackupSetupFromPc(options) {
    if (active || !options || !uuid.test(options.actorId) || typeof options.isCurrent !== "function" || !options.isCurrent()) throw new Error("company_operation_unavailable");
    active = true;
    var native;
    try {
      var record = await nativeRequest({ id: window.crypto.randomUUID(), command: "read_hanbaioh_company_device", actorId: options.actorId }, options);
      if (!validRecord(record) || record.actor_id !== options.actorId || Object.keys(record).sort().join(",") !== "actor_id,device_id,public_key_sha256,public_key_spki" ||
          !/^[0-9a-f]{64}$/.test(record.public_key_sha256) || typeof record.public_key_spki !== "string" || record.public_key_spki.length > 2048 || !record.public_key_spki.startsWith("-----BEGIN PUBLIC KEY-----") || !options.isCurrent()) throw new Error("company_device_unavailable");
      var api = window.DcatsHanbaiohCompanyApi;
      if (!api || typeof api.issue !== "function") throw new Error("company_issuer_unavailable");
      // This same-owner permit only opens a view. The native setup performs its
      // own product sign-in and obtains separate authorization for enrollment.
      var request = { request_id: window.crypto.randomUUID(), command: "enroll_hanbaioh_company_account", device_id: record.device_id };
      var capability = await issueEnrollmentTicket(api, record, request);
      if (!options.isCurrent()) throw new Error("company_session_changed");
      native = { id: request.request_id, command: "open_hanbaioh_company_backup_setup", deviceId: record.device_id, capability: capability };
      var result = await nativeRequest(native, options);
      if (!options.isCurrent() || !result || Object.keys(result).join(",") !== "status" || !["saved","cancelled","failed","outcome_unknown","expired"].includes(result.status)) throw new Error("company_backup_setup_unverified");
      return Object.freeze({ status: result.status });
    } finally { if (native) native.capability = ""; active = false; }
  }
  async function readBackupReadinessFromPc(options) {
    if (active || !options || !uuid.test(options.actorId) || typeof options.isCurrent !== "function" || !options.isCurrent()) throw new Error("company_operation_unavailable");
    active = true;
    try {
      var record = await nativeRequest({ id: window.crypto.randomUUID(), command: "read_hanbaioh_company_device", actorId: options.actorId }, options);
      if (!validRecord(record) || record.actor_id !== options.actorId || !options.isCurrent()) throw new Error("company_device_unavailable");
      var api = window.DcatsHanbaiohCompanyApi;
      if (!api || typeof api.issue !== "function") throw new Error("company_issuer_unavailable");
      // The existing enrollment scope is used only for a read of the same
      // signed binding. No enrollment or backup start is requested from Native.
      var request = { request_id: window.crypto.randomUUID(), command: "enroll_hanbaioh_company_account", device_id: record.device_id };
      var capability = await issueEnrollmentTicket(api, record, request);
      if (!options.isCurrent()) throw new Error("company_session_changed");
      var result = await nativeRequest({ id: request.request_id, command: "read_hanbaioh_company_backup_readiness", deviceId: record.device_id, capability: capability }, options);
      var unavailable = { identity: "unverified", syncFolder: "unverified", driveConfiguration: "configuration_required", driveAuthorization: "unverified", backupPassword: "registration_required", recovery: "unverified", backupAdapter: "unavailable" };
      if (!options.isCurrent() || !result || Object.keys(result).sort().join(",") !== "actorId,backupPolicy,checks,deviceId,folderId,ready,status,targetSha256" ||
          result.status !== "production_backup_prerequisites" || result.actorId !== options.actorId || result.deviceId !== record.device_id ||
          result.targetSha256 !== "975d8e446b7dd638ef46ba90dcf3baf4fa9f77c4f22ae9187fbb7913a0029a37" ||
          result.backupPolicy !== "password_protected_google_drive" || result.folderId !== "1JLtJIHpZS5SdDAusy4yc0RijxN0YwoSQ" ||
          typeof result.ready !== "boolean" || !result.checks || Array.isArray(result.checks) ||
          Object.keys(result.checks).sort().join(",") !== Object.keys(unavailable).sort().join(",")) throw new Error("company_backup_readiness_unverified");
      Object.keys(unavailable).forEach(function (name) { if (!["available", unavailable[name]].includes(result.checks[name])) throw new Error("company_backup_readiness_unverified"); });
      if (result.checks.identity !== "available" || result.ready !== Object.values(result.checks).every(function (value) { return value === "available"; })) throw new Error("company_backup_readiness_unverified");
      return result;
    } finally { active = false; }
  }
  async function enrollAccountFromPc(options) {
    if(active || !options || !uuid.test(options.actorId) || typeof options.isCurrent!=="function" || !options.isCurrent()) throw new Error("company_operation_unavailable");
    active=true;var initial,watch,capability;
    try {
      var record=await nativeRequest({id:window.crypto.randomUUID(),command:"read_hanbaioh_company_device",actorId:options.actorId},options);
      if(!validRecord(record)||record.actor_id!==options.actorId||Object.keys(record).sort().join(",")!=="actor_id,device_id,public_key_sha256,public_key_spki"||!options.isCurrent())throw new Error("company_device_unavailable");
      var api=window.DcatsHanbaiohCompanyApi;
      if(!api||typeof api.issue!=="function")throw new Error("company_operation_unavailable");
      var body={command:"enroll_hanbaioh_company_account",device_id:record.device_id,request_id:window.crypto.randomUUID()};
      capability=await issueEnrollmentTicket(api,record,body);
      if(!options.isCurrent())throw new Error("company_session_changed");
      initial={id:body.request_id,command:body.command,deviceId:body.device_id,capability:capability};
      return await new Promise(function(resolve,reject){
        var settled=false,asked=false;
        var timer=window.setTimeout(function(){finish(null);},405000);
        function finish(response,failure){
          if(settled)return;settled=true;window.clearTimeout(timer);window.clearInterval(watch);window.removeEventListener("message",onMessage);window.removeEventListener("pagehide",stop);cancel=null;
          window.postMessage({channel:channel,type:"company_enrollment_cancel",id:initial.id},window.location.origin);
          initial.capability="";capability="";
          var data=response&&response.data;
          if(response&&options.isCurrent()&&response.ok===true&&response.command===body.command&&data&&
            (data.status==="enrolled"&&typeof data.replaced==="boolean"&&Number.isSafeInteger(data.generation)&&data.generation>=1||["cancelled","expired"].includes(data.status)))resolve(data);
          else reject(new Error(failure || "company_registration_unverified"));
        }
        function stop(){finish(null);}
        async function onMessage(event){
          if(event.source!==window||event.origin!==window.location.origin)return;
          var m=event.data;
          if(!m||m.channel!==channel)return;
          if(m.type==="response"&&m.response&&m.response.id===initial.id){finish(m.response);return;}
          if(m.type!=="company_enrollment_ticket_request"||m.id!==initial.id)return;
          if(asked||!uuid.test(m.challengeId)||!options.isCurrent()){finish(null);return;}
          asked=true;
          try{
            var fresh={command:body.command,device_id:record.device_id,request_id:window.crypto.randomUUID()};
            var ticket=await issueEnrollmentTicket(api,record,fresh);
            if(settled||!options.isCurrent()){ticket="";finish(null);return;}
            window.postMessage({channel:channel,type:"company_enrollment_ticket_reply",id:initial.id,challengeId:m.challengeId,requestId:fresh.request_id,capability:ticket},window.location.origin);ticket="";
          }catch(error){finish(null,["company_authentication_required","company_not_authorized","company_binding_unavailable","company_issuer_unavailable","company_ticket_unavailable"].includes(error.message)?error.message:"company_registration_unverified");}
        }
        cancel=stop;watch=window.setInterval(function(){if(!options.isCurrent())stop();},250);
        window.addEventListener("pagehide",stop);window.addEventListener("message",onMessage);
        window.postMessage({channel:channel,type:"request",request:initial},window.location.origin);
      });
    }finally{window.clearInterval(watch);if(initial)initial.capability="";capability="";active=false;}
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
        verifiedLogins.add(key);
        return { status: "login_verified" };
      }
      var job = data && data.job;
      if (!job || job.status !== "validated_waiting_for_backup" || job.actorId !== options.record.actor_id || job.deviceId !== body.device_id || job.category !== category ||
          job.direction !== "import" || job.sourceSha256 !== body.source_sha256 || job.fileName !== body.file_name || !/^[0-9a-f]{64}$/.test(job.jobId)) throw new Error("company_result_unverified");
      return { status: "prepared", category: category, reused: data.reused === true };
    } finally { bytes && bytes.fill(0); if (request) request.capability = ""; active = false; }
  }
  function verifiedExport(data, category, requestId) {
      var artifact = data && data.artifact;
      if (!data || Object.keys(data).sort().join(",") !== "artifact,category,cleanup,direction,requestId,reused,status" ||
          data.status !== "company_export_csv_verified" || data.category !== category || data.direction !== "export" ||
          data.requestId !== requestId || typeof data.reused !== "boolean" || !["closed", "unverified"].includes(data.cleanup) ||
          !artifact || Object.keys(artifact).sort().join(",") !== "bytes,encoding,entityCount,fieldCount,fileName,headerSha256,rowCount,sha256" ||
          artifact.fileName !== category + "-" + requestId + ".csv" || artifact.encoding !== "cp932" ||
          artifact.fieldCount !== exportFields[category] || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 1 || artifact.bytes > 25 * 1024 * 1024 ||
          !Number.isSafeInteger(artifact.rowCount) || artifact.rowCount < 0 || artifact.rowCount > 100000 ||
          !Number.isSafeInteger(artifact.entityCount) || artifact.entityCount < 0 || artifact.entityCount > artifact.rowCount ||
          ![artifact.sha256, artifact.headerSha256].every(function (value) { return typeof value === "string" && /^[0-9a-f]{64}$/.test(value); }))
        throw new Error("company_result_unverified");
      return { status: "export_verified", category: category, rowCount: artifact.rowCount,
        entityCount: artifact.entityCount, sha256: artifact.sha256, cleanup: data.cleanup };
  }
  // The native host independently checks the protected session and binding.
  async function exportCsvOnce(options) {
    requireCurrent(options);
    var api = window.DcatsHanbaiohCompanyApi, category = options.category;
    var key = actorKey(options.record);
    if (active || !api || typeof api.issue !== "function" || !Object.hasOwn(exportCommands, category) ||
        !verifiedLogins.has(key)) throw new Error("company_operation_unavailable");
    if (previousExport(options.record, category)) throw new Error("company_export_already_attempted");
    active = true;
    var request;
    try {
      var body = { command: exportCommands[category], request_id: window.crypto.randomUUID(), device_id: options.record.device_id };
      var capability = issuedTicket(await api.issue(options.record, body), body);
      requireCurrent(options);
      request = { id: body.request_id, command: body.command, deviceId: body.device_id, capability: capability };
      rememberExport(options.record, category, body.request_id);
      var data = await nativeRequest(request, options);
      requireCurrent(options);
      if(data&&Object.keys(data).sort().join(",")==="attemptRecorded,code,exportMayHaveStarted,status"&&data.status==="stopped"&&data.code==="company_export_disabled"&&data.attemptRecorded===false&&data.exportMayHaveStarted===false) {
        window.sessionStorage.removeItem("dcats-company-export:"+exportKey(options.record,category));
        exportAttempts.delete(exportKey(options.record,category));
        throw new Error("company_export_disabled");
      }
      return verifiedExport(data, category, body.request_id);
    } finally { if (request) request.capability = ""; active = false; }
  }
  async function readExportResult(options) {
    requireCurrent(options);
    var category=options.category,original=previousExport(options.record,category),api=window.DcatsHanbaiohCompanyApi,request;
    if(active||!original||!api||typeof api.issue!=="function")throw new Error("company_operation_unavailable");
    active=true;
    try {
      var body={command:exportCommands[category],request_id:window.crypto.randomUUID(),device_id:options.record.device_id};
      var capability=issuedTicket(await api.issue(options.record,body),body);requireCurrent(options);
      request={id:body.request_id,command:"read_hanbaioh_company_export",deviceId:body.device_id,category:category,originalRequestId:original,capability:capability};
      var data=await nativeRequest(request,options);requireCurrent(options);
      if(data&&Object.keys(data).sort().join(",")==="attemptRecorded,code,exportMayHaveStarted,status"&&data.status==="stopped"&&typeof data.code==="string"&&typeof data.attemptRecorded==="boolean"&&typeof data.exportMayHaveStarted==="boolean")return {status:"export_pending",category:category};
      return verifiedExport(data,category,original);
    } finally { if(request)request.capability="";active=false; }
  }
  window.DcatsHanbaiohCompanyBridge = Object.freeze({
    loginOnce: function (options) { return run(options, "account"); },
    prepareCsv: function (options) { return run(options, options.category); },
    enrollAccountFromPc: enrollAccountFromPc,
    readDeviceFromPc: readDeviceFromPc,
    readBackupReadinessFromPc: readBackupReadinessFromPc,
    openBackupSetupFromPc: openBackupSetupFromPc,
    exportCsvOnce: exportCsvOnce,
    readExportResult: readExportResult,
    wasExportAttempted: function (record, category) { return !!previousExport(record, category); },
    wasLoginVerified: function (record) { return validRecord(record) && verifiedLogins.has(actorKey(record)); },
    wasLoginAttempted: function (record) { return validRecord(record) && loginAttempts.has(actorKey(record)); },
    cancelCurrent: function () { if (cancel) cancel(); }
  });
})();
