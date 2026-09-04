const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'shipment-instruction-print.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8').replace(/\r\n/g, '\n');
const documents = css.slice(css.indexOf('.document-core-return'), css.indexOf('@media print'));
const sizes = [...documents.matchAll(/font-size:\s*([\d.]+)pt/g)].map(match => Number(match[1]));
assert.ok(sizes.length > 25, 'Both document typography sets must be checked');
assert.ok(sizes.every(size => size >= 8), 'A5 document fonts must remain at least 8 pt before driver fitting');
assert.ok(Math.min(...sizes) * 0.9439 >= 7.4, 'Tray 4 output must meet the printed 7.4 pt minimum');
for (const selector of ['.warranty-identification .label', '.warranty-form-row .field-label', '.core-return-product dt', '.core-return-part-numbers span']) {
  const rule = documents.slice(documents.indexOf(selector + ' {')).split('}')[0];
  assert.ok(rule.includes('white-space: nowrap'), `${selector} must not break mid-label`);
}
assert.ok(!documents.includes('text-overflow: ellipsis'), 'Customer names must not be silently truncated');
assert.ok(app.includes("<h2><span>STEP 1</span>交換したコアを準備</h2><p>分解せずにそのまま袋に入れる</p>"), 'Core preparation must use the approved bagging instruction');
const start = app.indexOf("<section class='warranty-terms'>");
const end = app.indexOf("<div class='warranty-bottom-rules'>", start);
assert.ok(start > 0 && end > start, 'Warranty terms are missing');
assert.equal(crypto.createHash('sha256').update(app.slice(start, end)).digest('hex'), '492167bbe72607384e0358e13f3d8a134d94bf00e225f1d0cd6e5a02e9d7a325', 'Approved warranty and legal content must not change during typography updates');
console.log('Readable A5 typography, complete warranty terms and identifier wrapping contracts passed.');
