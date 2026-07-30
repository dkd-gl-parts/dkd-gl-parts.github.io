const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

const maskSource = sourceBetween("function ecMallLooksLikeOpaqueSellerId", "function ecMallCleanSellerNameCandidate");
const sandbox = {};
vm.runInNewContext(`${maskSource}; result = { masked: ecMallLooksLikeMaskedSellerName, broken: ecMallLooksLikeBrokenSellerName };`, sandbox);

if (!sandbox.result.masked("tgw********") || !sandbox.result.masked("tgw＊＊＊")) {
  throw new Error("partially masked Yahoo Auction names must remain under review");
}
if (sandbox.result.masked("ARD広島ヤフオク!店") || sandbox.result.broken("ARD広島ヤフオク!店")) {
  throw new Error("complete seller names must remain usable");
}
if (!sandbox.result.broken("AL4VB6SsgBkuqkpbtqN9yFn1mjSP8")) {
  throw new Error("opaque seller IDs must not be displayed as confirmed names");
}

[
  "var ecMallResolvedSellerNames = {};",
  "function ecMallIndexResolvedSellerNames",
  "function ecMallSellerNeedsReview",
  "function ecMallSellerProfileUrl",
  "function ecMallSellerReviewSuffixHtml",
  "function renderEcMallSellerReviewPanel",
  "https://auctions.yahoo.co.jp/seller/",
  "list.innerHTML = html;",
  "ecMallSellerReviewSuffixHtml(row)",
  "ecMallIndexResolvedSellerNames(rows);"
].forEach((fragment) => {
  if (!source.includes(fragment)) throw new Error(`seller review implementation is missing: ${fragment}`);
});
if (source.includes("renderEcMallSellerReviewPanel(rows) + html")) {
  throw new Error("the retired seller review panel must not be restored to the heavy result renderer");
}

[
  ".ec-seller-review-panel",
  ".ec-seller-review-badge",
  ".ec-seller-fixed-id",
  ".ec-seller-review-actions"
].forEach((fragment) => {
  if (!styles.includes(fragment)) throw new Error(`seller review styling is missing: ${fragment}`);
});

const translatedTitleCount = (source.match(/ec_seller_review_title:/g) || []).length;
if (translatedTitleCount !== 3) {
  throw new Error("seller review status must be translated for all supported languages");
}

console.log("EC mall seller review guard passed");
