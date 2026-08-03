(function() {
  "use strict";

  var autoPrintStarted = false;

  function printLabel() {
    try { window.focus(); } catch (e) { /* The browser may control window focus. */ }
    window.print();
  }

  function printFromButton() {
    autoPrintStarted = true;
    printLabel();
  }

  function startAutoPrint() {
    if (autoPrintStarted || !document.body || document.body.dataset.dcatsAutoPrint !== "true") return;
    autoPrintStarted = true;
    window.setTimeout(printLabel, 120);
  }

  var printButton = document.getElementById("dcats-print-now");
  if (printButton) printButton.addEventListener("click", printFromButton);

  if (document.readyState === "complete") startAutoPrint();
  else window.addEventListener("load", startAutoPrint, { once: true });
})();
