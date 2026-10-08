// Synthetic, unauthenticated UI QA. No Supabase/Tencent connections or photos.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "product-3d.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const translations = vm.runInNewContext(app.slice(app.indexOf("var TRANSLATIONS = "), app.indexOf("\nvar currentLang")) + "\nTRANSLATIONS");
function section(first, next) {
  const start = source.indexOf(first), end = source.indexOf(next, start);
  if (start < 0 || end <= start) throw new Error("Production QA section missing");
  return source.slice(start, end);
}
const render = section("  async function renderMediaPane(", "  async function publishModel(");
const check = section("  function hunyuanDiagnosticText(", "  function sameTripoTarget(");
const script = `
var params = new URLSearchParams(location.search);
var role = params.get("role") || "system_admin", mode = params.get("mode") || "response";
var sessionModelsEnabled = true, modelCacheEpoch = 0, hunyuanReadinessBusy = false;
var mediaPaneRequest = { sales: 0, production: 0, customer: 0 };
var selectedProduct = { id: Number(params.get("product") || 2639) };
var selectedKind = params.get("kind") || "aftermarket_new";
var translations = ${JSON.stringify(translations)};
var t = key => translations[params.get("lang") || "ja"][key];
var el = id => document.getElementById(id);
var esc = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
var canReview3D = () => role !== "customer", canManage3D = () => role !== "customer";
var canManageGlb = () => role === "system_admin", canPublish3D = () => role === "system_admin";
var productId = product => product.id, kindLabel = kind => kind;
var selectedTarget = () => ({ product: selectedProduct, kind: selectedKind });
var models = [];
var fetchInternalModels = async () => models, fetchPublishedModels = async () => models;
var deny3D = () => { throw new Error("Unauthorized synthetic action"); };
var calls = [];
var sb = { functions: { invoke: async (name, options) => {
  calls.push({ name, ...options });
  await new Promise(resolve => setTimeout(resolve, mode === "loading" || mode === "stale" ? 2000 : 100));
  if (mode === "error") throw new Error("synthetic secret-error");
  if (mode === "session" || mode === "denied") return { error: { context: { status: mode === "session" ? 401 : 403 } } };
  if (mode === "stale") { modelCacheEpoch++; selectedProduct = { id: 2640 }; await renderMediaPane("sales"); }
  var status = ({ missing: "not_configured", auth: "authentication_rejected", permission: "permission_denied", timeout: "timeout" })[mode] || "provider_response_received_unverified";
  var diagnostic = mode === "permission" ? { provider_code: "UnauthorizedOperation", request_id: "ebfba3b4-2547-49f3-8f4f-38701c81a127" } : undefined;
  return { data: { status, diagnostic, configured: mode !== "missing", generation_enabled: false, authentication_verified: false } };
} } };
${render}
${check}
document.addEventListener("click", event => {
  var button = event.target.closest("[data-hunyuan-readiness]");
  if (button) checkHunyuanReadiness(button.dataset.hunyuanReadiness, button);
});
renderMediaPane(role === "customer" ? "customer" : "sales");
`;
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tencent readiness synthetic QA</title><link rel="stylesheet" href="/styles.css">
<body><main class="detail-panel"><h1>商品ID 2639 / 新品</h1>
<p>合成画面試験。実キー・認証・写真・外部接続はありません。</p>
<div id="sales-product-3d-list"></div><div id="production-product-3d-list"></div><div id="customer-product-3d-list"></div>
</main><script src="/fixture.js"></script></body></html>`;
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
server.listen(0, "127.0.0.1", () => { process.stdout.write("http://127.0.0.1:" + server.address().port + "/\n"); });
