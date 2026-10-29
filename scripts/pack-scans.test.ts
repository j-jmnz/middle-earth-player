import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { sha256 } from "./data/sources/fetch.ts";
import { createLog } from "./log.ts";
import { MAX_SIDE, packScans, shrinkToMaxSide } from "./pack-scans.ts";
import sharp from "sharp";

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
  const pictures = path.join(root, "pictures");
  const pdfs = path.join(root, "pdf");
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
  insert.run("01134", "Appointed by Fate", "/bundles/cards/01134.png");
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
    pictures,
    sources,
    pin,
    options: {
      fixturesDir: fixtures,
      catalogDb: catalog,
      sourcesPath: sources,
      scanCacheDir: cache,
      pictureCacheDir: pictures,
      pdfCacheDir: pdfs,
      scansDir: path.join(root, "scans"),
      mapPath: path.join(root, "scan-map.ts"),
      shrink: (body: Uint8Array) => Promise.resolve(body),
    },
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

  it("bundles a card's picture in place of its scan, and a page of FFG's PDFs rendered from the pinned PDF", async () => {
    const staged = stage();
    const pdf = Buffer.from("%PDF-1.7 campaign cards");
    const pdfUrl = "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/core_set_campaign_cards.pdf";
    const pictureUrl = "https://images.cardgame.tools/lotr/MEC32-31-front-Location-Bag_End.jpg";
    const sources = JSON.parse(readFileSync(staged.sources, "utf8")) as { sources: Record<string, unknown> };
    sources.sources.pictures = {
      files: [
        { path: "pdf/core_set_campaign_cards.pdf", url: pdfUrl, sha256: sha256(pdf), bytes: pdf.length },
        { ...staged.pin("141031", pictureUrl, jpeg(2100)), path: "pictures/141031.A.jpg" },
        { ...staged.pin("01134", `${pdfUrl}#page=23`, jpeg(2097)), path: "pictures/01134.A.jpg" },
      ],
    };
    writeFileSync(staged.sources, JSON.stringify(sources));
    const fetched: string[] = [];
    const rendered: number[] = [];
    const packed = await packScans(
      {
        ...staged.options,
        fetch: (url) => {
          fetched.push(url);
          if (url === pdfUrl) return Promise.resolve(new Uint8Array(pdf));
          return Promise.resolve(new Uint8Array(url === pictureUrl ? jpeg(2100) : jpeg(560)));
        },
        render: (_file, page) => {
          rendered.push(page);
          return new Uint8Array(jpeg(2097));
        },
      },
      log,
    );
    expect(fetched).toEqual([pdfUrl, THREE_URL, pictureUrl]);
    expect(rendered).toEqual([23]);
    // Appointed by Fate has a RingsDB picture, but FFG's page is bundled in its place.
    expect(packed.map((entry) => [entry.code, entry.height])).toEqual([
      ["01134", 2097],
      ["141022", 560],
      ["141031", 2100],
    ]);
    expect(readFileSync(path.join(staged.pictures, "01134.A.jpg"))).toEqual(jpeg(2097));
  });

  it("scales a picture down to the bundle's size and keeps a small one byte for byte", async () => {
    const large = new Uint8Array(await sharp({ create: { width: 1480, height: 2100, channels: 3, background: "#406080" } }).jpeg().toBuffer());
    const small = new Uint8Array(jpeg(600));
    const shrunk = await sharp(Buffer.from(await shrinkToMaxSide(large))).metadata();
    expect([shrunk.width, shrunk.height]).toEqual([846, MAX_SIDE]);
    expect(await shrinkToMaxSide(small)).toBe(small);
  });
});
