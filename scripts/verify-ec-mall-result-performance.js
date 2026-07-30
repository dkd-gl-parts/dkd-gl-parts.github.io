const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const markup = fs.readFileSync(path.join(root, "index.html"), "utf8");

function functionSource(name, nextName, asyncFunction) {
  const prefix = asyncFunction ? `async function ${name}` : `function ${name}`;
  const start = source.indexOf(prefix);
  const end = source.indexOf(nextName, start + 1);
  if (start < 0 || end < start) throw new Error(`${name} could not be isolated`);
  return source.slice(start, end);
}

const compactSource = functionSource("compactRakutenItemsForDisplay", "function filterEcMallItemsByCondition");
const compactSandbox = {};
vm.runInNewContext(`${compactSource}; result = compactRakutenItemsForDisplay;`, compactSandbox);
const original = { itemName: "sample", raw: { large: "payload" }, raw_payload: { source: "payload" } };
const compacted = compactSandbox.result([original]);
if (!compacted[0] || compacted[0].raw !== undefined || compacted[0].raw_payload !== undefined || original.raw === undefined) {
  throw new Error("display items must release raw payloads without mutating the saved source item");
}

const renderSource = functionSource("renderRakutenResults", "function showMoreRakutenResults");
const resultEl = { innerHTML: "" };
const summaryEl = { innerHTML: "" };
const renderSandbox = {
  rakutenLastResultKeyword: "",
  rakutenVisibleResultCount: 24,
  EC_MALL_RESULT_INITIAL_RENDER: 24,
  rakutenLastDebug: [],
  document: {
    getElementById: (id) => id === "rakuten-results" ? resultEl : summaryEl
  },
  renderEcMallSellerPicker: () => {},
  ecMallIndexResolvedSellerNames: () => {},
  ecMallSellerReviewSuffixHtml: () => "",
  esc: (value) => String(value == null ? "" : value),
  t: (key) => key,
  tf: (key, values) => key === "rakuten_result_more" ? `more ${values.n}` : key,
  ecMallItemTotalPrice: (item) => item.totalPrice,
  rakutenConditionSummaries: () => [],
  yen: (value) => String(value == null ? "-" : value),
  renderEcMallBest3Html: () => "",
  getEcMallIncludeUsed: () => false,
  enrichRakutenItems: (items) => items || [],
  getRakutenImage: (item) => item.imageUrl || "",
  safeHttpsUrl: (value) => value || "",
  ecMallProviderLabel: () => "mall",
  rakutenConditionLabel: () => "new",
  ecMallSellerDisplayName: (item) => item.shopName || "shop"
};
vm.runInNewContext(`${renderSource}; result = renderRakutenResults;`, renderSandbox);
const items = Array.from({ length: 60 }, (_, index) => ({
  itemName: `item ${index}`,
  itemPrice: 1000 + index,
  totalPrice: 1000 + index,
  providerKey: "rakuten",
  condition: "new",
  shopName: "shop",
  imageUrl: `https://example.com/${index}.jpg`,
  itemUrl: `https://example.com/item/${index}`
}));
renderSandbox.result(items, "TEST-001");
const firstHtml = resultEl.innerHTML;
const firstCardCount = (firstHtml.match(/class='rakuten-item'/g) || []).length;
if (firstCardCount !== 24 || !firstHtml.includes("data-rakuten-result-more='1'") || !firstHtml.includes("more 36")) {
  throw new Error("EC mall results must initially render 24 cards and provide a continuation button");
}
if (!firstHtml.includes("loading='lazy'") || !firstHtml.includes("decoding='async'") ||
    !firstHtml.includes("fetchpriority='low'") || !firstHtml.includes("width='72' height='72'")) {
  throw new Error("EC mall result images must use low-cost lazy decoding with stable dimensions");
}
renderSandbox.rakutenVisibleResultCount = 48;
renderSandbox.result(items, "TEST-001", { preserveLimit: true });
const secondHtml = resultEl.innerHTML;
const secondCardCount = (secondHtml.match(/class='rakuten-item'/g) || []).length;
if (secondCardCount !== 48 || !secondHtml.includes("more 12")) {
  throw new Error("EC mall continuation must add results in a bounded batch");
}

const searchSource = functionSource("searchRakutenPrices", "async function runRakutenBulkSurvey", true);
const saveAt = searchSource.indexOf("await saveRakutenSurvey");
const compactAt = searchSource.indexOf("compactRakutenItemsForDisplay", saveAt);
const renderAt = searchSource.indexOf("renderRakutenResults", compactAt);
if (saveAt < 0 || compactAt < saveAt || renderAt < compactAt) {
  throw new Error("raw EC mall payloads must be retained for saving and released before display");
}

const listSource = functionSource("loadRakutenPriceList", "function ecPriceHistoryColor", true);
if (listSource.includes("raw_payload")) {
  throw new Error("the EC mall result list must not request unused raw payloads");
}
if (!source.includes("var EC_PRICE_LIST_RENDER_CHUNK_SIZE =") || !source.includes("var ecPriceListRenderToken =")) {
  throw new Error("the EC mall result list must keep bounded chunk rendering state");
}
if (!listSource.includes("ecPriceListRenderToken += 1")) {
  throw new Error("new EC mall result list loads must cancel older scheduled chunks");
}
const bindHistorySource = functionSource("bindEcPriceHistoryButtons", "function scheduleEcPriceListRenderChunk");
if (!bindHistorySource.includes("ecPriceHistoryBound")) {
  throw new Error("EC price history buttons must avoid duplicate listeners during chunked rendering");
}
const renderListSource = functionSource("renderEcMallPriceList", "function renderRakutenPriceList");
if (!renderListSource.includes("++ecPriceListRenderToken") ||
    !renderListSource.includes("<tbody></tbody>") ||
    !renderListSource.includes("insertAdjacentHTML(\"beforeend\"") ||
    !renderListSource.includes("scheduleEcPriceListRenderChunk(renderChunk)")) {
  throw new Error("the EC mall grouped result table must render incrementally");
}
const historySource = functionSource("fetchEcPriceHistoryRowsForGroup", "function buildEcPriceHistorySeries", true);
if (historySource.includes("raw_payload")) {
  throw new Error("the EC mall history view must not request unused raw payloads");
}
if (!styles.includes(".rakuten-result-more") || !styles.includes("content-visibility: auto")) {
  throw new Error("EC mall result cards must defer offscreen rendering and span the continuation row");
}
if (!source.includes("[data-rakuten-result-more]") || !source.includes("showMoreRakutenResults()")) {
  throw new Error("the EC mall continuation button must be wired to the incremental renderer");
}

const operationStart = markup.indexOf("class=\"rakuten-actions ec-research-operation-actions\"");
const operationEnd = markup.indexOf("class=\"ec-schedule-panel\"", operationStart);
const operationMarkup = markup.slice(operationStart, operationEnd);
const runNowAt = operationMarkup.indexOf("id=\"btn-ec-run-now\"");
const resultsAt = operationMarkup.indexOf("id=\"btn-rakuten-open-list\"");
if (operationStart < 0 || operationEnd < operationStart || runNowAt < 0 || resultsAt < runNowAt) {
  throw new Error("the EC research operation row must keep Run now on the left and Results on the right");
}
if (!operationMarkup.includes("ec-research-run-now-button") || !operationMarkup.includes("ec-research-results-button")) {
  throw new Error("the EC research operation buttons must keep distinct action styles");
}
if (!styles.includes(".ec-research-operation-actions") || !styles.includes(".btn-sm-edit.ec-research-results-button") ||
    !styles.includes("grid-template-columns: minmax(0, 1fr) auto")) {
  throw new Error("the EC research result action must remain right-aligned and visually distinct");
}

console.log("EC mall result performance guard passed");
