"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

function requireFragment(block, fragment, message) {
  if (!block.includes(fragment)) throw new Error(message || `Missing screen-state contract: ${fragment}`);
}

const screenManagement = sourceBetween("var screenInitialControlState", "function isScreenActive");
for (const fragment of [
  "function captureInitialScreenControlState",
  "function resetScreenControlState",
  "function resetScreenRuntimeStateForMenu",
  "function resetScreenStateForMenu",
  'id === "menu" && previousScreenId && previousScreenId !== "search"',
  "resetScreenStateForMenu(previousScreenId)",
  'screen.querySelectorAll("input, select, textarea")',
  'screen.querySelectorAll("details[open]")',
  "element.scrollTop = 0",
  'screenId === "sales-pricing-mgmt"',
  'screenId === "rakuten-price"'
]) requireFragment(screenManagement, fragment);

const showScreenSource = sourceBetween("function showScreen(id)", "captureInitialScreenControlState();");
const calls = [];
let active = "production-search";
const screens = [{ classList: { remove() {} } }];
const target = { classList: { add() {} } };
const context = {
  activeAppScreenName: () => active,
  resetScreenStateForMenu: (id) => calls.push(id),
  syncInstallAppAccess() {},
  document: {
    querySelectorAll: () => screens,
    getElementById: () => target
  },
  window: { scrollTo() {} },
  logScreenOpen() {}
};
vm.runInNewContext(`${showScreenSource}; this.showScreen = showScreen;`, context);
context.showScreen("menu");
if (calls.join(",") !== "production-search") {
  throw new Error("A normal screen must be reset when returning to the menu");
}
active = "search";
context.showScreen("menu");
if (calls.length !== 1) {
  throw new Error("Sales management must retain its screen state when returning to the menu");
}
active = "sales-order-mgmt";
context.showScreen("shipping-document-mgmt");
if (calls.length !== 1) {
  throw new Error("The order and shipping-document handoff must not be treated as a menu reset");
}

const productReturn = sourceBetween("function returnFromProductSearch()", "function shippingPrefectureLabel");
for (const fragment of ["clearAppRestoreState();", "showAuthenticatedHome();"]) requireFragment(productReturn, fragment);
if (productReturn.includes("resetProductSearchForMenu();") || productReturn.includes("returnToMenuFresh();")) {
  throw new Error("Sales management must not discard its search, selection, or detail state on menu return");
}

const openShippingDocuments = sourceBetween("async function openSalesOrderShippingDocuments", "async function issueSalesOrderDispatch");
requireFragment(openShippingDocuments, "enterShippingDocumentMgmt({ order: selectedOrder })");
const openSalesOrder = sourceBetween("async function openShippingDocumentOrderInSalesOrderMgmt", "function shippingDocumentLatestB2Export");
requireFragment(openSalesOrder, "enterSalesOrderMgmt({ order: order, detailView: \"fulfillment\" })");

console.log("screen state policy verification passed");
