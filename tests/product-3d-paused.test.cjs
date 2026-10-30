const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const acorn = require("acorn");
const { parseHTML } = require("linkedom");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const client = fs.readFileSync(path.join(root, "product-3d.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const nodes = acorn.parse(app, { ecmaVersion: "latest" }).body;
const functionSource = name => {
  const node = nodes.find(node => node.type === "FunctionDeclaration" && node.id.name === name);
  assert.ok(node, name);
  return app.slice(node.start, node.end);
};

test("product 3D is paused in the app and hidden before JavaScript initializes", () => {
  const flag = nodes.flatMap(node => node.type === "VariableDeclaration" ? node.declarations : [])
    .find(node => node.id.name === "PRODUCT_3D_DEVELOPMENT_PAUSED");
  assert.equal(flag.init.value, true);
  const { document } = parseHTML(html);
  assert.equal(document.documentElement.hasAttribute("data-product-3d-paused"), true);
  for (const id of ["btn-image-action-create-3d", "btn-image-action-upload-glb", "production-image-action-create-3d", "production-image-action-upload-glb"]) {
    const control = document.getElementById(id);
    assert.equal(control.hidden, true, id);
    assert.equal(control.hasAttribute("data-product-3d-control"), true, id);
  }
  const pauseRule = css.match(/html\[data-product-3d-paused\] :is\([\s\S]+?\) \{ display: none !important; \}/);
  assert.ok(pauseRule, "all paused surfaces need a stylesheet-level no-flash guard");
  for (const selector of ['[data-product-media="model"]', '[data-product-media-pane="model"]', "[data-product-3d-control]", ".product-3d-action-heading", ".product-3d-has-badge", ".product-3d-capture-overlay", ".product-3d-viewer-overlay", ".product-3d-tripo-overlay"]) {
    assert.ok(pauseRule[0].includes(selector), selector);
  }
  assert.ok(document.querySelector('[data-product-media="photos"]'), "photo controls remain present");
  assert.ok(document.getElementById("btn-image-action-upload"), "photo registration remains present");
});

for (const flag of [true, undefined]) {
  test(`paused bootstrap has no 3D side effects (flag ${flag})`, async () => {
    const context = { window: {} };
    if (flag !== undefined) context.PRODUCT_3D_DEVELOPMENT_PAUSED = flag;
    for (const key of ["document", "navigator", "sb", "MutationObserver", "Worker", "fetch"]) {
      Object.defineProperty(context, key, { get() { throw Error("Paused 3D accessed " + key); } });
    }
    vm.runInNewContext(client, context);
    const api = context.window.DcatsProduct3D;
    assert.equal(api.paused, true);
    assert.equal(Object.isFrozen(api), true);
    for (const scope of ["sales", "production", "customer"]) {
      await api.openCapture(scope);
      await api.renderMediaPane(scope);
      await api.refreshListBadges(scope);
      await api.refreshMediaAvailability(scope);
    }
    assert.equal((await api.fetchPublishedModels(2639)).length, 0);
  });
}

test("pause applies to every 3D role and explicit grant while photo permissions remain intact", () => {
  const context = {
    PRODUCT_3D_DEVELOPMENT_PAUSED: true,
    userProfile: { role_code: "system_admin" },
    isExternalViewer: () => false,
    isCustomerPortalSearchMode: () => false,
    userPermissionAllowed: () => true,
    hasAccessRole: () => true
  };
  vm.createContext(context);
  vm.runInContext(["canManageProduct3D", "canManageProduct3DGlb", "canPublishProduct3D", "canReviewProduct3D", "canManageAllImages"].map(functionSource).join("\n"), context);
  for (const role of ["system_admin", "company_admin", "dept_admin", "master_editor", "sales_staff", "production_editor", "customer_viewer", "external_viewer"]) {
    context.userProfile = { role_code: role };
    assert.equal(context.canManageProduct3D(), false, role);
    assert.equal(context.canManageProduct3DGlb(), false, role);
    assert.equal(context.canPublishProduct3D(), false, role);
    assert.equal(context.canReviewProduct3D(), false, role);
  }
  context.userProfile = { role_code: "system_admin" };
  assert.equal(context.canManageAllImages(), true);
  context.isExternalViewer = () => true;
  assert.equal(context.canManageAllImages(), false);
});

test("3D permission descriptions disappear without changing saved overrides or other permission rows", () => {
  const context = { PRODUCT_3D_DEVELOPMENT_PAUSED: true, manufacturingCostOptionalAllowedFor: () => false };
  vm.createContext(context);
  vm.runInContext(["permissionOverviewState", "permissionOverviewAllowed", "permissionOverviewLimited", "permissionOverviewOptional", "permissionOverviewDenied", "permissionOverviewRoleIn", "permissionOverviewCanOverride", "applyPermissionOverviewOverride", "permissionOverviewScreenGroups"].map(functionSource).join("\n"), context);
  for (const role of ["system_admin", "company_admin", "production_editor", "sales_staff", "customer_viewer", "external_viewer"]) {
    const overrides = { "product_3d.manage": true, "product_3d.publish": true, "image.manage": true };
    const before = JSON.stringify(overrides);
    const groups = context.permissionOverviewScreenGroups({ roleCode: role, companyCode: "daiko", ownRole: true, canEditStates: true, permissionOverrides: overrides });
    assert.ok(groups.length > 0);
    assert.equal(JSON.stringify(groups).includes("product_3d"), false, role);
    assert.equal(JSON.stringify(groups).includes("商品3D"), false, role);
    assert.ok(groups.some(group => group.screens.some(screen => screen.items.some(item => item.permissionKey === "image.manage"))));
    assert.equal(JSON.stringify(overrides), before, "hidden grants remain unchanged");
  }
});
