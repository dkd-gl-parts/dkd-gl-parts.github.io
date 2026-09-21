const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label} is missing: ${text}`);
}

function forbidText(source, text, label) {
  if (source.includes(text)) throw new Error(`${label} must not remain: ${text}`);
}

[
  'id="internal-user-issuance"',
  'id="btn-open-internal-user-invite"',
  'id="internal-user-invite-overlay"',
  'id="internal-user-invite-name"',
  'id="internal-user-invite-email"',
  'id="internal-user-invite-company"',
  'id="internal-user-invite-role"',
  'id="btn-internal-user-invite-submit"',
].forEach((text) => requireText(html, text, "internal account issuance UI"));

[
  'id="screen-register"',
  'id="btn-to-register"',
  'id="btn-submit-reg"',
  'id="reg-password"',
].forEach((text) => forbidText(html, text, "public signup UI"));

[
  "function openInternalUserInvite()",
  "async function inviteInternalUser()",
  "async function loadInternalUserAuthStatuses(users)",
  'sb.functions.invoke("invite-internal-user"',
  'body: { action: "status", user_ids: userIds }',
  'action: "invite"',
  'data-account-action=',
  '"resend_invitation"',
  '"send_password_reset"',
  '初回設定メールの再送を受け付けました',
  'PW再設定メールの送信を受け付けました',
  'department_code: departmentCodeForAccessRole(role ? role.value : "")',
  'document.getElementById("btn-open-internal-user-invite").addEventListener',
  'document.getElementById("btn-internal-user-invite-submit").addEventListener',
].forEach((text) => requireText(app, text, "internal account issuance behavior"));

forbidText(html, 'id="internal-user-invite-department"', "department selector");
forbidText(app, 'document.getElementById("internal-user-invite-department")', "department selector behavior");

[
  "sb.auth.signUp(",
  "function doRegister()",
  'showScreen("register")',
  'getElementById("reg-password")',
].forEach((text) => forbidText(app, text, "public signup behavior"));

const escapeFunction = app.match(/function esc\(s\) \{[\s\S]*?\r?\n\}/);
const topLevelFunctions = [...app.matchAll(/^(?:async )?function [A-Za-z0-9_]+\([^\r\n]*\) \{/gm)];
const renderUsersIndex = topLevelFunctions.findIndex((match) => match[0] === "function renderUsers(users) {");
const renderUsersSource = renderUsersIndex >= 0 && topLevelFunctions[renderUsersIndex + 1]
  ? app.slice(topLevelFunctions[renderUsersIndex].index, topLevelFunctions[renderUsersIndex + 1].index)
  : "";
const statusBadgeExpressions = renderUsersSource
  ? [...renderUsersSource.matchAll(/var sbadge\s*=\s*(.+);\r?\n/g)]
  : [];
if (!escapeFunction || !renderUsersSource || statusBadgeExpressions.length !== 1) {
  throw new Error("user status badge security contract could not be isolated");
}
forbidText(renderUsersSource, "sb.auth.resetPasswordForEmail", "internal user password-reset browser call");
const statusBadgeExpression = statusBadgeExpressions[0];

const maliciousStatus = "active'><img src=x onerror=alert(1)><span class='";
const sandbox = {
  status: maliciousStatus,
  t: (key) => key,
};
vm.createContext(sandbox);
vm.runInContext(`${escapeFunction[0]}; this.statusBadge = ${statusBadgeExpression[1]};`, sandbox);
if (sandbox.statusBadge.includes(maliciousStatus) || /<img\b/i.test(sandbox.statusBadge)) {
  throw new Error("DB-derived profile status must not inject markup into the user status badge");
}
if ((sandbox.statusBadge.match(/&lt;img/g) || []).length !== 2 || !sandbox.statusBadge.includes("&#39;")) {
  throw new Error("profile status must be escaped in both the badge class and translated label");
}

[
  ".internal-user-issuance",
  ".internal-user-invite-modal",
  ".internal-user-invite-grid",
  ".internal-user-invite-footer",
  ".status-auth-invitation-pending",
  ".status-auth-active",
  ".user-auth-state-note",
].forEach((text) => requireText(css, text, "internal account issuance styling"));

console.log("internal account issuance guard passed");

// Execute the production functions with synthetic SDK responses and DOM nodes.
const assert = require("node:assert/strict");
const acorn = require("acorn");
const names = new Set(["internalUserNeedsReview", "rememberInternalUserReviewRequired", "syncInternalUserInviteReviewState", "internalUserInviteErrorMessage", "internalUserInviteErrorCode", "inviteInternalUser", "sendInternalUserAccountEmail", "internalUserAuthStatus", "loadInternalUserAuthStatuses"]);
const functions = acorn.parse(app, { ecmaVersion: "latest" }).body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id.name))
  .map(node => app.slice(node.start, node.end)).join("\n");
assert.equal(acorn.parse(functions, { ecmaVersion: "latest" }).body.length, names.size);
function context(response, permitted = true) {
  const nodes = Object.fromEntries(["name", "email", "company", "role", "result"].map(name => ["internal-user-invite-" + name, { value: "", textContent: "" }]));
  nodes["internal-user-invite-name"].value = "招待テスト";
  nodes["internal-user-invite-email"].value = "fixture@gmail.com";
  nodes["internal-user-invite-company"].value = "daiko";
  nodes["internal-user-invite-role"].value = "sales_staff";
  nodes["btn-internal-user-invite-submit"] = { disabled: false };
  const calls = [];
  const box = { nodes, calls, userProfile: { id: "actor" }, internalUserReviewRequiredTargets: Object.create(null), internalUserInviteInFlight: false, internalUserAuthStatusMap: {},
    document: { getElementById: id => nodes[id] }, canUseUserManagement: () => permitted, canManageUser: () => permitted,
    showPermissionDenied: () => {}, departmentCodeForAccessRole: () => "product", t: x => x, setTimeout: () => {}, loadUsers: async () => {},
    sb: { functions: { invoke: async (name, args) => { calls.push(args.body); return typeof response === "function" ? response(args) : response; } } },
  };
  vm.createContext(box); vm.runInContext(functions, box); return box;
}
(async () => {
  let cases = 0;
  const review = { data: { ok: false, error: "reconciliation_required", retryable: false } };
  for (const action of ["invite", "resend_invitation", "send_password_reset"]) {
    const box = context(review), target = { id: "target", email: "fixture@gmail.com" }, button = { disabled: false }, message = {};
    const invoke = () => action === "invite" ? box.inviteInternalUser() : box.sendInternalUserAccountEmail(button, target, "target", message, action);
    await invoke(); await invoke();
    assert.equal(box.calls.length, 1, action + " must not repeat an uncertain request");
    assert(box.internalUserNeedsReview(target));
    assert.equal(action === "invite" ? box.nodes["btn-internal-user-invite-submit"].disabled : button.disabled, true);
    assert.match(action === "invite" ? box.nodes["internal-user-invite-result"].textContent : message.textContent, /再送せず管理担当者/);
    assert.equal(Object.keys(box.internalUserAuthStatusMap).length, 0, "request review must not invent account status");
    cases++;
  }
  for (const action of ["invite", "resend_invitation", "send_password_reset"]) {
    const box = context({ data: { ok: true, delivery_status: "accepted" } });
    const target = { id: "target", email: "fixture@gmail.com" }, button = { disabled: false }, message = {};
    if (action === "invite") await box.inviteInternalUser(); else await box.sendInternalUserAccountEmail(button, target, "target", message, action);
    assert.equal(box.calls.length, 1); assert(!box.internalUserNeedsReview(target)); assert.equal(button.disabled, false); cases++;
  }
  const box = context(review);
  assert.equal(box.internalUserInviteErrorMessage("future_unknown"), box.internalUserInviteErrorMessage("invite_failed")); cases++;
  await box.inviteInternalUser();
  box.nodes["internal-user-invite-email"].value = "other@gmail.com"; box.syncInternalUserInviteReviewState();
  assert.equal(box.nodes["btn-internal-user-invite-submit"].disabled, false);
  box.nodes["internal-user-invite-email"].value = " FIXTURE@GMAIL.COM "; box.syncInternalUserInviteReviewState();
  assert.equal(box.nodes["btn-internal-user-invite-submit"].disabled, true); cases++;
  box.internalUserAuthStatusMap.target = { user_id: "target", state: "active" };
  assert.equal(box.internalUserAuthStatus({ id: "target", email: "fixture@gmail.com" }).state, "active"); cases++;
  const unauthorized = context(review, false); await unauthorized.inviteInternalUser();
  await unauthorized.sendInternalUserAccountEmail({ disabled: false }, { id: "target" }, "target", {}, "send_password_reset");
  assert.equal(unauthorized.calls.length, 0); cases++;
  const wrapped = context({ error: { context: { json: async () => review.data } } }); await wrapped.inviteInternalUser();
  assert(wrapped.internalUserNeedsReview({ email: "fixture@gmail.com" })); cases++;
  const thrown = context(() => { throw new TypeError("response lost"); }); await thrown.inviteInternalUser();
  assert(thrown.internalUserNeedsReview({ email: "fixture@gmail.com" })); assert.equal(thrown.internalUserInviteInFlight, false); cases++;
  let finish; const inflight = context(() => new Promise(resolve => { finish = resolve; }));
  const first = inflight.inviteInternalUser(); inflight.syncInternalUserInviteReviewState(); await inflight.inviteInternalUser();
  assert.equal(inflight.calls.length, 1); assert.equal(inflight.nodes["btn-internal-user-invite-submit"].disabled, true);
  finish({ data: { ok: true, delivery_status: "accepted" } }); await first; cases++;
  const sdk = vm.runInNewContext(fs.readFileSync(path.join(root, "vendor/supabase-js-2.115.0.js"), "utf8") + ";supabase", {
    URL, Headers, Request, Response, AbortController, Blob, FormData, WebSocket, TextDecoder, TextEncoder,
    setTimeout, clearTimeout, setInterval, clearInterval, crypto: require("node:crypto").webcrypto, fetch, console,
  });
  const sdkClient = fetcher => sdk.createClient("https://fixture.invalid", "synthetic-key", {
    global: { fetch: fetcher }, auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  }).functions;
  const transportCases = [
    ["fetch failure", async () => { throw new TypeError("synthetic response loss"); }, "FunctionsFetchError"],
    ["relay error", async () => new Response("{}", { status: 503, headers: { "x-relay-error": "true" } }), "FunctionsRelayError"],
    ["broken error JSON", async () => new Response("{", { status: 500, headers: { "Content-Type": "application/json" } }), "FunctionsHttpError"],
    ["unknown error", async () => new Response('{"error":"future_unknown"}', { status: 500, headers: { "Content-Type": "application/json" } }), "FunctionsHttpError"],
    ["lost success body", async () => new Response("", { status: 200, headers: { "Content-Type": "application/json" } }), "SyntaxError"],
    ["ambiguous success", async () => new Response('{"ok":true}', { status: 200, headers: { "Content-Type": "application/json" } }), undefined],
  ];
  for (const action of ["invite", "resend_invitation", "send_password_reset"]) {
    for (const [label, fetcher, errorName] of transportCases) {
      const client = sdkClient(fetcher); let observedName;
      const scenario = context(async args => { const result = await client.invoke("invite-internal-user", args); observedName = result.error?.name; return result; });
      const target = { id: "target", email: "fixture@gmail.com" }, button = { disabled: false }, message = {};
      const invoke = () => action === "invite" ? scenario.inviteInternalUser() : scenario.sendInternalUserAccountEmail(button, target, "target", message, action);
      await invoke(); await invoke();
      assert.equal(observedName, errorName, label + " must exercise the real SDK error type");
      assert.equal(scenario.calls.length, 1); assert(scenario.internalUserNeedsReview(target), action + " / " + label); cases++;
    }
    for (const code of ["email_rate_limit", "forbidden", "invalid_email"]) {
      const client = sdkClient(async () => new Response(JSON.stringify({ error: code }), { status: code === "email_rate_limit" ? 429 : 403, headers: { "Content-Type": "application/json" } }));
      const scenario = context(args => client.invoke("invite-internal-user", args));
      const target = { id: "target", email: "fixture@gmail.com" }, button = { disabled: false }, message = {};
      if (action === "invite") await scenario.inviteInternalUser(); else await scenario.sendInternalUserAccountEmail(button, target, "target", message, action);
      assert(!scenario.internalUserNeedsReview(target)); assert.equal(action === "invite" ? scenario.nodes["btn-internal-user-invite-submit"].disabled : button.disabled, false); cases++;
    }
    let completeBody, bodyReading;
    const reading = new Promise(resolve => { bodyReading = resolve; });
    const client = sdkClient(async () => {
      const response = new Response("{}", { status: 409, headers: { "Content-Type": "application/json" } });
      response.json = () => { bodyReading(); return new Promise(resolve => { completeBody = resolve; }); };
      return response;
    });
    const scenario = context(args => client.invoke("invite-internal-user", args));
    const target = { id: "target", email: "fixture@gmail.com" }, button = { disabled: false }, message = {};
    const invoke = () => action === "invite" ? scenario.inviteInternalUser() : scenario.sendInternalUserAccountEmail(button, target, "target", message, action);
    const pending = invoke(); await reading;
    scenario.nodes["internal-user-invite-email"].value = "edited@gmail.com";
    target.email = "edited@gmail.com";
    scenario.syncInternalUserInviteReviewState(); await invoke();
    assert.equal(scenario.calls.length, 1, "keep lock while parsing SDK HTTP error body");
    completeBody({ error: "reconciliation_required" }); await pending;
    assert(scenario.internalUserNeedsReview({ email: "fixture@gmail.com" }), "hold the original request target");
    assert(!scenario.internalUserNeedsReview({ email: "edited@gmail.com" }), "do not hold unsent edited address"); cases++;
  }
  const statusClient = sdkClient(async () => { throw new TypeError("synthetic status transport failure"); });
  const statusOnly = context(args => statusClient.invoke("invite-internal-user", args));
  statusOnly.console = { warn: () => {} };
  await statusOnly.loadInternalUserAuthStatuses([{ id: "target" }]);
  assert.equal(Object.keys(statusOnly.internalUserReviewRequiredTargets).length, 0, "read-only status failures must not hold a send target"); cases++;
  console.log(`internal invitation safety runtime: ${cases} cases passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
