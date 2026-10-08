const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const section = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));
const daily = section(html, '<div class="form-overlay" id="dcats-business-workspace-overlay"', '<div class="form-overlay" id="dcats-business-workspace-settings-overlay"');
const settings = section(html, '<div class="form-overlay" id="dcats-business-workspace-settings-overlay"', '<div class="form-overlay sales-order-b2-import-guide-overlay"');
for (const id of ['shortcut','drive-support','account','backup','b2-select']) {
  assert(!daily.includes('id="dcats-business-workspace-' + id + '"'), id + ' must leave the daily panel');
  assert(settings.includes('id="dcats-business-workspace-' + id + '"'), id + ' must be available in Settings');
}
for (const category of ['products','customers','sales']) assert(daily.includes('data-company-export="' + category + '"'));
assert(daily.includes('id="dcats-business-workspace-folder-open"'));
assert(daily.includes('business_workspace_settings_location'));
assert(!settings.includes('<input'), 'Passwords must remain in the protected native GUI');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'Moving controls must not duplicate their IDs');
for (const suffix of ['title','desc','location','open','hint','drive_title']) assert.equal((app.match(new RegExp('business_workspace_settings_' + suffix + ':', 'g')) || []).length, 3);

function harness(role = 'system_admin') {
  const elements = new Map(), calls = [];
  let resolvePending;
  const defer = options => { calls.push(options); return new Promise(resolve => { resolvePending = resolve; }); };
  const context = { window: { DcatsHanbaiohCompanyBridge: {
    cancelCurrent: () => calls.push('cancel'), enrollAccountFromPc: defer, openBackupSetupFromPc: defer, checkBackupReadinessFromPc: defer
  } }, currentUser: { id: 'test-actor' }, t: key => key,
    isSystemAdmin: () => role === 'system_admin', canManageSalesOrders: () => role !== 'customer',
    document: { getElementById: id => elements.get(id) || null, querySelector: () => null, activeElement: null },
    Array, Promise, Error, Set
  };
  function element(id) {
    const classes = new Set();
    const node = { id, dataset: {}, disabled: false, hidden: false, textContent: '', className: '',
      classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) },
      focus: () => { context.document.activeElement = node; }, setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [] };
    elements.set(id, node); return node;
  }
  for (const id of ids.filter(id => id.startsWith('dcats-business-workspace'))) element(id);
  vm.runInNewContext(section(app, 'var DCATS_BUSINESS_WORKSPACE_URL', 'function updateSalesOrderSelectionButtons'), context);
  context.refreshDcatsB2ExportDirectoryState = async () => calls.push('read-folder-state');
  const trigger = element('menu-trigger');
  const visible = id => elements.get('dcats-business-workspace-' + id).classList.contains('show');
  return { context, elements, calls, trigger, visible, resolve: value => resolvePending(value) };
}

(async () => {
  const h = harness();
  h.context.openDcatsBusinessWorkspace({ currentTarget: h.trigger });
  assert(h.visible('overlay')); assert.equal(h.context.document.activeElement.id, 'dcats-business-workspace-folder-open');
  h.context.openDcatsBusinessWorkspaceSettings({ currentTarget: h.elements.get('dcats-business-workspace-settings-open') });
  assert(h.visible('settings-overlay')); assert(!h.visible('overlay'));
  assert(!h.calls.some(call => typeof call === 'object'), 'Opening Settings must not invoke a native action');
  h.context.closeDcatsBusinessWorkspaceSettings(); assert(h.visible('overlay')); assert(!h.visible('settings-overlay'));
  h.context.closeDcatsBusinessWorkspace(); assert.equal(h.context.document.activeElement, h.trigger);
  for (const method of ['registerDcatsCompanyAccount','openDcatsCompanyBackupSetup','checkDcatsCompanyBackupReadiness']) {
    h.calls.length = 0;
    await h.context[method](); assert.equal(h.calls.length, 0, 'Hidden settings must reject ' + method);
    h.context.openDcatsBusinessWorkspaceSettings({ currentTarget: h.trigger });
    const pending = h.context[method]();
    const permit = h.calls.find(call => typeof call === 'object'); assert(permit.isCurrent());
    h.context.closeDcatsBusinessWorkspaceSettings(); assert(!permit.isCurrent()); assert(h.calls.includes('cancel'));
    h.resolve({ status: 'saved', checks: {} }); await pending;
    assert.equal(h.elements.get('dcats-business-workspace-backup-status').textContent, '');
    h.context.openDcatsBusinessWorkspaceSettings({ currentTarget: h.trigger });
    const ownerPending = h.context[method]();
    const ownerPermit = h.calls.filter(call => typeof call === 'object').at(-1);
    h.context.currentUser = { id: 'different-actor' }; h.context.syncDcatsCompanyAccountControls();
    assert(!ownerPermit.isCurrent());
    h.resolve({ status: 'saved', checks: {} }); await ownerPending;
    assert.equal(h.elements.get('dcats-business-workspace-account-status').textContent, '');
    h.context.closeDcatsBusinessWorkspace(); h.context.currentUser = { id: 'test-actor' };
  }
  const staff = harness('staff'); staff.context.openDcatsBusinessWorkspaceSettings({ currentTarget: staff.trigger });
  for (const id of ['account','backup','company']) assert(staff.elements.get('dcats-business-workspace-' + id).hidden);
  const customer = harness('customer'); customer.context.openDcatsBusinessWorkspaceSettings({ currentTarget: customer.trigger });
  assert(!customer.visible('settings-overlay')); assert.equal(customer.calls.length, 0);
  console.log('Business workspace Settings: separate daily/setup controls, no duplicate IDs, three languages, no automatic native action, hidden/role rejection, cancellation, owner change, focus return: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
