const fs = require("fs");
const path = require("path");
const vm = require("vm");
const acorn = require("acorn");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const concierge = fs.readFileSync(path.join(root, "assets", "concierge-pet", "concierge-pet.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireFragment(source, fragment, message) {
  assert(source.includes(fragment), message + ": " + fragment);
}

function extractFunction(source, name) {
  const match = source.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"));
  assert(match, "Missing function: " + name);
  return match[0];
}

const sandbox = {};
vm.runInNewContext(
  extractFunction(app, "formatYen") + "\n" +
  extractFunction(app, "formatYenCurrency") + "\n" +
  "result = [formatYenCurrency(3943), formatYenCurrency(0), formatYenCurrency(null)];",
  sandbox,
);
assert(JSON.stringify(sandbox.result) === JSON.stringify(["\u00a53,943", "\u00a50", "-"]), "Yen currency formatter output is incorrect");

[
  "return formatYenCurrency(value);",
  "? formatYenCurrency(cost.totalCost)",
  "value: formatYenCurrency(ref.dksPrice)",
  "reference ? formatYenCurrency(reference.price) : \"-\"",
  "esc(formatYenCurrency(price))",
  "formatYenCurrency(row.base_price_jpy)",
  "return formatYenCurrency(n);",
  "formatYenCurrency(sl.price_jpy)",
].forEach((fragment) => requireFragment(app, fragment, "Yen display must use the shared formatter"));

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  Object.keys(node).forEach((key) => {
    if (key === "start" || key === "end") return;
    const value = node[key];
    if (Array.isArray(value)) value.forEach((entry) => walk(entry, visit));
    else if (value && typeof value === "object") walk(value, visit);
  });
}

function findVisibleJpyStrings(source, filename) {
  const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
  const violations = [];
  walk(ast, (node) => {
    if (node.type !== "Literal" || typeof node.value !== "string") return;
    if (/\bJPY\b/.test(node.value) && node.value !== "JPY") {
      violations.push(filename + ": " + JSON.stringify(node.value));
    }
  });
  return violations;
}

const visibleJpyStrings = [
  ...findVisibleJpyStrings(app, "app.js"),
  ...findVisibleJpyStrings(concierge, "assets/concierge-pet/concierge-pet.js"),
];
assert(visibleJpyStrings.length === 0, "User-visible JPY strings remain:\n- " + visibleJpyStrings.join("\n- "));
assert(!app.includes("販売価格(JP)"), "Japanese sales price label must say 円");

console.log("yen currency display guard passed");
