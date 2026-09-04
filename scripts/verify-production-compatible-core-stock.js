const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function section(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert(from >= 0 && to > from);
  return app.slice(from, to);
}
const source = [
  section('function renderProductionKikanPartsList(', 'function scrollProductionDetailIntoViewOnMobile('),
  section('async function fetchCoreStockQtyMap(', 'async function fetchKikanCompatibleMap(')
].join('\n');
async function run({ failStock = false, allowed = true, stale = false } = {}) {
  const wrap = { innerHTML: '', querySelectorAll: () => [] };
  let stockReads = 0;
  const context = {
    console: { warn() {} }, document: { getElementById: () => wrap },
    productionDetailRequestSeq: 1,
    canSeeCoreStockInfo: () => allowed, customerCanShowCompatibleParts: () => true,
    filterVisibleProducts: p => p, loadKikanVariantSummaryCache: async () => ({}),
    productDkdId: p => String(p.dkd_shohin_id), esc: v => String(v), t: k => k,
    tf: (k, o) => k + o.n, renderKikanStockHtml: () => '<span>finished stock</span>',
    sb: {
      rpc: async () => ({ data: [
        { dkd_shohin_id: 2, genuine_part_number: '37300-3C510', category_code: 'alternator' },
        { dkd_shohin_id: 3, genuine_part_number: '37300-3C610', category_code: 'alternator' }
      ] }),
      from: table => {
        assert.equal(table, 'production_core_list_entries'); stockReads++;
        return { select: () => ({ in: async () => {
          if (stale) context.productionDetailRequestSeq = 2;
          return failStock ? { error: new Error('network failed') } : {
            data: [{ dkd_shohin_id: 2, quantity: 10 }, { dkd_shohin_id: 2, quantity: 13 }]
          };
        } }) };
      }
    }
  };
  vm.createContext(context); vm.runInContext(source, context);
  await context.loadProductionKikanForRow({ dkd_shohin_id: 1, category_code: 'alternator' }, 1);
  return { html: wrap.innerHTML, stockReads };
}
(async () => {
  const success = await run();
  assert(success.html.includes('37300-3C510'));
  assert(success.html.includes('<b>23</b>'));
  assert(success.html.includes('<b>0</b>'));
  const failed = await run({ failStock: true });
  assert(failed.html.includes('<b>-</b>'));
  assert(!failed.html.includes('<b>0</b>'));
  const denied = await run({ allowed: false });
  assert.equal(denied.stockReads, 0);
  assert(!denied.html.includes('core_stock_qty'));
  assert.equal((await run({ stale: true })).html, '');
  console.log('Production compatible core stock: sums receipts once; distinguishes failure from zero; respects permissions and stale searches.');
})().catch(error => { console.error(error); process.exitCode = 1; });
