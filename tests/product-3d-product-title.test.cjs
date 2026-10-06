const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'product-3d.js'), 'utf8');
const start = source.indexOf('  function productTitle(product) {');
const end = source.indexOf('  function closeImageActionOverlays() {', start);
assert(start >= 0 && end > start, 'The product 3D title function must remain testable');

function title(product, language = 'ja') {
  const labels = language === 'en'
    ? { f_product_id: 'Product ID', f_mfr_pn: 'Manufacturer Part No.', f_genuine_pn: 'Genuine Part No.' }
    : { f_product_id: '商品ID', f_mfr_pn: 'メーカー品番', f_genuine_pn: '純正品番' };
  const context = {
    productId: row => Number(row?.dkd_shohin_id),
    t: key => labels[key],
  };
  const productTitle = vm.runInNewContext(`${source.slice(start, end)}\nproductTitle`, context);
  return productTitle(product);
}

test('3D capture and Viewer titles use product ID, never another company management number', () => {
  const product = { dkd_shohin_id: 2639, daiko_part_number: 'ALDK30220' };
  assert.equal(title(product), '商品ID 2639');
  assert.doesNotMatch(title(product), /ALDK30220/);
  assert.match(source, /product-3d-capture-context"\]\.textContent = productTitle\(target\.product\)/);
  assert.match(source, /showCommonViewer\(\{ url: signed\.data\.signedUrl \},\s*productTitle\(target\.product\)/);
  assert.match(source, /product-3d-viewer-title"\]\.textContent = title/);
});

test('manufacturer and genuine numbers are only supplemental, in both languages', () => {
  const product = { dkd_shohin_id: 2639, manufacturer_part_number: '27060-30220',
    genuine_part_number: '27060-30220-A', daiko_part_number: 'ALDK30220' };
  assert.equal(title(product),
    '商品ID 2639 / メーカー品番 27060-30220 / 純正品番 27060-30220-A');
  assert.equal(title(product, 'en'),
    'Product ID 2639 / Manufacturer Part No. 27060-30220 / Genuine Part No. 27060-30220-A');
});

test('blank supplemental values do not replace the stable product identifier', () => {
  assert.equal(title({ dkd_shohin_id: 42, manufacturer_part_number: '  ',
    genuine_part_number: null, daiko_part_number: 'ALDK999' }), '商品ID 42');
});
