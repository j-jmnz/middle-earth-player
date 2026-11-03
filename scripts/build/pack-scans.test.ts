import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { sniffImage } from "../../src/screens/images/policy.ts";
import { sha256 } from "../data/sources/fetch.ts";
import { createLog } from "../log.ts";
import { MAX_SIDE, packScans, sceneOf, shrinkToMaxSide } from "./pack-scans.ts";
import { SCENE_PICTURE } from "../../src/screens/art-crop.ts";
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
  const cache = path.join(root, "cache");
  const pictures = path.join(root, "pictures");
  const pdfs = path.join(root, "pdf");
  mkdirSync(cache, { recursive: true });
  const catalog = path.join(root, "catalog.db");
  const database = new Database(catalog);
  database.exec("create table cards (code text primary key, name text not null, imagesrc text, type_code text not null default 'ally')");
  const insert = database.prepare("insert into cards (code, name, imagesrc) values (?, ?, ?)");
  insert.run("141031", "Bag End", null);
  insert.run("141001", "Frodo Baggins", "/bundles/cards/141001.png");
  insert.run("141022", "Three is Company", THREE_URL);
  insert.run("01134", "Appointed by Fate", "/bundles/cards/01134.png");
  insert.run("99999", "Unpinned", null);
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
  writeFileSync(path.join(cache, "141031.B.jpg"), jpeg(600));
  writeFileSync(path.join(cache, "141022.A.jpg"), jpeg(100));
  writeFileSync(path.join(cache, "141001.A.jpg"), jpeg(600));
  return {
    cache,
    pictures,
    sources,
    pin,
    options: {
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
  it("bundles side A of every catalog card with a pin and side B where one is pinned, from the cache at its pin or else from the pinned URL", async () => {
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
    expect(readdirSync(staged.options.scansDir).sort()).toEqual([".packed.json", "141001.jpg", "141022.jpg", "141031.B.jpg", "141031.jpg"]);
    expect(packed.find((entry) => entry.code === "141031")).toMatchObject({ width: 423, height: 600 });
    expect(readFileSync(path.join(staged.cache, "141022.A.jpg"))).toEqual(jpeg(560));
    const map = readFileSync(staged.options.mapPath, "utf8");
    expect(map).toContain('"141031": { moduleId: require("../../../assets/scans/141031.jpg")');
    // Side B is keyed `<code>.B` (src/play/canvas/picture-key.ts); a card with no side B pin has no such key.
    expect(map).toContain('"141031.B": { moduleId: require("../../../assets/scans/141031.B.jpg")');
    expect(map).not.toContain("141022.B");
    expect(map).toContain("141022");
    expect(map).toContain("141001");
    expect(map).not.toContain("99999");
  });

  it("keeps a picture packed from the same pin, and packs one again when its pin moves", async () => {
    const staged = stage();
    const fetch = () => Promise.resolve(new Uint8Array(jpeg(560)));
    const first = await packScans({ ...staged.options, fetch }, log);
    const shrunk: string[] = [];
    const shrink = (body: Uint8Array) => {
      shrunk.push(String(sniffImage(body)?.height));
      return Promise.resolve(body);
    };
    // Nothing moved: every picture is kept, nothing is loaded, and the map is the same.
    const again = await packScans({ ...staged.options, shrink, fetch: () => Promise.reject(new Error("offline")) }, log);
    expect(shrunk).toEqual([]);
    expect(again).toEqual(first);
    // Bag End's side A pin moves (a data:sync pictures): only it is packed again.
    const sources = JSON.parse(readFileSync(staged.sources, "utf8")) as { sources: { scans: { files: { path: string }[] } } };
    sources.sources.scans.files = sources.sources.scans.files.map((file) => (file.path === "scans/141031.A.jpg" ? staged.pin("141031", BAG_END_URL, jpeg(700)) : file));
    writeFileSync(staged.sources, JSON.stringify(sources));
    writeFileSync(path.join(staged.cache, "141031.A.jpg"), jpeg(700));
    const moved = await packScans({ ...staged.options, shrink }, log);
    expect(shrunk).toEqual(["700"]);
    expect(moved.find((entry) => entry.code === "141031")).toMatchObject({ height: 700 });
  });

  it("fails when the fetched bytes do not match the pin", async () => {
    const staged = stage();
    await expect(packScans({ ...staged.options, fetch: () => Promise.resolve(new Uint8Array(jpeg(300))) }, log)).rejects.toThrow(
      /pinned .*pnpm data:sync scans/,
    );
  });

  it("bundles a card's picture in place of its scan, and renders a page of FFG's PDFs from the pinned PDF", async () => {
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
    expect(fetched.sort()).toEqual([pdfUrl, pictureUrl, THREE_URL].sort());
    expect(rendered).toEqual([23]);
    expect(packed.map((entry) => [entry.code, entry.height])).toEqual([
      ["01134", 2097],
      ["141001", 600],
      ["141022", 560],
      ["141031", 2100],
      ["141031.B", 600],
    ]);
    expect(readFileSync(path.join(staged.pictures, "01134.A.jpg"))).toEqual(jpeg(2097));
  });

  it("bundles the scan of a PDF page when pdftoppm is missing, and keeps going", async () => {
    const staged = stage();
    const pdf = Buffer.from("%PDF-1.7 campaign cards");
    const pdfUrl = "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/core_set_campaign_cards.pdf";
    const sources = JSON.parse(readFileSync(staged.sources, "utf8")) as { sources: Record<string, { files: unknown[] }> };
    sources.sources.pictures = {
      files: [
        { path: "pdf/core_set_campaign_cards.pdf", url: pdfUrl, sha256: sha256(pdf), bytes: pdf.length },
        { ...staged.pin("141031", `${pdfUrl}#page=1`, jpeg(2097)), path: "pictures/141031.A.jpg" },
      ],
    };
    writeFileSync(staged.sources, JSON.stringify(sources));
    const packed = await packScans(
      {
        ...staged.options,
        fetch: (url) => Promise.resolve(new Uint8Array(url === pdfUrl ? pdf : jpeg(560))),
        render: () => {
          throw Object.assign(new Error("spawnSync pdftoppm ENOENT"), { code: "ENOENT" });
        },
      },
      log,
    );
    // Bag End's page could not be rendered: its scan is bundled instead.
    expect(packed.find((entry) => entry.code === "141031")).toMatchObject({ height: 600 });
  });

  it("bundles each scenario's scene on its own beside its first quest card, keyed `<code>.scene`", async () => {
    const staged = stage();
    const packed = await packScans(
      { ...staged.options, fetch: () => Promise.resolve(new Uint8Array(jpeg(560))), sceneCodes: new Set(["141022"]), scene: () => Promise.resolve(new Uint8Array(jpeg(200))) },
      log,
    );
    expect(readdirSync(staged.options.scansDir)).toContain("141022.scene.jpg");
    expect(packed.filter((entry) => entry.code.endsWith(".scene")).map((entry) => entry.code)).toEqual(["141022.scene"]);
    expect(readFileSync(staged.options.mapPath, "utf8")).toContain('"141022.scene": { moduleId: require("../../../assets/scans/141022.scene.jpg")');
  });

  it("cuts a scene from the laid-down quest picture at the source's own size", async () => {
    const upright = new Uint8Array(await sharp({ create: { width: 1412, height: 1927, channels: 3, background: "#806040" } }).jpeg().toBuffer());
    const scene = await sharp(Buffer.from(await sceneOf(upright, "quest"))).metadata();
    expect([scene.width, scene.height]).toEqual([Math.round(SCENE_PICTURE.w * 1927), Math.round(SCENE_PICTURE.h * 1412)]);
  });

  it("scales a picture down to the bundle's size and keeps a small one byte for byte", async () => {
    const large = new Uint8Array(await sharp({ create: { width: 1480, height: 2100, channels: 3, background: "#406080" } }).jpeg().toBuffer());
    const small = new Uint8Array(jpeg(600));
    const shrunk = await sharp(Buffer.from(await shrinkToMaxSide(large))).metadata();
    expect([shrunk.width, shrunk.height]).toEqual([846, MAX_SIDE]);
    expect(await shrinkToMaxSide(small)).toBe(small);
  });

  it("lays an upright quest picture down, each kind its own way, and re-encodes a PNG", async () => {
    // A picture whose left half is dark: turned clockwise, the dark half is the top.
    const upright = new Uint8Array(
      await sharp({ create: { width: 700, height: 1000, channels: 3, background: "#ffffff" } })
        .composite([{ input: { create: { width: 350, height: 1000, channels: 3, background: "#000000" } }, left: 0, top: 0 }])
        .png()
        .toBuffer(),
    );
    const darkTop = async (body: Uint8Array) => {
      const { data, info } = await sharp(Buffer.from(body)).greyscale().raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([1000, 700]);
      return (data[10 * info.width + 500] ?? 255) < 128;
    };
    expect(await darkTop(await shrinkToMaxSide(upright, "quest"))).toBe(true);
    expect(await darkTop(await shrinkToMaxSide(upright, "player-side-quest"))).toBe(false);
    // A quest's side B is filed the other way up.
    expect(await darkTop(await shrinkToMaxSide(upright, "quest", "B"))).toBe(false);
    const png = await shrinkToMaxSide(upright, "ally");
    expect(await sharp(Buffer.from(png)).metadata()).toMatchObject({ format: "jpeg", width: 700, height: 1000 });
  });
});
