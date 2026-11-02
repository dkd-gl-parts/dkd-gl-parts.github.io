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
  vm.runInNewContext(
    functionSource("userAccessRoleCode", "userDepartmentCode") +
    functionSource("accessRoleCode", "userPermissionOverrides") + menuSource + ";renderMenu();",
    context
  );
  return {
    actions: Array.from(document.querySelectorAll(".menu-card"), card => card.dataset.action),
    openFirst() { document.querySelector(".menu-card").click(); return shippingOpened; }
  };
}
const managerMenu = menuForRole("sales_editor");
assert(managerMenu.actions[0] === "finished-product-shipping", "Shipping Manager must see picking first");
assert(managerMenu.openFirst() === 1, "First menu card must open shipping verification");
const normalMenu = menuForRole("company_admin");
assert(JSON.stringify(managerMenu.actions.slice(1)) === JSON.stringify(normalMenu.actions.filter(action => action !== "finished-product-shipping")), "Other menu items must retain their order");
for (const role of ["system_admin", "master_editor", "shipping_staff", "production_editor", "sales_viewer"]) {
  assert(JSON.stringify(menuForRole(role).actions) === JSON.stringify(normalMenu.actions), role + " menu order must remain unchanged");
}
const deniedMenu = menuForRole("sales_editor", false);
assert(!deniedMenu.actions.includes("finished-product-shipping"), "Picking must remain hidden without permission");
assert(deniedMenu.actions[0] === "search", "Missing picking permission must preserve the remaining order");

console.log("Internal shipping permission verification passed.");
