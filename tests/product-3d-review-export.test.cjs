const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'product-3d.js'), 'utf8');
const code = source.slice(source.indexOf('  function clearViewerExport('), source.indexOf('  async function showCommonViewer('));
const file = '1e5e9f77-0322-4e03-ad38-c56d25aca8de.glb';
const prefix = 'https://jqoeqximtwfpqwzngutj.supabase.co/storage/v1/object/sign/product-3d/tripo-review/dkd_2639/aftermarket_new/';
const validUrl = prefix + file + '?token=synthetic-not-a-credential';
function harness() {
  const link = { hidden: true, removeAttribute(name) { delete this[name]; } };
  const notice = { hidden: true, textContent: '' };
  const state = { current: true, role: true, now: 1000 };
  const context = { URL, Date: { now: () => state.now }, viewerExportTarget: null, viewerRequestId: 1,
    elements: { 'product-3d-viewer-export': link, 'product-3d-viewer-export-notice': notice },
    sessionModelsEnabled: true, canManageGlb: () => state.role,
    t: key => key === 'product_3d_review_export_stale' ? '再生成・課金は不要です。' : key,
    cleanKind: kind => ['rebuilt', 'aftermarket_new'].includes(kind) ? kind : '',
  };
  const api = vm.runInNewContext(code + '\n({ clearViewerExport, prepareViewerExport, guardViewerExport })', context);
  const target = { context: 'sales', productId: 2639, kind: 'aftermarket_new' };
  function prepare(url = validUrl, options = {}) {
    api.prepareViewerExport({ url, reviewExport: true, ...options }, target, 1, () => state.current, 1000);
  }
  function click() { const event = { prevented: false, preventDefault() { this.prevented = true; } };
    api.guardViewerExport(event); return event; }
  return { state, context, api, target, link, notice, prepare, click };
}
test('authorized non-public review exports exact signed object using attachment disposition', () => {
  const q = harness(); q.prepare();
  assert.equal(q.link.hidden, false);
  const url = new URL(q.link.href);
  assert.equal(url.pathname, new URL(validUrl).pathname);
  assert.equal(url.searchParams.get('token'), 'synthetic-not-a-credential');
  assert.equal(url.searchParams.get('download'), 'D-CATS-product-2639-aftermarket_new-' + file);
  assert.equal(q.link.download, url.searchParams.get('download'));
  assert.equal(q.click().prevented, false);
  assert(!/\bfetch\(|functions\.invoke|\.storage\.|localStorage|sessionStorage/.test(code));
});
test('other origin, public/uploaded objects, wrong product/kind, credentials and unsafe names are rejected', () => {
  for (const url of [validUrl.replace('.supabase.co', '.supabase.co.evil.example'),
    validUrl.replace('dkd_2639', 'dkd_2640'), validUrl.replace('aftermarket_new', 'rebuilt'),
    validUrl.replace('/sign/', '/public/'), validUrl.replace('/tripo-review/', '/uploaded/'),
    validUrl.replace('https://', 'http://'), validUrl.replace('https://', 'https://user:pass@'),
    validUrl + '#fragment', validUrl + '&token=duplicate', validUrl + '&redirect=evil',
    validUrl.replace(file, 'not-a-uuid.glb'), validUrl.replace('.glb?', '.exe?'),
    prefix + file, validUrl.replace('token=synthetic-not-a-credential', 'token='),
    validUrl.replace(file, '%2f' + file)]) {
    const q = harness(); q.prepare(url); assert.equal(q.link.hidden, true); assert.equal(q.link.href, undefined);
  }
});
test('local, uploaded and customer viewers cannot expose the export even when URL looks valid', () => {
  for (const change of [q => q.prepare(validUrl, { reviewExport: false }),
    q => { q.target.context = 'customer'; q.prepare(); },
    q => { q.state.role = false; q.prepare(); },
    q => { q.context.sessionModelsEnabled = false; q.prepare(); },
    q => { q.state.current = false; q.prepare(); },
    q => { q.context.viewerRequestId = 2; q.prepare(); }]) {
    const q = harness(); change(q); assert.equal(q.link.hidden, true); assert.equal(q.link.href, undefined);
  }
});
test('close, sign-out, role loss, product switch, viewer replacement and expiry block stale downloads', () => {
  for (const change of [q => q.api.clearViewerExport(), q => q.context.sessionModelsEnabled = false,
    q => q.state.role = false, q => q.state.current = false, q => q.context.viewerRequestId++,
    q => q.state.now = 241000]) {
    const q = harness(); q.prepare(); change(q);
    assert.equal(q.click().prevented, true); assert.equal(q.link.hidden, true);
    assert.equal(q.link.href, undefined); assert.equal(q.link.download, undefined);
    assert.match(q.notice.textContent, /再生成・課金は不要/);
  }
});
test('a very slow GLB load cannot renew the download lifetime', () => {
  const q = harness(); q.state.now = 241000; q.prepare();
  assert.equal(q.link.hidden, true); assert.equal(q.context.viewerExportTarget, null);
});
test('both Tripo preview entry paths opt in; close and keyboard focus include the download link', () => {
  assert.equal((source.match(/url: result.preview_url, reviewExport: true/g) || []).length, 2);
  assert.match(source.slice(source.indexOf('  function closeViewer()'), source.indexOf('  function closeCapture()')), /clearViewerExport\(\)/);
  assert(source.includes('querySelectorAll("button, a[href]")'));
  assert.match(source, /addEventListener\("click", guardViewerExport\)/);
});
