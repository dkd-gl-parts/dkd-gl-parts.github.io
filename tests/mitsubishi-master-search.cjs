"use strict";
const assert = require("node:assert/strict");
const vm = require("node:vm");

function functionSource(source, name) {
  const start = source.search(new RegExp("(?:async )?function " + name + "\\("));
  const end = source.indexOf("\n}", start);
  assert(start >= 0 && end > start, "Missing function: " + name);
  return source.slice(start, end + 2);
}
const normalizedFields = [
  "normalized_genuine_part_number", "normalized_genuine_part_number_2",
  "normalized_manufacturer_part_number", "normalized_pulley_assy_part_number",
  "normalized_daiko_part_number", "normalized_genuine_body_part_number",
  "normalized_manufacturer_body_part_number", "normalized_genuine_clutch_part_number",
  "normalized_manufacturer_clutch_part_number"
];
function product(id, number, maker = "MITSUBISHI", category = "alternator") {
  const row = { dkd_shohin_id: id, manufacturer_part_number: number, manufacturer: maker,
    category_code: category, genuine_part_number: "OE-" + id };
  for (const field of normalizedFields) row[field] = String(row[field.replace(/^normalized_/, "")] || "").replace(/[-\s]/g, "");
  return row;
}
function terms(text) {
  let depth = 0, start = 0;
  const result = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")") depth--;
    if (text[i] === "," && !depth) { result.push(text.slice(start, i)); start = i + 1; }
  }
  result.push(text.slice(start));
  return result;
}
function matches(row, filter) {
  if (filter.startsWith("and(")) return terms(filter.slice(4, -1)).every(term => matches(row, term));
  const match = filter.match(/^([a-z_0-9]+)\.(eq|like|ilike)\.(.*)$/);
  assert(match, "Unsupported filter " + filter);
  const [, field, operator, expected] = match;
  const value = String(row[field] ?? "");
  if (operator === "eq") return value === expected;
  const pattern = expected.split("%").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp("^" + pattern + "$", operator === "ilike" ? "i" : "").test(value);
}
function harness(source, options = {}) {
  const calls = [], rows = options.rows || [product(17890, "A002TX3081")];
  const legacy = options.legacy || [];
  const context = {
    console: { warn() {} }, CORE_PRODUCT_FAST_SELECT: "*", productSearchLimit: 200,
    normalizeAsciiWidth: value => String(value ?? "").normalize("NFKC"),
    isDaikoGroup: () => options.daiko !== false,
    fetchActiveSlLinkedDkdIds: async () => options.linked || [],
    norm: value => String(value ?? "").toUpperCase().replace(/[-\s]/g, "").replace(/^([AM])0+([0-9])T/, "$1$2T").toLowerCase(),
    document: { getElementById: () => ({ value: options.query || "" }) },
    loadPartsMgmtShippingWeights: async () => {},
    renderPartsMgmt() { context.rendered = true; },
    partsMgmtData: [], partsMgmtSearchFailed: false,
    sb: {
      from(table) {
        const call = { table, filters: [] }; calls.push(call);
        let limit = Infinity, single = false;
        return {
          select() { return this; }, order() { return this; },
          limit(value) { limit = value; return this; },
          or(value) { call.or = value; call.filters.push(row => terms(value).some(term => matches(row, term))); return this; },
          eq(field, value) { call.filters.push(row => String(row[field]) === String(value)); return this; },
          in(field, values) { call.filters.push(row => values.includes(row[field])); return this; },
          maybeSingle() { single = true; return this; },
          then(resolve) {
            if ((table === "core_products" && options.coreError) || (table === "parts" && options.legacyError)) {
              return Promise.resolve({ data: null, error: { message: "unavailable" } }).then(resolve);
            }
            let data = (table === "parts" ? legacy : rows).filter(row => call.filters.every(fn => fn(row))).slice(0, limit);
            return Promise.resolve({ data: single ? data[0] || null : data, error: null }).then(resolve);
          }
        };
      },
      async rpc(name, args) {
        assert.equal(name, "search_core_products_by_prefix_fast");
        calls.push({ rpc: name, args });
        if (options.prefixError) return { data: null, error: { message: "offline" } };
        return { data: rows.filter(row => (!args.category_filter || row.category_code === args.category_filter) &&
          normalizedFields.some(field => String(row[field] || "").startsWith(args.search_prefix))).slice(0, args.max_rows), error: null };
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(["normalizePartQuery", "mitsubishiManufacturerSearchAliases",
    "normalizeCoreProductFastRows", "fetchCoreProductMasterMatches", "loadPartsMgmt"]
    .map(name => functionSource(source, name)).join("\n"), context);
  return { context, calls };
}

async function verify(source) {
  let cases = 0;
  const check = async (options, query, expected, category = null, searchOptions = {}) => {
    const { context, calls } = harness(source, options);
    const result = await context.fetchCoreProductMasterMatches(query, category, 200, searchOptions);
    assert.equal(result.error || null, null);
    assert.deepEqual(Array.from(result.data, row => row.dkd_shohin_id).sort((a,b) => a-b), expected);
    cases++;
    return calls;
  };
  const long = product(17890, "A002TX3081");
  const short = product(2, "A2TX3081");
  const other = product(3, "A002TX3081", "DENSO");
  const suffix = product(4, "A002TX3081B");
  const one = await check({ rows: [long, other, suffix] }, "A2TX3081", [17890]);
  assert.equal(one.length, 1, "A full short-form match must use a single indexed exact read");
  assert(one[0].or.includes("and(manufacturer.eq.MITSUBISHI,normalized_manufacturer_part_number.eq.A002TX3081)"));
  await check({ rows: [short] }, "A002TX3081", [2]);
  await check({ rows: [long, short] }, "A2TX3081", [2,17890]);
  await check({ rows: [long] }, "ａ２ｔｘ３０８１", [17890]);
  await check({ rows: [long] }, "a2t-x3081", [17890]);
  await check({ rows: [long, suffix] }, "A2TX3081B", [4]);
  await check({ rows: [product(5, "M002T42842", "MITSUBISHI", "starter")] }, "M2T42842", [5], "starter");
  await check({ rows: [long] }, "A2TX3081", [], "starter");
  await check({ rows: [long] }, "A2TX3081", [17890], null, {exactOnly:true});
  await check({ rows: [long, other, suffix] }, "A2TX30", [4,17890]);
  await check({ rows: [short] }, "A002TX30", [2]);
  await check({ rows: [long], prefixError:true }, "A2TX30", [17890]);
  await check({ rows: [long] }, "A2TX30", [], null, {exactOnly:true});
  await check({ rows: [long] }, "A2TX30", [17890], null, {preferPrefix:true});
  const normal = await check({ rows: [product(6, "1042101230", "DENSO")] }, "1042101230", [6]);
  assert.equal(normal.length, 1, "Unrelated formats keep their original request count");
  const { context: scope } = harness(source);
  for (const input of ["B2TX3081", "A20TX3081", "A0002TX3081", "SH01-18-300", "A2TX3081,or(x)"]) {
    assert.equal(scope.mitsubishiManufacturerSearchAliases(input).length, 0, "Do not extend Mitsubishi zero padding to unrelated formats");
  }
  const failed = harness(source, { coreError:true });
  assert((await failed.context.fetchCoreProductMasterMatches("A2TX3081")).error);
  assert.equal(failed.calls.length, 1, "An access/read error must not trigger broader fallback");
  cases++;

  const master = harness(source, { query: "A2TX3081", rows: [long] });
  await master.context.loadPartsMgmt();
  assert.deepEqual(Array.from(master.context.partsMgmtData, row => row.dkd_shohin_id), [17890]);
  assert.equal(master.context.partsMgmtData[0]._coreManaged, true, "Catalog-only matches use the existing core editor");
  assert.equal(long._coreManaged, undefined, "Do not mutate source records");
  assert.equal(master.context.partsMgmtSearchFailed, false); cases++;
  const legacy = { id: 7, dkd_shohin_id: 17890, manufacturer_part_number:"A2TX3081", manufacturer:"MITSUBISHI" };
  const duplicate = harness(source, { query:"A2TX3081", rows:[long], legacy:[legacy] });
  await duplicate.context.loadPartsMgmt();
  assert.equal(duplicate.context.partsMgmtData.length, 1);
  assert.equal(duplicate.context.partsMgmtData[0].id, 7);
  assert.equal(duplicate.context.partsMgmtData[0]._coreManaged, undefined, "Keep the original legacy edit/delete path"); cases++;
  const numeric = harness(source, { query:"17890", rows:[long] });
  await numeric.context.loadPartsMgmt();
  assert.equal(numeric.context.partsMgmtData[0]._coreManaged, true); cases++;
  const unsearched = harness(source);
  await unsearched.context.loadPartsMgmt();
  assert.equal(unsearched.calls.filter(call => call.table === "core_products").length, 0, "Do not scan the core catalog on initial load"); cases++;
  const restricted = harness(source, { daiko:false, query:"A2TX3081", rows:[long,product(9,"A002TX3081")], linked:[17890] });
  await restricted.context.loadPartsMgmt();
  assert.deepEqual(Array.from(restricted.context.partsMgmtData, row => row.dkd_shohin_id), [17890]);
  assert.equal(restricted.context.partsMgmtData[0]._coreLinkedOnly, true);
  assert(!restricted.calls.some(call => call.table === "parts" || call.rpc), "Restricted users keep their linked-only lookup"); cases++;
  const incomplete = harness(source, { query:"A2TX3081", coreError:true, legacy:[legacy] });
  await incomplete.context.loadPartsMgmt();
  assert.equal(incomplete.context.partsMgmtSearchFailed, true);
  assert.equal(incomplete.context.partsMgmtData.length, 1); cases++;
  assert(functionSource(source,"renderPartsMgmt").includes('t("parts_mgmt_search_incomplete")'));
  assert.equal((source.match(/parts_mgmt_search_incomplete:/g) || []).length, 3);
  return {cases};
}
module.exports = { verify, harness, product };
