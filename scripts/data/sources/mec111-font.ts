// The Dream-chaser Campaign Expansion's rulebook (MEC111) prints the Heading's four steps and the Sailing success symbol as
// glyphs U+F2091 to U+F2094 and U+F2090 of its embedded "LOTRLCGIcons" font (dcce.heading, dcce.sailing-tests). No icon font on
// the web carries them, so the icon sync cuts the font out of the PDF it already pins: the TrueType program and the ToUnicode
// map that names each glyph's codepoint. The PDF has no object streams, so its objects are plain text between `obj` and `endobj`.
import { inflateSync } from "node:zlib";

export const MEC111_FONT_NAME = "LOTRLCGIcons";

export type Mec111Font = { ttf: Uint8Array; unicode: string };

function latin1(body: Uint8Array): string {
  return Buffer.from(body).toString("latin1");
}

function boundsIfPresent(text: string, id: number): { start: number; end: number } | null {
  const head = new RegExp(`(?:^|[\\r\\n])${id} 0 obj`).exec(text);
  if (!head) return null;
  const start = head.index + head[0].length;
  const end = text.indexOf("endobj", start);
  return end < 0 ? null : { start, end };
}

// The text of object `id`: its dictionary, and where its stream's bytes are (if it has one).
function objectBounds(text: string, id: number): { start: number; end: number } {
  const found = boundsIfPresent(text, id);
  if (!found) throw new Error(`The PDF has no object ${id}, or it does not end`);
  return found;
}

// The stream's `/Length`, direct (`/Length 6068`) or by reference (`/Length 9 0 R`, the object holding the number); null when the dictionary has none or it cannot be read.
function lengthOf(text: string, dict: string): number | null {
  const direct = /\/Length\s+(\d+)(?!\d|\s+\d+\s+R)/.exec(dict);
  if (direct) return Number(direct[1]);
  const indirect = /\/Length\s+(\d+)\s+0\s+R/.exec(dict);
  if (!indirect) return null;
  const bounds = boundsIfPresent(text, Number(indirect[1]));
  const value = bounds ? /^\s*(\d+)\s*$/.exec(text.slice(bounds.start, bounds.end)) : null;
  return value ? Number(value[1]) : null;
}

/** The decoded stream of object `id`: the bytes its `/Length` says (a stream may contain the word "endstream"), or up to the last "endstream" of the object when the length is missing or does not end at one. */
export function streamOf(pdf: Uint8Array, text: string, id: number): Uint8Array {
  const { start, end } = objectBounds(text, id);
  const dict = text.slice(start, end);
  const open = dict.indexOf("stream");
  if (open < 0) throw new Error(`Object ${id} has no stream`);
  let from = start + open + "stream".length;
  if (text[from] === "\r") from += 1;
  if (text[from] === "\n") from += 1;
  const length = lengthOf(text, dict.slice(0, open));
  // The length is right when "endstream" follows it (after at most an end of line).
  const ends = length != null && length >= 0 && /^\s{0,2}endstream/.test(text.slice(from + length, from + length + 12));
  let to = from + (ends ? (length ?? 0) : 0);
  if (!ends) {
    to = text.lastIndexOf("endstream", end);
    while (to > from && (text[to - 1] === "\n" || text[to - 1] === "\r")) to -= 1;
  }
  const raw = pdf.subarray(from, to);
  return /\/FlateDecode/.test(dict.slice(0, open)) ? inflateSync(raw) : raw;
}

function reference(dict: string, key: string): number {
  const match = new RegExp(`/${key}\\s+(\\d+)\\s+0\\s+R`).exec(dict);
  if (!match) throw new Error(`The font dictionary has no ${key}`);
  return Number(match[1]);
}

// The dictionary of the object that holds `/<key> /XXXXXX+LOTRLCGIcons`.
function dictionaryWith(text: string, key: string): string {
  const at = new RegExp(`/${key}\\s*/[A-Z]{6}\\+${MEC111_FONT_NAME}`).exec(text);
  if (!at) throw new Error(`The MEC111 PDF has no ${MEC111_FONT_NAME} ${key}`);
  const start = Math.max(text.lastIndexOf(" obj", at.index), 0);
  return text.slice(start, text.indexOf("endobj", at.index));
}

/** The icon font's TrueType program and ToUnicode map, read out of the MEC111 PDF's bytes. */
export function mec111Font(pdf: Uint8Array): Mec111Font {
  const text = latin1(pdf);
  const fontFile = reference(dictionaryWith(text, "FontName"), "FontFile2");
  const toUnicode = reference(dictionaryWith(text, "BaseFont"), "ToUnicode");
  return { ttf: streamOf(pdf, text, fontFile), unicode: latin1(streamOf(pdf, text, toUnicode)) };
}
