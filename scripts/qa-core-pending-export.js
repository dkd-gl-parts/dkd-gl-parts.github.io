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
    ["assets/core-pallet-entry.js", "application/javascript"],
    ["vendor/fflate-0.8.2.js", "application/javascript"]
  ].map(async ([name, type]) => ["/" + name, { body: await fs.readFile(name), contentType: type }])));
  const names = ["corePendingExportSnapshot", "showCorePendingExportError", "printCoreSheet", "printCorePendingStock", "exportCorePendingExcel",
    "canPrintCoreCollection", "openCoreCollectionPrint", "buildCoreCollectionPrintContent", "printCoreCollection", "esc"];
  const ast = acorn.parse(app, { ecmaVersion: "latest" });
  const funcs = ast.body.filter(node => node.type === "FunctionDeclaration" && names.includes(node.id.name));
  assert.equal(funcs.length, names.length);
  const dialogs = ["entry", "match"].map(name => {
    const start = index.indexOf('<dialog id="core-pallet-' + name + '-dialog"');
    return index.slice(start, index.indexOf("</dialog>", start) + 9);
  }).join("");
  const buttons = '<div id="core-pending-outputs">' + index.match(/<div id="core-pending-outputs" hidden>(.*?)<\/div>/)[1] + '</div>';
  const collectionButton = index.match(/<button[^<>]*id="btn-core-collection-print"[^<>]*>[^<>]*<\/button>/)[0];
  const collectionDialogStart = index.indexOf('<dialog id="core-collection-print-dialog"');
  const collectionDialog = index.slice(collectionDialogStart, index.indexOf("</dialog>", collectionDialogStart) + 9);
  const collection = Array.from({ length: 73 }, (_, index) => ({
    dkd_shohin_id: index + 1,
    target_quantity: index === 0 ? 300 : index === 1 ? 0 : index,
    maker: index === 0 ? "QA-000001-VERY-LONG-PART<&>" : "QA-COLLECTION-" + index,
    genuine: "OEM-" + index,
    vehicle: index === 0 ? "軽四・乗用車・トラック・商用バン・バス・建機・農機・その他" : "未分類",
    ranking: index === 72 ? null : { shipment: index === 0 ? 354 : index === 1 ? 158 : index },
    categoryRank: index === 72 ? null : index + 1
  }));
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
    "var coreCollectionFilteredRows = " + JSON.stringify(collection) + ";",
    'var t = (key) => ({core_pending_tab:"照合待ち",core_pallet_manual:"手入力",core_pending_export_filename:"GLTEK_コア照合待ち",',
    '  core_collection_print_title:"コアリスト",core_collection_rank_label:"カテゴリ内順位",core_pallet_col_part:"品番",',
    '  core_collection_print_vehicle:"車両区分",core_collection_print_required:"必要数"})[key] || key;',
    'var tf = (key, v) => key === "core_collection_print_count" ? "対象 " + v.count + " 件" : v.date + " " + v.count + "明細・" + v.qty + "台";',
    'var coreCollectionDisplayProduct = row => ({manufacturer_part_number:row.maker,genuine_part_number:row.genuine});',
    'var coreCollectionRank = row => row.ranking, coreCollectionCategoryRank = row => row.categoryRank;',
    'var productionCategoryLabel = () => "スタータ", renderCoreCollectionVehicleHtml = row => esc(row.vehicle);',
    'window.print = () => { document.body.dataset.printOpened = "true"; };',
    ...funcs.map(node => app.slice(node.start, node.end)),
    'for (const [id, handler] of [["print", printCorePendingStock], ["excel", exportCorePendingExcel]]) {',
    '  const button = document.getElementById("btn-core-pending-" + id);',
    '  button.disabled = false; button.addEventListener("click", handler);',
    "}",
    'const collectionPrint = document.getElementById("btn-core-collection-print");',
    'collectionPrint.disabled = false; collectionPrint.addEventListener("click", openCoreCollectionPrint);',
    'document.getElementById("btn-confirm-core-collection-print").addEventListener("click", printCoreCollection);',
    'const palletForm = window.DcatsCorePallet({translate:t, canEdit:() => true, pendingRows:() => [], openLinked:() => {},',
    '  write: async (params) => {document.body.dataset.quantityWrite = JSON.stringify(params); return {data:{affected:params.p_rows}};},',
    '  refresh: async () => {}, search: async (q) => {document.body.dataset.quantityLookup = q; return {data:[]};}});',
    'document.getElementById("qa-pallet-entry").addEventListener("click", palletForm.openEntry);',
    'document.getElementById("qa-pallet-adjust").addEventListener("click", () => palletForm.openMatch({entry_key:"qa", revision:1,',
    '  pallet_no:"QA-P-001", source_part_number:"000001", quantity:4}));'
  ].join("\n");
  const html = '<!doctype html><html lang="ja"><meta charset="utf-8"><title>D-CATS</title>' +
    '<link rel="stylesheet" href="/styles.css"><body><main id="screen-core-list-mgmt" class="active">' +
    buttons + collectionButton + '<button id="qa-pallet-entry">数量登録の検査</button><button id="qa-pallet-adjust">数量調整の検査</button>' +
    '<p id="core-pallet-save-status" hidden></p></main><section id="core-pending-print-sheet" hidden></section>' +
    '<section id="core-collection-print-sheet" hidden></section>' + dialogs + collectionDialog +
    '<script src="/assets/core-pallet-entry.js"></script>' +
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

    await page.locator("#btn-core-pending-print").click();
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
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => { coreListMode = "collection"; });
    await page.locator("#btn-core-collection-print").click();
    const printDialog = page.getByRole("dialog", { name: "コアリスト", exact: true });
    assert.equal(await printDialog.getByRole("combobox").count(), 0);
    assert.match(await printDialog.innerText(), /対象 73 件/);
    await printDialog.getByRole("button", { name: "印刷・PDF", exact: true }).click();
    assert.equal(await printDialog.isVisible(), false);
    assert.equal(await page.title(), "コアリスト");
    await page.emulateMedia({ media: "print" });
    const collectionReport = page.locator("#core-collection-print-sheet");
    const collectionRows = collectionReport.locator("tbody tr");
    assert.equal(await collectionReport.isVisible(), true);
    assert.equal(await page.locator("#screen-core-list-mgmt").isVisible(), false);
    assert.equal(await collectionReport.getByRole("heading", { name: "コアリスト", exact: true }).count(), 1);
    assert.deepEqual(await collectionReport.getByRole("columnheader").allTextContents(),
      ["カテゴリ内順位", "品番", "車両区分", "必要数"]);
    assert.equal(await collectionRows.count(), 73);
    assert.match(await collectionRows.first().locator("td").nth(1).innerText(), /QA-000001-VERY-LONG-PART<&>/);
    assert.deepEqual(await collectionRows.first().locator("td").allTextContents().then(cells => cells.slice(2)),
      ["軽四・乗用車・トラック・商用バン・バス・建機・農機・その他", "300"]);
    assert.equal(await collectionRows.nth(1).locator("td").last().textContent(), "0");
    assert.equal(await collectionRows.last().locator("td").last().textContent(), "72");
    async function verifyCollectionLayout(paperWidthMm) {
      await page.setViewportSize({ width: Math.floor(paperWidthMm * 96 / 25.4), height: 1100 });
      const layout = await collectionReport.evaluate(report => {
        const table = report.querySelector("table");
        const rows = [...table.rows];
        const overflow = rows.some(row => [...row.cells].some(cell => {
          const box = cell.getBoundingClientRect();
          const text = document.createRange();
          text.selectNodeContents(cell);
          return [...text.getClientRects()].some(rect => rect.left < box.left - 0.5 || rect.right > box.right + 0.5);
        }));
        return {
          width: table.getBoundingClientRect().width,
          availableWidth: report.getBoundingClientRect().width,
          highestRow: Math.max(...rows.map(row => row.getBoundingClientRect().height)),
          repeatedHeader: getComputedStyle(table.tHead).display,
          overflow
        };
      });
      assert.ok(layout.width <= layout.availableWidth + 1, JSON.stringify(layout));
      assert.ok(layout.highestRow <= 20, JSON.stringify(layout));
      assert.equal(layout.repeatedHeader, "table-header-group");
      assert.equal(layout.overflow, false);
    }
    await verifyCollectionLayout(194);
    assert.equal(await collectionReport.locator(".core-collection-print-wide").count(), 0);
    const collectionPdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    assert.match(collectionPdf.subarray(0, 8).toString(), /^%PDF-/);
    assert.equal((collectionPdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length, 2);
    if (dir) await fs.writeFile(path.join(dir, "core-collection.pdf"), collectionPdf);
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    assert.equal(await page.title(), "D-CATS");
    assert.equal(await collectionRows.count(), 0);
    await page.emulateMedia({ media: "screen" });

    await page.evaluate(() => { coreCollectionFilteredRows[0].target_quantity = 4; });
    await page.locator("#btn-core-collection-print").click();
    await printDialog.getByRole("button", { name: "印刷・PDF", exact: true }).click();
    assert.equal(await collectionRows.first().locator("td").last().textContent(), "4");
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));

    await page.evaluate(() => {
      const row = coreCollectionFilteredRows[0];
      coreCollectionFilteredRows = [{ ...row, maker: "W".repeat(46), genuine: "8".repeat(23) }];
    });
    await page.locator("#btn-core-collection-print").click();
    await printDialog.getByRole("button", { name: "印刷・PDF", exact: true }).click();
    await page.emulateMedia({ media: "print" });
    assert.equal(await collectionReport.locator(".core-collection-print-wide").count(), 1);
    await verifyCollectionLayout(281);
    assert.equal(await collectionRows.first().locator("td").nth(1).textContent(), "W".repeat(46) + " / " + "8".repeat(23));
    const widePdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const [, width, height] = widePdf.toString("latin1").match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/) || [];
    assert.ok(Number(width) > Number(height), "Wide content must use a landscape page");
    if (dir) await fs.writeFile(path.join(dir, "core-collection-wide.pdf"), widePdf);
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await page.emulateMedia({ media: "screen" });

    await page.getByRole("button", { name: "数量登録の検査", exact: true }).click();
    const entry = page.locator("#core-pallet-entry-dialog");
    const qty = entry.locator('[data-field="quantity"]');
    await entry.locator('[data-field="pallet_no"]').fill("QA-P-001");
    await entry.locator('[data-field="part_number"]').fill("000001");
    await qty.pressSequentially("12");
    assert.equal(await qty.inputValue(), "12");
    for (const rejected of ["１２３４５６７８９０", "1,23", "1.5", "-1", "０"]) {
      await qty.fill(rejected);
      await entry.locator("#core-pallet-entry-save").click();
      assert.equal(await qty.getAttribute("aria-invalid"), "true");
      assert.equal(await qty.evaluate(input => input === document.activeElement), true);
      assert.equal(await page.locator("body").getAttribute("data-quantity-write"), null);
    }
    await qty.fill("　１，２３４　");
    assert.equal(await qty.inputValue(), "　1,234　");
    assert.equal(await qty.getAttribute("aria-invalid"), null);
    await entry.locator("#core-pallet-entry-save").click();
    const registration = JSON.parse(await page.locator("body").getAttribute("data-quantity-write"));
    assert.equal(registration.p_action, "add");
    assert.deepEqual(registration.p_rows, [{ pallet_no: "QA-P-001", part_number: "000001", quantity: 1234, note: "" }]);

    await page.getByRole("button", { name: "数量調整の検査", exact: true }).click();
    const adjustQty = page.locator("#core-pallet-adjust-qty");
    assert.equal(await adjustQty.getAttribute("type"), "text");
    assert.equal(await adjustQty.inputValue(), "4");
    assert.equal(await adjustQty.isVisible(), true);
    assert.equal(await page.locator("#core-pallet-mode-adjust").getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#core-pallet-link-controls").isVisible(), false);
    assert.equal(await page.locator("body").getAttribute("data-quantity-lookup"), null);
    await page.locator("#core-pallet-mode-link").click();
    assert.equal(await page.locator("#core-pallet-link-search").inputValue(), "000001");
    assert.equal(await page.locator("#core-pallet-match-save").getAttribute("data-i18n"), "core_pallet_save_link");
    await page.locator("#core-pallet-link-find").click();
    assert.equal(await page.locator("body").getAttribute("data-quantity-lookup"), "000001");
    await page.locator("#core-pallet-mode-adjust").click();
    assert.equal(await adjustQty.isVisible(), true);
    assert.equal(await page.locator("#core-pallet-match-save").getAttribute("data-i18n"), "core_pallet_save_adjust");
    await adjustQty.fill("０");
    assert.equal(await adjustQty.inputValue(), "0");
    await page.locator("#core-pallet-adjust-reason").fill("QA");
    await page.locator("#core-pallet-match-save").click();
    const adjustment = JSON.parse(await page.locator("body").getAttribute("data-quantity-write"));
    assert.equal(adjustment.p_action, "adjust");
    assert.equal(adjustment.p_rows[0].quantity, 0);
    assert.deepEqual(errors, []);
    console.log("Core export: compact 73-row PDF (2 portrait pages), landscape fallback, pending PDF, Excel and quantity entry passed.");
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
