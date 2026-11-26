import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LOGIN_PLAYWRIGHT_MODULE);
const output = process.env.LOGIN_QA_OUTPUT;
const origin = "https://login-id.test";
const storageKey = "dcats.login.remembered-user-id";
const retiredPath = "/assets/temporary-device/temporary-device.html";
const index = await readFile("index.html", "utf8");
assert.doesNotMatch(index, /btn-temporary-device-access|assets\/temporary-device/);

const loginShell = index
  .replace('id="screen-boot" class="screen active app-boot"', 'id="screen-boot" class="screen app-boot"')
  .replace('<div id="screen-login" class="screen">', '<div id="screen-login" class="screen active">')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<link\b[^>]*>\s*/gi, "")
  .replace("</head>", '<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/assets/login/remember-login-id.css"></head>')
  .replace("</body>", '<script src="/legacy-i18n.js"></script><script src="/login-fixture.js"></script><script type="module" src="/assets/login/remember-login-id.mjs"></script></body>');
const oldPage = await readFile(retiredPath.slice(1), "utf8");
const fixtureScript = `window.loginAttempts = 0;
const doLogin=()=>{window.loginAttempts++; document.getElementById("login-error").textContent="ログインできませんでした";};
document.getElementById("btn-login").addEventListener("click",doLogin);
document.getElementById("login-password").addEventListener("keydown",e=>{if(e.key==="Enter")doLogin();});`;
const contentTypes = {
  css: "text/css", mjs: "text/javascript", js: "text/javascript",
  png: "image/png", svg: "image/svg+xml", jpg: "image/jpeg", webp: "image/webp",
  html: "text/html", ico: "image/x-icon", json: "application/json", webmanifest: "application/manifest+json"
};
const allowedAsset = /^\/(?:styles\.css|assets\/(?:login\/(?:login-bg-(?:desktop|mobile)-v1\.png|remember-login-id\.(?:mjs|css))|icons\/(?:dcats-mark-256\.png|eye-outline\.svg)|brand\/(?:daiko-mark\.jpg|gltek-mark\.webp)|temporary-device\/temporary-device\.css))$/;

async function setup(context) {
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/") return route.fulfill({ contentType:"text/html", body:loginShell });
    if (url.pathname === retiredPath) return route.fulfill({ contentType:"text/html", body:oldPage });
    if (url.pathname === "/login-fixture.js") return route.fulfill({ contentType:"text/javascript", body:fixtureScript });
    if (url.pathname === "/legacy-i18n.js") return route.fulfill({ contentType:"text/javascript", body:await readFile("legacy-i18n.js") });
    if (!allowedAsset.test(url.pathname)) return route.fulfill({ status:404 });
    const ext = url.pathname.split(".").at(-1);
    return route.fulfill({ contentType:contentTypes[ext], body:await readFile(url.pathname.slice(1)) });
  });
  const page=await context.newPage();
  return page;
}

async function fits(page, selector) {
  const result=await page.locator(selector).evaluateAll(nodes=>nodes.map(el=>[
    el.scrollWidth-el.clientWidth, el.scrollHeight-el.clientHeight
  ]));
  assert.ok(result.length && result.every(([x,y])=>x<=1&&y<=1),JSON.stringify(result));
}

async function testViewport(browser, viewport) {
  const context=await browser.newContext({viewport});
  try {
    const page=await setup(context);
    const errors=[];
    page.on("pageerror", error=>errors.push(error.message));
    await page.goto(origin);
    const remember=page.getByRole("checkbox",{name:"ユーザーIDを保存",exact:true});
    const id=page.locator("#login-email");
    const pw=page.locator("#login-password");
    const submit=page.getByRole("button",{name:"ログイン",exact:true});
    const values=()=>page.evaluate(key=>({saved:localStorage.getItem(key),keys:Object.keys(localStorage),attempts:window.loginAttempts}),storageKey);
    assert.equal(await remember.isChecked(),false);
    await id.fill("example@example.test");
    await pw.fill("fixture-only-password");
    await submit.click();
    assert.deepEqual(await values(),{saved:null,keys:[],attempts:1});
    await remember.check();
    await submit.click();
    assert.deepEqual(await values(),{saved:"example@example.test",keys:[storageKey],attempts:2});
    await page.reload();
    assert.equal(await id.inputValue(),"example@example.test");
    assert.equal(await pw.inputValue(),"");
    assert.equal(await remember.isChecked(),true);
    await id.fill("replacement@example.test");
    await pw.fill("fixture-only-password");
    await pw.press("Enter");
    assert.deepEqual(await values(),{saved:"replacement@example.test",keys:[storageKey],attempts:1});
    await page.reload();
    assert.equal(await id.inputValue(),"replacement@example.test");
    assert.equal(await pw.inputValue(),"");

    await fits(page,"html, #screen-login, .login-form-panel, .login-fields, .login-preferences");
    await page.screenshot({path:path.join(output,`login-${viewport.width}x${viewport.height}.png`)});
    const footer=await page.locator(".login-partners").evaluate(element=>{
      const bounds=element.getBoundingClientRect();
      return {top:bounds.top,bottom:bounds.bottom,height:document.documentElement.clientHeight};
    });
    assert.ok(footer.top>=0&&footer.bottom<=footer.height+1,`The login footer must fit on the viewport (${footer.top}-${footer.bottom} of ${footer.height})`);
    await page.evaluate(()=>{document.documentElement.lang="en";});
    await page.getByRole("checkbox",{name:"Remember user ID",exact:true}).waitFor();
    await fits(page,"html, #screen-login, .login-preferences");
    await page.evaluate(()=>{document.documentElement.lang="zh-CN";});
    await page.getByRole("checkbox",{name:"保存用户 ID",exact:true}).waitFor();
    await fits(page,"html, #screen-login, .login-preferences");

    await page.getByRole("checkbox",{name:"保存用户 ID",exact:true}).uncheck();
    assert.equal((await values()).saved,null);
    await page.reload();
    assert.equal(await remember.isChecked(),false);
    assert.equal(await id.inputValue(),"");
    assert.equal(await pw.inputValue(),"");

    await page.goto(origin+retiredPath);
    await page.getByRole("heading",{name:"専用ページの提供は終了しました"}).waitFor();
    assert.equal(await page.locator("script, input, button").count(),0);
    await fits(page,"html, .workspace");
    await page.getByRole("link",{name:"D-CATSのログイン画面へ"}).click();
    await remember.waitFor();
    assert.deepEqual(errors,[]);
    console.log(`${viewport.width}x${viewport.height}: saved ID, login error, keyboard, removal and retired page passed`);
  } finally {
    await context.close();
  }
}

async function testLogout(browser, viewport) {
  const context = await browser.newContext({ viewport, locale: "ja-JP", serviceWorkers: "block" });
  const backendHost = "jqoeqximtwfpqwzngutj.supabase.co";
  const user = {
    id: "279a117b-65c1-4f3c-90b6-cfa9a43a9515",
    email: "logout-fixture@example.test",
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: "2026-01-01T00:00:00Z"
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const session = {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`,
    refresh_token: "fixture-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user
  };
  const profile = { ...user, name: "QA fixture", role: "price_viewer", group_name: "public", status: "active", language: "ja" };
  const authActions = [];
  try {
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.hostname === backendHost) {
        const headers = {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS"
        };
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        const reply = data => route.fulfill({ headers, json: data });
        switch (url.pathname) {
          case "/auth/v1/token": authActions.push("login"); return reply(session);
          case "/auth/v1/logout": authActions.push("logout"); return route.fulfill({ status: 204, headers });
          case "/auth/v1/user": return reply(user);
          case "/rest/v1/profiles": return reply(profile);
          default: return reply([]);
        }
      }
      if (url.origin !== origin || route.request().method() !== "GET") return route.abort();
      const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const type = contentTypes[path.extname(file).slice(1)];
      if (!type || !path.resolve(file).startsWith(process.cwd() + path.sep)) return route.fulfill({ status: 404 });
      let body;
      try { body = await readFile(file); }
      catch (error) {
        if (error.code === "ENOENT" || error.code === "EISDIR") return route.fulfill({ status: 404 });
        throw error;
      }
      return route.fulfill({ contentType: type, body });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    const id = page.locator("#login-email");
    const pw = page.locator("#login-password");
    const remember = page.locator("#remember-login-id");
    const awaitInput = value => page.waitForFunction(expected => document.getElementById("login-email").value === expected, value);
    for (const shouldSave of [true, false]) {
      await id.fill(user.email);
      await remember.setChecked(shouldSave);
      await pw.fill("fixture-only-password");
      await page.locator("#btn-login").click();
      const signOut = page.locator("#btn-logout-menu");
      await signOut.waitFor({ timeout: 15000 });
      assert.equal(await id.inputValue(), "", "The real menu transition must reset the ID field");
      assert.equal(await remember.isChecked(), false);
      await signOut.click();
      await id.waitFor({ timeout: 15000 });
      await awaitInput(shouldSave ? user.email : "");
      assert.equal(await remember.isChecked(), shouldSave);
      assert.equal(await pw.inputValue(), "");
      assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), shouldSave ? user.email : null);
    }
    await fits(page, "html, #screen-login, .login-form-panel, .login-fields, .login-preferences");
    assert.deepEqual(authActions, ["login", "logout", "login", "logout"]);
    assert.deepEqual(errors, []);
    console.log(`${viewport.width}x${viewport.height}: real menu and sign-out restore the opted-in ID with fixture authentication`);
  } finally {
    await context.close();
  }
}

await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOGIN_BROWSER_PATH});
try {
  for (const viewport of [{width:1366,height:768},{width:1024,height:600},{width:320,height:568}]) {
    await testViewport(browser,viewport);
    await testLogout(browser,viewport);
  }
  const restricted=await browser.newContext();
  try {
    await restricted.addInitScript(()=>{Object.defineProperty(window,"localStorage",{get(){throw new DOMException("Unavailable","SecurityError");}});});
    const page=await setup(restricted);
    await page.goto(origin);
    assert.equal(await page.getByRole("checkbox",{name:"ユーザーIDを保存"}).isDisabled(),true);
    await page.getByRole("button",{name:"ログイン",exact:true}).click();
    assert.equal(await page.evaluate(()=>window.loginAttempts),1);
  } finally {
    await restricted.close();
  }
} finally {
  await browser.close();
}
