export function displayRequestNumber(grantId) {
  return (Number.parseInt(grantId.slice(0, 8), 16) % 1000000).toString().padStart(6, "0");
}

export function displayPairingCode(code) {
  const digits = Number.parseInt(code, 16).toString().padStart(8, "0");
  return digits.slice(0, 4) + "-" + digits.slice(4);
}

export function readPairingCode(input) {
  const normalized = input.normalize("NFKC").trim();
  // An in-flight request may still be displaying the previous hexadecimal format.
  if (/^[0-9A-Fa-f]{6}$/.test(normalized)) return normalized.toUpperCase();
  const digits = normalized.replace(/[\s-]/g, "");
  if (!/^\d{8}$/.test(digits) || Number(digits) > 0xffffff) return null;
  return Number(digits).toString(16).toUpperCase().padStart(6, "0");
}
