"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const ui = fs.readFileSync(
  path.join(root, "assets/concierge-pet/concierge-requests.js"),
  "utf8",
);
const pet = fs.readFileSync(
  path.join(root, "assets/concierge-pet/concierge-pet.js"),
  "utf8",
);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(
  path.join(root, "assets/concierge-pet/concierge-pet.css"),
  "utf8",
);
new vm.Script(ui);
assert.ok(
  html.indexOf("concierge-requests.js?") < html.indexOf("concierge-pet.js?"),
);
const version = /concierge-pet\.js\?v=([^"<]+)/.exec(html)[1];
assert.ok(html.includes(`concierge-requests.js?v=${version}`));
assert.ok(css.includes(":not(.dcats-concierge-request-card)"));
assert.ok(
  pet.includes("if (requestUi) { requestUi.destroy(); requestUi = null; }"),
);
assert.ok(
  !/innerHTML|localStorage|sessionStorage|OPENAI_API_KEY|service_role|api\.openai|\.from\(/.test(
    ui,
  ),
);
assert.ok(ui.includes("window.crypto.randomUUID()"));
assert.match(ui, /current\.id\s*!==\s*body\.id/);
assert.ok(ui.includes("同じ内容のまま再送すると重複せず確認できます"));
const dictionary = {};
vm.runInNewContext(
  ui.slice(ui.indexOf("var COPY ="), ui.indexOf("function mount(")),
  dictionary,
);
for (const lang of ["en", "zh"])
  assert.deepEqual(
    Object.keys(dictionary.COPY[lang]).sort(),
    Object.keys(dictionary.COPY.ja).sort(),
  );
const screens = Array.from(html.matchAll(/id="screen-([^"]+)"/g), (m) => m[1])
  .filter((id) => !["boot", "login", "forgot", "reset"].includes(id))
  .sort();
assert.deepEqual(Object.keys(dictionary.SCREENS).sort(), screens);
const apiSource = app.slice(
  app.indexOf("async function sendConciergeRequest("),
  app.indexOf("function canUseInstallApp("),
);
(async () => {
  let calls = 0,
    allowed = true,
    resolve;
  const context = {
    currentUser: { id: "admin-1" },
    window: {},
    Error,
    isSystemAdmin: () => allowed,
    sb: {
      functions: {
        invoke: async (name, args) => {
          calls++;
          assert.equal(name, "concierge-requests");
          assert.equal(args.body.action, "list");
          return { data: { ok: true, items: [] }, error: null };
        },
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(apiSource, context);
  assert.equal(
    (await context.window.DcatsConciergeRequestApi.send({ action: "list" }))
      .data.ok,
    true,
  );
  allowed = false;
  assert.equal(
    (await context.window.DcatsConciergeRequestApi.send({ action: "list" }))
      .error.message,
    "system_admin_required",
  );
  assert.equal(calls, 1);
  allowed = true;
  context.sb.functions.invoke = () =>
    new Promise((r) => {
      resolve = r;
    });
  const pending = context.window.DcatsConciergeRequestApi.send({
    action: "list",
  });
  context.currentUser = { id: "admin-2" };
  resolve({ data: { ok: true, items: [{ title: "old user" }] }, error: null });
  assert.equal((await pending).error.message, "system_admin_required");
  context.sb.functions.invoke = async () => ({
    data: null,
    error: {
      context: {
        clone() {
          return this;
        },
        json: async () => ({ error: "version_conflict" }),
      },
    },
  });
  assert.equal(
    (await context.window.DcatsConciergeRequestApi.send({ action: "list" }))
      .error.message,
    "version_conflict",
  );
  context.currentUser = null;
  assert.equal(
    (await context.window.DcatsConciergeRequestApi.send({ action: "list" }))
      .error.message,
    "system_admin_required",
  );
  console.log(
    "Concierge requests: admin API, stale owner, server errors, translations, screen catalog, private UI and version passed.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
