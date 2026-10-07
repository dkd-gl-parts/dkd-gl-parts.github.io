// Deterministic input preparation; no network, Storage writes or provider calls.
// The codec must decode RAW pixels (without EXIF auto-orientation). This module
// applies EXIF once, followed by the operator's clockwise quarter turn.
export const ALIGNMENT_VERSION = "exif-quarter-turn-v1";
export const MAX_ALIGNMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ALIGNMENT_PIXELS = 12_500_000;
export const MAX_ALIGNMENT_EDGE = 8192;
                                             
                                                                                     
                          
                                                                       
  
export class ImageAlignmentError extends Error {
  constructor() { super("Invalid or unsupported image alignment input"); }
}
function invalid()        { throw new ImageAlignmentError(); }

export function quarterTurn(value         )              {
  if (typeof value !== "number" || ![0, 90, 180, 270].includes(value)) invalid();
  return value               ;
}
function dimensions(width        , height        )       {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > MAX_ALIGNMENT_EDGE || height > MAX_ALIGNMENT_EDGE ||
      width * height > MAX_ALIGNMENT_PIXELS) invalid();
}

function exifOrientation(data            )         {
  // APP1's Exif signature has already been checked; all offsets stay inside
  // this segment. Only the IFD0 orientation is used, never a thumbnail's IFD.
  const tiff = data.subarray(6);
  if (tiff.length < 8) invalid();
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  if (!little && !(tiff[0] === 0x4d && tiff[1] === 0x4d)) invalid();
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const u16 = (at        ) => {
    if (!Number.isSafeInteger(at) || at < 0 || at + 2 > tiff.length) invalid();
    return view.getUint16(at, little);
  };
  const u32 = (at        ) => {
    if (!Number.isSafeInteger(at) || at < 0 || at + 4 > tiff.length) invalid();
    return view.getUint32(at, little);
  };
  if (u16(2) !== 42) invalid();
  const ifd = u32(4);
  if (ifd < 8) invalid();
  const count = u16(ifd);
  if (ifd + 2 + count * 12 + 4 > tiff.length) invalid();
  let orientation = 1;
  let seen = false;
  for (let entry = ifd + 2; entry < ifd + 2 + count * 12; entry += 12) {
    if (u16(entry) !== 0x0112) continue;
    if (seen || u16(entry + 2) !== 3 || u32(entry + 4) !== 1) invalid();
    orientation = u16(entry + 8);
    if (orientation < 1 || orientation > 8) invalid();
    seen = true;
  }
  return orientation;
}

export function inspectAlignmentJpeg(bytes            )             {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12 ||
      bytes.length > MAX_ALIGNMENT_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
      bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) invalid();
  let at = 2;
  let frame                                           = null;
  let orientation = 1;
  let hasExif = false;
  const sofMarkers = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
  while (at < bytes.length - 2) {
    if (bytes[at++] !== 0xff) invalid();
    while (bytes[at] === 0xff) at++;
    const marker = bytes[at++];
    if (marker === undefined || marker === 0 || marker === 0xd8 || marker === 0xd9 ||
        (marker >= 0xd0 && marker <= 0xd7)) invalid();
    if (marker === 0x01) continue;
    if (at + 2 > bytes.length) invalid();
    const length = bytes[at] * 256 + bytes[at + 1];
    if (length < 2 || at + length > bytes.length - 2) invalid();
    const payload = bytes.subarray(at + 2, at + length);
    if (marker === 0xe1 && payload.length >= 6 &&
        [69, 120, 105, 102, 0, 0].every((b, i) => payload[i] === b)) {
      if (hasExif) invalid(); // Ambiguous EXIF blocks must not pick a winner.
      hasExif = true;
      orientation = exifOrientation(payload);
    }
    if (sofMarkers.includes(marker)) {
      // ImageScript's verified codec supports 8-bit baseline/progressive JPEG.
      if (![0xc0, 0xc2].includes(marker) || frame || payload.length < 6 || payload[0] !== 8) invalid();
      const height = payload[1] * 256 + payload[2];
      const width = payload[3] * 256 + payload[4];
      const components = payload[5];
      if (![1, 3].includes(components) || payload.length !== 6 + components * 3) invalid();
      dimensions(width, height);
      frame = { width, height };
    }
    if (marker === 0xda) {
      if (!frame || payload.length < 4 || payload.length !== 1 + payload[0] * 2 + 3) invalid();
      return { ...frame, orientation, hasExif };
    }
    at += length;
  }
  return invalid();
}

function iccSegments(bytes            )               {
  inspectAlignmentJpeg(bytes);
  const parts = new Map                    ();
  let count = 0, total = 0, at = 2;
  const signature = [73, 67, 67, 95, 80, 82, 79, 70, 73, 76, 69, 0];
  while (at < bytes.length - 2) {
    const start = at++;
    while (bytes[at] === 0xff) at++;
    const marker = bytes[at++];
    if (marker === 0x01) continue;
    const length = bytes[at] * 256 + bytes[at + 1];
    const payload = bytes.subarray(at + 2, at + length);
    if (marker === 0xe2 && signature.every((b, i) => payload[i] === b)) {
      if (payload.length < 15 || payload[12] < 1 || payload[13] < 1 || payload[12] > payload[13] ||
          parts.has(payload[12]) || (count && count !== payload[13])) invalid();
      count = payload[13]; total += payload.length - 14;
      if (total > 256 * 1024) invalid();
      parts.set(payload[12], bytes.slice(start,at + length));
    }
    if (marker === 0xda) break;
    at += length;
  }
  if (parts.size !== count) invalid();
  return Array.from({ length:count },(_,i) => parts.get(i + 1) || invalid());
}

export function alignmentIccProfile(bytes            )             {
  const segments = iccSegments(bytes);
  if (!segments.length) return new Uint8Array();
  const payloads = segments.map((segment) => {
    let at = 1;
    while (segment[at] === 0xff) at++;
    return segment.subarray(at + 3 + 14);
  });
  const profile = new Uint8Array(payloads.reduce((n,part) => n + part.length,0));
  let offset = 0;
  for (const payload of payloads) { profile.set(payload,offset); offset += payload.length; }
  const ascii = (at        ) => String.fromCharCode(...profile.subarray(at,at + 4));
  if (profile.length < 132 || new DataView(profile.buffer).getUint32(0) !== profile.length ||
      ascii(36) !== "acsp" || ascii(16) !== "RGB ") invalid();
  const tags = new DataView(profile.buffer).getUint32(128);
  if (132 + tags * 12 > profile.length) invalid();
  for (let i = 0; i < tags; i++) {
    const view = new DataView(profile.buffer);
    const at = view.getUint32(132 + i * 12 + 4), length = view.getUint32(132 + i * 12 + 8);
    if (at < 132 + tags * 12 || at + length > profile.length) invalid();
  }
  return profile;
}

function preserveIccProfile(original            , encoded            )             {
  const segments = iccSegments(original);
  if (!segments.length) return encoded;
  if (iccSegments(encoded).length) invalid();
  const bytes = new Uint8Array(encoded.length + segments.reduce((n,part) => n + part.length,0));
  if (bytes.length > MAX_ALIGNMENT_BYTES) invalid();
  bytes.set(encoded.subarray(0,2));
  let offset = 2;
  for (const segment of segments) { bytes.set(segment,offset); offset += segment.length; }
  bytes.set(encoded.subarray(2),offset);
  return bytes;
}

// EXIF coordinate mappings are composed with the quarter turn. Each original
// pixel is copied exactly once; there is no interpolation, crop, resize or AI.
export function alignRawPixels(raw           , orientation        , rotation             )            {
  dimensions(raw.width, raw.height);
  quarterTurn(rotation);
  if (!Number.isInteger(orientation) || orientation < 1 || orientation > 8 ||
      !(raw.pixels instanceof Uint8ClampedArray) || raw.pixels.length !== raw.width * raw.height * 4) invalid();
  const w = raw.width, h = raw.height;
  // [x coefficient, y coefficient, offset] for each normalized axis.
  const maps = [
    [[1, 0, 0], [0, 1, 0]], [[-1, 0, w - 1], [0, 1, 0]],
    [[-1, 0, w - 1], [0, -1, h - 1]], [[1, 0, 0], [0, -1, h - 1]],
    [[0, 1, 0], [1, 0, 0]], [[0, -1, h - 1], [1, 0, 0]],
    [[0, -1, h - 1], [-1, 0, w - 1]], [[0, 1, 0], [-1, 0, w - 1]],
  ];
  let [xMap, yMap] = maps[orientation - 1].map((v) => [...v]);
  let width = orientation >= 5 ? h : w;
  let height = orientation >= 5 ? w : h;
  const invert = (map          , size        ) => [-map[0], -map[1], size - 1 - map[2]];
  if (rotation === 90) {
    [xMap, yMap] = [invert(yMap, height), xMap];
    [width, height] = [height, width];
  } else if (rotation === 180) {
    [xMap, yMap] = [invert(xMap, width), invert(yMap, height)];
  } else if (rotation === 270) {
    [xMap, yMap] = [yMap, invert(xMap, width)];
    [width, height] = [height, width];
  }
  const pixels = new Uint8ClampedArray(raw.pixels.length);
  const output = new Uint32Array(pixels.buffer);
  const source = raw.pixels.byteOffset % 4 === 0
    ? new Uint32Array(raw.pixels.buffer, raw.pixels.byteOffset, w * h)
    : new Uint32Array(raw.pixels.slice().buffer);
  const step = xMap[0] + yMap[0] * width;
  for (let y = 0, i = 0; y < h; y++) {
    let destination = xMap[1] * y + xMap[2] + (yMap[1] * y + yMap[2]) * width;
    for (let x = 0; x < w; x++, i++, destination += step) output[destination] = source[i];
  }
  return { width, height, pixels };
}

                            
                                                   
                                                                   
  
export async function prepareAlignedJpeg(
  original            , rotation             , codec              ,
)                                                                                    {
  quarterTurn(rotation);
  const header = inspectAlignmentJpeg(original); // Bound memory before decoding.
  alignmentIccProfile(original); // Retain color space, but not EXIF/GPS metadata.
  try {
    const decoded = await codec.decodeRaw(original);
    if (decoded.width !== header.width || decoded.height !== header.height) invalid();
    const aligned = alignRawPixels(decoded, header.orientation, rotation);
    const encodedBytes = await codec.encodeJpeg(aligned, 95);
    const bytes = preserveIccProfile(original, encodedBytes);
    const encoded = inspectAlignmentJpeg(bytes);
    if (encoded.hasExif || encoded.width !== aligned.width || encoded.height !== aligned.height) invalid();
    return { bytes, header, width: aligned.width, height: aligned.height };
  } catch {
    // Never include decoder payloads, paths or exception details in errors.
    return invalid();
  }
}
