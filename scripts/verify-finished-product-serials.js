const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const printCss = fs.readFileSync(path.join(root, "print.css"), "utf8");

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

assert(app.includes('sb.rpc("issue_finished_product_serials"'), "issuance RPC call is missing");
assert(app.includes('sb.rpc("record_finished_product_label_print"'), "audited label-print RPC call is missing");
assert(!app.includes('.from("finished_label_issues").insert('), "browser still inserts finished-label batches directly");
assert(!app.includes("quickchart.io/qr"), "production labels still depend on an external QR service");
assert(html.includes('id="finished-label-quantity" type="number" min="1" max="100"'), "quantity guard is missing from the form");
assert(html.includes('id="finished-label-print-count"') && html.includes('min="1" max="1"') && html.includes('value="1" readonly'), "one-label-per-unit rule is missing");
assert(html.includes('id="finished-label-layout-preview"'), "live 45x20 label layout preview is missing");
assert(html.includes('id="finished-label-layout-qr-value"'), "QR payload preview is missing");
assert(html.includes('選択したG品番') && !html.includes('選択したGLTEK品番'), "finished-label guidance is not using G品番 terminology");
assert(html.includes('id="finished-label-mode-hub"'), "finished registration label-screen chooser is missing");
assert(html.includes('data-finished-label-mode="product"') && html.includes('data-finished-label-mode="box"'), "separate product and box label entries are missing");
assert(html.includes('data-i18n="finished_label_preview" disabled>完品シール印刷</button>'), "45x20 label is not named 完品シール");
assert(html.includes('data-i18n="finished_label_layout_title">完品シール レイアウト</h4>'), "finished-label layout title is inconsistent");
assert(!html.includes("製品本体シール"), "obsolete 製品本体シール name remains in the screen");
assert(/@page\s*{[^}]*size:\s*45mm\s+20mm/i.test(printCss), "print page is not fixed at 45x20mm");
assert(/\.serial-label\s*{[^}]*width:\s*45mm;[^}]*height:\s*20mm;/i.test(printCss), "label dimensions are not exact");
assert(/\.serial-label-field-name\s*{[^}]*font-size:/i.test(printCss), "print field hierarchy is missing");
const componentLoadSource = functionSource("loadFinishedLabelComponentCandidates");
assert(componentLoadSource.includes('.from("assembly_component_usage_details")'), "product-scoped registered components are not loaded");
assert(componentLoadSource.includes('.eq("dkd_shohin_id", productDkdId(product))'), "component candidates are not limited to the selected product");
assert(componentLoadSource.includes('.eq("product_kind", normalizeProductKind(variant.product_kind))'), "component candidates are not limited to the selected product kind");
assert(componentLoadSource.includes('Number(row.replacement_rate) === 100'), "100-percent components are not selected by default");
assert(functionSource("addFinishedLabelSelectedComponent").includes("belongsToSelectedProduct"), "additional components are not guarded by the selected product candidate list");
assert(functionSource("openFinishedLabelComponentRegistration").includes('componentReturnScreen = "finished-label-mgmt"'), "category-based component registration is not available from the finished-label screen");
const productSelectionSource = functionSource("selectFinishedLabelProduct");
assert(productSelectionSource.indexOf("renderFinishedLabelCategoryOptions") < productSelectionSource.indexOf("loadFinishedLabelComponentCandidates"), "registered product components are not loaded after product selection");
assert(functionSource("applyFinishedLabelTemplate").includes("finishedLabelComponentCandidates"), "100-percent component reset is not based on registered product components");

const qrInputs = [];
const sandbox = {
  APP_VERSION: "v-test",
  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },
  finishedProductSerialQrDataUrl(value) {
    qrInputs.push(value);
    return `data:image/png;base64,${Buffer.from(value).toString("base64")}`;
  }
};
vm.createContext(sandbox);
vm.runInContext(`${functionSource("buildFinishedLabelMarkup")}; ${functionSource("buildFinishedLabelPrintHtml")}; this.build = buildFinishedLabelPrintHtml;`, sandbox);

const serials = ["M2026-0000001", "M2026-0000002"];
const output = sandbox.build({
  issueCode: "FB2026-0000001",
  productNo: "G0101-00001",
  units: serials.map((manufacturing_serial, index) => ({ id: index + 1, manufacturing_serial }))
});

assert((output.match(/class='serial-label'/g) || []).length === 2, "one label per finished unit was not generated");
assert((output.match(/<span>PRODUCT ID<\/span>/g) || []).length === 2, "product-label marker is missing");
assert((output.match(/G PART NO\./g) || []).length === 2, "G-part-number heading is missing");
assert(!output.includes("GLTEK PART NO."), "obsolete GLTEK part-number heading remains");
assert((output.match(/MFG SERIAL \/ S\/N/g) || []).length === 2, "manufacturing-serial heading is missing");
assert(!output.includes("化粧箱"), "obsolete box-label copy is still generated");
assert(qrInputs.length === 2 && qrInputs.every((value, index) => value === serials[index]), "QR payload is not serial-only");
assert(serials.every((serial) => output.includes(serial)), "human-readable manufacturing serial is missing");

const longOutput = sandbox.build({
  issueCode: "FB2026-0000002",
  productNo: "GEXTENDEDCODE01-00001",
  units: [{ id: 3, manufacturing_serial: "M2026-0000003" }]
});
assert(longOutput.includes("serial-label-product long"), "long GLTEK part numbers do not receive the adaptive type size");

console.log("Finished-product serial issuance, one-label rule, and product-scoped component defaults passed.");
