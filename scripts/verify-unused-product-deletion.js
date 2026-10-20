const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const acorn = require('acorn');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 2022 });
const names = /^(?:unusedProductDeletion|UNUSED_PRODUCT_DELETION_TEXT|canDeleteUnusedCoreProduct|resetUnusedProductDeletion|renderUnusedProductDeletion|loadUnusedProductDeletion|startUnusedProductDeletion|confirmUnusedProductDeletion|finishUnusedProductDeletion|checkUnusedProductDeletionResult|executeUnusedProductDeletion)/;
const code = ast.body.filter(n => (n.type === 'FunctionDeclaration' && names.test(n.id.name)) || (n.type === 'VariableDeclaration' && n.declarations.some(d => names.test(d.id.name) || d.id.name === 'TRANSLATIONS'))).map(n => source.slice(n.start, n.end)).join('\n');
const el = () => ({ hidden: false, disabled: false, textContent: '', value: '', checked: false, children: [], classList: { contains: () => true, remove() {}, add() {} }, replaceChildren() { this.children = []; }, appendChild(x) { this.children.push(x); }, focus() {} });
function fixture() {
  const elements = new Map();
  const c = { console, crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' },
    document: { getElementById: id => { if (!elements.has(id)) elements.set(id, el()); return elements.get(id); }, createElement: el },
    currentLang: 'ja', currentUser: { id: 'admin' }, userProfile: { role: 'system_admin' }, currentProduct: { id: 100 },
    partFormSource: 'core_products', partFormMode: 'edit', allProducts: [{ id: 100 }, { id: 200 }], currentProductionRow: null,
    canDelete: () => true, isSystemAdmin: () => true, accessRoleCode: p => p.role, userCompanyCode: () => 'daiko', productDkdId: p => p && p.id, tCat: v => v || '-',
    t: key => (c.TRANSLATIONS[c.currentLang] || c.TRANSLATIONS.en)[key] || key,
    enterPartsMgmt: async () => {}, sb: { rpc: async () => ({ data: checked() }) } };
  vm.createContext(c); vm.runInContext(code, c);
  c.startUnusedProductDeletion(c.currentProduct);
  return { c, elements };
}
function checked(extra = {}) { return { status: 'checked', product_id: 100, eligible: true, fingerprint: 'f'.repeat(32), product: { manufacturer: 'DENSO', category: 'alternator', manufacturer_part_number: '<script>TEST</script>', genuine_part_number: 'OEM' }, references: [], ...extra }; }
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  let passed = 0;
  for (const lang of ['ja', 'en', 'zh']) {
    const { c, elements } = fixture(); await tick(); c.currentLang = lang; c.renderUnusedProductDeletion();
    assert.equal(elements.get('btn-unused-product-delete').disabled, false);
    assert.ok(elements.get('unused-product-identity').textContent.includes('<script>TEST</script>'));
    assert.ok(!elements.get('unused-product-identity').innerHTML, 'identity uses textContent');
    c.confirmUnusedProductDeletion(); assert.equal(elements.get('unused-product-confirm').hidden, false); passed++;
  }
  {
    const { c, elements } = fixture(); await tick(); c.canDelete = () => false; c.renderUnusedProductDeletion();
    assert.equal(elements.get('unused-product-deletion').hidden, true); passed++;
  }
  for (const result of [checked({ eligible: false, references: [{ code: 'stock', count: 1, handling: 'block' }] }), checked({ product_id: 200 }), { status: 'schema_changed' }, null]) {
    const { c, elements } = fixture(); await tick(); c.sb.rpc = async () => ({ data: result }); await c.loadUnusedProductDeletion();
    assert.equal(elements.get('btn-unused-product-delete').disabled, true); passed++;
  }
  {
    const { c, elements } = fixture(); await tick(); let resolve;
    c.sb.rpc = () => new Promise(r => { resolve = r; });
    const pending = c.loadUnusedProductDeletion(); c.currentProduct = { id: 200 }; c.resetUnusedProductDeletion();
    resolve({ data: checked() }); await pending; assert.equal(elements.get('unused-product-deletion').hidden, true); passed++;
  }
  {
    const { c } = fixture(); await tick(); let resolve;
    c.sb.rpc = () => new Promise(r => { resolve = r; });
    const pending = c.loadUnusedProductDeletion(); c.currentUser = { id: 'another' };
    resolve({ data: checked() }); await pending; assert.equal(c.unusedProductDeletionState.inspection, null); passed++;
  }
  {
    const { c, elements } = fixture(); await tick(); c.confirmUnusedProductDeletion(); let calls = 0;
    c.sb.rpc = async () => { calls++; return {}; };
    await c.executeUnusedProductDeletion(); assert.equal(calls, 0); passed++;
    elements.get('unused-product-reason').value = 'wrong registration'; elements.get('unused-product-ack').checked = true;
    let resolve; const callNames = [];
    c.sb.rpc = (name, args) => { callNames.push(name); assert.equal(args.p_product_id, 100); return new Promise(r => { resolve = r; }); };
    const pending = c.executeUnusedProductDeletion(); await c.executeUnusedProductDeletion();
    assert.equal(callNames.length, 1, 'duplicate clicks do not resubmit'); passed++;
    resolve({ error: new Error('response lost') }); await pending;
    assert.equal(elements.get('btn-part-form-save').disabled, true);
    c.sb.rpc = async name => { callNames.push(name); return { data: { status: 'unconfirmed' } }; };
    await c.loadUnusedProductDeletion();
    assert.deepEqual(callNames, ['delete_unused_core_product', 'core_product_deletion_result']); passed++;
    c.sb.rpc = async () => ({ data: { status: 'deleted', product_id: 100, request_id: c.unusedProductDeletionState.pending.requestId } });
    await c.checkUnusedProductDeletionResult(); assert.equal(c.allProducts.length, 1); assert.equal(c.allProducts[0].id, 200);
    assert.equal(elements.get('parts-mgmt-deletion-notice').hidden, false); passed++;
  }
  {
    const { c, elements } = fixture(); await tick(); c.confirmUnusedProductDeletion();
    elements.get('unused-product-reason').value = 'mistake'; elements.get('unused-product-ack').checked = true;
    c.sb.rpc = async () => ({ data: { status: 'in_use', inspection: checked({ eligible: false }) } });
    await c.executeUnusedProductDeletion(); assert.equal(elements.get('btn-unused-product-delete').disabled, true);
    assert.equal(c.currentProduct.id, 100); passed++;
  }
  {
    const { c, elements } = fixture(); await tick(); c.confirmUnusedProductDeletion();
    elements.get('unused-product-reason').value = 'mistake'; elements.get('unused-product-ack').checked = true;
    c.document.getElementById('pf-shohin-cd').value = '200';
    c.sb.rpc = async (name,args) => { assert.equal(args.p_product_id,100,'saved target remains fixed despite edited form ID'); return { error: { code: '23503' } }; };
    await c.executeUnusedProductDeletion(); assert.equal(c.unusedProductDeletionState.pending,null);
    assert.equal(elements.get('btn-unused-product-delete').disabled,true); assert.equal(elements.get('btn-part-form-save').disabled,false);passed++;
  }
  assert.ok(source.includes('if (unusedProductDeletionBusy()) return;'), 'save is blocked while a deletion is pending');
  assert.ok(html.includes('maxlength="500"') && html.includes('id="unused-product-ack"'), 'explicit confirmation is present');
  assert.ok(!/\.from\("core_products"\)\s*\.delete\(/.test(code), 'browser cannot directly delete core products');
  console.log(`Unused product deletion: ${passed} scope, confirmation, translation, stale-response and unknown-result checks passed`);
})().catch(e => { console.error(e); process.exitCode = 1; });
