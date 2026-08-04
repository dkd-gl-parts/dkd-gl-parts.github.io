(function() {
  "use strict";

  function closePrintWindow() {
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
