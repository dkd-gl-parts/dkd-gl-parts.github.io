(function() {
  "use strict";

  var deferredInstallPrompt = null;
  var installEntries = Array.from(document.querySelectorAll("[data-install-entry]"));
  var installButtons = Array.from(document.querySelectorAll("[data-install-app]"));
  var installDialog = document.getElementById("app-install-dialog");
  var closeButton = document.getElementById("btn-install-dialog-close");
  var introGuide = document.getElementById("app-install-intro-guide");
  var iosGuide = document.getElementById("app-install-ios-guide");
  var manualGuide = document.getElementById("app-install-manual-guide");
  var guideActions = document.getElementById("app-install-guide-actions");
  var startButton = document.getElementById("btn-install-dialog-start");
  var confirmedButton = document.getElementById("btn-install-dialog-confirmed");
  var iosSafariNote = document.getElementById("app-install-ios-safari-note");
  var returnFocus = null;
  var installAllowed = false;
  var INSTALL_CAMPAIGN_ID = "dcats-icon-v4";
  var INSTALL_COMPLETE_KEY = "dcats_install_complete_" + INSTALL_CAMPAIGN_ID;
  var INSTALL_SESSION_PROMPT_KEY = "dcats_install_prompted_" + INSTALL_CAMPAIGN_ID;

  if (!installEntries.length || !installButtons.length || !installDialog || !introGuide || !iosGuide || !manualGuide || !guideActions || !startButton || !confirmedButton) return;

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

  function storageHas(storage, key) {
    try { return storage && storage.getItem(key) === "1"; }
    catch (error) { return false; }
  }

  function storageSet(storage, key) {
    try { if (storage) storage.setItem(key, "1"); }
    catch (error) { /* Private browsing or device policy can disable storage. */ }
  }

  function storageRemove(storage, key) {
    try { if (storage) storage.removeItem(key); }
    catch (error) { /* Private browsing or device policy can disable storage. */ }
  }

  function isInstallConfirmed() {
    return storageHas(window.localStorage, INSTALL_COMPLETE_KEY);
  }

  function recordInstallConfirmed() {
    storageSet(window.localStorage, INSTALL_COMPLETE_KEY);
    storageSet(window.sessionStorage, INSTALL_SESSION_PROMPT_KEY);
  }

  function canOfferInstall() {
    return !!(deferredInstallPrompt || isIos() || isAndroid() || isNarrowViewport());
  }

  function syncInstallEntry() {
    if (isStandalone()) recordInstallConfirmed();
    var shouldHide = !installAllowed || isStandalone() || !canOfferInstall();
    installEntries.forEach(function(entry) { entry.hidden = shouldHide; });
  }

  function openInstallGuide(kind) {
    if (installDialog.hidden) returnFocus = document.activeElement;
    introGuide.hidden = kind !== "intro";
    iosGuide.hidden = kind !== "ios";
    manualGuide.hidden = kind !== "manual";
    guideActions.hidden = kind === "intro";
    if (iosSafariNote) iosSafariNote.hidden = kind !== "ios" || isIosSafari();
    installDialog.hidden = false;
    document.body.classList.add("app-install-dialog-open");
    if (kind === "intro") startButton.focus();
    else if (closeButton) closeButton.focus();
  }

  function closeInstallGuide() {
    if (installDialog.hidden) return;
    installDialog.hidden = true;
    document.body.classList.remove("app-install-dialog-open");
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
    returnFocus = null;
  }

  function markInstallConfirmed() {
    recordInstallConfirmed();
    closeInstallGuide();
    syncInstallEntry();
  }

  function maybeOpenLoginPrompt() {
    if (!installAllowed || isStandalone() || !canOfferInstall() || isInstallConfirmed()) return;
    if (storageHas(window.sessionStorage, INSTALL_SESSION_PROMPT_KEY)) return;
    storageSet(window.sessionStorage, INSTALL_SESSION_PROMPT_KEY);
    openInstallGuide("intro");
  }

  window.addEventListener("beforeinstallprompt", function(event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    syncInstallEntry();
    maybeOpenLoginPrompt();
  });

  window.addEventListener("appinstalled", function() {
    deferredInstallPrompt = null;
    markInstallConfirmed();
  });

  window.addEventListener("dcats:install-access", function(event) {
    var wasAllowed = installAllowed;
    installAllowed = !!(event.detail && event.detail.allowed);
    if (!installAllowed) {
      closeInstallGuide();
      if (wasAllowed) storageRemove(window.sessionStorage, INSTALL_SESSION_PROMPT_KEY);
    }
    syncInstallEntry();
    if (installAllowed && !wasAllowed) maybeOpenLoginPrompt();
  });

  async function beginInstall() {
    if (!installAllowed) {
      syncInstallEntry();
      return;
    }
    if (isStandalone()) {
      markInstallConfirmed();
      return;
    }

    if (deferredInstallPrompt) {
      var promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      closeInstallGuide();
      installEntries.forEach(function(entry) { entry.hidden = true; });
      try {
        await promptEvent.prompt();
        var choice = await promptEvent.userChoice;
        if (choice && choice.outcome === "accepted") markInstallConfirmed();
        else syncInstallEntry();
      } catch (error) {
        console.warn("D-CATS install prompt failed", error);
        syncInstallEntry();
        openInstallGuide(isIos() ? "ios" : "manual");
      }
      return;
    }

    openInstallGuide(isIos() ? "ios" : "manual");
  }

  installButtons.forEach(function(button) {
    button.addEventListener("click", beginInstall);
  });

  startButton.addEventListener("click", beginInstall);
  confirmedButton.addEventListener("click", markInstallConfirmed);

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
