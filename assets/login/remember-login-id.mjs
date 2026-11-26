const storageKey = "dcats.login.remembered-user-id";
const labelText = {
  ja: "ユーザーIDを保存",
  en: "Remember user ID",
  zh: "保存用户 ID"
};

const id = document.getElementById("login-email");
const remember = document.getElementById("remember-login-id");
const label = document.getElementById("remember-login-id-label");
const login = document.getElementById("btn-login");
const passwordField = document.getElementById("login-password");

if (id && remember && label && login && passwordField) {
  function updateLabel() {
    const language = document.documentElement.lang.split("-")[0].toLowerCase();
    label.textContent = labelText[language] || labelText.ja;
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
