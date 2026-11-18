// The pixel size a PNG or JPEG file declares in its header, read without decoding it: the web table decodes a picture straight to the size its card
// needs (play/canvas/table-images.canvaskit.ts), and that size is worked out from the file's. The same reading as sniffImage in
// src/screens/images/policy.ts, which src/play may not import, and which stays where it is: moving it would change the phone's bundle.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const uint16 = (bytes: Uint8Array, at: number): number => ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
const uint32 = (bytes: Uint8Array, at: number): number => ((bytes[at] ?? 0) * 0x1000000 + ((bytes[at + 1] ?? 0) << 16)) + ((bytes[at + 2] ?? 0) << 8) + (bytes[at + 3] ?? 0);

function pngSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 24 || PNG_SIGNATURE.some((byte, at) => bytes[at] !== byte)) return null;
  if (String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0) !== "IHDR") return null;
  const w = uint32(bytes, 16);
  const h = uint32(bytes, 20);
  return w > 0 && h > 0 ? { w, h } : null;
}

// A JPEG's size is in its start-of-frame segment (baseline 0xC0, progressive 0xC2); the segments before it are skipped by their lengths.
function jpegSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 3 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    while (at < bytes.length && bytes[at] === 0xff) at += 1;
    const marker = bytes[at] ?? 0;
    at += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = uint16(bytes, at);
    if (length < 2) return null;
    if (marker === 0xc0 || marker === 0xc2) {
      const h = uint16(bytes, at + 3);
      const w = uint16(bytes, at + 5);
      return w > 0 && h > 0 ? { w, h } : null;
    }
    at += length;
  }
  return null;
}

/** The width and height (pixels) a PNG or JPEG declares, or null for any other file or a header that does not read. */
export function encodedSize(bytes: Uint8Array): { w: number; h: number } | null {
  return pngSize(bytes) ?? jpegSize(bytes);
}
