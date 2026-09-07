const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const printCss = fs.readFileSync(path.join(root, "shipment-instruction-print.css"), "utf8");
const staticBuild = fs.readFileSync(path.join(root, "scripts", "build-static-site.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionSource(name) {
  const marker = `function ${name}(`;
  const start = app.indexOf(marker);
  assert(start >= 0, `${name} is missing`);
  const brace = app.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < app.length; index += 1) {
    const char = app[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`${name} could not be parsed`);
}

assert(html.includes('id="screen-finished-product-shipping"'), "shipment screen is missing");
[
  'id="finished-shipment-dispatch-input"',
  'id="btn-finished-shipment-load-dispatch"',
  'id="btn-finished-shipment-camera-dispatch"',
  'id="finished-shipment-serial-input"',
  'id="btn-finished-shipment-camera-serial"',
  'id="finished-shipment-camera-overlay"',
  'id="finished-shipment-camera-video" autoplay muted playsinline',
  'id="finished-shipment-camera-status" aria-live="polite"',
  'id="finished-shipment-candidate-card" hidden',
  'id="finished-shipment-candidate-search"',
  'id="finished-shipment-order-context"',
  'id="finished-shipment-selection-card" hidden',
  'id="finished-shipment-order-form" hidden',
  'id="finished-shipment-shipped-on" type="date"'
].forEach((field) => assert(html.includes(field), `shipment workflow element is missing: ${field}`));
[
  'id="finished-shipment-customer"',
  'id="finished-shipment-order-number"',
  'id="finished-shipment-carrier"',
  'id="finished-shipment-tracking"'
].forEach((field) => assert(!html.includes(field), `duplicate shipment field remains: ${field}`));
assert(!html.includes('id="finished-shipment-warranty-months"'), "manual shipment warranty months must be removed");
for (const id of [
  "finished-shipment-warranty-summary",
  "btn-finished-warranty-settings",
  "finished-warranty-policy-overlay",
  "finished-warranty-policy-body",
  "finished-shipment-replacement-overlay",
  "finished-shipment-replacement-serial"
]) assert(html.includes(`id="${id}"`), `category warranty or replacement UI is missing: ${id}`);
assert(css.includes(".finished-shipment-shell"), "shipment layout styles are missing");
assert(css.includes(".finished-shipment-camera-stage"), "camera scanner preview styles are missing");
assert(/@media \(max-width: 767px\)[\s\S]*\.finished-shipment-scan-row\s*\{[^}]*grid-template-columns:\s*1fr 1fr/s.test(css), "camera scan controls must stack for narrow mobile screens");
assert(css.includes(".finished-shipment-candidates"), "manual serial candidate styles are missing");
assert(css.includes(".sales-order-dispatch-summary"), "sales-order dispatch summary styles are missing");
assert(/\.finished-shipment-table\s*\{[^}]*min-width:\s*0[^}]*table-layout:\s*fixed/s.test(css), "shipment table must fit its pane");
assert(/\.finished-shipment-table th:nth-child\(4\)\s*\{[^}]*width:\s*52px[^}]*text-align:\s*center/s.test(css), "shipment action column must remain visible");
assert(printCss.includes("@page") && printCss.includes("A4"), "shipment instruction print layout must target A4");
assert(staticBuild.includes('"shipment-instruction-print.css"'), "static build omits the shipment instruction stylesheet");

assert(app.includes('action: "finished-product-shipping"'), "shipment menu action is missing");
assert(app.includes('"finished_product_shipping.manage"'), "shipment permission key is missing");
assert((app.match(/mi_finished_shipping_title: "出荷照合・保証管理"/g) || []).length === 1, "Japanese dispatch/warranty menu title is missing");
assert((app.match(/\n    finished_shipping_title:/g) || []).length === 3, "dispatch/warranty title must be translated");

const salesDetailSource = functionSource("renderSalesOrderDetail");
assert(salesDetailSource.includes("salesOrderDispatchHtml(order)"), "sales-order detail must render dispatch controls");
assert(salesDetailSource.includes("issueSalesOrderDispatch"), "sales-order detail must bind dispatch issue");
assert(salesDetailSource.includes('printSalesOrderDocument("dispatch")'), "sales-order detail must print shipment instructions");
assert(salesDetailSource.includes('printSalesOrderDocument("core_return")'), "sales-order detail must print core-return sheets");
assert(salesDetailSource.includes("exportSalesOrderIdsB2([order.id])"), "sales-order detail must export the selected order to B2");
assert(salesDetailSource.includes("openSalesOrderSerialWarranty"), "sales-order detail must open dispatch checking");
assert(salesDetailSource.includes("送り状番号の登録だけでは在庫を減らしません"), "B2 label registration must explain that stock is unchanged");
assert(functionSource("issueSalesOrderDispatch").includes('sb.rpc("issue_sales_order_dispatch"'), "dispatch issue RPC is not called");
assert(functionSource("openSalesOrderSerialWarranty").includes("salesOrderDispatch(salesOrderDetail)"), "dispatch checking must require an issued instruction");
assert(functionSource("buildSalesOrderDocumentHtml").includes("shipment-instruction-print.css?dcats_version="), "shipment document stylesheet is not versioned");

const dispatchLoadSource = functionSource("loadFinishedShipmentDispatch");
assert(dispatchLoadSource.includes('sb.rpc("get_sales_order_dispatch"'), "shipment instruction load RPC is not called");
assert(dispatchLoadSource.includes("refreshFinishedShipmentContext(order)"), "loaded dispatch does not refresh the workspace");
const cameraLibrarySource = functionSource("loadFinishedShipmentCameraLibrary");
assert(cameraLibrarySource.includes("vendor/zxing-browser-0.2.0.min.js"), "self-hosted pinned camera scanner library is missing");
assert(cameraLibrarySource.includes('script.integrity = "sha384-HRtzk9lZgkbSgvUyQrnfC/GxiXZgwaNyD7hC9wcXlsBpDhkS80ISl73juef2FRuf"'), "camera scanner library must use the reviewed subresource integrity hash");
assert(cameraLibrarySource.includes('script.crossOrigin = "anonymous"'), "camera scanner library must use anonymous CORS for SRI");
const cameraOpenSource = functionSource("openFinishedShipmentCamera");
assert(cameraOpenSource.includes("window.isSecureContext"), "camera scanner must require a secure context");
assert(cameraOpenSource.includes("navigator.mediaDevices.getUserMedia"), "camera scanner must detect camera API availability");
assert(cameraOpenSource.includes("navigator.mediaDevices.getUserMedia(constraints)"), "camera scanner must open the camera with explicit constraints");
assert(cameraOpenSource.includes('facingMode: { ideal: "environment" }'), "camera scanner must prefer the environment camera");
assert(cameraOpenSource.includes("width: { ideal: 1920 }") && cameraOpenSource.includes("height: { ideal: 1080 }"), "camera scanner must request a high-resolution stream");
assert(cameraOpenSource.includes('target === "serial"') && cameraOpenSource.includes("new zxing.BrowserQRCodeReader"), "finished-product serial scanning must use the QR-only reader");
assert(cameraOpenSource.includes("startFinishedShipmentCameraCropScan(reader, video, target, session)"), "camera scanner must scan only the visible guide area");
const cameraCropSource = functionSource("finishedShipmentCameraCropRect");
assert(cameraCropSource.includes(".finished-shipment-camera-guide-box"), "camera crop must follow the visible guide box");
assert(cameraCropSource.includes("coverScale") && cameraCropSource.includes("video.videoWidth"), "camera crop must map the object-fit preview to source pixels");
const cropContext = {};
vm.runInNewContext(`${cameraCropSource}; this.crop = finishedShipmentCameraCropRect({
  videoWidth: 1920,
  videoHeight: 1080,
  parentElement: {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }),
    querySelector: () => ({ getBoundingClientRect: () => ({ left: 100, top: 50, width: 200, height: 200 }) })
  }
});`, cropContext);
assert(cropContext.crop.x === 600 && cropContext.crop.y === 180, "camera crop must account for the horizontally clipped object-fit preview");
assert(cropContext.crop.width === 720 && cropContext.crop.height === 720, "camera crop must map the square guide to square source pixels");
const cameraCropScanSource = functionSource("startFinishedShipmentCameraCropScan");
assert(cameraCropScanSource.includes("reader.decodeFromCanvas(canvas)"), "camera scanner must decode the cropped guide canvas");
const scanContext = {
  decoded: "",
  drawArgs: null,
  finishedShipmentCameraSession: 7,
  finishedShipmentCameraTarget: "serial",
  finishedShipmentCameraCropRect: () => ({ x: 12, y: 34, width: 320, height: 320 }),
  applyFinishedShipmentCameraResult: (value) => { scanContext.decoded = value; return true; },
  document: {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: (...args) => { scanContext.drawArgs = args; } })
    })
  },
  setTimeout: (callback) => { callback(); return 1; },
  clearTimeout: () => {},
  console
};
vm.runInNewContext(`${cameraCropScanSource}; this.controls = startFinishedShipmentCameraCropScan({
  decodeFromCanvas: () => ({ getText: () => "M2026-0000008" })
}, { readyState: 2 }, "serial", 7);`, scanContext);
assert(scanContext.decoded === "M2026-0000008", "cropped camera scan must pass the decoded serial to the existing result flow");
assert(scanContext.drawArgs.slice(1).join(",") === "12,34,320,320,0,0,320,320", "cropped camera scan must draw only the mapped guide area");
const cameraFocusSource = functionSource("improveFinishedShipmentCameraFocus");
assert(cameraFocusSource.includes('focusMode.indexOf("continuous")') && cameraFocusSource.includes("track.applyConstraints"), "camera scanner must enable continuous focus when supported");
assert(app.includes('finished_shipping_camera_serial_prompt: "完品シリアルのQRコード1個だけが正方形の枠内に入るように近づけてください。"'), "Japanese serial camera guidance must identify one QR code and the square guide");
assert(html.includes('class="finished-shipment-camera-guide-box"'), "camera overlay must expose the decoded guide area");
assert(css.includes(".serial-qr-mode .finished-shipment-camera-guide-box") && css.includes("aspect-ratio: 1"), "serial QR guide must be square");
assert(!app.includes("QRコードまたはバーコード") && !app.includes("QR code or barcode") && !app.includes("QR码或条码"), "finished-product serial guidance must not describe a one-dimensional barcode");
const cameraResultSource = functionSource("applyFinishedShipmentCameraResult");
assert(cameraResultSource.includes("/^D[0-9]{10}$/"), "camera dispatch results must be format-validated");
assert(cameraResultSource.includes("/^M[0-9]{4}-[0-9]{7}$/"), "camera serial results must be format-validated");
assert(cameraResultSource.includes("loadFinishedShipmentDispatch()"), "camera dispatch results must reuse the existing load flow");
assert(cameraResultSource.includes("addFinishedShipmentSerial()"), "camera serial results must reuse the existing serial flow");
const cameraCloseSource = functionSource("closeFinishedShipmentCamera");
assert(cameraCloseSource.includes("stopFinishedShipmentCameraStream()"), "closing the camera scanner must stop its media stream");
const candidateSource = functionSource("loadFinishedShipmentCandidates");
assert(candidateSource.includes('sb.rpc("list_sales_order_serial_candidates"'), "manual fallback candidate RPC is not called");
const assignmentSource = functionSource("assignFinishedShipmentSerial");
assert(assignmentSource.includes('sb.rpc("assign_sales_order_dispatch_serial"'), "serial assignment RPC is not called");
assert(assignmentSource.includes("target_order_item_id: orderItemId || null"), "scanner assignment must allow server-side order-line selection");
assert(!assignmentSource.includes("!orderItemId"), "scanner assignment must not require an exact client-side order-line match");

const scanSource = functionSource("addFinishedShipmentSerial");
assert(scanSource.includes('.from("finished_product_units")'), "serial scan does not look up finished units");
assert(scanSource.includes('r.data.status !== "available"'), "unavailable units are not blocked");
assert(scanSource.includes("assignFinishedShipmentSerial(null, serial, r.data)"), "scanned serial must use the server-side exact-or-compatible matcher and preserve its visual evaluation target");
assert(!scanSource.includes("finishedShipmentOrderItemForUnit"), "scanner must not reject compatible products through exact client matching");
assert(scanSource.includes("assignFinishedShipmentSerial"), "scanner input and manual selection do not share assignment logic");
assert(scanSource.includes("if (!dispatch)"), "standalone serial lookup must remain available without a dispatch");
assert(scanSource.includes("setFinishedShipmentPickingBlocked(true)"), "serial validation errors must block shipment confirmation");

const clearSource = functionSource("clearFinishedShipmentUnits");
assert(clearSource.includes('sb.rpc("release_sales_order_dispatch_serial"'), "clear action must release server-side assignments");
const saveSource = functionSource("saveFinishedProductShipment");
assert(saveSource.includes('sb.rpc("confirm_sales_order_dispatch"'), "atomic dispatch confirmation RPC is not called");
assert(saveSource.includes("target_expected_version"), "dispatch confirmation lacks optimistic concurrency");
assert(saveSource.includes("target_warranty_months: 12"), "legacy warranty argument must remain server-compatible while category policy is authoritative");
assert(!saveSource.includes("finished-shipment-warranty-months"), "shipment confirmation must not read browser-entered warranty months");
assert(saveSource.includes("finished_shipping_tracking_required"), "outbound tracking must be validated before shipment");
assert(saveSource.includes("finished_shipping_return_tracking_required"), "core-return tracking must be validated before shipment");
assert(saveSource.includes("if (finishedShipmentPickingBlocked)"), "picking errors must stop final shipment confirmation");
assert(!saveSource.includes("button.disabled = false"), "shipment completion must not blindly re-enable after an error");
assert(!saveSource.includes("ship_finished_product_units"), "legacy shipment RPC would double-decrement stock");
assert(!saveSource.includes('.from("finished_product_units").update('), "browser mutates unit lifecycle directly");
assert(!saveSource.includes('.from("core_product_variants").update('), "browser mutates stock directly");
assert(/id="btn-finished-shipment-save"[^>]*data-i18n="finished_shipping_register"[^>]*disabled/.test(html), "final shipment action must start blocked until server-backed checks pass");
assert(functionSource("renderFinishedShipmentCandidates").includes("unit.match_type === \"compatible\""), "compatible candidates need a visible badge");
assert(functionSource("finishedShipmentFlattenAssignments").includes('match_type: finishedShipmentUnitMatchesItem(serial, orderItem) ? "exact" : "compatible"'), "assigned compatible units must remain identifiable");
assert(css.includes(".finished-shipment-match-badge"), "compatible serial badge styles are missing");
assert(css.includes(".finished-warranty-policy-table"), "category warranty settings styles are missing");
assert(css.includes(".finished-shipment-item-warranty.replacement"), "replacement warranty styles are missing");
assert(functionSource("saveFinishedWarrantyPolicies").includes('sb.rpc("save_product_warranty_policies"'), "category warranty save RPC is not called");
assert(functionSource("updateFinishedShipmentReplacement").includes('sb.rpc("set_sales_order_dispatch_item_replacement"'), "replacement warranty RPC is not called");

const cancelSource = functionSource("cancelFinishedProductShipment");
assert(cancelSource.includes('sb.rpc("cancel_finished_product_shipment"'), "audited standalone cancellation RPC is not called");
assert(functionSource("renderFinishedShipmentLookup").includes("finishedShipmentWarrantyState"), "serial lookup does not show warranty state");
assert(functionSource("loadFinishedShipmentHistory").includes('.from("finished_product_shipments")'), "shipment history is not loaded");

assert(app.includes('document.getElementById("btn-finished-shipment-load-dispatch").addEventListener("click", loadFinishedShipmentDispatch)'), "dispatch load button is not bound");
assert(app.includes('document.getElementById("btn-finished-shipment-camera-dispatch").addEventListener("click"'), "dispatch camera button is not bound");
assert(app.includes('document.getElementById("btn-finished-shipment-camera-serial").addEventListener("click"'), "serial camera button is not bound");
assert(app.includes('document.getElementById("finished-shipment-camera-cancel").addEventListener("click", closeFinishedShipmentCamera)'), "camera cancel button is not bound");
assert(app.includes('document.getElementById("btn-finished-shipment-candidate-reload").addEventListener("click", loadFinishedShipmentCandidates)'), "manual candidate search is not bound");

const sandbox = { normalizeAsciiWidth(value) { return String(value); } };
vm.createContext(sandbox);
vm.runInContext(`${functionSource("normalizeFinishedShipmentSerial")}; this.normalizeSerial = normalizeFinishedShipmentSerial;`, sandbox);
assert(sandbox.normalizeSerial(" m2026-0000001 ") === "M2026-0000001", "serial normalization failed");

console.log("Dispatch instruction, manual fallback, stock, serial, and warranty UI checks passed.");
