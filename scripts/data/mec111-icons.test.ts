import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ICONS } from "../../src/play/icons/generated.ts";
import { MEC111_ICONS, parseToUnicode } from "./icons.ts";
import { RAW_DIR } from "./paths.ts";
import { sha256 } from "./sources/fetch.ts";
import { glyphPath } from "./ttf-glyphs.ts";

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
