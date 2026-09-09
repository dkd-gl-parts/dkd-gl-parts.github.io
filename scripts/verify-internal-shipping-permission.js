const fs = require("node:fs");
const path = require("node:path");

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

assert(app.includes('["sales_editor", "出荷管理"]'), "Shipping role option is missing");
assert(app.includes('sales_editor: "price_viewer"'), "Shipping role legacy mapping must remain least-privilege");
assert(app.includes('case "sales_editor": return "受注・出荷管理、ピッキング、出荷帳票、完品出荷、在庫更新。商品マスタ・販売価格設定・ユーザー管理は不可";'), "Shipping role scope is missing");

const stock = functionSource("canEditProductKindStockMgmt", "hasBaseManufacturingCostRole");
assert(stock.includes('"sales_editor"'), "Shipping role cannot update stock");

const finishedShipping = functionSource("canManageFinishedProductShipping", "customerOrderFeatureEnabled");
assert(finishedShipping.includes('"sales_editor"'), "Shipping role cannot register finished-product shipments");

const salesOrders = functionSource("canManageSalesOrders", "canViewManagementScreen");
assert(salesOrders.includes('"sales_order.manage"') && salesOrders.includes('"sales_editor"'), "Shipping role cannot open order fulfillment");

assert(app.includes('title: "受注・出荷"'), "Order and shipping permission group is missing");
assert(app.includes('permissionKey: "sales_order.manage"'), "Sales-order permission control is missing");
assert(app.includes('permissionKey: "finished_product_shipping.manage"'), "Finished-product shipment permission control is missing");
assert(app.includes('var roleCanManageStock = permissionOverviewRoleIn(role, productionEditors.concat(["sales_editor"]));'), "Stock permission overview does not include shipping role");

const editorDefaults = app.match(/var editors = \[([^\]]+)\]/);
assert(editorDefaults && !editorDefaults[1].includes("sales_editor"), "Shipping role must not inherit product editing");

console.log("Internal shipping permission verification passed.");
