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
  getAdminAccessToken, printers, existingGrant, operatorUrl }) {
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
  const addField = (title, name, value = "", required = false) => {
    const label = node("label", title);
    const input = node("input");
    input.name = name;
    input.value = value;
    input.required = required;
    input.autocomplete = "off";
    label.append(input);
    fields.append(label);
    return input;
  };
  const fields = node("div");
  fields.className = "temporary-device-dialog-fields";
  form.append(fields);
  const grantId = addField("申請番号", "grantId", existingGrant?.grantId || "", true);
  grantId.readOnly = !!existingGrant;
  const pairing = existingGrant ? null : addField("確認コード", "pairingCode", "", true);
  if (pairing) { pairing.maxLength = 6; pairing.pattern = "[0-9A-Fa-f]{6}"; }
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
    if (!response.ok) throw new Error(response.status === 403
      ? "承認や設定を反映できません。権限、申請番号と確認コードを確認してください。"
      : "設定結果を読み戻してから操作してください。");
    return response.json();
  }

  let active = !!existingGrant;
  let uncertain = false;
  let saving = false;
  const grantValue = () => grantId.value.trim().toLowerCase();
  async function perform(work) {
    if (saving || uncertain) return;
    saving = true;
    primary.disabled = true;
    revoke.disabled = true;
    try {
      await work();
    } catch (error) {
      uncertain = true;
      message.textContent = error.message || "反映結果を確認してください。";
    } finally {
      saving = false;
      primary.disabled = uncertain;
      revoke.disabled = uncertain;
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
      if (!active && !await confirmTemporaryDeviceAction(container,
        "端末利用の承認", targetUser.email, "この端末の利用を1年間承認しますか？", "承認する")) return;
      const grant = grantValue();
      const response = await send(active
        ? { action: "configure_device", grantId: grant, features }
        : { action: "approve_device", grantId: grant, subjectId: targetUser.id, pairingCode: pairing.value.trim(), features });
      active = true;
      linkArea.replaceChildren(operatorLink(operatorUrl));
      linkButton.hidden=true;
      if (pairing) { pairing.required = false; pairing.closest("label").hidden = true; }
      grantId.readOnly = true;
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
      await send({ action: "revoke_device", grantId: grantValue() });
      container.replaceChildren(node("p", "端末の利用許可を取り消しました。"));
    });
  });
}
