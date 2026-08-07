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
  const apiSuccess = await runLookup({ preview: true, mode: "auto" });
  assert(apiSuccess.events.some((event) => event.type === "api"), "automatic lookup must try the API first");
  assert(!apiSuccess.events.some((event) => event.type === "local"), "automatic lookup must not load local data after an API result");
  assert(apiSuccess.events.some((event) => event.type === "applied" && event.row.lookup_source === "api"), "API result must be applied with its source");

  const fallback = await runLookup({ preview: true, mode: "auto", apiError: true });
  assert(fallback.events.findIndex((event) => event.type === "api") < fallback.events.findIndex((event) => event.type === "local"), "automatic lookup must fall back from API to local data");
  assert(fallback.events.some((event) => event.type === "applied" && event.row.lookup_source === "local"), "local fallback result must be applied");

  const localOnly = await runLookup({ preview: true, mode: "local" });
  assert(!localOnly.events.some((event) => event.type === "api") && localOnly.events.some((event) => event.type === "local"), "local-only preview must bypass the API");

  const production = await runLookup({ preview: false, mode: "local" });
  assert(production.events.some((event) => event.type === "api") && !production.events.some((event) => event.type === "local"), "customer mode must force automatic API-first lookup");

  const failure = await runLookup({ preview: true, mode: "auto", apiError: true, localError: true });
  assert(failure.events.some((event) => event.type === "status" && event.message === "customer_order_postal_lookup_error" && event.isError), "dual lookup failure must keep manual entry available with an error status");

  const invalid = await runLookup({ preview: true, mode: "local", postalCode: "123" });
  assert(!invalid.events.some((event) => event.type === "api" || event.type === "local"), "invalid postal code must not perform a lookup");

  console.log("postal lookup fallback guard passed");
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
