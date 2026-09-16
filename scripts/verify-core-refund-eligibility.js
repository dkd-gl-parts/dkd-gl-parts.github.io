const fs = require("fs");

const source = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

function requireText(haystack, needle) {
  if (!haystack.includes(needle)) throw new Error(`Missing core refund eligibility contract: ${needle}`);
}

[
  'customer_order_core_return_standard: "返却要"',
  'customer_order_core_charge_refundable_status: "請求済み（返却後返金）"',
  'customer_order_core_charge_no_refund: "返金処理なし"',
  '「返却要」はコアの返却のみで、コア代金・返金はありません。',
  'var refundApplicable = ["pending", "refunded"].indexOf(refundStatus) >= 0 && refundAmount > 0;',
  '(refundApplicable ? coreReturnManagementOption("refund_review", resolution, "返金確認へ") : "")',
  'var refundSection = refundApplicable',
  'refundSection +',
  'refundApplicable ? refundLabel : t("customer_order_core_charge_no_refund")',
  'return t(handling === "return_required" ? "customer_order_core_return_standard" : "core_return_not_required")',
  '"customer_order_core_charge_refundable_status"'
].forEach((needle) => requireText(source, needle));

requireText(html, 'content="v1.1.1016"');
requireText(source, 'var APP_VERSION       = "v1.1.1016"');

if (source.includes("この返却対象に請求済みのコア代金はありません。")) {
  throw new Error("Unbilled returns must not render a disabled refund workflow.");
}

console.log("Core refund eligibility frontend verification passed.");
