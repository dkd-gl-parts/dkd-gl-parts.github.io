// Opt-in browser QA: node scripts/verify-product-3d-touch-browser.cjs
// Uses a synthetic, local-only GLB. No product, Auth, Storage, or paid API access.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fixtureServer = path.join(root, 'tests', 'serve-product-3d-fixture.cjs');
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dcats-product3d-touch-'));
let server;
let browser;
let socket;

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function until(read, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await delay(100);
  }
  throw new Error('Timed out waiting for the local browser fixture');
}

function launchServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, [fixtureServer], { cwd: root, windowsHide: true });
    let output = '';
    server.stdout.on('data', chunk => {
      output += chunk.toString();
      const url = output.match(/http:\/\/127\.0\.0\.1:\d+\/tests\/product-3d-viewer-fixture\.html/);
      if (url) resolve(url[0]);
    });
    server.once('error', reject);
    server.once('exit', code => reject(new Error('Fixture server exited: ' + code)));
  });
}

async function connect(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find(target => target.type === 'page');
  assert.ok(page, 'isolated Chrome must have a blank page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let serial = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error('CDP timeout: ' + method));
    }, 15000).unref();
  });
}

async function main() {
  assert.ok(fs.existsSync(chrome), 'Chrome executable not found; set CHROME_PATH');
  const url = await launchServer();
  browser = spawn(chrome, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-extensions',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank'
  ], { cwd: root, windowsHide: true, stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  const port = await until(() => fs.existsSync(portFile) &&
    Number(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]));
  const call = await connect(port);
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true
  });
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await call('Page.navigate', { url });
  async function evaluate(expression) {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  await until(async () => (await evaluate('document.querySelector("#result")?.textContent'))?.startsWith('PASS:'));
  const bounds = await evaluate(`(() => {
    const rect = document.querySelector('#stage canvas').getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  })()`);
  assert.ok(bounds.width >= 380 && bounds.height >= 400, 'mobile canvas must be visible');
  async function capture() {
    await delay(700); // OrbitControls damping must settle before comparison.
    const result = await call('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false,
      clip: { ...bounds, scale: 1 }
    });
    return result.data;
  }
  async function pixels(png) {
    return evaluate(`(async () => {
      const image = new Image(); image.src = 'data:image/png;base64,${png}';
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, 64, 64);
      return Array.from(context.getImageData(0, 0, 64, 64).data);
    })()`);
  }
  function difference(first, second) {
    let changed = 0;
    for (let i = 0; i < first.length; i += 4) {
      if (Math.abs(first[i] - second[i]) + Math.abs(first[i + 1] - second[i + 1]) +
          Math.abs(first[i + 2] - second[i + 2]) > 24) changed++;
    }
    return changed;
  }
  const before = await capture();
  const x = Math.round(bounds.x + bounds.width * 0.55);
  const y = Math.round(bounds.y + bounds.height * 0.52);
  const point = (px, py) => [{ x: px, y: py, id: 1 }];
  await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x, y) });
  for (let step = 1; step <= 8; step++) {
    await call('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: point(x - step * 14, y + step * 4)
    });
    await delay(25);
  }
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const after = await capture();
  const changed = difference(await pixels(before), await pixels(after));
  assert.ok(changed > 10, `touch drag did not visibly rotate the model (changed pixels: ${changed})`);
  await evaluate('document.querySelector("#reset").click()');
  const reset = await capture();
  const resetDifference = difference(await pixels(before), await pixels(reset));
  assert.ok(resetDifference < changed * 0.5,
    `reset did not return near the original view (${resetDifference} vs ${changed})`);
  const button = await evaluate(`(() => {
    const rect = document.querySelector('#fullscreen').getBoundingClientRect();
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
  })()`);
  await call('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: point(button.x, button.y)
  });
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await until(() => evaluate('document.fullscreenElement?.id === "stage"'), 3000);
  await call('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
  });
  await call('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
  });
  await delay(500);
  const escaped = !(await evaluate('Boolean(document.fullscreenElement)'));
  // Headless CDP may not deliver Escape to the browser's fullscreen chrome.
  // Do not report a product failure or claim physical-key QA from that case.
  if (!escaped) await evaluate('document.exitFullscreen()');
  assert.equal(await evaluate('Boolean(document.fullscreenElement)'), false);
  console.log(JSON.stringify({ result: 'PASS', viewport: '390x844', changedPixels: changed,
    resetDifference, fullscreenEntry: 'PASS', fullscreenEscape: escaped ? 'PASS' : 'UNVERIFIED', fixture: 'synthetic GLB',
    browser: 'headless Chrome touch emulation' }));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  if (browser && !browser.killed) browser.kill();
  if (server && !server.killed) server.kill();
  // Chrome can keep its profile locked briefly after its parent exits on Windows.
  for (const child of [browser, server]) {
    if (child && child.exitCode === null && child.signalCode === null) {
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)), delay(3000)
      ]);
    }
  }
  // Only remove this run's uniquely created, verified temp browser profile.
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (path.resolve(profile).startsWith(tempRoot) &&
      path.basename(profile).startsWith('dcats-product3d-touch-')) {
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
        break;
      } catch (error) {
        if (!['EPERM', 'EBUSY'].includes(error.code) || attempt === 11) {
          console.error('Local Chrome profile cleanup failed:', profile, error.code);
          process.exitCode = 1;
          break;
        }
        await delay(500);
      }
    }
  }
});
