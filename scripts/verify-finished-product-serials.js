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
assert(app.includes('sb.rpc("record_finished_product_label_reprint"'), "audited reprint RPC call is missing");
assert(!app.includes('.from("finished_label_issues").insert('), "browser still inserts finished-label batches directly");
assert(!app.includes("quickchart.io/qr"), "production labels still depend on an external QR service");
assert(html.includes('id="finished-label-quantity" type="number" min="1" max="100"'), "quantity guard is missing from the form");
assert(html.includes('id="finished-label-print-count"') && html.includes('value="2" readonly'), "two-copy product-and-box rule is missing");
assert(/@page\s*{[^}]*size:\s*45mm\s+20mm/i.test(printCss), "print page is not fixed at 45x20mm");
assert(/\.serial-label\s*{[^}]*width:\s*45mm;[^}]*height:\s*20mm;/i.test(printCss), "label dimensions are not exact");

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
vm.runInContext(`${functionSource("buildFinishedLabelPrintHtml")}; this.build = buildFinishedLabelPrintHtml;`, sandbox);

const serials = ["M2026-0000001", "M2026-0000002"];
const output = sandbox.build({
  issueCode: "FB2026-0000001",
  productNo: "G0101-00001",
  units: serials.map((manufacturing_serial, index) => ({ id: index + 1, manufacturing_serial }))
});

assert((output.match(/class='serial-label'/g) || []).length === 4, "two labels per finished unit were not generated");
assert((output.match(/製品本体/g) || []).length === 2, "product-body labels are missing");
assert((output.match(/化粧箱/g) || []).length >= 2, "box labels are missing");
assert(qrInputs.length === 2 && qrInputs.every((value, index) => value === serials[index]), "QR payload is not serial-only");
assert(serials.every((serial) => output.includes(serial)), "human-readable manufacturing serial is missing");

console.log("Finished-product serial issuance and 45x20 label checks passed.");
