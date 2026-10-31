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

// The text of object `id`: its dictionary, and where its stream's bytes are (if it has one).
function objectBounds(text: string, id: number): { start: number; end: number } {
  const head = new RegExp(`(?:^|[\\r\\n])${id} 0 obj`).exec(text);
  if (!head) throw new Error(`The PDF has no object ${id}`);
  const start = head.index + head[0].length;
  const end = text.indexOf("endobj", start);
  if (end < 0) throw new Error(`Object ${id} does not end`);
  return { start, end };
}

function streamOf(pdf: Uint8Array, text: string, id: number): Uint8Array {
  const { start, end } = objectBounds(text, id);
  const dict = text.slice(start, end);
  const open = dict.indexOf("stream");
  if (open < 0) throw new Error(`Object ${id} has no stream`);
  let from = start + open + "stream".length;
  if (text[from] === "\r") from += 1;
  if (text[from] === "\n") from += 1;
  const close = text.lastIndexOf("endstream", end);
  let to = close;
  while (to > from && (text[to - 1] === "\n" || text[to - 1] === "\r")) to -= 1;
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
