import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { sha256 } from "./data/sources/fetch.ts";
import { createLog } from "./log.ts";
import { packScans } from "./pack-scans.ts";

const roots: string[] = [];
const log = createLog("pack-scans");

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

const BAG_END_URL = "https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/The-Black-Riders/Bag-End.jpg";
const THREE_URL = "https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/The-Black-Riders/Three-is-Company-1A.jpg";

function stage() {
  const root = mkdtempSync(path.join(tmpdir(), "pack-scans-"));
  roots.push(root);
  const fixtures = path.join(root, "fixtures");
  const cache = path.join(root, "cache");
  mkdirSync(fixtures, { recursive: true });
  mkdirSync(cache, { recursive: true });
  writeFileSync(path.join(fixtures, "scenario.json"), JSON.stringify({ cards: [{ code: "141031" }, { code: "141001" }, { code: "141022" }] }));
  const catalog = path.join(root, "catalog.db");
  const database = new Database(catalog);
  database.exec("create table cards (code text primary key, name text not null, imagesrc text)");
  const insert = database.prepare("insert into cards (code, name, imagesrc) values (?, ?, ?)");
  insert.run("141031", "Bag End", null);
  insert.run("141001", "Frodo Baggins", "/bundles/cards/141001.png");
  insert.run("141022", "Three is Company", THREE_URL);
  database.close();
  const pin = (code: string, url: string, body: Buffer) => ({ path: `scans/${code}.A.jpg`, url, sha256: sha256(body), bytes: body.length });
  const sources = path.join(root, "sources.json");
  writeFileSync(
    sources,
    JSON.stringify({
      sources: {
        scans: {
          files: [
            pin("141031", BAG_END_URL, jpeg(600)),
            { ...pin("141031", BAG_END_URL, jpeg(600)), path: "scans/141031.B.jpg" },
            pin("141022", THREE_URL, jpeg(560)),
            pin("141001", "https://example.invalid/frodo.jpg", jpeg(600)),
          ],
        },
      },
    }),
  );
  writeFileSync(path.join(cache, "141031.A.jpg"), jpeg(600));
  writeFileSync(path.join(cache, "141022.A.jpg"), jpeg(100));
  return {
    cache,
    options: { fixturesDir: fixtures, catalogDb: catalog, sourcesPath: sources, scanCacheDir: cache, scansDir: path.join(root, "scans"), mapPath: path.join(root, "scan-map.ts") },
  };
}

describe("pack scans", () => {
  it("bundles side A of each card with no RingsDB path, from the cache at its pin or else from the pinned URL", async () => {
    const staged = stage();
    const fetched: string[] = [];
    const packed = await packScans(
      {
        ...staged.options,
        fetch: (url) => {
          fetched.push(url);
          return Promise.resolve(new Uint8Array(jpeg(560)));
        },
      },
      log,
    );
    expect(fetched).toEqual([THREE_URL]);
    expect(readdirSync(staged.options.scansDir).sort()).toEqual(["141022.jpg", "141031.jpg"]);
    expect(packed.find((entry) => entry.code === "141031")).toMatchObject({ width: 423, height: 600 });
    expect(readFileSync(path.join(staged.cache, "141022.A.jpg"))).toEqual(jpeg(560));
    const map = readFileSync(staged.options.mapPath, "utf8");
    expect(map).toContain('"141031": { moduleId: require("../../../assets/scans/141031.jpg")');
    expect(map).toContain("141022");
    expect(map).not.toContain("141001");
  });

  it("fails when the fetched bytes do not match the pin", async () => {
    const staged = stage();
    await expect(packScans({ ...staged.options, fetch: () => Promise.resolve(new Uint8Array(jpeg(300))) }, log)).rejects.toThrow(
      /pinned .*pnpm data:sync scans/,
    );
  });
});
