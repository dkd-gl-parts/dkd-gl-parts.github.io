const encoder = new TextEncoder();
const curve = { name: "ECDSA", namedCurve: "P-256" };
const signatureAlgorithm = { name: "ECDSA", hash: "SHA-256" };
const audience = "https://dcats.daiko-denki.co.jp";
const protocol = "dcats-temporary-device-v1";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const operationName = /^[a-z][a-z0-9_]{0,79}$/;

function encode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode(value, byteCount) {
  if (typeof value !== "string" || value.length !== Math.ceil(byteCount * 4 / 3)
    || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new TypeError("Invalid proof encoding");
  }
  const decoded = Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    character => character.charCodeAt(0));
  if (decoded.length !== byteCount || encode(decoded) !== value) {
    throw new TypeError("Noncanonical proof encoding");
  }
  return decoded;
}

function fixedPublicJwk(jwk) {
  if (jwk?.kty !== "EC" || jwk.crv !== "P-256" || "d" in jwk) {
    throw new TypeError("Expected a P-256 public key");
  }
  decode(jwk.x, 32);
  decode(jwk.y, 32);
  return { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };
}

export function newDeviceChallenge() {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function createDeviceKey() {
  const key = await crypto.subtle.generateKey(curve, false, ["sign", "verify"]);
  return { privateKey: key.privateKey, publicJwk: fixedPublicJwk(await crypto.subtle.exportKey("jwk", key.publicKey)) };
}

export async function deviceFingerprint(jwk) {
  const publicJwk = fixedPublicJwk(jwk);
  // Reject malformed curve points before accepting an enrollment request.
  await crypto.subtle.importKey("jwk", publicJwk, curve, false, ["verify"]);
  return encode(await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(publicJwk))));
}

async function signedMessage({ grantId, challenge, operation, bodyText }) {
  if (typeof grantId !== "string" || !uuid.test(grantId) || typeof operation !== "string"
    || !operationName.test(operation) || typeof bodyText !== "string") {
    throw new TypeError("Invalid temporary device request");
  }
  decode(challenge, 32);
  const digest = encode(await crypto.subtle.digest("SHA-256", encoder.encode(bodyText)));
  return encoder.encode(JSON.stringify([protocol, audience, grantId, challenge, operation, digest]));
}

export async function signDeviceRequest(privateKey, fields) {
  return encode(await crypto.subtle.sign(signatureAlgorithm, privateKey, await signedMessage(fields)));
}

export async function verifyDeviceRequest(publicJwk, fields, signature) {
  try {
    const key = await crypto.subtle.importKey("jwk", fixedPublicJwk(publicJwk), curve, false, ["verify"]);
    return await crypto.subtle.verify(signatureAlgorithm, key, decode(signature, 64), await signedMessage(fields));
  } catch {
    return false;
  }
}
