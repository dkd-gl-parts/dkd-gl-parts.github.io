const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

[
  'class="mgmt-toolbar kikan-mgmt-toolbar"',
  'class="kikan-mgmt-search-controls"',
  'id="kikan-mgmt-search"',
  'id="btn-kikan-mgmt-search"',
  'class="btn-primary kikan-mgmt-new-group"'
].forEach((fragment) => {
  if (!html.includes(fragment)) throw new Error(`compatibility search markup is missing: ${fragment}`);
});

const managementSource = sourceBetween("var kikanMgmtData", "function openKikanForm");
[
  'var kikanMgmtKeyword = ""',
  "var kikanMgmtLoadSeq = 0",
  "function searchKikanMgmt()",
  "kikanMgmtKeyword = normalizeAsciiWidth",
  "var loadSeq = ++kikanMgmtLoadSeq",
  "var q = kikanMgmtKeyword",
  'fetchCoreProductMasterMatches(qAscii, "", 50)',
  '.from("kikan_group_members").select("kikan_group_id").in("dkd_gokan_id", matchIds)'
].forEach((fragment) => {
  if (!managementSource.includes(fragment)) throw new Error(`compatibility search flow is missing: ${fragment}`);
});
if ((managementSource.match(/if \(loadSeq !== kikanMgmtLoadSeq\) return;/g) || []).length < 7) {
  throw new Error("stale compatibility loads must be rejected after asynchronous queries");
}

const eventSource = sourceBetween('document.getElementById("btn-new-kikan-group")', 'document.getElementById("btn-rakuten-search")');
if (!eventSource.includes('document.getElementById("btn-kikan-mgmt-search").addEventListener("click", searchKikanMgmt)') ||
    !eventSource.includes('if (e.key === "Enter")') ||
    !eventSource.includes("e.preventDefault()") ||
    !eventSource.includes("searchKikanMgmt()")) {
  throw new Error("compatibility keyword search must run from its button or Enter key");
}

[
  ".kikan-mgmt-toolbar { display: grid",
  "grid-template-columns: minmax(0, 1fr) auto",
  ".kikan-mgmt-search-controls",
  "gap: 28px",
  ".kikan-mgmt-new-group { justify-self: end",
  "@media (max-width: 767px)"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`compatibility search styling is missing: ${fragment}`);
});

console.log("compatibility management search guard passed");
