const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8").replace(/\r\n/g,"\n");
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
const functions=[
  "isBusinessInspectionProfile","profileAccessRoleLabel","currentRoleDisplayLabel",
  "userAccessRoleCode","accessRoleCode","hasAccessRole","userPermissionOverrides",
  "userPermissionAllowed","isSystemAdmin","isCompanyAdminRole","canDelete","canUseProductPhotoTools",
  "canUseUserManagement","canAssignUserRole","canManageUser","canEditUserPermission",
  "canEditUserPermissionStates","permissionOverridesForRole","internalInviteRoleOptions",
  "internalAccessRoleOptionHtmlForCompany","accessRoleOptionHtmlForCompany","optionHtml",
  "userCompanyCode","optionLabel","accessScopeLabel","permissionOverviewUserContext",
  "currentPermissionEditRoleCode","openUserPermissionEditor","refreshUserPermissionEditor",
  "manufacturingCostBaseRoleByCode","manufacturingCostOptionalAllowedFor"
];
const roleArray=app.match(/var USER_ACCESS_ROLE_OPTIONS = \[[\s\S]*?\n\];/)[0];
const makeElement=()=>({innerHTML:"",textContent:"",disabled:false,value:"",
  className:"",classList:{add(){},toggle(){}}});
const elements=Object.fromEntries([
  "user-permission-edit-overlay","user-permission-edit-summary","user-permission-edit-role",
  "user-permission-edit-customer","user-permission-edit-message","user-permission-edit-role-note",
  "user-permission-edit-customer-field","user-permission-edit-preview","user-permission-edit-counts",
  "btn-user-permission-edit-save","user-permission-edit-guide"
].map(id=>[id,makeElement()]));
let previewContext;
const ctx={
  userProfile:null,currentUser:{id:"actor"},customerPortalSearchActive:false,
  USER_COMPANY_OPTIONS:[["daiko","大光電機"],["gltek","GLTEK"]],
  customerUserLinkMap:{},currentPermissionEditOverrides:{},
  accessRoleLabel:code=>code,roleLabel:role=>role,
  normalizeAccessRoleForCompany:code=>code,defaultAccessRoleForCompany:()=>"sales_viewer",
  skipAccessRoleForCompany:()=>false,managedStaffRoles:()=>[],
  hasOwnDepartmentUserScope:()=>false,esc:v=>String(v==null?"":v),
  isExternalViewer:()=>false,isCustomerPortalSearchMode:()=>false,customerOptionHtml:()=>"<option></option>",
  currentPermissionEditUser:()=>ctx.editorUser,
  permissionOverviewTableHtml:c=>{previewContext=c;return JSON.stringify(c.permissionOverrides);},
  permissionOverviewCountHtml:()=>"",setCspStyle:()=>{},
  document:{getElementById:id=>elements[id],querySelector:()=>makeElement()}
};
vm.createContext(ctx);vm.runInContext(roleArray+"\n"+functions.map(extract).join("\n"),ctx);
const fixed={"product.delete":false,"users.manage":true,"app_settings.manage":true,
  "price_research.schedule":true,"product_3d.manage":true,"product_3d.publish":true};
const ai={id:"ai",email:"ai@example.test",name:"AI",role:"system_admin",role_code:"system_admin",
  company_code:"daiko",group_name:"daiko",permission_profile_code:"business_inspection",
  permission_overrides:fixed};
const ordinary={id:"ordinary",role:"admin",role_code:"company_admin",company_code:"daiko",
  group_name:"daiko",permission_overrides:{}};
let checks=0;
function check(value,expected,label){assert.deepEqual(value,expected,label);checks++;}
ctx.userProfile=ai;
check(ctx.currentRoleDisplayLabel(),"業務点検","signed-in AI label");
check(ctx.isSystemAdmin(),true,"all existing administrator-only entry points remain compatible");
check(ctx.canDelete(),false,"product deletion is hidden/denied");
check(ctx.canUseUserManagement(),true,"user management is permitted");
check(ctx.canUseProductPhotoTools(),true,"AI business inspection can use photo tools");
check(ctx.canAssignUserRole("business_inspection"),false,"reserved profile cannot be assigned as a role");
check(ctx.USER_ACCESS_ROLE_OPTIONS.some(x=>x[0]==="business_inspection"||x[1]==="業務点検"),false,"ordinary role list has no AI profile");
check(ctx.internalInviteRoleOptions("daiko").some(x=>x[0]==="business_inspection"),false,"invitation list has no AI profile");
check(ctx.internalAccessRoleOptionHtmlForCompany("daiko","company_admin").includes("業務点検"),false,"ordinary internal selector excludes AI profile");
check(ctx.accessRoleOptionHtmlForCompany("daiko","company_admin").includes("業務点検"),false,"ordinary selector excludes AI profile");
check(ctx.canEditUserPermission(ai),false,"AI preset is read-only for itself");
check(ctx.canManageUser(ai),false,"AI preset cannot be changed through ordinary user editing");
ctx.userProfile={id:"actor",role:"system_admin",role_code:"system_admin",company_code:"daiko"};
check(ctx.canEditUserPermission(ai),false,"another administrator cannot edit the reserved AI preset");
check(ctx.canEditUserPermission(ordinary),true,"ordinary permission editing remains available");
check(ctx.canAssignUserRole("company_admin"),true,"ordinary role assignment remains available");
check(ctx.canUseProductPhotoTools(),false,"unmarked system administrator photo restriction remains");
check(ctx.canManageUser(ordinary),true,"ordinary user management remains available");
const clean=ctx.permissionOverridesForRole(ai,"system_admin",{"product.delete":true});
check(JSON.stringify(clean),JSON.stringify(fixed),"AI preview keeps server values instead of editable drafts");
clean["product.delete"]=true;
check(ai.permission_overrides["product.delete"],false,"preview copy cannot mutate the saved deny");
ctx.editorUser=ai;
ctx.openUserPermissionEditor(ai);
check(elements["user-permission-edit-role"].disabled,true,"reserved role display is disabled");
check(elements["user-permission-edit-role"].innerHTML.includes("業務点検"),true,"reserved editor uses the requested name");
check(elements["user-permission-edit-summary"].innerHTML.includes("業務点検"),true,"editor summary uses the requested name");
check(elements["user-permission-edit-guide"].textContent.includes("AI専用"),true,"reserved profile explanation");
check(previewContext.permissionOverrides["product.delete"],false,"permission preview retains product deletion deny");
check(previewContext.permissionOverrides["users.manage"],true,"permission preview retains allowed operations");
ctx.userProfile=ordinary;
check(ctx.currentRoleDisplayLabel(),"company_admin","ordinary role label unchanged");
check(ctx.canDelete(),true,"ordinary administrator deletion permission unchanged");
ctx.userProfile={...ai,permission_overrides:{"product.delete":true}};
check(ctx.canDelete(),false,"client-side malformed override cannot enable AI delete control");
check((extract("renderUserPermissionOverview").match(/profileAccessRoleLabel\(user\)/g)||[]).length,2,"permission list label and search both use profile name");
check(extract("renderUsers").includes("profileAccessRoleLabel(u)"),true,"user cards use profile name");
console.log("Business inspection permissions: "+checks+" checks passed");
module.exports={checks,passed:true};
