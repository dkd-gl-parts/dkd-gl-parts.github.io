"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = path.join(__dirname, ".."), source = fs.readFileSync(path.join(root, "assets/concierge-pet/concierge-images.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const version = /concierge-pet\.js\?v=([^"<]+)/.exec(html)[1];
assert(html.includes(`concierge-images.js?v=${version}`));
assert(html.indexOf("concierge-images.js?") < html.indexOf("concierge-requests.js?"));
assert(!/navigator\.clipboard|\.clipboard\.read|fetch\(|getDisplayMedia|html2canvas|captureStream|localStorage|sessionStorage/.test(source));
const state = { width: 3200, height: 1800, data: "aGVsbG8=", fail: false, revoked: 0, drawn: 0 };
const window = { setTimeout, clearTimeout, URL: { createObjectURL: () => "blob:synthetic", revokeObjectURL: () => state.revoked++ }, Image: class {
  constructor() { this.naturalWidth = state.width; this.naturalHeight = state.height; }
  set src(v) { if (v) queueMicrotask(() => state.fail ? this.onerror() : this.onload()); }
} };
const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: () => state.drawn++ }), toDataURL: () => "data:image/png;base64," + state.data };
const doc = { createElement: tag => { assert.equal(tag, "canvas"); return canvas; } };
vm.runInNewContext(source, { window, Array, Math, Promise });
const api = window.DcatsConciergeImages;
function event(files) { return { prevented: false, preventDefault() { this.prevented = true; }, clipboardData: { items: files.map(file => ({ kind: "file", type: file.type, getAsFile: () => file })) } }; }
const png = { type: "image/png", size: 100 };
(async () => {
  const text = event([]); assert.equal(api.pastedFile(text), null); assert(!text.prevented, "text paste must stay native");
  const paste = event([png]); assert.equal(api.pastedFile(paste), png); assert(paste.prevented);
  assert.throws(() => api.pastedFile(event([png, png])), /invalid_image/);
  assert.equal(await api.prepare(png, doc), state.data); assert.equal(canvas.width, 1600); assert.equal(canvas.height, 900); assert.equal(state.revoked, 1); assert.equal(state.drawn, 1);
  for (const file of [{ type: "image/svg+xml", size: 100 }, { type: "image/png", size: 10485761 }, { type: "image/png", size: 0 }]) await assert.rejects(() => api.prepare(file, doc), /invalid_image/);
  state.fail = true; await assert.rejects(() => api.prepare(png, doc), /invalid_image/); assert.equal(state.revoked, 2);
  state.fail = false; state.width = 10000; state.height = 10000; await assert.rejects(() => api.prepare(png, doc), /invalid_image/); assert.equal(state.revoked, 3);
  state.width = 100; state.height = 100; state.data = "A".repeat(2796208); await assert.rejects(() => api.prepare(png, doc), /image_large/); assert.equal(state.revoked, 4);
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const start = app.indexOf("var CONCIERGE_AI_SCREEN_IDS = Object.freeze({"), end = app.indexOf("async function sendConciergeRequest(", start);
  let calls = 0, resultBody, complete;
  const ctx = { window: {}, currentUser: { id: "synthetic-admin" }, isSystemAdmin: () => true, sb: { functions: { invoke: async (name, args) => { calls++; resultBody = args.body; assert.equal(name, "concierge-ai-assist"); return { data: { ok: true } }; } } } };
  vm.runInNewContext(app.slice(start, end), ctx);
  const question = { question: "この表示は？", language: "ja", screenId: "menu", image: "aGVsbG8=" };
  assert((await ctx.window.DcatsConciergeAiApi.ask(question)).data.ok); assert.equal(resultBody.image, question.image);
  assert((await ctx.window.DcatsConciergeAiApi.ask({ ...question, image: "https://fixture.invalid" })).error); assert.equal(calls, 1);
  ctx.sb.functions.invoke = () => new Promise(resolve => { complete = resolve; });
  const pending = ctx.window.DcatsConciergeAiApi.ask(question); ctx.currentUser = { id: "different-admin" }; complete({ data: { ok: true } });
  assert.equal((await pending).error.message, "system_admin_required");
  console.log("Concierge images: explicit paste, text paste, format/size/pixel limits, redraw, URL cleanup, version, minimal adapter and owner expiry passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
