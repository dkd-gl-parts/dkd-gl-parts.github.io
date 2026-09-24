const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
function functionSource(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} missing`);
  const end = source.indexOf('\n}\n', start);
  assert.ok(end >= 0, `${name} has no closing brace`);
  return source.slice(start, end + 2);
}

async function main() {
  let saveArgs = null;
  const elements = {
    'sales-rank1-status': { textContent: '', classList: { add() {}, remove() {} } },
    'sales-rank1-price': { value: '5900' },
    'btn-sales-rank1-save': { disabled: false }
  };
  const context = {
    Set,
    Number,
    parseInt,
    isNaN,
    Array,
    Object,
    Promise,
    String,
    console,
    normalizeProductKind: kind => kind || 'rebuilt',
    productDkdId: product => String(product.dkd_shohin_id),
    customerCatalogProductKind: product => product.default_product_kind || 'rebuilt',
    customerCatalogContext: () => ({ customer: { price_rank_code: 'HANBAIOU_URI_1' } }),
    isCustomerViewer: () => false,
    customerViewerSetting: () => true,
    calculateSalesPriceClient: base => base,
    ensureCustomerAccessPriceRanks: async () => {},
    loadCustomerPriceListBaseRows: async () => [{ dkd_shohin_id: 11, product_kind: 'rebuilt', base_price_jpy: 9000 }],
    loadCustomerPriceListProductMap: async ids => Object.fromEntries(ids.map(id => [String(id), { dkd_shohin_id: id, category_code: 'starter' }])),
    defaultCustomerDisplaySettings: () => ({ show_zero_price: false }),
    customerAccessSettings: {},
    customerAccessVisibilityRows: [],
    customerPriceListRank: () => ({ rank_code: 'HANBAIOU_URI_1' }),
    customerCategoryIsVisible: () => true,
    customerPriceListSortRows: rows => rows,
    sales_price_ranks: [],
    document: { getElementById: id => elements[id] || null },
    canEditBasePrice: () => true,
    currentSalesPricingDkdId: 22,
    currentSalesRank1Row: { price_jpy: 5800, updated_at: 'prior-revision' },
    salesPricingCurrentProductKind: () => 'rebuilt',
    salesRank1SavePending: false,
    salesPricingMgmtRank1Map: {},
    renderSalesRankPreview: () => {},
    renderSalesPricingMgmt: () => {},
    t: key => key,
    sb: {
      rpc: async (name, args) => {
        if (name === 'save_product_rank1_price') {
          saveArgs = args;
          return { data: { price_jpy: args.target_price_jpy, updated_at: 'next-revision' } };
        }
        assert.equal(name, 'get_product_rank1_prices');
        if (args.target_ids === null) return { data: [
          { dkd_shohin_id: 11, product_kind: 'rebuilt', price_jpy: 6200 },
          { dkd_shohin_id: 22, product_kind: 'rebuilt', price_jpy: 5800 }
        ] };
        return { data: [{ dkd_shohin_id: 22, product_kind: 'rebuilt', price_jpy: 5800 }] };
      },
      from: table => {
        if (table === 'product_base_prices') return {
          select: () => ({ in: () => ({ eq: async () => ({ data: [{ dkd_shohin_id: 11, product_kind: 'rebuilt', base_price_jpy: 9000 }] }) }) })
        };
        if (table === 'sales_price_ranks') return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { rank_code: 'HANBAIOU_URI_1' } }) }) }) })
        };
        throw Error(`Unexpected table ${table}`);
      }
    }
  };
  vm.createContext(context);
  ['fetchInternalRank1PriceMap', 'fetchCustomerCatalogPriceMap', 'loadCustomerPriceListRows', 'saveSalesRank1Price']
    .forEach(name => vm.runInContext(functionSource(name), context));

  const map = await context.fetchInternalRank1PriceMap([11, 22]);
  assert.equal(map['22|rebuilt'], 5800);

  const catalog = await context.fetchCustomerCatalogPriceMap([
    { dkd_shohin_id: 11, default_product_kind: 'rebuilt' },
    { dkd_shohin_id: 22, default_product_kind: 'rebuilt' }
  ]);
  assert.equal(catalog['11'], 9000);
  assert.equal(catalog['22'], 5800);

  const priceList = await context.loadCustomerPriceListRows({ price_rank_code: 'HANBAIOU_URI_1' });
  assert.equal(priceList.length, 2);
  assert.equal(priceList.find(row => row.product.dkd_shohin_id === 11).salesPrice, 6200);
  assert.equal(priceList.find(row => row.product.dkd_shohin_id === 22).salesPrice, 5800);
  assert.equal(priceList.find(row => row.product.dkd_shohin_id === 22).price.base_price_jpy, null);

  context.customerCatalogContext = () => ({ customer: { price_rank_code: 'HANBAIOU_URI_2' } });
  const otherCatalog = await context.fetchCustomerCatalogPriceMap([
    { dkd_shohin_id: 11, default_product_kind: 'rebuilt' },
    { dkd_shohin_id: 22, default_product_kind: 'rebuilt' }
  ]);
  assert.equal(otherCatalog['11'], 9000);
  assert.equal(otherCatalog['22'], null);
  const otherPriceList = await context.loadCustomerPriceListRows({ price_rank_code: 'HANBAIOU_URI_2' });
  assert.equal(otherPriceList.length, 1);
  assert.equal(otherPriceList[0].salesPrice, 9000);

  await context.saveSalesRank1Price();
  assert.equal(saveArgs.target_dkd_shohin_id, 22);
  assert.equal(saveArgs.target_product_kind, 'rebuilt');
  assert.equal(saveArgs.target_price_jpy, 5900);
  assert.equal(saveArgs.target_expected_updated_at, 'prior-revision');
  assert.equal(context.salesPricingMgmtRank1Map['22'], 5900);
  assert.equal(elements['btn-sales-rank1-save'].disabled, false);
  console.log('rank-1 pricing frontend scenarios passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
