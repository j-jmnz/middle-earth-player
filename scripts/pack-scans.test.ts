import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { matchShelfScan, packScans, shelfFetchArgs } from "./pack-scans.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function jpeg(height: number): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xfe, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, (height >> 8) & 0xff, height & 0xff,
    0x01,
    0xa7,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xd9,
  ]);
}

function stage(): { root: string; fixtures: string; reading: string; scans: string; map: string; catalog: string } {
  const root = mkdtempSync(path.join(tmpdir(), "pack-scans-"));
  roots.push(root);
  const fixtures = path.join(root, "fixtures");
  const reading = path.join(root, "reading");
  const scans = path.join(root, "scans");
  const ringsdb = path.join(reading, "ringsdb");
  for (const dir of [fixtures, path.join(root, "sources", "ringsdb")]) {
    mkdirSync(dir, { recursive: true });
  }
  mkdirSync(ringsdb, { recursive: true });
  writeFileSync(
    path.join(fixtures, "scenario.json"),
    JSON.stringify({
      cards: [
        { code: "141031" },
        { code: "141001" },
        { code: "141022" },
      ],
    }),
  );
  const catalog = path.join(root, "catalog.db");
  const database = new Database(catalog);
  database.exec("create table cards (code text primary key, name text not null, imagesrc text)");
  const insert = database.prepare("insert into cards (code, name, imagesrc) values (?, ?, ?)");
  insert.run("141031", "Bag End", null);
  insert.run("141001", "Frodo Baggins", "/bundles/cards/141001.png");
  insert.run("141022", "Three is Company", null);
  database.close();
  writeFileSync(path.join(reading, "Bag-End.jpg"), jpeg(600));
  writeFileSync(path.join(ringsdb, "Bag-End.jpg"), jpeg(100));
  writeFileSync(path.join(root, "sources", "ringsdb", "141001.jpg"), jpeg(100));
  writeFileSync(path.join(reading, "Bag-End.pdf"), "%PDF-1.1");
  writeFileSync(path.join(reading, "rules.pdf"), "%PDF-1.1");
  writeFileSync(path.join(reading, "Three-is-Company-1A.jpg"), jpeg(560));
  writeFileSync(path.join(reading, "Three-is-Company-1B.jpg"), jpeg(560));
  writeFileSync(path.join(reading, "Frodo-Baggins.jpg"), jpeg(600));
  return { root, fixtures, reading, scans, map: path.join(root, "scan-map.ts"), catalog };
}

describe("pack scans", () => {
  it("copies a null-imagesrc code, skips imagesrc, and skips RingsDB previews and PDFs", () => {
    const staged = stage();
    const packed = packScans({
      root: staged.root,
      fixturesDir: staged.fixtures,
      catalogDb: staged.catalog,
      readingDir: staged.reading,
      scansDir: staged.scans,
      mapPath: staged.map,
      fetchShelf: () => {
        throw new Error("shelf fetch should not run when the files are present");
      },
    });
    const names = readdirSync(staged.scans).sort();
    expect(names).toEqual(["141022.jpg", "141031.jpg"]);
    expect(packed.map((entry) => entry.code).sort()).toEqual(["141022", "141031"]);
    expect(packed.find((entry) => entry.code === "141031")).toMatchObject({ width: 423, height: 600 });
    expect(readFileSync(path.join(staged.scans, "141031.jpg"))).toEqual(jpeg(600));
    const map = readFileSync(staged.map, "utf8");
    expect(map).toContain("141031");
    expect(map).toContain("141022");
    expect(map).not.toContain("141001");
    expect(map).not.toContain(".pdf");
    expect(map).not.toContain("ringsdb");
    expect(
      matchShelfScan("Three is Company", [
        { path: path.join(staged.reading, "Three-is-Company-1B.jpg") },
        { path: path.join(staged.reading, "Three-is-Company-1A.jpg") },
      ]),
    ).toContain("Three-is-Company-1A.jpg");
  });

  it("fetches the shelf once when a shipped code has no file, without RingsDB image flags", () => {
    const staged = stage();
    rmSync(path.join(staged.reading, "Bag-End.jpg"));
    let fetches = 0;
    packScans({
      root: staged.root,
      fixturesDir: staged.fixtures,
      catalogDb: staged.catalog,
      readingDir: staged.reading,
      scansDir: staged.scans,
      mapPath: staged.map,
      fetchShelf: () => {
        fetches += 1;
        writeFileSync(path.join(staged.reading, "Bag-End.jpg"), jpeg(600));
      },
    });
    expect(fetches).toBe(1);
    expect(readdirSync(staged.scans)).toContain("141031.jpg");
    expect(shelfFetchArgs()).not.toContain("--all-ringsdb-images");
  });
});
