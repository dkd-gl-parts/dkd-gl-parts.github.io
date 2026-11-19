import { createDeviceKey, signDeviceRequest } from "./device-proof.mjs";

function withStorage(mode, work) {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open("dcats-temporary-device", 1);
    opening.onerror = () => reject(opening.error);
    opening.onupgradeneeded = () => opening.result.createObjectStore("device");
    opening.onsuccess = () => {
      const database = opening.result;
      const transaction = database.transaction("device", mode);
      const request = work(transaction.objectStore("device"));
      transaction.oncomplete = () => {
        database.close();
        resolve(request.result);
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error);
      };
    };
  });
}

export function createTemporaryDeviceClient({ endpoint, publishableKey, enrollmentToken }) {
  async function post(payload) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: publishableKey },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      body: JSON.stringify(payload)
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data: await response.json() };
  }

  async function requestDevice() {
    const previous = await withStorage("readonly", store => store.get("registered"));
    if (previous && !enrollmentToken) return { ok:true,data:{grantId:previous.grantId,pairingCode:previous.pairingCode} };
    if (!enrollmentToken) return { ok:false,status:403 };
    const { publicJwk, privateKey } = await createDeviceKey();
    const requested = await post({ action:"request_device", publicJwk, enrollmentToken });
    if (!requested.ok) return requested;
    const { grantId, pairingCode } = requested.data;
    await withStorage("readwrite", store => store.put({grantId,pairingCode,privateKey},"registered"));
    enrollmentToken = null;
    return { ok: true, data: { grantId, pairingCode } };
  }

  async function perform(operation, argumentsObject = {}, beforeSubmit) {
    const registration = await withStorage("readonly", store => store.get("registered"));
    if (!registration) return { ok: false, status: 404 };
    const { grantId, privateKey } = registration;
    const issued = await post({ action: "challenge", grantId });
    if (!issued.ok) return issued;
    const fields = { grantId, challenge: issued.data.challenge, operation, bodyText: JSON.stringify(argumentsObject) };
    const signature = await signDeviceRequest(privateKey, fields);
    beforeSubmit?.(fields);
    return post({ action: "perform", ...fields, signature });
  }

  async function removeLocalRegistration() {
    await withStorage("readwrite", store => store.delete("registered"));
  }

  return { requestDevice, perform, removeLocalRegistration, status: () => perform("device_access_state") };
}
