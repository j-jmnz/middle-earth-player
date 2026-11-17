// What the web store checks about a picked file before it keeps it (docs/brief.md, Persistence and shipping, booklets). The page
// count pdf.js reads is the second check; this one runs first and costs nothing.

// A PDF's header, `%PDF-`, may sit anywhere in its first 1024 bytes (the spec's allowance for a file with leading junk).
const HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;
const HEADER_WINDOW = 1024;

export function looksLikePdf(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, HEADER_WINDOW) - HEADER.length;
  for (let start = 0; start <= end; start += 1) {
    if (HEADER.every((byte, offset) => bytes[start + offset] === byte)) return true;
  }
  return false;
}

export function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
