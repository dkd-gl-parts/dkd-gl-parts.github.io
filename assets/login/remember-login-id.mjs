const storageKey = "dcats.login.remembered-user-id";
const loginScreen = document.getElementById("screen-login");
const id = document.getElementById("login-email");
const remember = document.getElementById("remember-login-id");
const label = document.getElementById("remember-login-id-label");
const login = document.getElementById("btn-login");
const passwordField = document.getElementById("login-password");

if (loginScreen && id && remember && label && login && passwordField) {
  function updateLabel() {
    const language = document.documentElement.lang.split("-")[0].toLowerCase();
    const source = "ユーザーIDを保存";
    label.textContent = globalThis.DCATS_LEGACY_UI_TRANSLATIONS?.[language]?.[source] || source;
  }

  updateLabel();
  new MutationObserver(updateLabel).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"]
  });

  function restoreChoice() {
    try {
      const savedId = localStorage.getItem(storageKey);
      remember.checked = savedId !== null;
      if (savedId && !id.value && loginScreen.classList.contains("active")) {
        id.value = savedId;
      }
      remember.disabled = false;
    } catch {
      remember.disabled = true;
    }
  }

  restoreChoice();
  // A screen reset can clear the controls, but only an explicit checkbox change updates the preference.
  new MutationObserver(restoreChoice).observe(loginScreen, { attributes: true, attributeFilter: ["class"] });

  remember.addEventListener("change", () => {
    try {
      if (remember.checked) {
        const savedId = localStorage.getItem(storageKey);
        localStorage.setItem(storageKey, id.value.trim() || savedId || "");
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      restoreChoice();
    }
  });

  function saveSubmittedId() {
    const value = id.value.trim();
    if (!value) return;
    try {
      if (localStorage.getItem(storageKey) !== null) localStorage.setItem(storageKey, value);
    } catch {
      restoreChoice();
    }
  }

  login.addEventListener("click", saveSubmittedId, true);
  passwordField.addEventListener("keydown", event => {
    if (event.key === "Enter") saveSubmittedId();
  }, true);
}
