const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

function requireFragment(text, fragment, message) {
  if (!text.includes(fragment)) throw new Error(message || `Missing fragment: ${fragment}`);
}

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

[
  'class="mgmt-toolbar parts-mgmt-toolbar"',
  'id="parts-mgmt-search-form" role="search"',
  'for="parts-mgmt-search" data-i18n="parts_mgmt_search_label"',
  'id="parts-mgmt-search" type="search" autocomplete="off"',
  'id="btn-parts-mgmt-search" type="submit" data-i18n="btn_search"',
  'id="parts-mgmt-create-panel"',
  'data-i18n="parts_mgmt_create_label"',
  'id="btn-add-part" type="button"'
].forEach((fragment) => requireFragment(html, fragment, `product-management search markup is missing: ${fragment}`));

const inputPosition = html.indexOf('id="parts-mgmt-search"');
const searchButtonPosition = html.indexOf('id="btn-parts-mgmt-search"');
const addButtonPosition = html.indexOf('id="btn-add-part"');
if (!(inputPosition < searchButtonPosition && searchButtonPosition < addButtonPosition)) {
  throw new Error("the search action must follow the input before the separate add action");
}

const eventSource = sourceBetween(
  'document.getElementById("btn-add-part").addEventListener',
  'document.getElementById("btn-sales-pricing-mgmt-search").addEventListener'
);
[
  'document.getElementById("parts-mgmt-search-form").addEventListener("submit"',
  "e.preventDefault()",
  "searchPartsMgmt()"
].forEach((fragment) => requireFragment(eventSource, fragment, `product-management search submit handling is missing: ${fragment}`));
if (source.includes('document.getElementById("parts-mgmt-search").addEventListener("input"') ||
    source.includes('document.getElementById("parts-mgmt-search").addEventListener("keydown"')) {
  throw new Error("product-management search must use form submission instead of input or keydown-triggered querying");
}

const searchControlSource = sourceBetween("function setPartsMgmtSearchPending", "async function loadPartsMgmtShippingWeights");
[
  "if (partsMgmtSearchInFlight) return",
  "setPartsMgmtSearchPending(true)",
  "await loadPartsMgmt()",
  "setPartsMgmtSearchPending(false)",
  'form.setAttribute("aria-busy", isPending ? "true" : "false")',
  "button.disabled = isPending"
].forEach((fragment) => requireFragment(searchControlSource, fragment, `product-management search state is incomplete: ${fragment}`));

[
  ".parts-mgmt-toolbar { display: grid",
  "grid-template-columns: minmax(0, 1fr) auto",
  ".parts-mgmt-search-controls",
  ".parts-mgmt-create-panel",
  "border-left: 1px solid",
  ".parts-mgmt-add-button",
  "@media (max-width: 760px)",
  "border-top: 1px solid",
  "border-left: 0"
].forEach((fragment) => requireFragment(css, fragment, `product-management search styling is missing: ${fragment}`));

(async () => {
  let loadCount = 0;
  let releaseLoad;
  const pendingLoad = new Promise((resolve) => { releaseLoad = resolve; });
  const form = { busy: "", setAttribute(name, value) { if (name === "aria-busy") this.busy = value; } };
  const button = { disabled: false };
  const controls = new Function("document", "loadPartsMgmt", `
    var partsMgmtSearchInFlight = false;
    ${searchControlSource}
    return { searchPartsMgmt };
  `)({
    getElementById(id) {
      if (id === "parts-mgmt-search-form") return form;
      if (id === "btn-parts-mgmt-search") return button;
      return null;
    }
  }, async () => {
    loadCount += 1;
    await pendingLoad;
  });

  const first = controls.searchPartsMgmt();
  await Promise.resolve();
  await controls.searchPartsMgmt();
  if (loadCount !== 1 || button.disabled !== true || form.busy !== "true") {
    throw new Error("search submission must lock immediately and suppress duplicate searches");
  }
  releaseLoad();
  await first;
  if (button.disabled !== false || form.busy !== "false") {
    throw new Error("search controls must be restored after the query finishes");
  }

  console.log("Product management search action verification passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
