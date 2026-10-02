const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testsDirectory = path.join(__dirname, '..', 'tests');
const tests = fs.readdirSync(testsDirectory)
  .filter(name => /^product-3d.*\.test\.(cjs|mjs)$/.test(name))
  .sort()
  .map(name => path.join(testsDirectory, name));
if (!tests.length) throw new Error('Product 3D tests are missing');
const result = spawnSync(process.execPath, ['--test', ...tests], {
  stdio: 'inherit',
  windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status === null ? 1 : result.status;
