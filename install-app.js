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
  var coachmarkButton = document.getElementById("btn-install-ios-coachmark");
  var shareCoachmark = document.getElementById("app-install-share-coachmark");
  var iosSafariNote = document.getElementById("app-install-ios-safari-note");
  var returnFocus = null;
  var installAllowed = false;
  var publishedVerificationMethods = {};
  var INSTALL_CAMPAIGN_ID = "dcats-icon-v4-verified";
  var INSTALL_COMPLETE_KEY = "dcats_install_complete_" + INSTALL_CAMPAIGN_ID;
  var INSTALL_SESSION_PROMPT_KEY = "dcats_install_prompted_" + INSTALL_CAMPAIGN_ID;
  var INSTALL_COACHMARK_KEY = "dcats_install_coachmark_" + INSTALL_CAMPAIGN_ID;

  if (!installEntries.length || !installButtons.length || !installDialog || !introGuide || !iosGuide || !manualGuide || !guideActions || !startButton || !coachmarkButton || !shareCoachmark) return;

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

  function currentDisplayMode() {
    if (window.navigator.standalone === true) return "standalone";
    if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
    if (window.matchMedia("(display-mode: fullscreen)").matches) return "fullscreen";
    return "browser";
  }

  function publishInstallVerification(method) {
    if (!method || publishedVerificationMethods[method]) return;
    publishedVerificationMethods[method] = true;
    var detail = {
      id: method + ":" + Date.now() + ":" + Math.random().toString(36).slice(2, 9),
      method: method,
      campaign_id: INSTALL_CAMPAIGN_ID,
      display_mode: currentDisplayMode(),
      detected_at: new Date().toISOString()
    };
    if (!Array.isArray(window.DCATS_INSTALL_EVENT_QUEUE)) window.DCATS_INSTALL_EVENT_QUEUE = [];
    window.DCATS_INSTALL_EVENT_QUEUE.push(detail);
    if (typeof window.CustomEvent === "function") {
      window.dispatchEvent(new window.CustomEvent("dcats:install-verified", { detail: detail }));
    }
  }

  function syncInstallEntry() {
    if (isStandalone()) {
      closeShareCoachmark();
      recordInstallConfirmed();
      publishInstallVerification("standalone_launch");
    }
    var shouldHide = !installAllowed || isStandalone() || !canOfferInstall();
    installEntries.forEach(function(entry) { entry.hidden = shouldHide; });
  }

  function openInstallGuide(kind) {
    if (installDialog.hidden) returnFocus = document.activeElement;
    introGuide.hidden = kind !== "intro";
    iosGuide.hidden = kind !== "ios";
    manualGuide.hidden = kind !== "manual";
    guideActions.hidden = kind === "intro";
    coachmarkButton.hidden = kind !== "ios";
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

  function closeShareCoachmark() {
    shareCoachmark.hidden = true;
    storageRemove(window.sessionStorage, INSTALL_COACHMARK_KEY);
  }

  function openShareCoachmark() {
    closeInstallGuide();
    storageSet(window.sessionStorage, INSTALL_COACHMARK_KEY);
    shareCoachmark.hidden = false;
    var dismissButton = shareCoachmark.querySelector("[data-install-coachmark-close]");
    if (dismissButton && typeof dismissButton.focus === "function") dismissButton.focus();
  }

  function maybeRestoreShareCoachmark() {
    if (!installAllowed || isStandalone() || !isIos()) return false;
    if (!storageHas(window.sessionStorage, INSTALL_COACHMARK_KEY)) return false;
    closeInstallGuide();
    shareCoachmark.hidden = false;
    return true;
  }

  function markInstallConfirmed(method) {
    recordInstallConfirmed();
    publishInstallVerification(method);
    closeInstallGuide();
    closeShareCoachmark();
    syncInstallEntry();
  }

  function maybeOpenLoginPrompt() {
    if (!installAllowed || isStandalone() || !canOfferInstall() || isInstallConfirmed()) return;
    if (storageHas(window.sessionStorage, INSTALL_COACHMARK_KEY)) return;
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
    markInstallConfirmed("browser_appinstalled");
  });

  window.addEventListener("dcats:install-access", function(event) {
    var wasAllowed = installAllowed;
    installAllowed = !!(event.detail && event.detail.allowed);
    if (!installAllowed) {
      closeInstallGuide();
      closeShareCoachmark();
      if (wasAllowed) storageRemove(window.sessionStorage, INSTALL_SESSION_PROMPT_KEY);
    }
    syncInstallEntry();
    if (installAllowed && !wasAllowed && !maybeRestoreShareCoachmark()) maybeOpenLoginPrompt();
  });

  async function beginInstall() {
    if (!installAllowed) {
      syncInstallEntry();
      return;
    }
    if (isStandalone()) {
      markInstallConfirmed("standalone_launch");
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
        syncInstallEntry();
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

  coachmarkButton.addEventListener("click", openShareCoachmark);

  shareCoachmark.querySelectorAll("[data-install-coachmark-close]").forEach(function(element) {
    element.addEventListener("click", closeShareCoachmark);
  });

  installDialog.querySelectorAll("[data-install-dialog-close]").forEach(function(element) {
    element.addEventListener("click", closeInstallGuide);
  });

  document.addEventListener("keydown", function(event) {
    if (event.key === "Escape" && !shareCoachmark.hidden) {
      closeShareCoachmark();
      return;
    }
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
