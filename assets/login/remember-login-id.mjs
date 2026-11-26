const storageKey = "dcats.login.remembered-user-id";
const id = document.getElementById("login-email");
const remember = document.getElementById("remember-login-id");
const label = document.getElementById("remember-login-id-label");
const login = document.getElementById("btn-login");
const passwordField = document.getElementById("login-password");

if (id && remember && label && login && passwordField) {
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

  try {
    const savedId = localStorage.getItem(storageKey);
    if (savedId) {
      if (!id.value) id.value = savedId;
      remember.checked = true;
    }
  } catch {
    remember.disabled = true;
  }

  function saveChoice() {
    if (remember.disabled) return;
    try {
      const value = id.value.trim();
      if (remember.checked && value) localStorage.setItem(storageKey, value);
      else localStorage.removeItem(storageKey);
    } catch {
      remember.checked = false;
    }
  }

  remember.addEventListener("change", saveChoice);
  login.addEventListener("click", saveChoice, true);
  passwordField.addEventListener("keydown", event => {
    if (event.key === "Enter") saveChoice();
  }, true);
}
