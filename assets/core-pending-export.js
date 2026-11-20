(function (root) {
  "use strict";

  var namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  var rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  var packageRel = "http://schemas.openxmlformats.org/package/2006/relationships";
  var columns = ["No.", "パレット No. / Pallet", "品番 / Part No.", "数量 / Qty (pcs)", "備考 / Remarks", "出典 / Source"];
  var widths = [6, 18, 26, 12, 40, 18];
  var categories = [
    ["セルモーター", "GLTEK セルモーター コアリスト / STARTER CORE LIST"],
    ["オルタネーター", "GLTEK オルタネーター コアリスト / ALTERNATOR CORE LIST"]
  ];

  function collect(rows, manualLabel) {
    var sheets = categories.map(function (pair) { return { name: pair[0], title: pair[1], rows: [] }; });
    var other = { name: "区分未設定", title: "GLTEK 区分未設定 コアリスト / OTHER CORE LIST", rows: [] };
    var total = 0;
    rows.forEach(function (row) {
      var sheet = sheets.find(function (item) { return item.name === row.source_sheet; }) || other;
      var quantity = Number(row.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("Invalid core quantity");
      total += quantity;
      sheet.rows.push([
        sheet.rows.length + 1,
        String(row.pallet_no ?? ""),
        String(row.source_part_number ?? ""),
        quantity,
        String(row.source_remarks ?? ""),
        String(row.source_reference || (row.source_sheet ? row.source_sheet + (row.source_row ? "!" + row.source_row : "") : manualLabel))
      ]);
    });
    if (other.rows.length) sheets.push(other);
    return { sheets: sheets, count: rows.length, total: total };
  }

  function xml(value) {
    return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "\uFFFD")
      .replace(/_x[0-9a-f]{4}_/gi, function (token) { return "_x005F_" + token.slice(1); })
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/\r/g, "&#13;");
  }

  function cell(ref, value, style) {
    var prefix = '<c r="' + ref + '" s="' + style + '"';
    if (typeof value === "number") return prefix + '><v>' + value + '</v></c>';
    return prefix + ' t="inlineStr"><is><t xml:space="preserve">' + xml(value) + '</t></is></c>';
  }

  function totalQuantity(sheet) {
    return sheet.rows.reduce(function (sum, row) { return sum + row[3]; }, 0);
  }

  function worksheet(sheet, subtitle) {
    var last = 4 + sheet.rows.length;
    var labels = columns.map(function (label, i) { return cell("ABCDEF"[i] + "4", label, 3); }).join("");
    var rows = sheet.rows.map(function (row, index) {
      var number = index + 5;
      var styles = index % 2 === 0 ? [4, 5, 6, 7, 6, 6] : [8, 9, 10, 11, 10, 10];
      return '<row r="' + number + '">' + row.map(function (value, i) {
        return cell("ABCDEF"[i] + number, value, styles[i]);
      }).join("") + '</row>';
    }).join("");
    var end = last + 2;
    var formula = sheet.rows.length ? 'SUM(D5:D' + last + ')' : '0';
    return '<worksheet xmlns="' + namespace + '"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<dimension ref="A1:F' + end + '"/><sheetViews><sheetView workbookViewId="0">' +
      '<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/><cols>' + widths.map(function (width, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + width + '" customWidth="1"/>';
      }).join("") + '</cols><sheetData><row r="1" ht="18" customHeight="1">' + cell("A1", sheet.title, 1) +
      '</row><row r="2" ht="14.25" customHeight="1">' + cell("A2", subtitle, 2) + '</row>' +
      '<row r="4" ht="30" customHeight="1">' + labels + '</row>' + rows +
      '<row r="' + end + '">' + cell("C" + end, "合計 / Total", 12) +
      '<c r="D' + end + '" s="13"><f>' + formula + '</f><v>' + totalQuantity(sheet) + '</v></c></row></sheetData>' +
      '<autoFilter ref="A4:F' + last + '"/><pageMargins left="0.75" right="0.75" top="1" bottom="1" header="0.5" footer="0.5"/>' +
      '<pageSetup fitToWidth="1" fitToHeight="0" orientation="portrait"/></worksheet>';
  }

  function styles() {
    var variants = [[0,0,0],[1,0,0],[2,0,0],[3,2,0,"center",true]];
    [3, 0].forEach(function (fill) {
      variants.push([4,fill,1,"center"], [5,fill,1,"center"], [4,fill,1,"left",true], [4,fill,1,"center",false,3]);
    });
    variants.push([6,0,0], [6,0,0,"center",false,3]);
    var fonts = [[11],[14,true],[9,false,"FF595959"],[11,true,"FFFFFFFF"],[10],[10,true],[11,true]];
    var border = ["left", "right", "top", "bottom"].map(function (side) {
      return '<' + side + ' style="thin"><color rgb="FFBFBFBF"/></' + side + '>';
    }).join("");
    return '<styleSheet xmlns="' + namespace + '"><fonts count="7">' + fonts.map(function (font) {
      return '<font>' + (font[1] ? '<b/>' : '') + '<sz val="' + font[0] + '"/>' +
        (font[2] ? '<color rgb="' + font[2] + '"/>' : '') + '<name val="Arial"/><family val="2"/></font>';
    }).join("") + '</fonts><fills count="4"><fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>' + border +
      '<diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + variants.length + '">' + variants.map(function (v) {
        return '<xf numFmtId="' + (v[5] || 0) + '" fontId="' + v[0] + '" fillId="' + v[1] + '" borderId="' + v[2] + '" xfId="0"' +
          (v[0] ? ' applyFont="1"' : '') + (v[1] ? ' applyFill="1"' : '') + (v[2] ? ' applyBorder="1"' : '') +
          (v[5] ? ' applyNumberFormat="1"' : '') + (v[3] ? ' applyAlignment="1"><alignment horizontal="' + v[3] +
          '" vertical="center"' + (v[4] ? ' wrapText="1"' : '') + '/></xf>' : '/>');
      }).join("") + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }

  function workbook(report, subtitle, fflate) {
    var contentTypes = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>';
    var types = "application/vnd.openxmlformats-officedocument.spreadsheetml.";
    var override = function (part, type) {
      return '<Override PartName="/xl/' + part + '" ContentType="' + types + type + '+xml"/>';
    };
    var relationships = function (items) { return '<Relationships xmlns="' + packageRel + '">' + items + '</Relationships>'; };
    var relationship = function (id, path, kind) {
      return '<Relationship Id="' + id + '" Type="' + rel + '/' + kind + '" Target="' + path + '"/>';
    };
    var files = {};
    var add = function (path, value) { files[path] = fflate.strToU8('<?xml version="1.0" encoding="UTF-8"?>' + value); };
    var sheetRelationships = relationship("styles", "styles.xml", "styles");
    var sheetNames = "";
    contentTypes += override("workbook.xml", "sheet.main") + override("styles.xml", "styles");
    report.sheets.forEach(function (sheet, index) {
      var id = index + 1;
      var path = "worksheets/sheet" + id + ".xml";
      contentTypes += override(path, "worksheet");
      sheetRelationships += relationship("s" + id, path, "worksheet");
      sheetNames += '<sheet name="' + xml(sheet.name) + '" sheetId="' + id + '" r:id="s' + id + '"/>';
      add("xl/" + path, worksheet(sheet, subtitle));
    });
    add("[Content_Types].xml", contentTypes + "</Types>");
    add("_rels/.rels", relationships(relationship("workbook", "xl/workbook.xml", "officeDocument")));
    add("xl/_rels/workbook.xml.rels", relationships(sheetRelationships));
    add("xl/workbook.xml", '<workbook xmlns="' + namespace + '" xmlns:r="' + rel +
      '"><bookViews><workbookView/></bookViews><sheets>' + sheetNames + '</sheets></workbook>');
    add("xl/styles.xml", styles());
    return fflate.zipSync(files);
  }

  function printContent(report, title, subtitle, document) {
    var fragment = document.createDocumentFragment();
    function textElement(parent, tag, value) {
      var node = document.createElement(tag);
      node.textContent = value;
      parent.append(node);
      return node;
    }
    textElement(fragment, "h1", title);
    textElement(fragment, "p", subtitle);
    report.sheets.filter(function (sheet) { return sheet.rows.length; }).forEach(function (sheet) {
      var section = document.createElement("section");
      fragment.append(section);
      textElement(section, "h2", sheet.name);
      var table = document.createElement("table");
      section.append(table);
      var header = table.createTHead().insertRow();
      columns.forEach(function (label) { textElement(header, "th", label).scope = "col"; });
      var body = table.createTBody();
      sheet.rows.forEach(function (row) {
        var tr = body.insertRow();
        row.forEach(function (value) { textElement(tr, "td", value); });
      });
      textElement(section, "p", "合計 / Total  " + totalQuantity(sheet).toLocaleString("ja-JP"));
    });
    return fragment;
  }

  root.DcatsCorePendingExport = Object.freeze({ collect: collect, workbook: workbook, printContent: printContent });
})(typeof window === "undefined" ? module.exports : window);
