const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const viewer = fs.readFileSync(path.join(__dirname, '..', 'product-3d-viewer.js'), 'utf8');
const orbit = fs.readFileSync(path.join(__dirname, '..', 'vendor', 'three', 'examples', 'jsm', 'controls', 'OrbitControls.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

function viewerAction(name) {
  const match = viewer.match(new RegExp(`${name}\\(\\) \\{([\\s\\S]*?)\\n    \\},`));
  assert.ok(match, `${name} must remain available in the common viewer`);
  return `${name === 'fullscreen' ? 'async ' : ''}${name}() {${match[1]}\n    }`;
}

test('Viewer zoom buttons move the camera in the labeled direction', () => {
  // Guard the exact semantics of the vendored controls. A future Three.js
  // upgrade must re-check the viewer action scales instead of trusting names.
  assert.match(orbit, /_dollyIn\( dollyScale \) \{[\s\S]*?this\._scale \*= dollyScale;/);
  assert.match(orbit, /_dollyOut\( dollyScale \) \{[\s\S]*?this\._scale \/= dollyScale;/);
  let distance = 10;
  const context = {
    homeView: true,
    controls: {
      dollyIn(scale) { distance *= scale; },
      dollyOut(scale) { distance /= scale; },
    },
  };
  const actions = vm.runInNewContext(`({${viewerAction('zoomIn')},${viewerAction('zoomOut')}})`, context);
  actions.zoomIn();
  assert.ok(distance < 10, 'zoom in must move closer');
  assert.equal(context.homeView, false);
  actions.zoomOut();
  assert.ok(Math.abs(distance - 10) < 1e-10, 'zoom out must move farther by the same step');
});

test('Viewer fullscreen fills the viewport and toggles only its own shell', async () => {
  assert.match(styles, /\.product-3d-viewer-shell:fullscreen\s*\{[^}]*width:\s*100vw;[^}]*height:\s*100dvh;/);
  assert.match(styles, /\.product-3d-viewer-shell:fullscreen \.product-3d-viewer-stage\s*\{[^}]*flex:\s*1 1 auto;/);
  let active = null;
  let exits = 0;
  const shell = { requestFullscreen: async () => { active = shell; } };
  const document = {
    get fullscreenElement() { return active; },
    async exitFullscreen() { exits++; active = null; },
  };
  const actions = vm.runInNewContext(`({${viewerAction('fullscreen')}})`, {
    options: { fullscreenElement: shell }, host: {}, document,
  });
  await actions.fullscreen();
  assert.equal(active, shell);
  await actions.fullscreen();
  assert.equal(active, null);
  assert.equal(exits, 1);
  const unrelated = {};
  active = unrelated;
  await actions.fullscreen();
  assert.equal(active, unrelated, 'another fullscreen view must remain untouched');
  assert.equal(exits, 1);
});
