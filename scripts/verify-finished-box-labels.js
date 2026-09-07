const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const printCss = fs.readFileSync(path.join(root, "box-label-print.css"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
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
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`${name} could not be parsed`);
}

assert(html.includes('id="btn-finished-box-label-preview"'), "80x60 box-label print action is missing");
assert(html.includes('id="finished-box-label-layout-preview"'), "80x60 live layout preview is missing");
assert(html.includes('data-i18n="finished_box_label_preview" disabled>印刷</button>'), "80x60 print button label is not concise");
assert(!html.includes("80×60箱シール印刷"), "box-label action still exposes the dimension as its name");
assert(html.includes('id="finished-box-label-barcode-value"'), "part-number barcode payload preview is missing");
assert(html.includes('id="finished-box-label-qr-value"'), "serial QR payload preview is missing");
assert(html.includes('data-finished-label-box-only'), "box label does not have a dedicated print workspace");
assert(html.includes('id="finished-label-search-hint"'), "box-label search cannot expose a mode-specific hint");
assert(html.includes('data-i18n="finished_box_label_layout_sample"'), "box-label preview guidance still describes pre-issue sample serials");
assert(html.includes('<script src="vendor/jsbarcode-3.12.3.all.min.js" integrity="sha384-vmcSy8TM1KhZWBIKMKTR8AxbrJQCuConAolGY+42odu9ZGIzw8L8xAT/u7ul4X2U" crossorigin="anonymous"></script>'), "self-hosted JsBarcode dependency must use the reviewed exact version and SRI");
assert(html.indexOf("vendor/jsbarcode-3.12.3.all.min.js") < html.indexOf('src="app.js'), "JsBarcode must load before app.js");
assert(!app.includes("quickchart.io") && !app.includes("bwip-js.metafloor.com"), "label generation depends on an external barcode image service");
assert(/@page\s*{[^}]*size:\s*80mm\s+60mm/i.test(printCss), "print page is not fixed at 80x60mm");
assert(/\.box-product-label\s*{[^}]*width:\s*80mm;[^}]*height:\s*60mm;/i.test(printCss), "box label dimensions are not exact");
assert(styles.includes("width: 480px; height: 360px;"), "live box-label preview does not preserve the 4:3 ratio");
assert(styles.includes(".finished-label-history-main > span:first-child") && styles.includes("white-space: nowrap"), "box-label issue IDs can wrap when print status is displayed");
assert(functionSource("finishedProductPartBarcodeDataUrl").includes('format: "CODE128"'), "GLTEK part-number barcode is not Code 128");
assert(functionSource("finishedBoxLabelProductNo").indexOf("unit.gltek_part_number") < functionSource("finishedBoxLabelProductNo").indexOf("unit.product_no"), "box-label product number does not prefer the G part number");
assert(functionSource("renderFinishedBoxLabelLayoutPreview").includes("buildFinishedBoxLabelMarkup"), "live box-label preview is not connected to production markup");
assert(functionSource("previewCurrentFinishedBoxLabel").includes("printFinishedBoxLabelIssue"), "current box-label print action is not routed through the audited print flow");
assert(functionSource("openFinishedBoxLabelPrintPreview").includes("buildFinishedBoxLabelPrintHtml"), "box-label print preview is not connected");
assert(app.includes("data-finished-box-label-history-select"), "box-label history selection action is missing");
assert(!app.includes("data-finished-box-label-history-preview"), "box-label history still prints immediately instead of selecting a preview target");
const boxSearchSource = functionSource("searchFinishedLabelProducts");
assert(boxSearchSource.includes('finishedLabelPrintMode === "box"') && boxSearchSource.includes("fetchFinishedBoxLabelProducts()"), "blank box-label search does not use issued finished products");
assert(boxSearchSource.includes("loadFinishedBoxLabelProductReadiness"), "box-label search does not rank products by issued serial availability");
const recentBoxProductsSource = functionSource("fetchFinishedBoxLabelProducts");
assert(recentBoxProductsSource.includes('.from("finished_label_issues")') && recentBoxProductsSource.includes('.order("issued_at", { ascending: false })'), "box-label default products are not sourced from recent issue history");
assert(recentBoxProductsSource.includes('.from("core_products")'), "box-label recent issue products are not refreshed from the product master");
const boxSelectionSource = functionSource("selectFinishedBoxLabelHistory");
assert(boxSelectionSource.includes("finishedLabelRecordFromHistory(row)") && boxSelectionSource.includes("updateFinishedLabelQrPayload()"), "box-label history selection does not update the real serial preview");
assert(functionSource("loadFinishedLabelHistory").includes("selectFinishedBoxLabelHistory(selectedRow"), "latest box-label issue is not automatically selected");
assert(functionSource("finishedBoxLabelPreviewRecord").includes('finishedLabelPrintMode === "box"') && functionSource("finishedBoxLabelPreviewRecord").includes("finishedLabelLastIssuedRecord"), "box-label preview does not use the selected issued record");
assert(functionSource("setFinishedBoxLabelPrintButton").includes('"finished_label_reprint"'), "box-label reprint action is not concise");
assert(app.includes('if (finishedLabelPrintMode === "box") searchFinishedLabelProducts();'), "opening box-label mode does not automatically load printable history");
[
  "finished_box_label_search_hint",
  "finished_box_label_ready_summary",
  "finished_box_label_no_history",
  "finished_box_label_layout_sample",
  "finished_box_label_history_select",
  "finished_box_label_history_selected",
  "finished_box_label_initial_status",
  "finished_box_label_reprint_status",
  "finished_box_label_selected_serials"
].forEach((key) => {
  assert((app.match(new RegExp(`${key}:`, "g")) || []).length === 3, `${key} is not translated in all three languages`);
});
const reprintSource = functionSource("reprintFinishedLabelIssue");
const reprintDialogSource = functionSource("openFinishedLabelReprintDialog");
const confirmReprintSource = functionSource("confirmFinishedLabelReprint");
const executeReprintSource = functionSource("executeFinishedLabelHistoryReprint");
assert(html.includes('id="finished-label-reprint-overlay"') && html.includes('id="finished-label-reprint-reason"'), "in-page reprint reason dialog is missing");
assert(styles.includes(".finished-label-reprint-card"), "in-page reprint reason dialog layout is missing");
assert(reprintSource.includes('openFinishedLabelReprintDialog(row, labelType, "history")'), "finished-label history does not open the in-page reprint dialog");
assert(reprintDialogSource.includes('labelType === "box"') && reprintDialogSource.includes('overlay.classList.add("show")'), "product and box reprints are not prepared in the shared dialog");
assert(!confirmReprintSource.includes("window.open"), "reprint confirmation still opens the browser print preview");
assert(!confirmReprintSource.includes("prompt("), "reprint confirmation still depends on a browser prompt");
assert(confirmReprintSource.includes("executeFinishedLabelHistoryReprint(pending.row, pending.labelType, reason)"), "finished-label reprint is not sent directly after confirmation");
assert(executeReprintSource.includes('sb.rpc("record_finished_product_label_print"'), "generic audited print RPC is not used for reprints");
assert(!executeReprintSource.includes("openFinishedLabelPrintPreview") && !executeReprintSource.includes("openFinishedBoxLabelPrintPreview"), "desktop reprints can still fall back to browser print preview");
const boxPrintSource = functionSource("printFinishedBoxLabelIssue");
const boxExecutionSource = functionSource("executeFinishedBoxLabelIssue");
assert(boxPrintSource.includes('row.boxLabelPrinted ? "reprint" : "initial"'), "box initial print and reprint are not distinguished");
assert(boxPrintSource.includes('openFinishedLabelReprintDialog(row, "box", "box_main")'), "box-label reprint does not open the in-page reason dialog");
assert(boxExecutionSource.includes('target_label_target: "box"'), "box print audit target is missing");
assert(boxExecutionSource.includes('target_print_event_type: eventType'), "box print event type is not recorded");
assert(boxExecutionSource.includes('eventType === "reprint" || finishedLabelUsesRemotePrintQueue()'), "desktop box-label reprints can still open browser print preview");
assert(executeReprintSource.includes('event_type: labelType === "box" ? "box_label_reprint" : "product_label_reprint"'), "reprint audit type is missing");
assert(executeReprintSource.includes('label_size: labelType === "box" ? "80x60" : "45x20"'), "reprint label size is missing from audit details");
assert(executeReprintSource.includes("copies_per_unit: 1"), "one-label-per-unit audit rule is missing");

const reprintFlowEvents = [];
const reprintReasonInput = { value: "ラベル汚損", focus() {} };
const reprintFlowSandbox = {
  finishedLabelPendingReprint: { source: "history", row: { id: 1 }, labelType: "product" },
  document: {
    getElementById(id) { return id === "finished-label-reprint-reason" ? reprintReasonInput : null; }
  },
  t(key) { return key; },
  alert() {},
  closeFinishedLabelReprintDialog() { reprintFlowEvents.push("close-dialog"); },
  executeFinishedLabelHistoryReprint(row, labelType, reason) {
    reprintFlowEvents.push(["execute-history", row.id, labelType, reason].join(":"));
  },
  executeFinishedBoxLabelIssue() { reprintFlowEvents.push("execute-box"); }
};
vm.createContext(reprintFlowSandbox);
vm.runInContext(`${confirmReprintSource}; this.confirmReprint = confirmFinishedLabelReprint;`, reprintFlowSandbox);
reprintFlowSandbox.confirmReprint();
assert(reprintFlowEvents.join(",") === "close-dialog,execute-history:1:product:ラベル汚損", "finished-label reprint does not proceed without browser print preview");

const boxSortSandbox = {
  finishedLabelPrintMode: "box",
  finishedLabelBoxReadinessMap: {
    old: { issueCount: 2, latestIssuedAt: "2026-07-01T00:00:00Z" },
    recent: { issueCount: 1, latestIssuedAt: "2026-08-01T00:00:00Z" },
    none: { issueCount: 0, latestIssuedAt: "" }
  },
  finishedLabelProductReadinessMap: {},
  finishedLabelInstructionMap: {},
  productDkdId(product) { return product.id; }
};
vm.createContext(boxSortSandbox);
vm.runInContext(`${functionSource("finishedLabelProductPriority")}; ${functionSource("sortFinishedLabelProducts")}; this.sortProducts = sortFinishedLabelProducts;`, boxSortSandbox);
assert(boxSortSandbox.sortProducts([{ id: "none" }, { id: "old" }, { id: "recent" }]).map((row) => row.id).join(",") === "recent,old,none", "box-label products are not ordered by printable history and latest issue");

const printButton = { disabled: true, textContent: "", title: "" };
const printButtonSandbox = {
  document: { getElementById(id) { return id === "btn-finished-box-label-preview" ? printButton : null; } },
  finishedLabelUsesRemotePrintQueue() { return false; },
  t(key) { return key; }
};
vm.createContext(printButtonSandbox);
vm.runInContext(`${functionSource("setFinishedBoxLabelPrintButton")}; this.setButton = setFinishedBoxLabelPrintButton;`, printButtonSandbox);
printButtonSandbox.setButton({ finishedUnits: [{ id: 1 }], boxLabelPrinted: false });
assert(!printButton.disabled && printButton.textContent === "finished_box_label_preview", "initial box-label selection does not enable the main print action");
printButtonSandbox.setButton({ finishedUnits: [{ id: 1 }], boxLabelPrinted: true });
assert(!printButton.disabled && printButton.textContent === "finished_label_reprint", "printed box-label selection does not switch the main action to concise reprint");
printButtonSandbox.setButton({ finishedUnits: [{ id: 1 }], boxLabelPartiallyPrinted: true });
assert(printButton.disabled && printButton.title === "finished_box_label_partial_print", "partial initial printing does not block the main print action");

const barcodeInputs = [];
const qrInputs = [];
const sandbox = {
  APP_VERSION: "v-test",
  currentLang: "ja",
  t(key) {
    return {
      btn_print: "印刷",
      finished_box_label_print_setup: "箱シール: {n}台"
    }[key] || key;
  },
  tf(key, vars) {
    let value = {
      btn_print: "印刷",
      finished_box_label_print_setup: "箱シール: {n}台"
    }[key] || key;
    Object.keys(vars || {}).forEach((name) => {
      value = value.replace(new RegExp(`\\{${name}\\}`, "g"), vars[name]);
    });
    return value;
  },
  tCat(value) {
    return value;
  },
  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },
  productKindLabel(value) {
    return value === "rebuilt" ? "リビルト" : value;
  },
  finishedProductPartBarcodeDataUrl(value) {
    barcodeInputs.push(value);
    return `data:image/png;base64,barcode-${value}`;
  },
  finishedProductSerialQrDataUrl(value) {
    qrInputs.push(value);
    return `data:image/png;base64,qr-${value}`;
  }
};
vm.createContext(sandbox);
vm.runInContext(`${functionSource("finishedBoxLabelProductNo")}; ${functionSource("buildFinishedBoxLabelMarkup")}; ${functionSource("buildFinishedBoxLabelPrintHtml")}; this.build = buildFinishedBoxLabelPrintHtml;`, sandbox);

const serials = ["M2026-0000001", "M2026-0000002"];
const record = {
  issueCode: "FB2026-0000001",
  productNo: "104210-4120",
  gltekPartNumber: "G0101-00001",
  manufacturer: "DENSO",
  manufacturerPartNumber: "104210-4120",
  genuinePartNumber: "27060-30110",
  genuinePartNumber2: "27060-30111",
  productCategory: "オルタネータ",
  productKind: "rebuilt",
  nominalVoltage: "12V",
  nominalOutput: "130A",
  nominalSpec: "SC6",
  units: serials.map((manufacturing_serial, index) => ({ id: index + 1, manufacturing_serial, product_no: "104210-4120" }))
};
const output = sandbox.build(record);

assert((output.match(/class='box-product-label'/g) || []).length === 2, "one box label per finished unit was not generated");
assert((output.match(/BOX LABEL/g) || []).length === 2, "box-label marker is missing");
assert((output.match(/GLTEK PART NO\./g) || []).length === 2, "GLTEK part-number heading is missing");
assert((output.match(/<div class='box-product-label-number'><span>GLTEK PART NO\.<\/span><strong class='box-product-label-part'>G0101-00001<\/strong><\/div>/g) || []).length === 2, "GLTEK PART NO. does not display the G part number");
assert((output.match(/MANUFACTURER \/ MFR PART NO\./g) || []).length === 2, "manufacturer part-number field is missing");
assert((output.match(/GENUINE PART NO\./g) || []).length === 2, "genuine part-number field is missing");
assert(output.includes("DENSO / 104210-4120"), "manufacturer data is missing");
assert(output.includes("27060-30110 / 27060-30111"), "genuine part-number data is missing");
assert(output.includes("12V / 130A / SC6"), "specification data is missing");
assert(barcodeInputs.length === 2 && barcodeInputs.every((value) => value === record.gltekPartNumber), "Code 128 payload is not the G part number");
assert(qrInputs.length === 2 && qrInputs.every((value, index) => value === serials[index]), "QR payload is not the unit manufacturing serial");
assert(serials.every((serial) => output.includes(serial)), "human-readable manufacturing serial is missing");
assert(output.includes("box-label-print.css?dcats_version=v-test"), "80x60 print stylesheet is not versioned");
assert(output.includes("label-print-window.js?dcats_version=v-test"), "box-label print runtime is missing or unversioned");
assert(functionSource("openFinishedBoxLabelPrintPreview").includes("printFinishedLabelWindowWhenReady(win)"), "box-label printing starts before assets are ready");
assert(boxExecutionSource.indexOf('if (!printWindow)') < boxExecutionSource.indexOf('sb.rpc("record_finished_product_label_print"'), "box-label print history can be recorded after a blocked print window");

const longOutput = sandbox.build({
  ...record,
  productNo: "GEXTENDEDMANUFACTURERCODE01-00001",
  gltekPartNumber: "GEXTENDEDMANUFACTURERCODE01-00001",
  units: [{ manufacturing_serial: "M2026-0000003" }]
});
assert(longOutput.includes("box-product-label-part long"), "long GLTEK part numbers do not receive adaptive type size");

console.log("80x60 box-label layout, Code 128, serial QR, and separate reprint flow passed.");
