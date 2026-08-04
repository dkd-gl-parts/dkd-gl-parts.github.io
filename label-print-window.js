(function() {
  "use strict";

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPrintButton, { once: true });
  } else {
    bindPrintButton();
  }
})();
