const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const lookupSource = sourceBetween("async function lookupCustomerOrderPostalCode", "function configureCustomerOrderAddressTools");

async function runLookup(options) {
  const input = { value: options.postalCode || "1000001" };
  const events = [];
  const apiRow = { postal_code: "100-0001", prefecture_code: "13", prefecture_name: "東京都", address_line_1: "千代田区千代田", lookup_source: "api", data_version: "" };
  const localRow = { postal_code: "100-0001", prefecture_code: "13", prefecture_name: "東京都", address_line_1: "千代田区千代田", lookup_source: "local", data_version: "2026-07-31" };
  const context = {
    customerOrderPostalLookingUp: false,
    customerOrderPostalLookupSeq: 0,
    customerOrderPostalLookupMode: options.mode || "auto",
    customerOrderPostalRows: [],
    customerOrderPostalResultSource: "",
    document: { getElementById: (id) => id === "customer-order-postal-code" ? input : null },
    normalizeCustomerOrderPostalCode: (value) => String(value || "").replace(/\D/g, "").slice(0, 7),
    canPreviewCustomerOrdering: () => options.preview === true,
    configureCustomerOrderAddressTools: () => {},
    renderCustomerOrderPostalResults: () => {},
    customerOrderPostalSetStatus: (message, isError) => events.push({ type: "status", message, isError }),
    applyCustomerOrderPostalAddress: (row) => events.push({ type: "applied", row }),
    lookupCustomerOrderPostalApi: async () => {
      events.push({ type: "api" });
      if (options.apiError) throw new Error("api unavailable");
      return options.apiEmpty ? [] : [apiRow];
    },
    lookupCustomerOrderPostalLocal: async () => {
      events.push({ type: "local" });
      if (options.localError) throw new Error("local unavailable");
      return options.localEmpty ? [] : [localRow];
    },
    t: (key) => key,
    tf: (key) => key
  };
  vm.runInNewContext(lookupSource, context);
  await context.lookupCustomerOrderPostalCode();
  return { events, input, context };
}

(async () => {
  assert(
    source.includes("端末内住所データを優先し、利用できない場合または該当がない場合のみ外部APIを使用します。"),
    "the postal lookup hint must disclose the local-first external fallback",
  );

  const localSuccess = await runLookup({ preview: true, mode: "auto" });
  assert(localSuccess.events.some((event) => event.type === "local"), "automatic lookup must try local data first");
  assert(!localSuccess.events.some((event) => event.type === "api"), "automatic lookup must not disclose the postal code to the API after a local match");
  assert(localSuccess.events.some((event) => event.type === "applied" && event.row.lookup_source === "local"), "local result must be applied with its source");

  const fallback = await runLookup({ preview: true, mode: "auto", localEmpty: true });
  assert(fallback.events.findIndex((event) => event.type === "local") < fallback.events.findIndex((event) => event.type === "api"), "automatic lookup must fall back from local data to the API");
  assert(fallback.events.some((event) => event.type === "applied" && event.row.lookup_source === "api"), "API fallback result must be applied");

  const unavailableFallback = await runLookup({ preview: true, mode: "auto", localError: true });
  assert(unavailableFallback.events.findIndex((event) => event.type === "local") < unavailableFallback.events.findIndex((event) => event.type === "api"), "automatic lookup must retain API fallback when local data is unavailable");
  assert(unavailableFallback.events.some((event) => event.type === "applied" && event.row.lookup_source === "api"), "API result must remain available when local data fails");

  const noMatch = await runLookup({ preview: true, mode: "auto", localEmpty: true, apiEmpty: true });
  assert(noMatch.events.findIndex((event) => event.type === "local") < noMatch.events.findIndex((event) => event.type === "api"), "an empty local result must still use the external fallback");
  assert(!noMatch.events.some((event) => event.type === "applied"), "dual empty results must not apply an address");
  assert(noMatch.events.some((event) => event.type === "status" && event.message === "customer_order_postal_lookup_empty" && event.isError), "dual empty results must keep manual entry available with a no-match status");

  const localOnly = await runLookup({ preview: true, mode: "local" });
  assert(!localOnly.events.some((event) => event.type === "api") && localOnly.events.some((event) => event.type === "local"), "local-only preview must bypass the API");

  const apiOnly = await runLookup({ preview: true, mode: "api" });
  assert(apiOnly.events.some((event) => event.type === "api") && !apiOnly.events.some((event) => event.type === "local"), "API-only preview must bypass local data");

  const production = await runLookup({ preview: false, mode: "api" });
  assert(production.events.some((event) => event.type === "local") && !production.events.some((event) => event.type === "api"), "customer mode must force automatic local-first lookup");

  const failure = await runLookup({ preview: true, mode: "auto", localError: true, apiError: true });
  assert(failure.events.some((event) => event.type === "status" && event.message === "customer_order_postal_lookup_error" && event.isError), "dual lookup failure must keep manual entry available with an error status");

  const invalid = await runLookup({ preview: true, mode: "local", postalCode: "123" });
  assert(!invalid.events.some((event) => event.type === "api" || event.type === "local"), "invalid postal code must not perform a lookup");

  console.log("postal local-first lookup and fallback guard passed");
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
