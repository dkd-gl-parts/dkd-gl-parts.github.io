const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), assert = require("node:assert/strict");
const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const start = source.indexOf("var conciergeTestOrderOpening = false;"), end = source.indexOf("window.DcatsConciergeAiApi = Object.freeze", start);
const handoff = source.slice(start, end);
assert(start > 0 && end > start);
assert(!/place_.*order|preview_.*order|\.insert\(|\.update\(|\.delete\(/.test(handoff), "Handoff must have no business writes");
const customer = { id: 167, source_customer_code: "DEV-ORDER-001", customer_name: "D-CATS開発テスト得意先", is_active: true };
function fixture(scenario = "allowed") {
  const calls = [], filters = [];
  let active = true, resolveWait;
  const context = {
    currentUser: { id: "admin" }, isSystemAdmin: () => scenario !== "nonadmin",
    customerOrderSaving: scenario === "saving", customerOrderCart: scenario === "cart" ? [{ id: "keep" }] : [],
    customerOrderFeatureStatus: {}, detailSalesCustomerOptions: [], customerPortalSearchActive: true,
    canStartInternalCustomerOrderEntry: () => scenario !== "localdenied",
    loadDetailSalesCustomerOptions: async isCurrent => { assert(isCurrent()); calls.push("options"); if (scenario === "optionstale") active = false; return scenario === "optionserror" ? [] : [{ id: 10 }]; },
    applyCustomerPortalPreviewContext: (row, value) => { calls.push("apply"); assert.equal(row.id, 167); assert.equal(value.sales_customer_id, 167); },
    loadCustomerPortalContextForCustomer: async row => { calls.push("context"); if (scenario === "latecart") context.customerOrderCart.push({ id: "new" }); if (scenario === "contextstale") active = false; return { sales_customer_id: row.id, customer: row }; },
    enterCustomerCatalog: async opts => { calls.push("open"); assert.equal(opts.query, ""); },
    sb: {
      rpc: async name => { calls.push(name); if (scenario === "waiting") await new Promise(resolve => { resolveWait = resolve; }); if (scenario === "owner") context.currentUser = { id: "other" }; if (scenario === "closed") active = false; if (scenario === "offline") throw new Error("offline"); return { data: { enabled: scenario !== "disabled", internal_management: scenario !== "override" }, error: scenario === "rpcerror" ? {} : null }; },
      from: name => {
        calls.push(name);
        const q = { select: () => q, eq: (key, value) => { filters.push([key, value]); return q; }, contains: (key, value) => { filters.push([key, value]); return q; }, maybeSingle: async () => ({
          data: name === "profiles" ? { id: "admin", role: "system_admin", role_code: scenario === "revoked" ? "company_admin" : "system_admin", status: scenario === "inactive" ? "inactive" : "active" } : scenario === "missing" ? null : { ...customer, customer_name: scenario === "renamed" ? "real customer" : customer.customer_name },
          error: scenario === "queryerror" ? {} : null,
        }) }; return q;
      }
    }
  };
  vm.createContext(context); vm.runInContext(handoff, context);
  return { context, calls, filters, options: { isCurrent: () => active }, release: () => resolveWait() };
}
(async () => {
  for (const scenario of ["allowed", "nonadmin", "saving", "cart", "localdenied", "latecart", "contextstale", "optionstale", "optionserror", "owner", "closed", "offline", "disabled", "override", "rpcerror", "revoked", "inactive", "missing", "queryerror"]) {
    const f = fixture(scenario), before = JSON.stringify(f.context.customerOrderCart);
    const result = await f.context.prepareConciergeTestOrder(f.options);
    assert.equal(!!result.data?.ok, scenario === "allowed", scenario);
    assert.equal(f.calls.includes("apply"), scenario === "allowed", scenario + " mutated context");
    assert.equal(f.calls.includes("open"), scenario === "allowed", scenario + " navigated");
    if (scenario !== "latecart") assert.equal(JSON.stringify(f.context.customerOrderCart), before, "cart changed: " + scenario);
    if (scenario === "allowed") {
      assert.equal(result.data.order_created, false);
      assert(f.filters.some(([key, value]) => key === "source_code" && value === "dcats_test"));
      assert(f.filters.some(([key, value]) => key === "source_customer_code" && value === "DEV-ORDER-001"));
      assert(f.filters.some(([key, value]) => key === "raw_payload" && value.dcats_test_customer === true));
      assert.deepEqual(f.calls, ["profiles", "get_customer_order_feature_status", "options", "sales_customers", "context", "apply", "open"]);
    }
    assert.equal(f.context.conciergeTestOrderOpening, false);
  }
  const f = fixture("waiting"), first = f.context.prepareConciergeTestOrder(f.options);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await f.context.prepareConciergeTestOrder(f.options)).error.message, "test_order_busy");
  f.release(); assert.equal((await first).data.ok, true);
  const noCaller = fixture(); assert.equal((await noCaller.context.prepareConciergeTestOrder()).error.message, "test_order_stale");
  // The actual shared selector loader must retain normal customers and reject late owner data.
  const loaderStart = source.indexOf("async function loadDetailSalesCustomerOptions(isCurrent) {"), loaderEnd = source.indexOf("\nfunction detailCustomerOptionLabel", loaderStart);
  for (const current of [true, false]) {
    const rows = [{ id: 10 }, { id: 20 }];
    const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: rows }) };
    const c = { detailSalesCustomerOptions: [], sb: { from: () => q }, console };
    vm.createContext(c); vm.runInContext(source.slice(loaderStart, loaderEnd), c);
    await c.loadDetailSalesCustomerOptions(() => current);
    assert.equal(c.detailSalesCustomerOptions.length, current ? 2 : 0);
  }
  console.log("Concierge fixed test-order handoff: server permission, stale/owner/cart/duplicate guards, no writes passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
