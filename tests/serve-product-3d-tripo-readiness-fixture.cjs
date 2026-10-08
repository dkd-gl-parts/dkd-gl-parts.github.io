// Synthetic, unauthenticated QA only. This server never calls Supabase/Tripo.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "product-3d.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const translations = require("node:vm").runInNewContext(app.slice(app.indexOf("var TRANSLATIONS = "), app.indexOf("\nvar currentLang")) + "\nTRANSLATIONS");
function section(first, next) {
  const start = source.indexOf(first);
  const end = source.indexOf(next, start);
  if (start < 0 || end <= start) throw new Error("Production QA section missing");
  return source.slice(start, end);
}
const render = section("  async function renderMediaPane(", "  async function publishModel(");
const check = section("  async function checkTripoReadiness(", "  function selectGlbForUpload(");
const script = `
var params = new URLSearchParams(location.search);
var role = params.get("role") || "system_admin";
var mode = params.get("mode") || "connected";
var sessionModelsEnabled = true, modelCacheEpoch = 0, hunyuanReadinessBusy = false;
var translations = ${JSON.stringify(translations)};
var t = key => translations.ja[key];
var mediaPaneRequest = { sales: 0, production: 0, customer: 0 };
var selectedProduct = { id: 2639 };
var el = id => document.getElementById(id);
var esc = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
var canReview3D = () => role !== "customer";
var canManage3D = () => role !== "customer";
var canManageGlb = () => role === "system_admin";
var canPublish3D = () => role === "system_admin";
var productId = product => product.id;
var kindLabel = kind => kind === "rebuilt" ? "リビルト" : "新品";
var selectedTarget = () => ({ product: selectedProduct, kind: "aftermarket_new" });
var models = params.get("registered") === "1" ? [{ id: "uploaded_00000000-0000-4000-8000-000000000001",
  model_source: "uploaded", product_kind: "aftermarket_new", model_bytes: 2000000,
  status: "published", published_model_path: "synthetic.glb" }] : [];
var fetchInternalModels = async () => models;
var fetchPublishedModels = async () => models;
var deny3D = () => { throw new Error("Unauthorized synthetic action"); };
var calls = [];
var sb = { functions: { invoke: async (name, options) => {
  calls.push({ name, ...options });
  await new Promise(resolve => setTimeout(resolve, 100));
  if (mode === "error") return { error: new Error("synthetic outage") };
  return { data: mode === "missing" ? { configured: false, connection_status: "not_configured" } : {
    configured: true, connection_status: "connected", generation_enabled: false,
    balance: mode === "empty" ? 0 : 100, has_sufficient_credits: mode !== "empty"
  } };
} } };
${render}
${check}
document.addEventListener("click", event => {
  var button = event.target.closest("[data-tripo-readiness]");
  if (button) checkTripoReadiness(button.dataset.tripoReadiness, button);
});
renderMediaPane(role === "customer" ? "customer" : "sales");
`;
const html = `<!doctype html><html lang="ja"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tripo readiness synthetic QA</title><link rel="stylesheet" href="/styles.css">
<body><main class="detail-panel"><h1>商品ID 2639 / 新品</h1>
<p>合成画面試験です。API接続・画像送信・クレジット消費はありません。</p>
<div id="sales-product-3d-list"></div><div id="production-product-3d-list"></div>
<div id="customer-product-3d-list"></div></main><script src="/fixture.js"></script></body></html>`;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  let content, type;
  if (pathname === "/") { content = html; type = "text/html"; }
  else if (pathname === "/fixture.js") { content = script; type = "text/javascript"; }
  else if (pathname === "/styles.css") { content = fs.readFileSync(path.join(root, "styles.css")); type = "text/css"; }
  else { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'" });
  res.end(content);
});
server.listen(0, "127.0.0.1", () => {
  process.stdout.write("http://127.0.0.1:" + server.address().port + "/\n");
});
