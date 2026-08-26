(function() {
  "use strict";

  var deferredInstallPrompt = null;
  var installEntries = Array.from(document.querySelectorAll("[data-install-entry]"));
  var installButtons = Array.from(document.querySelectorAll("[data-install-app]"));
  var installDialog = document.getElementById("app-install-dialog");
  var closeButton = document.getElementById("btn-install-dialog-close");
  var iosGuide = document.getElementById("app-install-ios-guide");
  var manualGuide = document.getElementById("app-install-manual-guide");
  var iosSafariNote = document.getElementById("app-install-ios-safari-note");
  var returnFocus = null;
  var installAllowed = false;

  if (!installEntries.length || !installButtons.length || !installDialog || !iosGuide || !manualGuide) return;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.navigator.standalone === true;
  }

  function isIos() {
    var ua = window.navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  }

  function isAndroid() {
    return /Android/i.test(window.navigator.userAgent || "");
  }

  function isNarrowViewport() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function isIosSafari() {
    var ua = window.navigator.userAgent || "";
    return isIos() && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  }

  function syncInstallEntry() {
    var shouldHide = !installAllowed || isStandalone() || !(deferredInstallPrompt || isIos() || isAndroid() || isNarrowViewport());
    installEntries.forEach(function(entry) { entry.hidden = shouldHide; });
  }

  function openInstallGuide(kind) {
    returnFocus = document.activeElement;
    iosGuide.hidden = kind !== "ios";
    manualGuide.hidden = kind === "ios";
    if (iosSafariNote) iosSafariNote.hidden = kind !== "ios" || isIosSafari();
    installDialog.hidden = false;
    document.body.classList.add("app-install-dialog-open");
    if (closeButton) closeButton.focus();
  }

  function closeInstallGuide() {
    if (installDialog.hidden) return;
    installDialog.hidden = true;
    document.body.classList.remove("app-install-dialog-open");
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
    returnFocus = null;
  }

  window.addEventListener("beforeinstallprompt", function(event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    syncInstallEntry();
  });

  window.addEventListener("appinstalled", function() {
    deferredInstallPrompt = null;
    closeInstallGuide();
    syncInstallEntry();
  });

  window.addEventListener("dcats:install-access", function(event) {
    installAllowed = !!(event.detail && event.detail.allowed);
    if (!installAllowed) closeInstallGuide();
    syncInstallEntry();
  });

  installButtons.forEach(function(button) {
    button.addEventListener("click", async function() {
      if (!installAllowed) {
        syncInstallEntry();
        return;
      }
      if (isStandalone()) {
        syncInstallEntry();
        return;
      }

      if (deferredInstallPrompt) {
        var promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        installEntries.forEach(function(entry) { entry.hidden = true; });
        try {
          await promptEvent.prompt();
          var choice = await promptEvent.userChoice;
          if (!choice || choice.outcome !== "accepted") syncInstallEntry();
        } catch (error) {
          console.warn("D-CATS install prompt failed", error);
          syncInstallEntry();
          openInstallGuide(isIos() ? "ios" : "manual");
        }
        return;
      }

      openInstallGuide(isIos() ? "ios" : "manual");
    });
  });

  installDialog.querySelectorAll("[data-install-dialog-close]").forEach(function(element) {
    element.addEventListener("click", closeInstallGuide);
  });

  document.addEventListener("keydown", function(event) {
    if (installDialog.hidden) return;
    if (event.key === "Escape") {
      closeInstallGuide();
      return;
    }
    if (event.key !== "Tab") return;
    var focusable = Array.from(installDialog.querySelectorAll("button:not([disabled])"));
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  var standaloneQuery = window.matchMedia("(display-mode: standalone)");
  if (typeof standaloneQuery.addEventListener === "function") {
    standaloneQuery.addEventListener("change", syncInstallEntry);
  }
  var narrowViewportQuery = window.matchMedia("(max-width: 900px)");
  if (typeof narrowViewportQuery.addEventListener === "function") {
    narrowViewportQuery.addEventListener("change", syncInstallEntry);
  }

  syncInstallEntry();
})();
