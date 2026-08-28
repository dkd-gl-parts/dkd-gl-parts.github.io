const fs = require("fs");

const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

function requireText(source, fragment, message) {
  if (!source.includes(fragment)) throw new Error(message || `Missing contract: ${fragment}`);
}

[
  'action: "core-return-mgmt"',
  'enterCoreReturnManagement()',
  'sb.rpc("list_core_return_management"',
  'sb.rpc("get_core_return_management_detail"',
  'sb.rpc("register_core_return_receipt"',
  'sb.rpc("inspect_core_return"',
  'return_sheet: "コア返却シート"',
  'manual_identification: "受注・得意先から照合"',
  'replacement_return: "代替品の返却"',
  'wrong_item: "異なるコア"',
  'refund_review: "返金確認へ"',
  'coreReturnManagementEventLabel',
  'btn-logout-core-return-mgmt',
  'btn-back-core-return-mgmt'
].forEach((fragment) => requireText(app, fragment));

[
  'id="screen-core-return-mgmt"',
  'id="core-return-mgmt-search"',
  'id="core-return-mgmt-status"',
  'id="core-return-mgmt-list"',
  'id="core-return-mgmt-detail"',
  '返却管理番号・送り状・受注番号・得意先・品番・製造シリアル',
  '<option value="exception">相違・破損あり</option>'
].forEach((fragment) => requireText(html, fragment));

[
  ".core-return-mgmt-body",
  ".core-return-mgmt-workspace",
  ".core-return-mgmt-list-row.overdue",
  ".core-return-mgmt-sections",
  ".core-return-mgmt-history-row"
].forEach((fragment) => requireText(css, fragment));

if (/addEventListener\("input"[\s\S]{0,120}refreshCoreReturnManagement/.test(app)) {
  throw new Error("Core-return search must run from Search/Enter, not on every input event");
}
if (!/core-return-mgmt-reload"\)\.addEventListener\("click"/.test(app)) {
  throw new Error("Core-return Search button is not wired");
}

console.log("Core-return management frontend verification passed.");
