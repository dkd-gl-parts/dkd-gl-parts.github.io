const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const {parseHTML}=require("linkedom");
const {chromium}=require(process.env.WARRANTY_PLAYWRIGHT_MODULE||"playwright");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"app.js"),"utf8").replace(/\r\n/g,"\n");
function extract(name){
  const start=app.indexOf("function "+name+"(");
  assert.ok(start>=0,"missing "+name);
  let i=app.indexOf("{",start),depth=0,quote="",escape=false,line=false,block=false;
  for(;i<app.length;i++){
    const c=app[i],n=app[i+1];
    if(line){if(c==="\n")line=false;continue;}
    if(block){if(c==="*"&&n==="/"){block=false;i++;}continue;}
    if(quote){if(escape){escape=false;continue;}if(c==="\\"){escape=true;continue;}if(c===quote)quote="";continue;}
    if(c==="/"&&n==="/"){line=true;i++;continue;}
    if(c==="/"&&n==="*"){block=true;i++;continue;}
    if(c==="'"||c==='"'||c==="`"){quote=c;continue;}
    if(c==="{")depth++;
    if(c==="}"&&--depth===0)return app.slice(start,i+1);
  }
  throw Error("Unclosed "+name);
}

const names=[...new Set(["isBusinessInspectionProfile","profileAccessRoleLabel","currentRoleDisplayLabel","userAccessRoleCode","accessRoleCode","hasAccessRole","userPermissionOverrides","userPermissionAllowed","isSystemAdmin","isCompanyAdminRole","canDelete","canUseUserManagement","canAssignUserRole","canManageUser","canEditUserPermission","canEditUserPermissionStates","permissionOverridesForRole","internalInviteRoleOptions","internalAccessRoleOptionHtmlForCompany","accessRoleOptionHtmlForCompany","optionHtml","userCompanyCode","optionLabel","accessScopeLabel","permissionOverviewUserContext","currentPermissionEditRoleCode","openUserPermissionEditor","refreshUserPermissionEditor","manufacturingCostBaseRoleByCode","manufacturingCostOptionalAllowedFor"].concat(
  [...app.matchAll(/^function (permissionOverview\w+|applyPermissionOverviewOverride|manufacturingCostPermissionNote|customerPortalDefaultEnabled|accessRoleScopeText)\(/gm)].map(m=>m[1]),
  ["accessRoleLabel","roleLabel","esc","setCspStyle","closeUserPermissionEditor"]
))];
const functions=names.map(extract).join("\n");
const roleArray=app.match(/var USER_ACCESS_ROLE_OPTIONS = \[[\s\S]*?\n\];/)[0];
const cspMap=app.match(/var DCATS_CSP_STYLE_MAP = \{[\s\S]*?\n\};/)[0];
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const {document}=parseHTML(html);
const overlay=document.getElementById("user-permission-edit-overlay");
assert.ok(overlay,"real permission editor markup");
const out=path.join(process.env.WARRANTY_QA_OUTPUT||path.join(root,"outputs"),"business-inspection");
fs.mkdirSync(out,{recursive:true});
const preset={"product_search.view":true,"product_info.view":true,"sales_price.view":true,"purchase_price.view":true,"product.manage":true,"image.manage":true,"product_3d.manage":true,"product_3d.publish":true,"product_management.view":true,"product.delete":false,"component_name.manage":true,"component_compatibility.manage":true,"production.view":true,"component.view":true,"component.manage":true,"finished_label.manage":true,"finished_product_shipping.manage":true,"sales_order.manage":true,"core_list.view":true,"production_records.manage":true,"used_core_image.manage":true,"stock.view":true,"stock.manage":true,"manufacturing_cost.use":true,"manufacturing_cost.manage":true,"manufacturing_report.view":true,"compatibility.view":true,"compatibility.manage":true,"sales_pricing.view":true,"sales_pricing.manage":true,"base_price.view":true,"base_price.manage":true,"purchase_management.view":true,"purchase.manage":true,"price_research.view":true,"price_research.manage":true,"price_research.schedule":true,"customer_access.manage":true,"users.manage":true,"operation_logs.view":true,"app_settings.manage":true,"gltek_part_number.issue":true};
(async()=>{
  const browser=await chromium.launch({headless:true});
  const results=[],errors=[],requests=[];
  try{
    const page=await browser.newPage();
    page.on("pageerror",e=>errors.push(String(e)));
    page.on("request",r=>requests.push(r.url()));
    await page.route("**/*",route=>route.abort());
    for(const width of [1280,390,320]){
      await page.setViewportSize({width,height:960});
      await page.setContent('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><p id="qa-role"></p><select id="qa-normal-selector" aria-label="通常ユーザーの権限"></select><button id="qa-open" type="button">権限を確認</button>'+overlay.outerHTML+'</body></html>');
      await page.addStyleTag({content:fs.readFileSync(path.join(root,"styles.css"),"utf8")});
      await page.addScriptTag({content:`
        var currentLang="ja";
        var PRODUCT_3D_DEVELOPMENT_PAUSED=true;
        var USER_COMPANY_OPTIONS=[["daiko","大光電機"],["gltek","GLTEK"]];
        var customerPortalSearchActive=false;
        var currentPermissionEditUserId=null;
        var currentPermissionEditOverrides={};
        var customerUserLinkMap={};
        var ai={id:"synthetic-ai",name:"AI確認アカウント",email:"ai@example.test",role:"system_admin",role_code:"system_admin",company_code:"daiko",group_name:"daiko",permission_profile_code:"business_inspection",permission_overrides:${JSON.stringify(preset)}};
        var ordinary={id:"synthetic-other",name:"通常の会社管理者",email:"ordinary@example.test",role:"admin",role_code:"company_admin",company_code:"daiko",group_name:"daiko",permission_overrides:{}};
        var userProfile=ai,currentUser={id:ai.id},fixtureTarget=ai;
        function t(k){return k;}
        function normalizeAccessRoleForCompany(code){return code;}
        function defaultAccessRoleForCompany(){return "sales_viewer";}
        function skipAccessRoleForCompany(){return false;}
        function managedStaffRoles(){return [];}
        function hasOwnDepartmentUserScope(){return false;}
        function customerOptionHtml(){return "<option></option>";}
        function currentPermissionEditUser(){return fixtureTarget;}
        ${cspMap}\n${roleArray}\n${functions}
        document.getElementById("qa-role").textContent=currentRoleDisplayLabel();
        document.getElementById("qa-normal-selector").innerHTML=internalAccessRoleOptionHtmlForCompany("daiko","company_admin");
        document.getElementById("qa-open").addEventListener("click",function(){openUserPermissionEditor(fixtureTarget);});
        document.getElementById("btn-user-permission-edit-close").addEventListener("click",closeUserPermissionEditor);
      `});
      assert.equal(await page.locator("#qa-role").innerText(),"業務点検");
      const options=await page.locator("#qa-normal-selector option").allTextContents();
      assert.equal(options.includes("業務点検"),false);
      await page.locator("#qa-open").focus();await page.keyboard.press("Enter");
      assert.equal(await page.locator("#user-permission-edit-role").isDisabled(),true);
      assert.equal(await page.locator("#user-permission-edit-role option").innerText(),"業務点検");
      assert.equal(await page.locator("#btn-user-permission-edit-save").isVisible(),false);
      assert.ok((await page.locator("#user-permission-edit-guide").innerText()).includes("AI専用"));
      const deleted=page.locator("#user-permission-edit-preview tr").filter({hasText:"商品削除"});
      assert.equal(await deleted.count(),1);
      assert.equal(await deleted.locator(".permission-status-denied").innerText(),"個別停止");
      assert.equal(await page.evaluate(()=>canDelete()),false);
      assert.equal(await page.evaluate(()=>canAssignUserRole("business_inspection")),false);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"AI page horizontal overflow");
      await page.screenshot({path:path.join(out,"ai-"+width+".png"),fullPage:true});
      await page.locator("#btn-user-permission-edit-close").focus();await page.keyboard.press("Enter");
      assert.equal(await page.locator("#user-permission-edit-overlay").isVisible(),false);
      await page.evaluate(()=>{fixtureTarget=ordinary;});
      await page.locator("#qa-open").click();
      assert.equal(await page.locator("#user-permission-edit-role").isDisabled(),false);
      assert.equal((await page.locator("#user-permission-edit-role option").allTextContents()).includes("業務点検"),false);
      assert.equal(await page.locator("#btn-user-permission-edit-save").isVisible(),true);
      const ordinaryDelete=page.locator("#user-permission-edit-preview tr").filter({hasText:"商品削除"});
      assert.equal(await ordinaryDelete.locator(".permission-status-allowed").count(),1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"ordinary page horizontal overflow");
      await page.screenshot({path:path.join(out,"ordinary-"+width+".png"),fullPage:true});
      results.push({width,height:960,states:["AI label","AI read-only","delete denied","ordinary role options","ordinary edit","keyboard close"],passed:true});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    fs.writeFileSync(path.join(out,"results.json"),JSON.stringify({passed:true,synthetic:true,productionAuth:false,results,errors,requests},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
