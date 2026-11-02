const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionSource(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start + 1);
  assert(start >= 0 && end > start, `Unable to isolate ${name}`);
  return app.slice(start, end);
}

assert(app.includes('["sales_editor", "出荷管理者"]'), "Shipping manager role option is missing");
assert(app.includes('["shipping_staff", "出荷スタッフ"]'), "Shipping staff role option is missing");
assert(app.includes('["shipping", "出荷"]'), "Shipping department option is missing");
assert(app.includes('if (roleCode === "sales_editor" || roleCode === "shipping_staff") return "shipping";'), "Shipping role scope mapping is missing");
assert(!app.includes('if (roleCode === "sales_editor") return "sales";'), "Legacy sales department fallback remains active");
assert(app.includes('sales_editor: "price_viewer"'), "Shipping role legacy mapping must remain least-privilege");
assert(app.includes('shipping_staff: "price_viewer"'), "Shipping staff legacy mapping must remain least-privilege");
assert(app.includes('case "sales_editor": return "受注・出荷、ピッキング、帳票、完品出荷、在庫、出荷スタッフ管理";'), "Shipping manager scope is missing");

const stock = functionSource("canEditProductKindStockMgmt", "hasBaseManufacturingCostRole");
assert(stock.includes('"sales_editor"'), "Shipping role cannot update stock");
assert(stock.includes('"shipping_staff"'), "Shipping staff cannot update stock");

const finishedShipping = functionSource("canManageFinishedProductShipping", "customerOrderFeatureEnabled");
assert(finishedShipping.includes('"sales_editor"'), "Shipping role cannot register finished-product shipments");
assert(finishedShipping.includes('"shipping_staff"'), "Shipping staff cannot register finished-product shipments");

const salesOrders = functionSource("canManageSalesOrders", "canViewManagementScreen");
assert(salesOrders.includes('"sales_order.manage"') && salesOrders.includes('"sales_editor"'), "Shipping role cannot open order fulfillment");
assert(salesOrders.includes('"shipping_staff"'), "Shipping staff cannot open order fulfillment");

assert(app.includes('title: "受注・出荷"'), "Order and shipping permission group is missing");
assert(app.includes('permissionKey: "sales_order.manage"'), "Sales-order permission control is missing");
assert(app.includes('permissionKey: "finished_product_shipping.manage"'), "Finished-product shipment permission control is missing");
assert(app.includes('var roleCanManageStock = permissionOverviewRoleIn(role, productionEditors.concat(["sales_editor", "shipping_staff"]));'), "Stock permission overview does not include both shipping roles");

const editorDefaults = app.match(/var editors = \[([^\]]+)\]/);
assert(editorDefaults && !editorDefaults[1].includes("sales_editor"), "Shipping role must not inherit product editing");

const menuSource = functionSource("renderMenu", "customerPortalValue");
function menuForRole(roleCode, shippingAllowed = true) {
  const { document } = parseHTML('<div id="menu-grid"></div>');
  let shippingOpened = 0;
  const context = {
    document,
    userProfile: { role_code: roleCode, role: "price_viewer", group_name: "daiko" },
    syncDcatsIntegrationReadinessContext() {},
    refreshConciergeMenuBadge: async () => {},
    t: key => key,
    enterFinishedProductShipping() { shippingOpened++; }
  };
  for (const name of menuSource.match(/\bcan\w+(?=\()/g) || []) context[name] = () => true;
  context.isSystemAdmin = () => roleCode === "system_admin";
  context.canManageFinishedProductShipping = () => shippingAllowed;
  context.canPreviewCustomerPortal = () => true;
  vm.runInNewContext(
    functionSource("userAccessRoleCode", "userDepartmentCode") +
    functionSource("accessRoleCode", "userPermissionOverrides") +
    functionSource("customerPortalDefaultEnabled", "isCustomerPortalSearchMode") + menuSource + ";renderMenu();",
    context
  );
  return {
    actions: Array.from(document.querySelectorAll(".menu-card"), card => card.dataset.action),
    openFirst() { document.querySelector(".menu-card").click(); return shippingOpened; }
  };
}
const normalMenu = menuForRole("company_admin");
for (const role of ["sales_editor", "shipping_staff"]) {
  const shippingMenu = menuForRole(role);
  assert(shippingMenu.actions[0] === "finished-product-shipping", role + " must see picking first");
  assert(!shippingMenu.actions.includes("customer-portal"), role + " must not see the customer portal menu");
  assert(shippingMenu.openFirst() === 1, "First shipping menu card must open shipping verification");
  assert(JSON.stringify(shippingMenu.actions.slice(1)) === JSON.stringify(normalMenu.actions.filter(action => !["finished-product-shipping", "customer-portal"].includes(action))), "Other shipping menu items must retain their order");
  const deniedMenu = menuForRole(role, false);
  assert(!deniedMenu.actions.includes("finished-product-shipping"), "Picking must remain hidden without permission");
  assert(!deniedMenu.actions.includes("customer-portal"), "Hiding picking must not reveal the customer portal to " + role);
  assert(deniedMenu.actions[0] === "search", "Missing picking permission must preserve the remaining order");
}
for (const role of ["dept_admin", "production_editor", "sales_staff", "sales_viewer"]) {
  const productionMenu = menuForRole(role);
  assert(!productionMenu.actions.includes("customer-portal"), role + " must not see the customer portal menu");
  assert(JSON.stringify(productionMenu.actions) === JSON.stringify(normalMenu.actions.filter(action => action !== "customer-portal")), "Other production menu items must retain their order");
}
for (const role of ["system_admin", "master_editor", "business_admin"]) {
  assert(JSON.stringify(menuForRole(role).actions) === JSON.stringify(normalMenu.actions), role + " menu order must remain unchanged");
  assert(menuForRole(role).actions.includes("customer-portal"), role + " customer portal menu must remain available");
}

const overviewContext = {
  PRODUCT_3D_DEVELOPMENT_PAUSED: true,
  manufacturingCostOptionalAllowedFor: () => false
};
vm.runInNewContext(
  functionSource("customerPortalDefaultEnabled", "canShowCustomerPortalMenu") +
  functionSource("permissionOverviewState", "permissionOverviewUserContext") +
  functionSource("permissionOverviewCanOverride", "permissionOverviewStatusHtml"),
  overviewContext
);
const portalEnabledRoles = ["system_admin", "company_admin", "master_editor", "business_admin"];
for (const role of portalEnabledRoles.concat(["dept_admin", "production_editor", "sales_editor", "shipping_staff", "sales_staff", "sales_viewer"])) {
  const enabled = portalEnabledRoles.includes(role);
  assert(overviewContext.customerPortalDefaultEnabled(role) === enabled, role + " portal default is inconsistent");
  for (const company of ["daiko", "gltek"]) {
    const groups = overviewContext.permissionOverviewScreenGroups({ roleCode: role, companyCode: company, ownRole: true,
      manufacturingCostAllowed: false, canEditStates: true,
      permissionOverrides: { "product_search.view": true, "product_info.view": true, "sales_price.view": true } });
    const portal = groups[0].screens[0];
    assert(portal.items[0].effectiveAllowed === enabled, role + " portal overview must match its menu default");
    if (!enabled) assert(portal.items.every(item => !item.effectiveAllowed), "Product permissions must not enable the portal for " + role);
    const salesSearch = groups.flatMap(group => group.screens).find(screen => screen.title === "商品検索");
    assert(salesSearch.items[0].effectiveAllowed, "Portal OFF must preserve normal product search");
  }
}
const customerPortal = overviewContext.permissionOverviewScreenGroups({ roleCode: "customer_viewer", companyCode: "external",
  ownRole: true, permissionOverrides: {}, manufacturingCostAllowed: false, canEditStates: false })[0].screens[0];
assert(customerPortal.items[0].effectiveAllowed, "Customer accounts must retain their own dedicated portal");

const internalOrderContext = {
  userProfile: null,
  isExternalViewerProfile: () => false,
  isExternalViewer: () => false,
  customerOrderFeatureEnabled: () => true
};
vm.runInNewContext(
  functionSource("userAccessRoleCode", "userDepartmentCode") +
  functionSource("accessRoleCode", "isSystemAdmin") +
  functionSource("isCustomerViewerProfile", "isCustomerPortalSearchMode") +
  functionSource("canStartInternalCustomerOrderEntry", "canRegisterInternalCustomerOrder"),
  internalOrderContext
);
for (const role of portalEnabledRoles.concat(["dept_admin", "production_editor", "sales_editor", "shipping_staff", "sales_staff", "sales_viewer"])) {
  internalOrderContext.userProfile = { role_code: role, group_name: "daiko", permission_overrides: {} };
  assert(internalOrderContext.canShowCustomerPortalMenu() === portalEnabledRoles.includes(role), role + " portal menu must use the common default");
  assert(internalOrderContext.canStartInternalCustomerOrderEntry() === ["system_admin", "company_admin", "master_editor", "sales_editor", "shipping_staff"].includes(role), role + " internal order access must remain unchanged");
}

console.log("Internal shipping permission verification passed.");
