const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const { parseHTML } = require("linkedom");
const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
const names = ["esc", "componentIllustrationPublicUrl", "signComponentIllustrationRows", "catalogIllustrationFailureText", "componentIllustrationPoints", "componentIllustrationPointLabel", "componentIllustrationPointTitle", "componentIllustrationPointSvg", "componentIllustrationDimensions", "renderComponentIllustrationPanelHtml", "catalogIllustrationViewBox", "setCatalogIllustrationViewBox", "zoomCatalogIllustration", "resetCatalogIllustration", "bindCatalogIllustrationInteractions", "renderComponentIllustrationSlot", "retryCatalogIllustrationLoad", "loadCatalogIllustrationsForCurrent"];
names.push("componentIllustrationViewportBounds");
names.push("catalogIllustrationNow", "clearCatalogIllustrationSignedUrlCache", "catalogIllustrationContextCurrent", "catalogIllustrationAuthContext", "invalidateCatalogIllustrationSignedUrl", "catalogIllustrationSignedUrl");
const functions = names.map(name => {
  const node = ast.body.find(n => n.type === "FunctionDeclaration" && n.id.name === name);
  assert(node, name); return source.slice(node.start, node.end);
}).join("\n");
const translations = ast.body.find(n => n.type === "VariableDeclaration" && n.declarations.some(d => d.id.name === "TRANSLATIONS"));
function sandbox(lang = "ja") {
  const { document, window } = parseHTML("<html><body><div id='component-illustration-slot'></div></body></html>");
  const logs = [];
  const ctx = vm.createContext({ document, window, console: { warn: (...args) => logs.push(args) }, currentLang: lang, kind: "catalog_spec", componentIllustrationRows: [], componentIllustrationLoading: false, componentIllustrationError: "", componentIllustrationRequestId: 0, componentIllustrationSignedUrlCache: null, componentIllustrationLastTiming: null,
    currentUser: { id: "test-actor" }, userProfile: { id: "test-actor", status: "active" }, customerPortalSearchActive: false, canSeeComponentInfo() { return true; },
    PRODUCT_IMAGE_SIGNED_URL_TTL_SECONDS: 900, selectedProductKind() { return ctx.kind; }, async resolveCurrentCoreDkdShohinId() { return 1; }, sb: {}, logs });
  vm.runInContext(source.slice(translations.start, translations.end), ctx);
  ctx.t = key => ctx.TRANSLATIONS[ctx.currentLang][key] || key;
  ctx.tf = (key, values) => ctx.t(key).replace(/\{(\w+)\}/g, (_, k) => String(values[k]));
  vm.runInContext(functions, ctx);
  ctx.sb.rpc = async () => ({ data: [] });
  ctx.sb.auth = { getSession: async () => ({ data: { session: { user: { id: ctx.currentUser && ctx.currentUser.id }, access_token: "test-token", expires_at: Math.floor(Date.now() / 1000) + 3600 } } }) };
  ctx.sb.storage = { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://example.test/private.gif" } }) }) };
  return ctx;
}
const row = { image_bucket: "product-images", image_path: "catalog/sawafuji/0355-502-0043.gif", image_width: 615, image_height: 487, model_id: "0355-502-0043", points: [{ x_px: 10, y_px: 20, component_position: "1" }] };
const text = c => c.document.body.textContent;
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let checks = 0;
async function test(name, run) { await run(); checks++; }
(async () => {
  for (const lang of ["ja", "en", "zh"]) {
    await test(lang + " empty/loading", async () => {
      const c = sandbox(lang), d = defer(); c.sb.rpc = () => d.promise;
      const pending = c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
      assert(c.document.querySelector("[aria-busy='true']")); assert(c.document.querySelector("button").disabled);
      d.resolve({ data: [] }); await pending;
      assert(text(c).includes(c.t("catalog_figure_empty"))); assert.equal(c.document.querySelectorAll("[role='alert']").length, 0);
      assert(c.document.querySelector("[data-catalog-retry]"));
    });
    for (const [error, reason] of [[{ code: "57014" }, "timeout"], [{ status: 401 }, "auth"], [{ code: "42501" }, "denied"], [{ name: "TypeError", message: "Failed to fetch token=SECRET" }, "network"]]) {
      await test(lang + " RPC " + reason, async () => {
        const c = sandbox(lang); c.sb.rpc = async () => ({ error }); await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
        assert(text(c).includes(c.t("catalog_figure_data_failed"))); assert(text(c).includes(c.t("catalog_figure_" + reason)));
        assert(!text(c).includes(c.t("catalog_figure_empty"))); assert(!JSON.stringify(c.logs).includes("SECRET"));
      });
    }
    await test(lang + " signing error is not empty", async () => {
      const c = sandbox(lang); c.sb.rpc = async () => ({ data: [row] });
      c.sb.storage.from = () => ({ createSignedUrl: async () => ({ error: { statusCode: "400", message: "Object not found" } }) });
      await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
      assert(text(c).includes(c.t("catalog_figure_image_failed"))); assert(text(c).includes(c.t("catalog_figure_unavailable")));
      assert(!text(c).includes(c.t("catalog_figure_empty")));
    });
  }
  await test("partial signing success and image error", async () => {
    const c = sandbox(); c.sb.rpc = async () => ({ data: [row, { ...row, image_path: "denied.gif" }] });
    c.sb.storage.from = () => ({ createSignedUrl: async name => name === "denied.gif" ? { error: { status: 403 } } : { data: { signedUrl: "https://example.test/private.gif" } } });
    await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
    assert.equal(c.document.querySelectorAll("image").length, 1); assert.equal(c.document.querySelectorAll("[role='alert']").length, 1);
    c.document.querySelector("image").dispatchEvent(new c.window.Event("error"));
    assert.equal(c.document.querySelectorAll("image").length, 0); assert.equal(c.document.querySelectorAll("[role='alert']").length, 2);
  });
  await test("bad response and invalid metadata", async () => {
    const c = sandbox(); c.sb.rpc = async () => ({ data: {} }); await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); assert(c.componentIllustrationError);
    c.sb.rpc = async () => ({ data: [null, {}] }); await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); assert.equal(c.document.querySelectorAll("[role='alert']").length, 2);
  });
  await test("no public URL fallback or empty URL", async () => {
    const c = sandbox(); c.sb.rpc = async () => ({ data: [row] }); c.sb.storage.from = () => ({ createSignedUrl: async () => ({ data: { publicUrl: "https://example.test/public.gif" } }) });
    await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); assert.equal(c.document.querySelectorAll("image").length, 0); assert(c.componentIllustrationRows[0].image_load_error);
  });
  await test("stale RPC never signs or overwrites", async () => {
    const c = sandbox(), d = defer(); let signed = 0; c.sb.rpc = () => d.promise; c.sb.storage.from = () => { signed++; throw Error("stale signing"); };
    const pending = c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); await c.loadCatalogIllustrationsForCurrent(2, "rebuilt"); d.resolve({ data: [row] }); await pending;
    assert.equal(signed, 0); assert.equal(c.componentIllustrationRows.length, 0);
  });
  await test("stale signing and image events never overwrite", async () => {
    const c = sandbox(), d = defer(); c.sb.rpc = async () => ({ data: [row] }); c.sb.storage.from = () => ({ createSignedUrl: () => d.promise });
    const pending = c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); await Promise.resolve(); await c.loadCatalogIllustrationsForCurrent(2, "rebuilt"); d.resolve({ data: { signedUrl: "https://example.test/old.gif" } }); await pending;
    assert.equal(c.componentIllustrationRows.length, 0);
  });
  await test("retry recovery and duplicate click", async () => {
    const c = sandbox(); c.sb.rpc = async () => ({ error: { code: "57014" } }); await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
    let calls = 0; c.sb.rpc = async () => { calls++; return { data: [row] }; };
    await Promise.all([c.retryCatalogIllustrationLoad(), c.retryCatalogIllustrationLoad()]); assert.equal(calls, 1); assert.equal(c.document.querySelectorAll("image").length, 1);
    const oldImage = c.document.querySelector("image"); c.componentIllustrationRequestId++; c.componentIllustrationRows = [];
    oldImage.dispatchEvent(new c.window.Event("error")); assert.equal(c.componentIllustrationRows.length, 0);
  });
  await test("noncatalog hidden and error escaped", async () => {
    const c = sandbox(); c.kind = "rebuilt"; assert.equal(c.renderComponentIllustrationPanelHtml(), "");
    c.kind = "catalog_spec"; c.componentIllustrationError = "<script>BAD</script>"; c.renderComponentIllustrationSlot(); assert.equal(c.document.querySelectorAll("script").length, 0);
  });
  await test("Sawafuji viewport padding preserves image pixels and edge labels", async () => {
    const c = sandbox();
    const r = { ...row, source_code: "catalog_sawafuji", image_width: 791, image_height: 486, signed_image_url: "https://example.test/private.gif", points: [{ x_px: 0, y_px: 1, component_position: "19-2" }, { x_px: 791, y_px: 486, component_position: "32" }] };
    c.componentIllustrationRows = [r];
    c.renderComponentIllustrationSlot();
    const viewport = c.document.querySelector("[data-catalog-viewport]");
    const svg = viewport.querySelector("svg"), image = svg.querySelector("image");
    assert.equal(image.getAttribute("width"), "791"); assert.equal(image.getAttribute("height"), "486");
    assert.equal(svg.querySelector("circle").getAttribute("cx"), "0");
    assert.equal(svg.querySelector("circle").getAttribute("cy"), "1");
    const originalBox = svg.getAttribute("viewBox");
    assert(Number(originalBox.split(" ")[0]) < -7);
    viewport.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 260 });
    c.zoomCatalogIllustration(viewport, 1.2);
    assert.notEqual(svg.getAttribute("viewBox"), originalBox);
    c.setCatalogIllustrationViewBox(viewport, -9999, -9999, 1, 1);
    assert.equal(Number(svg.getAttribute("viewBox").split(" ")[0]), Number(viewport.dataset.catalogX));
    c.resetCatalogIllustration(viewport); assert.equal(svg.getAttribute("viewBox"), originalBox);
    assert.equal(viewport.closest(".catalog-illustration-card").querySelector("[data-catalog-zoom-label]").textContent, "100%");
    const other = c.componentIllustrationViewportBounds({ ...r, source_code: "catalog_denso" });
    assert.deepEqual(JSON.parse(JSON.stringify(other)), { x: 0, y: 0, width: 791, height: 486 });
    const plain = c.componentIllustrationViewportBounds({ ...r, points: [] });
    assert.deepEqual(JSON.parse(JSON.stringify(plain)), { x: 0, y: 0, width: 791, height: 486 });
  });
  const revisit = async c => { c.kind = "rebuilt"; await c.loadCatalogIllustrationsForCurrent(1, c.kind); c.kind = "catalog_spec"; await c.loadCatalogIllustrationsForCurrent(1, c.kind); };
  const instrument = c => {
    const calls = { rpc: 0, signed: 0 };
    c.sb.rpc = async () => { calls.rpc++; return { data: [row] }; };
    c.sb.storage.from = () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://example.test/private-" + (++calls.signed) + ".gif" } }) });
    return calls;
  };
  await test("revisit reuses same URL but always requests current authorized metadata", async () => {
    const c = sandbox(), calls = instrument(c);
    await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
    const url = c.componentIllustrationRows[0].signed_image_url;
    for (let i = 0; i < 5; i++) await revisit(c);
    assert.equal(calls.rpc, 6); assert.equal(calls.signed, 1);
    assert.equal(c.componentIllustrationRows[0].signed_image_url, url);
    assert.equal(c.componentIllustrationLastTiming.reusedUrls, 1);
    c.sb.rpc = async () => ({ data: [{ ...row, model_id: "updated-model", points: [{ ...row.points[0], x_px: 99 }] }] });
    await revisit(c); assert.equal(c.componentIllustrationRows[0].model_id, "updated-model"); assert.equal(c.componentIllustrationRows[0].points[0].x_px, 99);
    assert.equal(calls.signed, 1);
    c.sb.rpc = async () => ({ data: [] }); await revisit(c);
    assert.equal(c.document.querySelectorAll("image").length, 0); assert(text(c).includes(c.t("catalog_figure_empty")));
  });
  await test("RPC authorization error never falls back to the cached URL", async () => {
    const c = sandbox(); instrument(c); await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
    c.sb.rpc = async () => ({ error: { code: "42501" } }); await revisit(c);
    assert(text(c).includes(c.t("catalog_figure_denied"))); assert.equal(c.document.querySelectorAll("image").length, 0);
    assert.equal(c.componentIllustrationSignedUrlCache, null);
  });
  await test("changed path always signs again", async () => {
    const c = sandbox(), calls = instrument(c); await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
    c.sb.rpc = async () => ({ data: [{ ...row, image_path: "catalog/sawafuji/replaced.gif" }] }); await revisit(c);
    assert.equal(calls.signed, 2);
  });
  await test("account, token, profile and preview changes cannot share URL cache", async () => {
    const c = sandbox(), calls = instrument(c); await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
    c.currentUser = { id: "other-actor" }; c.userProfile = { id: "other-actor", status: "active" }; await revisit(c); assert.equal(calls.signed, 2);
    c.sb.auth.getSession = async () => ({ data: { session: { user: c.currentUser, access_token: "refreshed-test-token", expires_at: Math.floor(Date.now()/1000)+3600 } } }); await revisit(c); assert.equal(calls.signed, 3);
    c.userProfile.component_permission_revision = 2; await revisit(c); assert.equal(calls.signed, 4);
    c.customerPortalSearchActive = true; await revisit(c); assert.equal(calls.signed, 5);
    assert(!JSON.stringify(c.logs).includes("test-token")); assert(!JSON.stringify(c.componentIllustrationLastTiming).includes("test-token"));
  });
  await test("missing, expired, mismatched Auth and local denied permission fail closed", async () => {
    for (const type of ["missing", "expired", "mismatch", "denied", "suspended", "error"]) {
      const c = sandbox(), calls = instrument(c);
      await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
      if (type === "missing") c.sb.auth.getSession = async () => ({ data: { session: null } });
      if (type === "expired") c.sb.auth.getSession = async () => ({ data: { session: { user: c.currentUser, access_token: "test-token", expires_at: 1 } } });
      if (type === "mismatch") c.sb.auth.getSession = async () => ({ data: { session: { user: { id: "wrong" }, access_token: "test-token", expires_at: Math.floor(Date.now()/1000)+3600 } } });
      if (type === "denied") c.canSeeComponentInfo = () => false;
      if (type === "suspended") c.userProfile.status = "suspended";
      if (type === "error") c.sb.auth.getSession = async () => ({ error: { message: "do not expose test-token" } });
      await revisit(c); assert.equal(calls.rpc, 1); assert.equal(calls.signed, 1); assert.equal(c.document.querySelectorAll("image").length, 0);
      assert.equal(c.componentIllustrationSignedUrlCache, null);
    }
  });
  await test("cache deadline is bounded and hits do not extend it", async () => {
    const c = sandbox(), calls = instrument(c); let now = Date.now(); c.Date = { now: () => now };
    await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
    const deadline = [...c.componentIllustrationSignedUrlCache.entries.values()][0].expiresAt;
    now += 299999; await revisit(c); assert.equal(calls.signed, 1);
    assert.equal([...c.componentIllustrationSignedUrlCache.entries.values()][0].expiresAt, deadline);
    now += 2; await revisit(c); assert.equal(calls.signed, 2);
  });
  await test("clock rollback and token expiry margin force fresh URLs", async () => {
    const c = sandbox(), calls = instrument(c); let now = Date.now(); c.Date = { now: () => now };
    c.sb.auth.getSession = async () => ({ data: { session: { user: c.currentUser, access_token: "test-token", expires_at: (now+90000)/1000 } } });
    await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
    assert.equal([...c.componentIllustrationSignedUrlCache.entries.values()][0].expiresAt, now+30000);
    now += 31000; await revisit(c); assert.equal(calls.signed, 2);
    now -= 32000; await revisit(c); assert.equal(calls.signed, 3);
  });
  await test("manual retry and actual image error invalidate reusable URLs", async () => {
    const c = sandbox(), calls = instrument(c); await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec");
    await c.retryCatalogIllustrationLoad(); assert.equal(calls.signed, 2);
    c.document.querySelector("image").dispatchEvent(new c.window.Event("error"));
    await revisit(c); assert.equal(calls.signed, 3);
  });
  await test("duplicate image paths share pending signing but not geometry", async () => {
    const c = sandbox(), d = defer(); let signed = 0;
    c.sb.rpc = async () => ({ data: [row, { ...row, points: [{ ...row.points[0], x_px: 123 }] }] });
    c.sb.storage.from = () => ({ createSignedUrl: () => { signed++; return d.promise; } });
    const pending = c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); await new Promise(setImmediate);
    assert.equal(signed, 1); d.resolve({ data: { signedUrl: "https://example.test/one.gif" } }); await pending;
    assert.equal(c.componentIllustrationRows.length, 2); assert.equal(c.componentIllustrationRows[1].points[0].x_px, 123);
  });
  await test("signing failures are never cached", async () => {
    const c = sandbox(); let signed = 0; c.sb.rpc = async () => ({ data: [row] });
    c.sb.storage.from = () => ({ createSignedUrl: async () => { signed++; return { error: { status: 403 } }; } });
    await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); await revisit(c);
    assert.equal(signed, 2); assert.equal(c.componentIllustrationSignedUrlCache.entries.size, 0);
  });
  await test("cache is bounded to 32 entries", async () => {
    const c = sandbox(), calls = instrument(c);
    c.sb.rpc = async () => ({ data: Array.from({ length: 40 }, (_, i) => ({ ...row, image_path: "figure-"+i+".gif" })) });
    await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); assert.equal(calls.signed, 40); assert.equal(c.componentIllustrationSignedUrlCache.entries.size, 32);
  });
  await test("logout and token events invalidate cache through actual registration", async () => {
    const registration = ast.body.find(n => n.type === "IfStatement" && source.slice(n.start,n.end).includes("sb.auth.onAuthStateChange"));
    assert(registration);
    for (const event of ["SIGNED_OUT", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "PASSWORD_RECOVERY"]) {
      const c = sandbox(), calls = instrument(c); let callback;
      c.sb.auth.onAuthStateChange = fn => { callback = fn; }; vm.runInContext(source.slice(registration.start,registration.end), c);
      await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); callback(event); assert.equal(c.componentIllustrationSignedUrlCache, null);
      if (event === "SIGNED_OUT") assert.equal(c.document.querySelectorAll("image").length, 0);
      await revisit(c); assert.equal(calls.signed, 2);
    }
  });
  await test("logout during signing cannot repopulate cache or display", async () => {
    const c = sandbox(), d = defer(); c.sb.rpc = async () => ({ data: [row] }); c.sb.storage.from = () => ({ createSignedUrl: () => d.promise });
    const pending = c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); await new Promise(setImmediate);
    c.clearCatalogIllustrationSignedUrlCache(true); c.currentUser = null; c.userProfile = null;
    d.resolve({ data: { signedUrl: "https://example.test/late.gif" } }); await pending;
    assert.equal(c.componentIllustrationSignedUrlCache, null); assert.equal(c.document.querySelectorAll("image").length, 0);
  });
  await test("late Auth response cannot discard the newer context", async () => {
    const c = sandbox(), d = defer(), session = c.sb.auth.getSession; instrument(c); c.sb.auth.getSession = () => d.promise;
    const old = c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); c.sb.auth.getSession = session;
    await c.loadCatalogIllustrationsForCurrent(2, "catalog_spec"); const context = c.componentIllustrationSignedUrlCache;
    d.resolve(await session()); await old; assert.equal(c.componentIllustrationSignedUrlCache, context); assert.equal(c.document.querySelectorAll("image").length, 1);
  });
  await test("image completion timings are after load and paint, never contain URL or token", async () => {
    const c = sandbox(), frames = []; let clock = 100; c.performance = { now: () => ++clock }; c.requestAnimationFrame = fn => frames.push(fn); instrument(c);
    await c.loadCatalogIllustrationsForCurrent(1, "catalog_spec"); assert.equal(c.componentIllustrationLastTiming.imageReadyMs, null);
    c.document.querySelector("image").dispatchEvent(new c.window.Event("load")); assert.equal(c.componentIllustrationLastTiming.imageReadyMs, null);
    frames.shift()(); assert.equal(c.componentIllustrationLastTiming.imageReadyMs, null); frames.shift()();
    assert(c.componentIllustrationLastTiming.imageReadyMs > 0); assert.equal(c.componentIllustrationLastTiming.loadedImages, 1);
    assert(!/https:|token|private-/.test(JSON.stringify(c.componentIllustrationLastTiming)));
  });
  console.log("Catalog illustration states: " + checks + " scenarios passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
