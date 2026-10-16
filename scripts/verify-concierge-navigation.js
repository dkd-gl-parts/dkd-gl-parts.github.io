"use strict";
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."), read = f => fs.readFileSync(path.join(root, f), "utf8");
const source = read("assets/concierge-pet/concierge-navigation.js"), app = read("app.js"), html = read("index.html");
const ioSource = source.replaceAll("dirtyScreens.delete(id)", "");
assert(!/innerHTML|localStorage|sessionStorage|fetch\(|window\.open|window\.location|\.insert\(|\.update\(|\.delete\(/.test(ioSource));
assert(html.indexOf("concierge-navigation.js?") < html.indexOf('src="app.js?'));
const version = /concierge-pet\.js\?v=([^"<]+)/.exec(html)[1]; assert(html.includes('concierge-navigation.js?v=' + version));
const window = {}; vm.runInNewContext(source, { window, Set, Object, Array, Error, Promise, setTimeout, clearTimeout });
function fixture(factory = window.DcatsConciergeNav.create) {
  let active = "menu", permission = true, busy = false, current = true, key = "selection-1", waiting = null;
  const actor = { id: "admin", admin: true, stamp: "verified-permissions" }, calls = [], listeners = {};
  const showSearch = () => { calls.push("open"); active = "search"; };
  const controller = factory({ document: { addEventListener: (event, fn) => { listeners[event] = fn; } },
    routes: { search: { allowed: () => permission, open: showSearch }, alias: { destination: "search", allowed: () => permission, open: showSearch } },
    activeScreen: () => active, context: () => ({ ...actor }), label: () => "販売管理", busy: () => busy, navigationContext: () => key,
    authorize: async () => { calls.push("auth"); if (waiting) await waiting.promise; }
  });
  const options = { isCurrent: () => current, contextKey: key };
  const edit = (screen, tag = "INPUT") => listeners.input({ target: { tagName: tag, closest: () => screen ? { id: "screen-" + screen } : null } });
  return { controller, actor, calls, edit, options, active: v => { active = v; }, allowed: v => { permission = v; }, busy: v => { busy = v; }, current: v => { current = v; }, key: v => { key = v; }, wait: () => { let resolve; const promise = new Promise(r => { resolve = r; }); waiting = { promise }; return resolve; } };
}
const start = app.indexOf("function conciergeNavigationProfileStamp("), end = app.indexOf("var CONCIERGE_AI_SCREEN_IDS", start), adapter = app.slice(start, end);
assert(start > 0 && end > start);
const registry = adapter.slice(adapter.indexOf("function createConciergeScreenRoutes"), adapter.indexOf("var conciergeNavigation ="));
const guards = Array.from(new Set(Array.from(registry.matchAll(/allowed: ([A-Za-z][A-Za-z0-9_]*),/g), m => m[1])));
guards.forEach(name => assert(app.includes("function " + name + "("), name + " must be an existing permission guard"));
const handlers = Array.from(new Set(Array.from(registry.matchAll(/return (enter[A-Za-z0-9_]+)\(/g), m => m[1])));
const allSource = app + read("customer-price-report.js") + read("manufacturing-ranking-report.js");
handlers.forEach(name => assert(allSource.includes("function " + name + "("), name + " must be an existing entry point"));
function adapterFixture(scenario) {
  let config, fields = ""; const calls = [];
  const profile = { id: "admin", role: "system_admin", role_code: "system_admin", status: "active", company: "", company_code: "daiko", group_name: "daiko", department_code: "all", manufacturing_cost_allowed: true, permission_overrides: {} };
  const context = { window: { DcatsConciergeNav: { create: c => { config = c; return {}; } } }, document: {}, currentUser: { id: "admin" }, userProfile: profile, currentLang: "ja", activeAppScreenName: () => "menu", isSystemAdmin: () => true, Object, Array, JSON, Error,
    sb: { auth: { getUser: async () => { calls.push("auth"); return { data: { user: scenario === "noauth" ? null : { id: scenario === "otherauth" ? "other" : "admin" } }, error: scenario === "autherror" ? {} : null }; } },
      from: name => { assert.equal(name, "profiles"); const q = { select: s => { fields = s; return q; }, eq: (key, id) => { assert.equal(key, "id"); assert.equal(id, "admin"); return q; }, maybeSingle: async () => { calls.push("profile"); const p = { ...profile }; if (scenario === "inactive") p.status = "inactive"; if (scenario === "revoked") p.role_code = "company_admin"; if (scenario === "override") p.permission_overrides = { "product_search.view": false }; if (scenario === "company") p.company_code = "external"; return { data: scenario === "missing" ? null : p, error: scenario === "profileerror" ? {} : null }; } }; return q; },
      rpc: async name => { assert.equal(name, "get_customer_order_feature_status"); calls.push("features"); return { data: { enabled: true, internal_management: scenario !== "disabled" }, error: scenario === "featureerror" ? {} : null }; }
    }
  };
  guards.forEach(name => { context[name] = () => true; }); vm.createContext(context); vm.runInContext(adapter + "\ngetConciergeNavigation();", context);
  const screens = Array.from(html.matchAll(/id="screen-([^"]+)"/g), m => m[1]).filter(id => !["boot", "login", "forgot", "reset"].includes(id));
  assert.deepEqual(Object.keys(config.routes).sort(), screens.sort());
  return { config, context, calls, fields: () => fields };
}
(async () => {
  for (const id of ["__proto__", "constructor", "https://example.invalid", "login", "search?run=delete"]) { const f = fixture(); assert.equal(f.controller.describe(id), null); assert((await f.controller.open(id, f.options)).error); assert.equal(f.calls.length, 0); }
  for (const mode of ["allowed", "role", "permission", "busy", "source-edit", "target-edit", "context", "closed", "outside-input"]) {
    const f = fixture(); assert.equal(f.controller.describe("search").label, "販売管理");
    if (mode === "role") f.actor.admin = false; if (mode === "permission") f.allowed(false); if (mode === "busy") f.busy(true);
    if (mode === "source-edit") f.edit("menu"); if (mode === "target-edit") f.edit("search", "TEXTAREA"); if (mode === "context") f.key("changed"); if (mode === "closed") f.current(false); if (mode === "outside-input") f.edit(null);
    const result = await f.controller.open("search", f.options); const success = ["allowed", "outside-input"].includes(mode);
    assert.equal(!!result.data?.ok, success, mode); assert.equal(f.calls.includes("open"), success, mode);
    if (!success) assert.equal(f.calls.length, 0, mode + " should reject before reads");
  }
  for (const change of ["edit", "target", "permission", "owner", "stamp", "context", "screen", "closed", "clear"]) {
    const f = fixture(), release = f.wait(), pending = f.controller.open("search", f.options);
    if (change === "edit") f.edit("menu"); if (change === "target") f.edit("search"); if (change === "permission") f.allowed(false); if (change === "owner") f.actor.id = "other"; if (change === "stamp") f.actor.stamp = "revoked"; if (change === "context") f.key("other"); if (change === "screen") f.active("logs"); if (change === "closed") f.current(false); if (change === "clear") f.controller.clear();
    release(); assert((await pending).error, change); assert(!f.calls.includes("open"), change);
  }
  const retry = fixture(); retry.edit("menu"); assert((await retry.controller.open("search", retry.options)).error); retry.controller.resetScreen("menu"); assert((await retry.controller.open("search", retry.options)).data.ok);
  const duplicate = fixture(), release = duplicate.wait(), first = duplicate.controller.open("search", duplicate.options); assert.equal((await duplicate.controller.open("search", duplicate.options)).error.message, "screen_open_busy"); release(); assert((await first).data.ok); assert.equal(duplicate.calls.filter(c => c === "open").length, 1);
  const alias = fixture(); assert.equal(alias.controller.describe("alias").label, "販売管理"); assert((await alias.controller.open("alias", alias.options)).data.ok); assert.equal(alias.controller.describe("alias"), null); assert((await alias.controller.open("alias", alias.options)).data.already_open); assert.equal(alias.calls.filter(c => c === "open").length, 1);
  const aliasDraft = fixture(); aliasDraft.edit("search"); assert.equal((await aliasDraft.controller.open("alias", aliasDraft.options)).error.message, "screen_open_draft"); assert.equal(aliasDraft.calls.length, 0);
  let expire, cleared = false; const timedWindow = {};
  vm.runInNewContext(source, { window: timedWindow, Set, Object, Array, Error, Promise, setTimeout: (fn, ms) => { assert.equal(ms, 10000); expire = fn; return 1; }, clearTimeout: id => { assert.equal(id, 1); cleared = true; } });
  const timed = fixture(timedWindow.DcatsConciergeNav.create), finishAuth = timed.wait(), timedOpen = timed.controller.open("search", timed.options); expire(); assert.equal((await timedOpen).error.message, "screen_open_unavailable"); assert(cleared); finishAuth(); await Promise.resolve(); assert(!timed.calls.includes("open"), "a late authorization must never navigate after timeout");
  for (const scenario of ["allowed", "noauth", "otherauth", "autherror", "inactive", "revoked", "override", "company", "missing", "profileerror", "disabled", "featureerror"]) {
    const f = adapterFixture(scenario), operation = f.config.authorize(f.config.context(), "sales-order-mgmt");
    if (scenario === "allowed") { await operation; assert.deepEqual(f.calls, ["auth", "profile", "features"]); assert(!/email|name|password/.test(f.fields().replace("group_name", ""))); }
    else await assert.rejects(operation, /screen_open_(forbidden|unavailable)/);
  }
  console.log("Concierge navigation: fixed registry, permission/Auth/profile/feature checks, draft/context/owner/expiry/duplicate guards, no writes or automatic navigation passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
