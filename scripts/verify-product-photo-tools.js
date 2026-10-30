const {spawnSync}=require('node:child_process');
const path=require('node:path');
const result=spawnSync(process.execPath,['--test',path.join(__dirname,'../tests/product-photo-tools.test.cjs')],{stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
process.exitCode=result.status===null?1:result.status;
