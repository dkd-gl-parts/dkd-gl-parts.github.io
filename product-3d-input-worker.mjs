import { prepareAlignedJpeg, MAX_ALIGNMENT_BYTES } from "./vendor/product3d-inputs/alignment-exif-v1.mjs";
import { decodeRaw } from "./vendor/product3d-inputs/jpeg-raw-imagescript-1.3.0.mjs";
import { encode } from "./vendor/product3d-inputs/jpeg-encoder-0.4.4-bounded-v1.mjs";
let used = false;
const hashPattern = /^[a-f0-9]{64}$/;
async function hash(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
}
self.onmessage = async function (event) {
  if (used) return;
  used = true;
  try {
    const input = event.data;
    if (!input || !(input.bytes instanceof ArrayBuffer) || !hashPattern.test(input.source_sha256) ||
        !hashPattern.test(input.sha256) || input.bytes.byteLength !== input.source_bytes ||
        input.bytes.byteLength > MAX_ALIGNMENT_BYTES) throw new Error("Input mismatch");
    const original = new Uint8Array(input.bytes);
    if (await hash(original) !== input.source_sha256) throw new Error("Source mismatch");
    const prepared = await prepareAlignedJpeg(original, input.rotation_clockwise, {
      decodeRaw, async encodeJpeg(raw, quality) {
        return encode({ width:raw.width, height:raw.height, data:raw.pixels },quality).data;
      },
    });
    if (prepared.width !== input.width || prepared.height !== input.height ||
        prepared.bytes.length !== input.output_bytes || await hash(prepared.bytes) !== input.sha256) {
      throw new Error("Prepared content differs from reviewed output");
    }
    const bytes = new Uint8Array(prepared.bytes).buffer;
    self.postMessage({ ok:true, bytes },[bytes]);
  } catch (_) { self.postMessage({ ok:false }); }
};
