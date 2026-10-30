import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { BOOKLETS } from "../src/screens/booklets/books.ts";
import { sha256 } from "./data/sources/fetch.ts";
import { createLog } from "./log.ts";
import { BOOKLET_SOURCES, packBooklets } from "./pack-booklets.ts";

const roots: string[] = [];
const log = createLog("test");

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const body = (name: string) => new TextEncoder().encode(`%PDF-1.7 ${name}`);

function stage(cached: Record<string, Uint8Array>) {
  const root = mkdtempSync(path.join(tmpdir(), "pack-booklets-"));
  roots.push(root);
  const pdfCacheDir = path.join(root, "pdf");
  mkdirSync(pdfCacheDir);
  const files = Object.values(BOOKLET_SOURCES).map((file) => ({ path: `pdf/${file}`, url: `https://example.test/${file}`, sha256: sha256(body(file)), bytes: body(file).length }));
  const sourcesPath = path.join(root, "sources.json");
  writeFileSync(sourcesPath, JSON.stringify({ sources: { rules: { id: "rules", files } } }));
  for (const [file, bytes] of Object.entries(cached)) writeFileSync(path.join(pdfCacheDir, file), bytes);
  return { sourcesPath, pdfCacheDir, outDir: path.join(root, "booklets") };
}

describe("pack booklets", () => {
  it("names a pinned source for every booklet id", () => {
    expect(Object.keys(BOOKLET_SOURCES).sort()).toEqual(BOOKLETS.map((book) => book.id).sort());
    const pinned = (JSON.parse(readFileSync(path.join(import.meta.dirname, "../data/sources.json"), "utf8")) as { sources: { rules: { files: { path: string }[] } } }).sources.rules.files.map((file) => file.path);
    for (const file of Object.values(BOOKLET_SOURCES)) expect(pinned).toContain(`pdf/${file}`);
  });

  it("copies cached PDFs at their pin and fetches the rest", async () => {
    const mec109 = BOOKLET_SOURCES["fellowship-of-the-ring"];
    const ltp = BOOKLET_SOURCES["learn-to-play"];
    const staged = stage({ [mec109]: body(mec109), [ltp]: body("stale") });
    const fetched: string[] = [];
    const packed = await packBooklets(
      {
        ...staged,
        fetch: async (url) => {
          fetched.push(url);
          return body(path.basename(url));
        },
      },
      log,
    );
    expect(packed.map((book) => book.filename)).toEqual(["fellowship-of-the-ring.pdf", "learn-to-play.pdf", "rules-reference.pdf", "the-dark-of-mirkwood.pdf"]);
    // Only the stale cached copy and the books with no cached copy are fetched.
    expect(fetched).toEqual([ltp, BOOKLET_SOURCES["rules-reference"], BOOKLET_SOURCES["the-dark-of-mirkwood"]].map((file) => `https://example.test/${file}`));
    expect(readFileSync(path.join(staged.outDir, "learn-to-play.pdf"))).toEqual(Buffer.from(body(ltp)));
    const map = readFileSync(path.join(staged.outDir, "bundled-map.ts"), "utf8");
    expect(map).toContain(`"fellowship-of-the-ring": { moduleId: require("./fellowship-of-the-ring.pdf") as number, filename: "${mec109}", bytes: ${body(mec109).length}, sha256: "${sha256(body(mec109))}" },`);
  });

  it("fails when the fetched bytes do not match the pin", async () => {
    const staged = stage({});
    await expect(packBooklets({ ...staged, fetch: async () => body("changed") }, log)).rejects.toThrow(/pinned/);
  });

  it("keeps the committed map empty", () => {
    const map = readFileSync(path.join(import.meta.dirname, "../src/screens/booklets/bundled-map.ts"), "utf8");
    expect(map).toContain("bundledBooklets: Partial<Record<string, BundledBooklet>> = {};");
  });
});

describe("the booklet sources", () => {
  it("bundle four books: the two campaign books, Learn to Play and the Rules Reference, each from its pinned file", () => {
    expect(BOOKLETS.map((book) => book.id)).toEqual(["fellowship-of-the-ring", "learn-to-play", "rules-reference", "the-dark-of-mirkwood"]);
    expect(BOOKLET_SOURCES["rules-reference"]).toBe("mec101_rules_reference.pdf");
    expect(BOOKLET_SOURCES["the-dark-of-mirkwood"]).toBe("dark_of_mirkwood_rulebook_v2.pdf");
  });
});
