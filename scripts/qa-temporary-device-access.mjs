import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.DEVICE_PLAYWRIGHT_MODULE);
const origin = "https://temporary-device.test";
const assets = "/assets/temporary-device/";
const fixtureId = "10000000-0000-4000-8000-000000000021";
const grantId = "10000000-0000-4000-8000-000000000022";
const invitation = "a".repeat(64);
const primaryFeatures = ["part_label", "shipping", "core_return"];
const expiry = "2027-11-19T03:00:00.000Z";
const output = process.env.DEVICE_QA_OUTPUT;
const mainHtml = await readFile("index.html", "utf8");
assert.doesNotMatch(mainHtml, /temporary-device\.html|限定業務を開く/);
const operatorUrl = new URL(assets + "temporary-device.html", origin).href;
const loginShell = mainHtml
  .replace('id="screen-boot" class="screen active app-boot"', 'id="screen-boot" class="screen app-boot"')
  .replace('<div id="screen-login" class="screen">', '<div id="screen-login" class="screen active">')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<link\b[^>]*>\s*/gi, "")
  .replace("</head>", '<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/assets/temporary-device/temporary-device-admin.css"></head>');
const adminShell = `<!doctype html><html lang="ja"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="${assets}temporary-device-admin.css">
<div id="user-permission-edit-overlay"><button id="btn-temporary-device-access" hidden>期限付き利用</button></div>
<dialog id="temporary-device-access-dialog" class="temporary-device-dialog" aria-label="期限付き利用">
<header><h2>期限付き利用</h2><button id="btn-temporary-device-access-close">閉じる</button></header>
<section id="temporary-device-admin-content"></section></dialog>
<script src="/admin-fixture.js"></script><script type="module" src="${assets}integration.mjs"></script>`;

const fixtureScript = `window.SUPABASE_URL=location.origin;
window.SUPABASE_KEY="fixture"; window.sb={auth:{getSession:async()=>({data:{session:{access_token:"fixture"}}})}};
window.isSystemAdmin=()=>true;
window.currentPermissionEditUser=()=>({id:"${fixtureId}",email:"fixture@example.test"});
window.addEventListener("DOMContentLoaded",()=>document.querySelector("#user-permission-edit-overlay").classList.add("show"));`;

async function verifyBrowser(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const admin = await context.newPage();
  const errors = [];
  admin.on("pageerror", error => errors.push(error.message));
  const writes = [];
  let adminReads = 0;
  let requested = false;
  let issued = false;
  let active = null;

  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/functions/v1/temporary-device-access") {
      const headers = {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "authorization, apikey, content-type",
      };
      if (request.method() === "OPTIONS") { await route.fulfill({ status: 204, headers }); return; }
      const body = request.postDataJSON();
      let payload;
      switch (body.action) {
        case "admin_state":
          adminReads++;
          if (body.subjectId === fixtureId) payload = {
            existingGrant: active, pendingRequests: requested && !active ? [grantId] : [],
            printers: [{ code: "FIXTURE", name: "検証用プリンター" }]
          };
          break;
        case "prepare_enrollment":
          issued = body.subjectId === fixtureId;
          if (issued) { writes.push(body.action); payload = { enrollmentToken: invitation }; }
          break;
        case "request_device":
          if (issued && !requested && body.enrollmentToken === invitation) {
            requested = true; writes.push(body.action); payload = { grantId, pairingCode: "DE1A42" };
          }
          break;
        case "approve_device":
          if (requested && body.subjectId === fixtureId && body.grantId === grantId && body.pairingCode === "DE1A42") {
            writes.push(body.action); active = { grantId, features: body.features, expiresAt: expiry }; payload = { expiresAt: expiry };
          }
          break;
        case "set_label_printer":
          if (active) { writes.push(body.action); active.printer = body.printer; payload = { configured: true }; }
          break;
        case "revoke_device":
          if (active) { writes.push(body.action); active = null; payload = { revoked: true }; }
          break;
        case "challenge":
          if (active && body.grantId === grantId) payload = { challenge: "A".repeat(43) };
          break;
        case "perform":
          if (active && body.operation === "device_access_state") payload = { result: active };
          if (active && body.operation === "list_picking_orders") payload = { result: { dispatches: [] } };
          break;
      }
      await route.fulfill({ status: payload ? 200 : 403, headers, json: payload || {} });
      return;
    }
    if (url.origin !== origin) { await route.abort(); return; }
    if (url.pathname === "/login") {
      await route.fulfill({ contentType: "text/html; charset=utf-8", body: loginShell }); return;
    }
    if (url.pathname === "/styles.css") {
      await route.fulfill({ contentType: "text/css; charset=utf-8", body: await readFile("styles.css") }); return;
    }
    if (/^\/assets\/(?:login\/login-bg-(?:desktop|mobile)-v1\.png|icons\/(?:dcats-mark-256\.png|eye-outline\.svg))$/.test(url.pathname)) {
      const type = url.pathname.endsWith(".svg") ? "image/svg+xml" : "image/png";
      await route.fulfill({ contentType: type, body: await readFile(process.cwd() + url.pathname) }); return;
    }
    const partnerLogoType = {
      "/assets/brand/daiko-mark.jpg": "image/jpeg",
      "/assets/brand/gltek-mark.webp": "image/webp"
    }[url.pathname];
    if (partnerLogoType) {
      await route.fulfill({ contentType: partnerLogoType, body: await readFile(process.cwd() + url.pathname) }); return;
    }
    if (url.pathname === "/admin") { await route.fulfill({ contentType: "text/html; charset=utf-8", body: adminShell }); return; }
    if (url.pathname === "/ordinary") {
      const body = adminShell.replace("/admin-fixture.js", "/ordinary-fixture.js");
      await route.fulfill({ contentType: "text/html; charset=utf-8", body }); return;
    }
    if (url.pathname === "/ordinary-fixture.js") {
      const body = fixtureScript.replace("window.isSystemAdmin=()=>true", "window.isSystemAdmin=()=>false");
      await route.fulfill({ contentType: "text/javascript; charset=utf-8", body }); return;
    }
    if (url.pathname === "/admin-fixture.js") { await route.fulfill({ contentType: "text/javascript; charset=utf-8", body: fixtureScript }); return; }
    if (!url.pathname.startsWith(assets) || !/^[a-z.-]+$/.test(url.pathname.slice(assets.length))) { await route.fulfill({ status: 404 }); return; }
    const mediaType = url.pathname.endsWith(".html") ? "text/html" : url.pathname.endsWith(".css") ? "text/css" : "text/javascript";
    const body = await readFile(process.cwd() + url.pathname);
    await route.fulfill({ contentType: mediaType + "; charset=utf-8", body });
  });

  const button = (page, name) => page.getByRole("button", { name, exact: true });
  const visible = locator => locator.waitFor({ state: "visible" });
  const noOverflow = async (page, selector) => {
    const result = await page.locator(selector).evaluateAll(nodes => nodes.map(el => [
      el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight,
    ]));
    assert.ok(result.length && result.every(([x,y]) => x <= 1 && y <= 1), JSON.stringify({ viewport, selector, result }));
  };
  try {
    const login = await context.newPage();
    login.on("pageerror", error => errors.push(error.message));
    await login.goto(origin + "/login");
    await visible(button(login, "ログイン"));
    await visible(button(login, "パスワードをお忘れの方"));
    assert.equal(await login.locator('a[href*="temporary-device.html"]').count(), 0);
    assert.equal(await login.getByText("限定業務を開く", { exact: true }).count(), 0);
    await noOverflow(login, "html, #screen-login, .login-form-panel, .login-fields");
    await login.screenshot({ path: path.join(output, `login-${viewport.width}x${viewport.height}.png`) });

    await login.goto(origin + "/ordinary");
    await login.locator("#user-permission-edit-overlay.show").waitFor({ state: "attached" });
    assert.equal(await button(login, "期限付き利用").isVisible(), false);
    assert.equal(await login.getByRole("link", { name: "利用者用ページを開く" }).count(), 0);

    await login.goto(operatorUrl);
    await button(login, "利用を開始").click();
    await visible(login.getByText("管理者から新しい利用者用リンクを受け取ってください。", { exact: true }));
    assert.equal(await login.locator('input[type="email"],input[type="password"]').count(), 0);
    for (const title of ["品番シール", "ピッキング・出荷確定", "コア返却管理"]) {
      assert.equal(await button(login, title).count(), 0);
    }
    assert.equal(adminReads, 0);
    assert.deepEqual(writes, []);
    await noOverflow(login, "html, .workspace, #panel");
    await login.close();

    await admin.goto(origin + "/admin");
    await button(admin, "期限付き利用").click();
    assert.equal(await admin.getByRole("link", { name: "利用者用ページを開く" }).count(), 0);
    assert.equal(await button(admin, "1年間の利用を承認").isEnabled(), false);
    await button(admin, "利用者用リンクを発行").click();
    const invite = await admin.getByRole("link", { name: "利用者用ページを開く", exact: true }).getAttribute("href");
    const invitationUrl = new URL(invite);
    assert.equal(invitationUrl.hash, "#enroll=" + invitation);
    invitationUrl.hash = "";
    assert.equal(invitationUrl.href, operatorUrl);
    const operator = await context.newPage();
    operator.on("pageerror", error => errors.push(error.message));
    await operator.goto(invite);
    await button(operator, "利用を開始").click();
    await visible(operator.getByRole("heading", { name: "管理者の承認を待っています" }));
    assert.equal(new URL(operator.url()).hash, "");
    await visible(operator.getByText("申請番号 435456", { exact: true }));
    await visible(operator.getByText("確認コード 1455-5714", { exact: true }));
    assert.equal(await operator.getByText(grantId, { exact: true }).count(), 0);
    const selectedRequest = admin.getByRole("combobox", { name: "申請番号" });
    await selectedRequest.locator('option[value="' + grantId + '"]').waitFor({ state: "attached" });
    assert.equal(await selectedRequest.locator("option:checked").textContent(), "435456");
    const confirmation = admin.getByRole("textbox", { name: "確認コード" });
    assert.equal(await confirmation.inputValue(), "");
    await confirmation.fill("0000-0001");
    await button(admin, "1年間の利用を承認").click();
    await button(admin, "承認する").click();
    await visible(admin.getByText("申請番号、確認コードまたは利用期限を確認してください。"));
    assert.deepEqual(writes, ["prepare_enrollment", "request_device"]);
    await confirmation.fill("1455-5714");
    await admin.getByRole("combobox", { name: "品番シールの印刷先" }).selectOption("FIXTURE");
    await button(admin, "1年間の利用を承認").click();
    await visible(admin.getByRole("dialog", { name: "端末利用の承認" }));
    await noOverflow(admin, "html, dialog[open]");
    await admin.screenshot({ path: path.join(output, `admin-${viewport.width}x${viewport.height}.png`) });
    await button(admin, "キャンセル").click();
    assert.deepEqual(writes, ["prepare_enrollment", "request_device"]);
    await button(admin, "1年間の利用を承認").click();
    await Promise.all([
      admin.waitForResponse(response => response.request().postData()?.includes('"set_label_printer"'), { timeout: 5000 }),
      button(admin, "承認する").click(),
    ]);
    await visible(admin.getByText("承認しました。利用期限", { exact: false }));
    assert.equal(active.printer, "FIXTURE");
    assert.deepEqual(active.features, primaryFeatures);
    await button(operator, "承認状況を確認").click();
    for (const title of ["品番シール", "ピッキング・出荷確定", "コア返却管理"]) await visible(button(operator, title));
    for (const title of ["受注受付", "B2 CSV"]) assert.equal(await button(operator, title).count(), 0);
    await noOverflow(operator, "html, .workspace, #panel");
    await operator.screenshot({ path: path.join(output, `operator-${viewport.width}x${viewport.height}.png`) });
    await visible(operator.getByText("このページをブックマークして、次回も同じブラウザで開いてください。", { exact: true }));
    const returningUrl = await admin.getByRole("link", { name: "利用者用ページを開く" }).getAttribute("href");
    assert.equal(returningUrl, operatorUrl);
    await operator.goto(returningUrl);
    await button(operator, "利用を開始").click();
    await visible(button(operator, "品番シール"));
    await button(admin, "利用を取り消す").click();
    await button(admin, "キャンセル").click();
    assert.ok(active);
    await button(admin, "利用を取り消す").click();
    await button(admin, "取り消す").click();
    await visible(admin.getByText("端末の利用許可を取り消しました。"));
    assert.equal(active, null);
    assert.equal(await admin.getByRole("link", { name: "利用者用ページを開く" }).count(), 0);
    await operator.goto(returningUrl);
    await button(operator, "利用を開始").click();
    await visible(operator.getByRole("heading", { name: "管理者の承認を待っています" }));
    for (const title of ["品番シール", "ピッキング・出荷確定", "コア返却管理"]) {
      assert.equal(await button(operator, title).count(), 0);
    }
    await noOverflow(operator, "html, .workspace, #panel");
    assert.deepEqual(writes, ["prepare_enrollment", "request_device", "approve_device", "set_label_printer", "revoke_device"]);
    assert.deepEqual(errors, []);
    console.log(`${viewport.width}x${viewport.height}: hidden ordinary login, admin-only invitation, approved bookmark and revocation passed`);
  } finally {
    await context.close();
  }
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.DEVICE_BROWSER_PATH });
try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 600 }, { width: 320, height: 568 }]) {
    await verifyBrowser(browser, viewport);
  }
} finally {
  await browser.close();
}
