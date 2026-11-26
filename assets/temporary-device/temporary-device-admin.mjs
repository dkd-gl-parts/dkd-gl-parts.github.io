import { displayRequestNumber, readPairingCode } from "./pairing-codes.mjs";

const featureNames = Object.freeze({
  part_label: "品番シール",
  shipping: "ピッキング・出荷確定",
  core_return: "コア返却管理"
});

function node(tag, text) {
  const result = document.createElement(tag);
  if (text) result.textContent = text;
  return result;
}

function confirmTemporaryDeviceAction(container, title, email, details, confirmLabel) {
  const dialog = node("dialog");
  dialog.className = "temporary-device-dialog";
  dialog.setAttribute("aria-label", title);
  const buttons = node("div");
  buttons.className = "temporary-device-dialog-actions";
  const cancel = node("button", "キャンセル");
  cancel.type = "button";
  cancel.className = "btn-cancel";
  const confirm = node("button", confirmLabel);
  confirm.type = "button";
  confirm.className = "btn-primary";
  buttons.append(cancel, confirm);
  dialog.append(node("h3", title), node("p", email), node("p", details), buttons);
  container.append(dialog);
  const previousFocus = document.activeElement;
  return new Promise(resolve => {
    cancel.addEventListener("click", () => dialog.close());
    confirm.addEventListener("click", () => dialog.close("confirmed"));
    dialog.addEventListener("close", () => {
      const accepted = dialog.returnValue === "confirmed";
      dialog.remove();
      previousFocus?.focus();
      resolve(accepted);
    }, { once: true });
    dialog.showModal();
    cancel.focus();
  });
}

export async function readTemporaryDeviceAdmin(options) {
  const token = await options.getAdminAccessToken();
  if (!token) return null;
  const response = await fetch(options.endpoint, {
    method: "POST", cache: "no-store", credentials: "omit", redirect: "error",
    headers: { "Content-Type":"application/json", apikey:options.publishableKey, Authorization:"Bearer "+token },
    body: JSON.stringify({ action:"admin_state", subjectId:options.targetUser.id })
  });
  return response.ok ? response.json() : null;
}

export function renderTemporaryDeviceAdmin(container, { targetUser, endpoint, publishableKey,
  getAdminAccessToken, printers, existingGrant, pendingRequests = [], operatorUrl }) {
  const form = node("form");
  form.append(node("p", targetUser.email));
  if (existingGrant?.expiresAt) {
    const expires = new Intl.DateTimeFormat("ja-JP",{dateStyle:"long",timeZone:"Asia/Tokyo"}).format(new Date(existingGrant.expiresAt));
    form.append(node("p","利用期限 "+expires));
  }
  const linkButton = node("button","利用者用リンクを発行");
  linkButton.type="button";
  linkButton.className="btn-cancel";
  linkButton.hidden=!!existingGrant;
  const linkArea=node("p");
  function operatorLink(url) {
    const link = node("a", "利用者用ページを開く");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }
  if (existingGrant) linkArea.append(operatorLink(operatorUrl));
  form.append(linkButton,linkArea);
  const fields = node("div");
  fields.className = "temporary-device-dialog-fields";
  function addField(title, input) {
    const label = node("label", title);
    label.append(input);
    fields.append(label);
    return input;
  }
  const requests = addField("申請番号", node("select"));
  requests.required = true;
  const pairing = addField("確認コード", node("input"));
  pairing.type = "text";
  pairing.autocomplete = "off";
  pairing.inputMode = "numeric";
  pairing.maxLength = 12;
  pairing.placeholder = "0000-0000";
  pairing.required = !existingGrant;
  pairing.closest("label").hidden = !!existingGrant;
  form.append(fields);
  const featureControls = node("div");
  featureControls.className = "temporary-device-dialog-features";
  form.append(featureControls);
  for (const [key, title] of Object.entries(featureNames)) {
    const label = node("label", title);
    const input = node("input");
    input.type = "checkbox";
    input.name = "features";
    input.value = key;
    input.checked = existingGrant ? existingGrant.features.includes(key) : true;
    label.prepend(input);
    featureControls.append(label);
  }
  const printLabel = node("label", "品番シールの印刷先");
  printLabel.className = "temporary-device-dialog-print";
  const print = node("select");
  const unconfigured = node("option", "設定しない");
  unconfigured.value = "";
  print.append(unconfigured);
  for (const printer of printers) {
    const entry = node("option", printer.name);
    entry.value = printer.code;
    entry.selected = printer.code === existingGrant?.printer;
    print.append(entry);
  }
  printLabel.append(print);
  form.append(printLabel);
  const primary = node("button", existingGrant ? "利用機能を保存" : "1年間の利用を承認");
  primary.type = "submit";
  const revoke = node("button", "利用を取り消す");
  revoke.type = "button";
  revoke.hidden = !existingGrant;
  const message = node("p");
  message.setAttribute("role", "status");
  const actions = node("div");
  actions.className = "temporary-device-dialog-actions";
  primary.className = "btn-primary";
  revoke.className = "btn-cancel";
  actions.append(primary,revoke);
  form.append(actions,message);
  container.replaceChildren(form);

  async function send(body) {
    const auth = await getAdminAccessToken();
    if (!auth) throw new Error("システム管理者としてログインしてください。");
    const response = await fetch(endpoint, {
      method: "POST", cache: "no-store", credentials: "omit", redirect: "error",
      headers: { "Content-Type": "application/json", apikey: publishableKey, Authorization: "Bearer " + auth },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const error = new Error(response.status === 403
        ? "申請番号、確認コードまたは利用期限を確認してください。"
        : "設定結果を読み戻してから操作してください。");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  let activeGrant = existingGrant?.grantId || "";
  let uncertain = false;
  let saving = false;

  function syncButtons() {
    primary.disabled = saving || uncertain || !(activeGrant || requests.value);
    revoke.disabled = saving || uncertain;
  }

  let displayedRequests = "";
  function showRequests(ids) {
    const snapshot = JSON.stringify(ids);
    if (snapshot === displayedRequests) return;
    displayedRequests = snapshot;
    const previous = requests.value;
    const counts = new Map();
    for (const id of ids) {
      const reference = displayRequestNumber(id);
      counts.set(reference, (counts.get(reference) || 0) + 1);
    }
    const options = ids.flatMap(id => {
      const reference = displayRequestNumber(id);
      if (counts.get(reference) > 1) return [];
      const item = node("option", reference);
      item.value = id;
      return [item];
    });
    const placeholder = node("option", options.length ? "申請番号を選択" : ids.length ? "番号が重複しています" : "申請を待っています");
    placeholder.value = "";
    requests.replaceChildren(placeholder, ...options);
    if (options.some(item => item.value === previous)) requests.value = previous;
    else if (ids.length === 1) requests.value = ids[0];
    syncButtons();
  }

  function showActiveGrant() {
    const option = node("option", displayRequestNumber(activeGrant));
    option.value = activeGrant;
    requests.replaceChildren(option);
    requests.disabled = true;
    pairing.required = false;
    pairing.closest("label").hidden = true;
  }

  async function refreshRequests() {
    if (!form.isConnected || activeGrant || uncertain) return;
    try {
      if (!saving) {
        const state = await send({ action: "admin_state", subjectId: targetUser.id });
        if (form.isConnected && !saving && !activeGrant) showRequests(state.pendingRequests || []);
      }
    } catch {
      if (form.isConnected && !saving && !activeGrant) showRequests([]);
    } finally {
      if (form.isConnected && !activeGrant && !uncertain) setTimeout(refreshRequests, 3000);
    }
  }

  requests.addEventListener("change", syncButtons);
  if (activeGrant) showActiveGrant();
  else {
    showRequests(pendingRequests);
    setTimeout(refreshRequests, 3000);
  }
  syncButtons();
  async function perform(work) {
    if (saving || uncertain) return;
    saving = true;
    syncButtons();
    try {
      await work();
    } catch (error) {
      uncertain = !!activeGrant || error.status !== 403;
      message.textContent = error.message || "反映結果を確認してください。";
    } finally {
      saving = false;
      syncButtons();
    }
  }
  linkButton.addEventListener("click", () => {
    void perform(async () => {
      const reply = await send({action:"prepare_enrollment",subjectId:targetUser.id});
      const url = new URL(operatorUrl);
      url.hash="enroll="+encodeURIComponent(reply.enrollmentToken);
      linkArea.replaceChildren(operatorLink(url),document.createTextNode("（有効15分）"));
    });
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    void perform(async () => {
      const features = new FormData(form).getAll("features");
      if (!features.length) { message.textContent = "利用する機能を選んでください。"; return; }
      const grant = activeGrant || requests.value;
      if (!grant) return;
      const code = activeGrant ? null : readPairingCode(pairing.value);
      if (!activeGrant && !code) {
        message.textContent = "利用者の確認コードを確認してください。";
        return;
      }
      if (!activeGrant && !await confirmTemporaryDeviceAction(container,
        "端末利用の承認", targetUser.email, "申請番号 " + displayRequestNumber(grant) + " の端末を1年間承認しますか？", "承認する")) return;
      const response = await send(activeGrant
        ? { action: "configure_device", grantId: grant, features }
        : { action: "approve_device", grantId: grant, subjectId: targetUser.id, pairingCode: code, features });
      activeGrant = grant;
      linkArea.replaceChildren(operatorLink(operatorUrl));
      linkButton.hidden = true;
      showActiveGrant();
      primary.textContent = "利用機能を保存";
      revoke.hidden = false;
      message.textContent = response.expiresAt ? "承認しました。利用期限 " + new Intl.DateTimeFormat(
        "ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(new Date(response.expiresAt)) : "利用機能を保存しました。";
      if (features.includes("part_label")) {
        try { await send({ action: "set_label_printer", grantId: grant, printer: print.value || null }); }
        catch { message.textContent += " 印刷先の設定結果を確認してください。"; }
      }
    });
  });
  revoke.addEventListener("click", () => {
    void perform(async () => {
      if (!await confirmTemporaryDeviceAction(container,
        "端末利用の取り消し", targetUser.email, "対象端末の利用許可を取り消しますか？", "取り消す")) return;
      await send({ action: "revoke_device", grantId: activeGrant });
      container.replaceChildren(node("p", "端末の利用許可を取り消しました。"));
    });
  });
}
