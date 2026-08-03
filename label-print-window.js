(function() {
  "use strict";

  function printLabel() {
    try { window.focus(); } catch (e) { /* The browser may control window focus. */ }
    window.print();
  }

  var printButton = document.getElementById("dcats-print-now");
  if (printButton) printButton.addEventListener("click", printLabel);
})();
