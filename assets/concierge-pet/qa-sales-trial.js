(function () {
  "use strict";
  var channel = "dcats-hanbaioh25-bridge-v1";
  var fingerprint = "6d6c0d4d97bdd5835e6d879c5dcc8bbe85d912911b546ba109231aa3af99f0ac";
  function applies(record) { return !!record && record.public_key_sha256 === fingerprint; }
  function proof(request) {
    return new Promise(function (resolve, reject) {
      function finish(error, result) {
        window.removeEventListener("message", receive);
        clearTimeout(timer);
        if (error) reject(error); else resolve(result);
      }
      function receive(event) {
        if (event.source !== window || event.origin !== window.location.origin) return;
        var m = event.data;
        if (!m || m.channel !== channel || m.type !== "response" || m.response?.id !== request.id) return;
        var data = m.response.data;
        if (m.response.ok !== true || m.response.command !== request.command ||
            !data || data.id !== request.id || data.session !== request.session || data.action !== request.action ||
            !Number.isSafeInteger(data.issuedAt) || !/^[A-Za-z0-9_-]{512}$/.test(data.signature || "")) {
          finish(new Error("qa_device_unavailable")); return;
        }
        finish(null, data);
      }
      var timer = setTimeout(function () { finish(new Error("qa_device_timeout")); }, 12000);
      window.addEventListener("message", receive);
      window.postMessage({channel:channel,type:"request",request:request},window.location.origin);
    });
  }
  async function invoke(action, record, id) {
    var client = window.sb || window.supabaseClient;
    if (!client || !applies(record) || window.currentUser?.id !== record.actor_id) throw new Error("qa_identity_unavailable");
    var result = await client.auth.getClaims();
    var claims = result?.data?.claims;
    if (result?.error || claims?.sub !== record.actor_id || !claims.session_id) throw new Error("qa_identity_unavailable");
    var requestId=id || crypto.randomUUID();
    var ticket=await client.functions.invoke("hanbaioh-qa-sales-trial",{body:{prepare:action,id:requestId}});
    if(ticket.error || ticket.data?.session!==claims.session_id || !Number.isSafeInteger(ticket.data?.issuedAt) ||
       !/^qa1\.[A-Za-z0-9_-]{86}$/.test(ticket.data?.capability||""))throw new Error("qa_authorization_unavailable");
    var body = await proof({command:"sign_qa_sales_trial",action:action,session:claims.session_id,
      id:requestId,issuedAt:ticket.data.issuedAt,capability:ticket.data.capability,actorId:record.actor_id,deviceId:record.device_id});
    if (window.currentUser?.id !== record.actor_id) throw new Error("qa_identity_changed");
    return client.functions.invoke("hanbaioh-qa-sales-trial",{body:body});
  }
  var api = Object.freeze({
    submitPending:function(record){return invoke("enroll", record);},
    approvePending:function(record){return invoke("approve", record);},
    issueBinding:function(record){return invoke("binding", record);},
    issue:function(record,id){return invoke("login", record,id);},
    claimOnce:function(record,slip,digest){
      if (slip !== "900100" || digest !== "f59332f7cbd260c3fcfd45e37f0e0ddc008ed0570af548a69cd123703324af68") throw new Error("qa_target_mismatch");
      return invoke("claim", record);
    }
  });
  window.DcatsQaSalesTrial = Object.freeze({select:function(record,other){return applies(record)?api:other;}});
})();
