const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const acorn = require("acorn");
const XLSX = require("../vendor/xlsx-0.20.3.full.min.js");
const { chromium } = require(process.env.WARRANTY_PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const app = await fs.readFile("app.js", "utf8");
  const index = await fs.readFile("index.html", "utf8");
  const assets = Object.fromEntries(await Promise.all([
    ["styles.css", "text/css"],
    ["assets/core-pending-export.js", "application/javascript"],
    ["vendor/fflate-0.8.2.js", "application/javascript"]
  ].map(async ([name, type]) => ["/" + name, { body: await fs.readFile(name), contentType: type }])));
  const names = ["corePendingExportSnapshot", "showCorePendingExportError", "printCorePendingStock", "exportCorePendingExcel"];
  const ast = acorn.parse(app, { ecmaVersion: "latest" });
  const funcs = ast.body.filter(node => node.type === "FunctionDeclaration" && names.includes(node.id.name));
  assert.equal(funcs.length, names.length);
  const buttons = index.match(/<div id="core-pending-outputs">.*?<\/div>/)[0];
  const data = Array.from({ length: 73 }, (_, index) => ({
    source_sheet: index < 70 ? "セルモーター" : index < 72 ? "オルタネーター" : null,
    source_row: index + 5,
    quantity: index === 72 ? 0 : 2,
    pallet_no: String(index).padStart(4, "0"),
    source_part_number: index === 0 ? "=001+2" : "PN-" + index,
    source_remarks: "検査メモ < & > " + String(index)
  }));
  const harness = [
    'var coreListMode = "pending", coreManagementDataReady = true;',
    "var corePendingStockFiltered = " + JSON.stringify(data) + ";",
    "var canViewCoreManagement = () => true;",
    'var t = (key) => ({core_pending_tab:"照合待ち",core_pallet_manual:"手入力",core_pending_export_filename:"GLTEK_コア照合待ち"})[key] || key;',
    'var tf = (key, v) => v.date + " " + v.count + "明細・" + v.qty + "台";',
    'window.print = () => { document.body.dataset.printOpened = "true"; };',
    ...funcs.map(node => app.slice(node.start, node.end)),
    'for (const [id, handler] of [["print", printCorePendingStock], ["excel", exportCorePendingExcel]]) {',
    '  const button = document.getElementById("btn-core-pending-" + id);',
    '  button.disabled = false; button.addEventListener("click", handler);',
    "}"
  ].join("\n");
  const html = '<!doctype html><html lang="ja"><meta charset="utf-8"><title>D-CATS</title>' +
    '<link rel="stylesheet" href="/styles.css"><body><main id="screen-core-list-mgmt" class="active">' +
    buttons + '<p id="core-pallet-save-status" hidden></p></main><section id="core-pending-print-sheet" hidden></section>' +
    '<script src="/vendor/fflate-0.8.2.js"></script><script src="/assets/core-pending-export.js"></script>' +
    '<script src="/harness.js"></script></body></html>';
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://core-export.test/**", route => {
      const url = new URL(route.request().url());
      const body = url.pathname === "/" ? { body: html, contentType: "text/html; charset=utf-8" }
        : url.pathname === "/harness.js" ? { body: harness, contentType: "application/javascript; charset=utf-8" }
          : assets[url.pathname];
      return route.fulfill({ status: body ? 200 : 404, ...body });
    });
    await page.goto("https://core-export.test");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Excel出力", exact: true }).click()
    ]);
    assert.match(download.suggestedFilename(), /^GLTEK_コア照合待ち_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const bytes = await fs.readFile(await download.path());
    const workbook = XLSX.read(bytes, { type: "buffer", cellStyles: true });
    assert.deepEqual(workbook.SheetNames, ["セルモーター", "オルタネーター", "区分未設定"]);
    const starter = workbook.Sheets["セルモーター"];
    assert.equal(starter.C4.v, "品番 / Part No.");
    assert.equal(starter.C4.s.fgColor.rgb, "1F4E78");
    assert.equal(starter.B5.v, "0000");
    assert.equal(starter.C5.t, "s");
    assert.equal(starter.C5.v, "=001+2");
    assert.equal(starter.C74.v, "PN-69");
    assert.equal(starter.D76.v, 140);
    assert.equal(workbook.Sheets["オルタネーター"].D8.v, 4);
    assert.equal(workbook.Sheets["区分未設定"].D5.v, 0);

    await page.getByRole("button", { name: "印刷・PDF", exact: true }).click();
    assert.equal(await page.locator("body").getAttribute("data-print-opened"), "true");
    await page.emulateMedia({ media: "print" });
    const report = page.locator("#core-pending-print-sheet");
    assert.equal(await report.locator("tbody tr").count(), 73);
    assert.equal(await report.getByText("PN-72", { exact: true }).count(), 1);
    assert.equal(await report.isVisible(), true);
    assert.equal(await page.locator("#screen-core-list-mgmt").isVisible(), false);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    assert.match(pdf.subarray(0, 8).toString(), /^%PDF-/);
    assert.ok((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length > 1, "across print pages");
    const dir = process.env.WARRANTY_QA_OUTPUT;
    if (dir) {
      await fs.mkdir(dir, { recursive: true });
      await Promise.all([fs.writeFile(path.join(dir, "core-pending.xlsx"), bytes),
        fs.writeFile(path.join(dir, "core-pending.pdf"), pdf)]);
    }
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    assert.equal(await page.title(), "D-CATS");
    assert.equal(await report.locator("tbody tr").count(), 0);
    assert.deepEqual(errors, []);
    console.log("Core pending export: Excel content and multi-page PDF passed.");
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
