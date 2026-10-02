const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function segment(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  assert.ok(start >= 0 && end > start, `${startText} must remain testable`);
  return source.slice(start, end);
}

test('sales gallery opens the displayed rows when mutable search data is stale', () => {
  const image = { id: 183, image_url: 'https://example.invalid/image.jpg' };
  let clickHandler;
  const scope = {
    renderedSalesImageGroups: Object.create(null),
    currentImages: [image],
    thumbImgHtml: () => '<img src="thumbnail">',
    esc: value => String(value ?? ''),
    productKindClass: () => '',
    salesImageKindLabel: () => '新品',
    tf: () => '1 枚',
    t: () => '読み込み中',
    normalizeProductKind: kind => kind,
    salesImagesForKind: () => [],
    openFullscreen: (index, images) => { scope.opened = { index, images }; },
    document: { getElementById: () => ({ addEventListener: (_type, handler) => { clickHandler = handler; } }) },
  };
  const render = vm.runInNewContext(`${segment('function salesImageGroupHtml(', 'function renderImagesLoading(')}\nsalesImageGroupHtml`, scope);
  assert.match(render('aftermarket_new', [image], false), /data-index='0'/);
  scope.currentImages = [];
  vm.runInNewContext(segment('document.getElementById("panel").addEventListener("click"', 'document.getElementById("btn-open-image-actions")'), scope);
  clickHandler({ target: { closest: () => ({ dataset: { index: '0', salesImageKind: 'aftermarket_new' } }) } });
  assert.equal(scope.opened.index, 0);
  assert.equal(scope.opened.images[0], image);
  render('aftermarket_new', [], true);
  assert.equal(scope.renderedSalesImageGroups.aftermarket_new.length, 0);
});

test('an invalid gallery index never opens an empty black overlay', () => {
  const image = { id: 183 };
  const nodes = {
    fullscreen: { classList: { add() { scope.visible = true; }, remove() { scope.visible = false; } } },
    'fs-img': { complete: false, naturalWidth: 0 },
    'fs-loading': { textContent: '', hidden: true },
    'fs-counter': { textContent: '' },
    'fs-prev': { classList: { toggle() {} } },
    'fs-next': { classList: { toggle() {} } },
    'fs-thumbs': { innerHTML: '', querySelector: () => null },
  };
  const scope = {
    currentImages: [], activeFullscreenImages: null, fsIndex: 0, visible: false,
    document: { getElementById: id => nodes[id] },
    setSignedProductImageElementSource: (_element, row) => { scope.shown = row; },
    thumbImgHtml: () => '<img>',
    t: () => '読み込み中',
  };
  const gallery = vm.runInNewContext(`${segment('function fullscreenImageList()', 'function closeFullscreen()')}\n({ openFullscreen })`, scope);
  gallery.openFullscreen(0, []);
  gallery.openFullscreen(Number.NaN, [image]);
  assert.equal(scope.visible, false);
  gallery.openFullscreen(0, [image]);
  assert.equal(scope.visible, true);
  assert.equal(scope.shown, image);
  assert.equal(nodes['fs-counter'].textContent, '1 / 1');
  assert.equal(nodes['fs-loading'].hidden, false);
  assert.equal(nodes['fs-loading'].textContent, '読み込み中');
});
