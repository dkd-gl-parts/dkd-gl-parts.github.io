const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
for (const args of [['--check','account-operation-workspace.js'], ['--test','tests/account-operation-workspace.test.cjs']]) {
  const result = spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',shell:false,windowsHide:true});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Account workspace verification failed');
}
