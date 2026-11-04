import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ICONS } from "../../src/ui/icons/generated.ts";
import { MEC111_ICONS, parseToUnicode } from "./icons.ts";
import { RAW_DIR } from "./paths.ts";
import { sha256 } from "./sources/fetch.ts";
import { glyphPath } from "./ttf-glyphs.ts";
import { streamOf } from "./sources/mec111-font.ts";

// The Heading's four steps and the Sailing success symbol (dcce.heading, dcce.sailing-tests) are glyphs U+F2090 to U+F2094 of the MEC111 rulebook's
// embedded icon font. The sync keeps the font program and its ToUnicode map under data/raw/icons; the build cuts each glyph's outline.
const raw = (name: string) => readFileSync(path.join(RAW_DIR, "icons", name));

describe("the MEC111 icon font", () => {
  it("names the five codepoints the rules quote, and each is a glyph of the kept font", () => {
    const map = parseToUnicode(raw("mec111-icons.unicode.txt").toString("utf8"));
    expect([...map.values()].sort((a, b) => a - b)).toEqual([0xf2090, 0xf2091, 0xf2092, 0xf2093, 0xf2094]);
    expect(MEC111_ICONS.map((icon) => icon.codepoint).sort((a, b) => a - b)).toEqual([...map.values()].sort((a, b) => a - b));
  });

  it("gives each glyph a closed outline of its own", () => {
    const ttf = new Uint8Array(raw("mec111-icons.ttf"));
    const paths = new Set<string>();
    for (let index = 1; index <= 5; index += 1) {
      const d = glyphPath(ttf, index);
      expect(d.startsWith("M")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
      expect(d).not.toMatch(/NaN/);
      paths.add(d);
    }
    expect(paths.size).toBe(5);
  });

  it("is pinned in data/sources.json against the MEC111 PDF's URL", () => {
    const sources = JSON.parse(readFileSync(path.join(RAW_DIR, "..", "sources.json"), "utf8")) as { sources: { icons: { files: { path: string; url: string; sha256: string }[] } } };
    for (const name of ["mec111-icons.ttf", "mec111-icons.unicode.txt"]) {
      const file = sources.sources.icons.files.find((entry) => entry.path === `raw/icons/${name}`);
      expect(file?.url).toMatch(/MEC111\.pdf$/);
      expect(file?.sha256).toBe(sha256(raw(name)));
    }
  });

  it("builds an icon per name, each from that URL", () => {
    for (const icon of MEC111_ICONS) {
      const record = ICONS[icon.name as keyof typeof ICONS];
      expect(record.kind).toBe("vector");
      expect(record.source).toMatch(/MEC111\.pdf$/);
    }
  });
});

describe("reading the PDF and its ToUnicode map", () => {
  const text = (body: string) => ({ bytes: new Uint8Array(Buffer.from(body, "latin1")), text: body });

  it("honours a stream's /Length, even when the data holds the word endstream, and an indirect /Length", () => {
    const data = "foo endstream bar";
    const direct = text(`1 0 obj\n<< /Length ${data.length} >>\nstream\n${data}\nendstream\nendobj\n`);
    expect(Buffer.from(streamOf(direct.bytes, direct.text, 1)).toString("latin1")).toBe(data);
    const indirect = text(`1 0 obj\n<< /Length 2 0 R >>\nstream\r\n${data}\r\nendstream\nendobj\n2 0 obj\n${data.length}\nendobj\n`);
    expect(Buffer.from(streamOf(indirect.bytes, indirect.text, 1)).toString("latin1")).toBe(data);
    // A wrong length falls back to the object's own endstream.
    const wrong = text(`1 0 obj\n<< /Length 3 >>\nstream\nabcdef\nendstream\nendobj\n`);
    expect(Buffer.from(streamOf(wrong.bytes, wrong.text, 1)).toString("latin1")).toBe("abcdef");
    // A two-digit indirect length is not read as its first digit.
    const twelve = text(`1 0 obj\n<< /Length 12 0 R >>\nstream\nabcdef\nendstream\nendobj\n`);
    expect(Buffer.from(streamOf(twelve.bytes, twelve.text, 1)).toString("latin1")).toBe("abcdef");
  });

  it("reads every bfchar block and every bfrange of a ToUnicode map", () => {
    const map = parseToUnicode(`/CIDInit begincmap 1 begincodespacerange <0000> <FFFF> endcodespacerange
2 beginbfchar <0001> <DB88DC90> <0002> <0041> endbfchar
1 beginbfrange <0003> <0005> <DB88DC91> endbfrange
1 beginbfchar <0006> <0042> endbfchar
1 beginbfrange <0007> <0008> [<0043> <0050>] endbfrange endcmap`);
    expect([...map]).toEqual([[1, 0xf2090], [2, 0x41], [6, 0x42], [3, 0xf2091], [4, 0xf2092], [5, 0xf2093], [7, 0x43], [8, 0x50]]);
  });

  it("refuses a glyph the font does not have", () => {
    const ttf = new Uint8Array(raw("mec111-icons.ttf"));
    expect(() => glyphPath(ttf, 6000)).toThrow(/not in the font/);
    expect(() => glyphPath(ttf, -1)).toThrow(/not in the font/);
  });
});
