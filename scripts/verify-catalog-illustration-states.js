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
const functions = names.map(name => {
  const node = ast.body.find(n => n.type === "FunctionDeclaration" && n.id.name === name);
  assert(node, name); return source.slice(node.start, node.end);
}).join("\n");
const translations = ast.body.find(n => n.type === "VariableDeclaration" && n.declarations.some(d => d.id.name === "TRANSLATIONS"));
function sandbox(lang = "ja") {
  const { document, window } = parseHTML("<html><body><div id='component-illustration-slot'></div></body></html>");
  const logs = [];
  const ctx = vm.createContext({ document, window, console: { warn: (...args) => logs.push(args) }, currentLang: lang, kind: "catalog_spec", componentIllustrationRows: [], componentIllustrationLoading: false, componentIllustrationError: "", componentIllustrationRequestId: 0, PRODUCT_IMAGE_SIGNED_URL_TTL_SECONDS: 900, selectedProductKind() { return ctx.kind; }, async resolveCurrentCoreDkdShohinId() { return 1; }, sb: {}, logs });
  vm.runInContext(source.slice(translations.start, translations.end), ctx);
  ctx.t = key => ctx.TRANSLATIONS[ctx.currentLang][key] || key;
  ctx.tf = (key, values) => ctx.t(key).replace(/\{(\w+)\}/g, (_, k) => String(values[k]));
  vm.runInContext(functions, ctx);
  ctx.sb.rpc = async () => ({ data: [] });
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
  console.log("Catalog illustration states: " + checks + " scenarios passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
