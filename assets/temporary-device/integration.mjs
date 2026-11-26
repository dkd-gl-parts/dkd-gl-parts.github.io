import { readTemporaryDeviceAdmin, renderTemporaryDeviceAdmin } from "./temporary-device-admin.mjs";

const endpoint = window.SUPABASE_URL + "/functions/v1/temporary-device-access";
const operatorUrl = new URL("./temporary-device.html",import.meta.url);
const overlay = document.getElementById("user-permission-edit-overlay");
const trigger = document.getElementById("btn-temporary-device-access");
const dialog = document.getElementById("temporary-device-access-dialog");
const container = document.getElementById("temporary-device-admin-content");
const close = document.getElementById("btn-temporary-device-access-close");

function selectedAdministratorTarget() {
  if (!overlay?.classList.contains("show") || !window.isSystemAdmin?.()) return null;
  return window.currentPermissionEditUser?.() || null;
}

async function getAdminAccessToken() {
  const session = await window.sb.auth.getSession();
  return session.data?.session?.access_token || null;
}

if (overlay && trigger && dialog && container && close) {
  let generation = 0;
  let selected = null;

  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    container.replaceChildren();
    if (!trigger.hidden) trigger.focus();
  });
  trigger.addEventListener("click", async () => {
    const user = selectedAdministratorTarget();
    if (!selected || user?.id !== selected.id || dialog.open) return;
    const request = ++generation;
    trigger.disabled = true;
    const options = { targetUser:user, endpoint, publishableKey:window.SUPABASE_KEY, getAdminAccessToken, operatorUrl };
    try {
      const state = await readTemporaryDeviceAdmin(options);
      if (!state || generation !== request || selectedAdministratorTarget()?.id !== user.id) return;
      renderTemporaryDeviceAdmin(container,{ ...options,...state });
      dialog.showModal();
    } catch {
      if (generation === request && selectedAdministratorTarget()?.id === user.id) {
        container.textContent = "設定を読み込めませんでした。開き直してください。";
        dialog.showModal();
      }
    } finally {
      if (generation === request) trigger.disabled = false;
    }
  });

  const watch = new MutationObserver(async () => {
    const request = ++generation;
    trigger.hidden = true;
    trigger.disabled = false;
    selected = null;
    if (dialog.open) dialog.close();
    const user = selectedAdministratorTarget();
    if (!user?.id) return;
    try {
      const ready = await readTemporaryDeviceAdmin({
        targetUser: user, endpoint, publishableKey: window.SUPABASE_KEY, getAdminAccessToken
      });
      if (ready && generation === request && selectedAdministratorTarget()?.id === user.id) {
        selected = user;
        trigger.hidden = false;
      }
    } catch {
      // The user-permission editor is usable while the optional endpoint is unavailable.
    }
  });
  watch.observe(overlay, { attributes: true, attributeFilter: ["class"] });
}
