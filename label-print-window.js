(function() {
  "use strict";

  function closePrintWindow() {
    try {
      if (window.opener && !window.opener.closed) {
        if (typeof window.opener.restoreFinishedLabelWorkspaceAfterPrint === "function") {
          window.opener.restoreFinishedLabelWorkspaceAfterPrint();
        } else if (typeof window.opener.focus === "function") {
          window.opener.focus();
        }
      }
    } catch (e) { /* A cross-origin opener cannot be controlled from the print window. */ }
    try { window.close(); } catch (e) { /* The browser controls whether this window can close. */ }
  }

  function printLabel() {
    try { window.focus(); } catch (e) { /* The browser may control window focus. */ }
    window.print();
  }

  function bindPrintButton() {
    var printButton = document.getElementById("dcats-print-now");
    if (!printButton || printButton.getAttribute("data-dcats-print-bound") === "true") return;
    printButton.setAttribute("data-dcats-print-bound", "true");
    printButton.addEventListener("click", printLabel);
  }

  if (typeof window.addEventListener === "function") {
    window.addEventListener("afterprint", closePrintWindow, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPrintButton, { once: true });
  } else {
    bindPrintButton();
  }
})();
