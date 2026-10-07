// RAW RGB JPEG decoder adapter derived from ImageScript 1.3.0 wasm/node/jpeg.js.
// Copyright (c) 2023 Mathis Mensing. MIT; see ImageScript-1.3.0-MIT-LICENSE.txt.
// No browser image decoder: EXIF/ICC are NOT silently applied a second time.
export async function decodeRaw(bytes) {
  const response = await fetch(new URL("./jpeg-imagescript-1.3.0.wasm", import.meta.url), { credentials: "omit" });
  if (!response.ok) throw new Error("JPEG decoder unavailable");
  const binary = await response.arrayBuffer();
  if (binary.byteLength !== 91769) throw new Error("Decoder size changed");
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",binary)), b => b.toString(16).padStart(2,"0")).join("");
  if (digest !== "019bcef4d864045e9b2df7e39ef6e7f3227d80b08a33742e1438441f2ddc2368") throw new Error("Decoder integrity changed");
  const { instance } = await WebAssembly.instantiate(binary);
  const wasm = instance.exports;
  const inputPtr = wasm.walloc(bytes.length);
  new Uint8Array(wasm.memory.buffer, inputPtr, bytes.length).set(bytes);
  const ptr = wasm.decode(inputPtr, bytes.length, 0, 0);
  if (!ptr || ptr === 1) throw new Error("JPEG decode failed");
  try {
    const width = wasm.decode_width(ptr), height = wasm.decode_height(ptr);
    const count = width * height;
    // decode_buffer sets the WASM ABI's last-result length; read it AFTER that
    // accessor (same evaluation order as the pinned upstream adapter).
    const bufferPtr = wasm.decode_buffer(ptr), length = wasm.wlen();
    if (!Number.isSafeInteger(count) || count < 1 || count > 12500000 ||
        width > 8192 || height > 8192 || wasm.decode_format(ptr) !== 1 || length !== count * 3) {
      throw new Error("Unsupported bounded RGB JPEG");
    }
    const rgb = new Uint8Array(wasm.memory.buffer, bufferPtr, count * 3);
    const pixels = new Uint8ClampedArray(count * 4); pixels.fill(255);
    for (let i = 0; i < count; i++) pixels.set(rgb.subarray(i * 3, i * 3 + 3), i * 4);
    return { width, height, pixels };
  } finally { wasm.decode_free(ptr); }
}
