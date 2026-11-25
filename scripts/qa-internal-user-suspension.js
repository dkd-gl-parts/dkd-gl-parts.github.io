const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");
const { parseHTML } = require("linkedom");
const { chromium } = require(process.env.WARRANTY_PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const { document } = parseHTML(html);
const screen = document.getElementById("screen-users");
screen.classList.add("active");
const ast = acorn.parse(app, { ecmaVersion: 2022 });
const functions = ["esc", "activeScreenId", "enterUsers", "loadUsers", "configureUsersScreenMode",
  "showSuspendedInternalUsers", "syncSuspendedInternalUserCards", "renderUserPermissionOverview", "renderUsers"];
const declarations = functions.map(name => {
  const node = ast.body.find(node => node.type === "FunctionDeclaration" && node.id.name === name);
  assert.ok(node, name);
  return app.slice(node.start, node.end);
});
const translations = ast.body.find(node => node.type === "VariableDeclaration" &&
  node.declarations.some(declaration => declaration.id.name === "TRANSLATIONS"));
const listeners = ast.body.filter(node => node.type === "ExpressionStatement" &&
  /^document\.getElementById\("(users-show-suspended|user-permission-search)"\)\.addEventListener/.test(app.slice(node.start, node.end)));
assert.equal(listeners.length, 2);
const source = [app.slice(translations.start, translations.end), ...declarations,
  ...listeners.map(node => app.slice(node.start, node.end))].join("\n");

const out = path.join(process.env.WARRANTY_QA_OUTPUT || path.join(root, "outputs"), "internal-user-suspension");
fs.mkdirSync(out, { recursive: true });

function installFixture() {
  window.currentLang = "ja";
  window.userProfile = { id: "synthetic-manager" };
  window.USER_COMPANY_OPTIONS = [["daiko", "大光電機"]];
  window.fixture = {
    writes: [], audits: [], nextResult: "ok",
    rows: [
      { id: "active", status: "active", name: "利用中", email: "active-with-long-identifier@example.test" },
      { id: "pending", status: "pending", name: "承認待ち", email: "pending@example.test" },
      { id: "suspended", status: "suspended", name: "停止済み", email: "suspended@example.test" },
      { id: "legacy", status: null, name: "既存アカウント", email: "legacy@example.test" },
      { id: "protected", status: "active", name: "保護対象", email: "protected@example.test" }
    ]
  };
  window.userManagementRows = [];
  window.userManagementLoaded = false;
  window.canUseUserManagement = () => true;
  window.isSystemAdmin = () => true;
  window.canManageUser = row => row.id !== "protected";
  window.canEditUserPermission = window.canManageUser;
  window.userCompanyCode = () => "daiko";
  window.userAccessRoleCode = () => "sales_viewer";
  window.normalizeAccessRoleForCompany = role => role;
  window.profileAccessRoleLabel = () => "営業閲覧";
  window.accessRoleScopeText = () => "商品・販売価格・価格調査履歴の閲覧";
  window.optionLabel = (options, code) => options.find(option => option[0] === code)[1];
  window.optionHtml = () => '<option value="daiko">大光電機</option>';
  window.internalAccessRoleOptionHtmlForCompany = () => '<option value="sales_viewer">営業閲覧</option>';
  window.departmentCodeForAccessRole = () => "sales";
  window.internalUserAuthStatus = () => ({ state: "setup_complete" });
  window.internalUserAuthStatusNote = () => "";
  window.internalUserAuthStatusBadge = () => '<span class="status-badge status-active">利用中</span>';
  window.internalUserNeedsReview = () => false;
  window.loadInternalUserAuthStatuses = async () => {};
  window.manufacturingCostBaseRoleByCode = () => false;
  window.manufacturingCostOptionalAllowedFor = () => false;
  window.userPermissionAllowed = (_profile, _key, fallback) => fallback;
  window.userPermissionOverrides = () => ({});
  window.permissionOverviewAllowed = value => value;
  window.permissionOverviewDenied = value => value;
  window.permissionOverviewLimited = value => value;
  window.permissionOverviewStatusHtml = value => value;
  window.norm = value => value.toLowerCase();
  window.t = key => TRANSLATIONS[currentLang][key] || key;
  window.setCspStyle = (element, property, value) => { element.style[property] = value; };
  window.showScreen = () => {};
  window.showPermissionDenied = () => { throw Error("Unexpected permission denial"); };
  window.logUserActivity = async (type, entry) => { fixture.audits.push([type, entry.target_id]); };
  window.sb = {
    from() {
      return {
        select: () => ({ order: async () => ({ data: fixture.rows.map(row => ({ ...row })) }) }),
        update(values) {
          const predicates = {};
          const addPredicate = (key, value) => {
            predicates[key] = value;
            return query;
          };
          const query = {
            eq: addPredicate,
            is: addPredicate,
            select: () => ({
              maybeSingle: async () => {
                fixture.writes.push([predicates.id, predicates.status, values.status]);
                const outcome = fixture.nextResult;
                fixture.nextResult = "ok";
                if (outcome === "error") return { error: new Error("synthetic rejection") };
                if (outcome === "throw") throw new Error("synthetic network issue");
                const row = fixture.rows.find(row => row.id === predicates.id && row.status === predicates.status);
                if (outcome === "missing" || !row) return { data: null };
                row.status = values.status;
                return { data: { id: row.id, status: row.status } };
              }
            })
          };
          return query;
        }
      };
    }
  };
}

async function verifyViewport(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>' + screen.outerHTML + '</body></html>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: "(" + installFixture.toString() + ")();\n" + source });
  await page.evaluate(() => enterUsers());
  const filter = page.getByRole("checkbox", { name: "停止中も表示" });
  const rights = page.locator("#user-permission-overview");
  const card = id => page.locator("#users-list .user-card[data-uid='" + id + "']");
  const search = page.locator("#user-permission-search");
  assert.equal(await filter.isChecked(), false);
  assert.equal(await card("suspended").isVisible(), false);
  assert.equal(await rights.getByText("suspended@example.test", { exact: false }).count(), 0);
  assert.equal(await card("pending").isVisible(), true);
  assert.equal(await card("legacy").isVisible(), true);
  assert.equal(await card("protected").getByRole("button", { name: "停止", exact: true }).count(), 0);
  assert.equal(await page.locator("#user-permission-count").textContent(), "4 / 4 件");
  await search.fill("suspended@example.test");
  assert.equal(await page.locator("#user-permission-count").textContent(), "0 / 4 件");
  const draft = card("active").locator(".user-name-input");
  await draft.fill("保存前の入力");
  await filter.focus();
  await page.keyboard.press("Space");
  assert.equal(await card("suspended").isVisible(), true);
  assert.equal(await rights.getByText("suspended@example.test", { exact: false }).count(), 1);
  assert.equal(await page.locator("#user-permission-count").textContent(), "1 / 5 件");
  assert.equal(await draft.inputValue(), "保存前の入力");
  await filter.uncheck();
  await search.clear();
  await page.screenshot({ path: path.join(out, width + "-default.png") });
  const overflows = await page.evaluate(() => [document.documentElement, ...document.querySelectorAll(
    ".users-body, .user-permission-toolbar, .user-permission-toolbar-options, #user-permission-overview, #users-list"
  )].filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.id || node.className || "html"));
  assert.deepEqual(overflows, [], "page or inner horizontal overflow");
  const filterBox = await filter.boundingBox();
  assert.ok(filterBox.x >= 0 && filterBox.x + filterBox.width <= width && filterBox.y >= 0 &&
    filterBox.y + filterBox.height <= height, "filter is reachable in the initial viewport");

  const stop = card("active").getByRole("button", { name: "停止", exact: true });
  page.once("dialog", dialog => dialog.dismiss());
  await stop.click();
  assert.deepEqual(await page.evaluate(() => fixture.writes), []);
  page.once("dialog", dialog => dialog.accept());
  await stop.click();
  await card("active").waitFor({ state: "hidden" });
  assert.equal(await rights.getByText("active-with-long-identifier@example.test", { exact: false }).count(), 0);
  assert.deepEqual(await page.evaluate(() => fixture.writes), [["active", "active", "suspended"]]);
  assert.deepEqual(await page.evaluate(() => fixture.audits), [["suspend", "active"]]);

  await filter.check();
  const reactivate = card("active").getByRole("button", { name: "有効化", exact: true });
  await reactivate.waitFor();
  await reactivate.click();
  await stop.waitFor();
  assert.deepEqual(await page.evaluate(() => fixture.audits.at(-1)), ["approve", "active"]);

  await filter.uncheck();
  for (const outcome of ["missing", "error", "throw"]) {
    await page.evaluate(async outcome => {
      await enterUsers();
      fixture.nextResult = outcome;
    }, outcome);
    page.once("dialog", dialog => dialog.accept());
    await stop.click();
    await card("active").getByRole("status").getByText("アカウント状態を確認できませんでした。", { exact: false }).waitFor();
    assert.equal(await card("active").isVisible(), true);
    assert.equal(await stop.isDisabled(), true);
    assert.equal(await page.evaluate(() => fixture.audits.length), 2);
  }

  await page.evaluate(() => enterUsers());
  page.once("dialog", dialog => dialog.accept());
  await card("pending").getByRole("button", { name: "停止", exact: true }).click();
  await card("pending").waitFor({ state: "hidden" });
  assert.deepEqual(await page.evaluate(() => fixture.writes.at(-1)), ["pending", "pending", "suspended"]);
  page.once("dialog", dialog => dialog.accept());
  await card("legacy").getByRole("button", { name: "停止", exact: true }).click();
  await card("legacy").waitFor({ state: "hidden" });
  assert.deepEqual(await page.evaluate(() => fixture.writes.at(-1)), ["legacy", null, "suspended"]);

  await page.evaluate(async () => {
    fixture.rows = fixture.rows.filter(row => row.status === "suspended");
    await enterUsers();
  });
  assert.equal(await page.locator("[data-suspended-users-empty]").isVisible(), true);
  await filter.check();
  assert.equal(await page.locator("[data-suspended-users-empty]").isVisible(), false);
  assert.equal(await card("suspended").isVisible(), true);
  await page.evaluate(() => document.querySelector(".users-body").scrollTo(0, 0));
  await page.screenshot({ path: path.join(out, width + "-suspended.png") });
  await page.evaluate(() => enterUsers());
  assert.equal(await filter.isChecked(), false);
  assert.equal(await page.evaluate(() => Boolean(TRANSLATIONS.en.users_show_suspended && TRANSLATIONS.zh.users_show_suspended)), true);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sizes = [[1366, 768], [1024, 600], [390, 780], [320, 568]];
  try {
    for (const [width, height] of sizes) {
      const page = await browser.newPage();
      const problems = [];
      page.on("pageerror", error => problems.push(error.message));
      await page.route("**/*", route => {
        problems.push("External request: " + route.request().url());
        return route.abort();
      });
      await verifyViewport(page, width, height);
      assert.deepEqual(problems, []);
      await page.close();
      console.log("Internal user suspension browser QA passed", width, height);
    }
    fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ sizes, synthetic: true, passed: true }));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
