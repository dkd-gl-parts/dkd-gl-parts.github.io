"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.WARRANTY_PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
const output = process.env.WARRANTY_QA_OUTPUT;
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      let networkRequests = 0;
      await context.route("**/*", route => { networkRequests++; return route.abort(); });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", e => errors.push(String(e)));
        await page.setContent("<!doctype html><html lang=ja><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><body></body></html>");
        await page.addStyleTag({ content: fs.readFileSync(path.join(root, "sales-slips-readonly.css"), "utf8") });
        await page.addScriptTag({ content: fs.readFileSync(path.join(root, "sales-slips-readonly.js"), "utf8") });
        await page.addScriptTag({ content: fs.readFileSync(path.join(root, "tests/sales-slips-readonly-cases.js"), "utf8") });
        const cases = await page.evaluate(() => window.runSalesSlipsReadonlyCases(document, window.DcatsSalesSlipsReadonly.create));
        cases.forEach(c => results.push({ viewport: viewport.width, ...c }));
        results.push({ viewport: viewport.width, name: "実通信なし・未処理例外なし", pass: networkRequests === 0 && errors.length === 0, errors });
        // Retain a representative synthetic screen for visual review and overflow measurement.
        await page.evaluate(async () => {
          const host = document.createElement("main"); host.className = "slip-body"; document.body.append(host);
          const row = { id:"9007199254740993",slip_number:"SYNTHETIC-READONLY-001",slip_type:"sale",original_slip_id:null,reversal_slip_id:null,
            selling_company_code:"SYN-A",customer_code:"00018",customer_name:"合成データ株式会社",billing_customer_code:"00018",recorded_on:"2026-11-11",
            tax_timing:"per_closing",tax_state:"pending_closing",amount_basis_jpy:"12000",net_amount_jpy:null,tax_jpy:null,total_jpy:null,item_count:1 };
          const controller = window.DcatsSalesSlipsReadonly.create({ host, currentUserId:() => "synthetic",canRead:() => true,active:() => true,
            rpc:async (name) => ({data:name === "list_sales_slips_readonly"
              ? {contract_version:1,posting_enabled:false,rows:[row],has_more:false,next_before_id:null}
              : {contract_version:1,posting_enabled:false,status:"found",slip:row,items:[{id:"1",line_no:1,line_kind:"product",product_label:"合成商品",quantity:1,
                unit_price_jpy:"12000",amount_jpy:"12000",tax_mode:"excluded",tax_rate_basis_points:1000,cost_state:"unknown",cost_total_jpy:null}]}}) });
          await controller.enter();
        });
        await page.getByRole("button", { name:"SYNTHETIC-READONLY-001", exact:true }).click();
        await page.getByRole("heading", { name:"SYNTHETIC-READONLY-001", exact:true }).waitFor();
        const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        results.push({ viewport: viewport.width, name:"画面全体に横はみ出しなし", pass: fits });
        if (output) {
          fs.mkdirSync(output,{recursive:true});
          await page.screenshot({path:path.join(output, "sales-slips-readonly-"+viewport.width+".png"),fullPage:true});
        }
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  if (output) fs.writeFileSync(path.join(output,"sales-slips-readonly-results.json"),JSON.stringify(results,null,2)+"\n");
  for (const r of results) console.log((r.pass?"PASS":"FAIL")+" ["+r.viewport+"] "+r.name+(r.error?" "+r.error:""));
  if (results.some(r=>!r.pass)) throw new Error("Sales slip read-only browser QA failed");
  console.log("Sales slip read-only browser QA: "+results.length+" passed; no authentication, DB, server, or production connection.");
})().catch(error=>{console.error(error);process.exitCode=1;});
