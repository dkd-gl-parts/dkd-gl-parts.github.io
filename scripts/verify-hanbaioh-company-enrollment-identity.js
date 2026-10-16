const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const source=app.slice(app.indexOf('async function verifyDcatsCompanyAccountIdentity('),app.indexOf('function updateDcatsCompanyIntegrationControls('));
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
function fixture(mode={}){
  const stats={session:0,refresh:0,user:0,preflight:0,enroll:0,logout:0,focus:0};
  const nodes=new Map();for(const id of ['dcats-business-workspace-account-register','dcats-business-workspace-account-status','dcats-business-workspace-account-sign-in','dcats-business-workspace-settings-overlay','login-email'])nodes.set(id,{hidden:id.endsWith('sign-in'),disabled:false,classList:{contains:()=>true},setAttribute(){},removeAttribute(){},focus(){stats.focus++;}});
  const valid=()=>({data:{session:{user:{id:actor},expires_at:Date.now()/1000+3600}}});
  const failure=()=>({data:{session:null,user:null},error:{status:mode.network?503:403,name:'AuthApiError',message:'DO-NOT-ECHO'}});
  const ctx={window:{DcatsHanbaiohCompanyBridge:{enrollAccountFromPc:async()=>{stats.enroll++;if(mode.server401)throw Error('company_authentication_required');return{status:'enrolled',replaced:!!mode.replacing};}}},
    currentUser:{id:actor},isSystemAdmin:()=>!mode.unauthorized,dcatsCompanyIntegrationEpoch:1,dcatsCompanyAccountBusy:false,dcatsCompanyIntegrationBusy:false,dcatsCompanyBackupBusy:false,
    document:{getElementById:id=>nodes.get(id)},t:key=>key,updateDcatsCompanyIntegrationControls(){},syncDcatsCompanyAccountControls(){},refreshDcatsIntegrationReadinessAutomatically(){},
    ensureDcatsIntegrationBeforeAction:async()=>{stats.preflight++;return{ok:true};},doLogout:async()=>{stats.logout++;ctx.currentUser=null;},
    sb:{auth:{getSession:async()=>{stats.session++;if(mode.noSession)return{data:{session:null}};if(mode.sessionFailure||mode.network)return failure();const v=valid();if(mode.nearExpiry)v.data.session.expires_at=Date.now()/1000+10;if(mode.wrongSession)v.data.session.user.id=other;return v;},
      refreshSession:async()=>{stats.refresh++;if(mode.changedDuringRefresh)ctx.currentUser={id:other};return mode.refreshFailure?failure():valid();},
      getUser:async()=>{stats.user++;if(mode.changedDuringUser)ctx.currentUser={id:other};return mode.revoked?failure():{data:{user:{id:mode.wrongUser?other:actor,is_anonymous:!!mode.anonymous}}};}}}};
  vm.createContext(ctx);vm.runInContext(source,ctx);return{ctx,stats,nodes,run:()=>ctx.registerDcatsCompanyAccount()};
}
(async()=>{
  for(const replacing of [false,true]){const f=fixture({replacing});await f.run();assert.equal(f.stats.user,1);assert.equal(f.stats.refresh,0);assert.equal(f.stats.enroll,1);assert.equal(f.nodes.get('dcats-business-workspace-account-status').textContent,replacing?'business_workspace_account_updated':'business_workspace_account_saved');}
  const refreshed=fixture({nearExpiry:true});await refreshed.run();assert.equal(refreshed.stats.refresh,1);assert.equal(refreshed.stats.user,1);assert.equal(refreshed.stats.enroll,1);
  for(const settings of [{noSession:true},{sessionFailure:true},{wrongSession:true},{revoked:true},{wrongUser:true},{anonymous:true},{nearExpiry:true,refreshFailure:true}]){
    const f=fixture(settings);await f.run();assert.equal(f.stats.enroll,0);assert.equal(f.stats.preflight,0);assert(f.stats.refresh<=1);assert.equal(f.nodes.get('dcats-business-workspace-account-sign-in').hidden,false);assert.equal(f.nodes.get('dcats-business-workspace-account-status').textContent,'business_workspace_account_authentication_required');
    await f.ctx.signInAgainForDcatsCompanyAccount();assert.equal(f.stats.logout,1);assert.equal(f.stats.focus,1);assert.equal(f.stats.enroll,0);
  }
  for(const settings of [{network:true},{changedDuringUser:true},{nearExpiry:true,changedDuringRefresh:true},{unauthorized:true}]){
    const f=fixture(settings);await f.run();assert.equal(f.stats.enroll,0);assert.equal(f.stats.preflight,0);assert.equal(f.nodes.get('dcats-business-workspace-account-sign-in').hidden,true);assert(!f.ctx.dcatsCompanyAccountBusy);
  }
  const server=fixture({server401:true});await server.run();assert.equal(server.stats.enroll,1);assert.equal(server.stats.refresh,0);assert.equal(server.nodes.get('dcats-business-workspace-account-sign-in').hidden,false);
  const hidden=fixture();await hidden.ctx.signInAgainForDcatsCompanyAccount();assert.equal(hidden.stats.logout,0);
  assert.doesNotMatch(source,/access_token|refresh_token|console\.|localStorage|sessionStorage|JSON\.stringify/);
  assert(app.includes('dcats-business-workspace-account-sign-in").addEventListener("click", signInAgainForDcatsCompanyAccount)'));
  console.log('Company password enrollment identity: SDK refresh, fresh user check, revoked session sign-in, owner change, no native retry or credential logging: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
