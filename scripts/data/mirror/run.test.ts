import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLog } from "../../log.ts";
import { sha256, type SourceFile, type SourceRecord } from "../sources/fetch.ts";
import type { Mirror } from "./client.ts";
import { cachedPins, pullPins, pushPins, type CacheDirs } from "./run.ts";

const roots: string[] = [];
const log = createLog("mirror-test");

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const bytesOf = (text: string) => new TextEncoder().encode(text);
const file = (pinPath: string, text: string): SourceFile => ({ path: pinPath, url: `https://example.test/${pinPath}`, sha256: sha256(bytesOf(text)), bytes: text.length });
const record = (id: string, files: SourceFile[]): SourceRecord => ({ id, site: "https://example.test", pin: { kind: "sha256", value: id }, fetchedAt: "", files });

function dirs(): CacheDirs {
  const root = mkdtempSync(path.join(tmpdir(), "mirror-"));
  roots.push(root);
  const made = { scans: path.join(root, "scans"), pictures: path.join(root, "pictures"), pdf: path.join(root, "pdf") };
  for (const dir of Object.values(made)) mkdirSync(dir);
  return made;
}

function memoryMirror(objects = new Map<string, Uint8Array>()): Mirror & { objects: Map<string, Uint8Array> } {
  return {
    name: "memory",
    objects,
    get: (hash) => Promise.resolve(objects.get(hash) ?? null),
    put: (hash, body) => {
      objects.set(hash, body);
      return Promise.resolve();
    },
    list: () => Promise.resolve(new Set(objects.keys())),
  };
}

const SOURCES = {
  scans: record("scans", [file("scans/1.A.jpg", "scan one"), file("scans/2.A.jpg", "scan two")]),
  pictures: record("pictures", [file("pictures/1.A.jpg", "picture one"), file("pdf/campaign.pdf", "pdf")]),
  // Committed under data/raw: not the mirror's.
  ringsdb: record("ringsdb", [file("raw/ringsdb/packs.json", "packs")]),
};

describe("asset mirror commands", () => {
  it("takes the cached pins of the named sources, each in its .cache folder, and refuses an unknown source", () => {
    const at = dirs();
    expect(cachedPins(SOURCES, [], at).map((pin) => pin.cached)).toEqual([
      path.join(at.scans, "1.A.jpg"),
      path.join(at.scans, "2.A.jpg"),
      path.join(at.pictures, "1.A.jpg"),
      path.join(at.pdf, "campaign.pdf"),
    ]);
    expect(cachedPins(SOURCES, ["pictures"], at)).toHaveLength(2);
    expect(() => cachedPins(SOURCES, ["nope"], at)).toThrow(/no source nope/);
  });

  it("pushes what the bucket lacks from the cache at its pin, and pulls it back into an empty cache", async () => {
    const at = dirs();
    writeFileSync(path.join(at.scans, "1.A.jpg"), "scan one");
    writeFileSync(path.join(at.scans, "2.A.jpg"), "stale");
    writeFileSync(path.join(at.pictures, "1.A.jpg"), "picture one");
    const held = file("pictures/1.A.jpg", "picture one").sha256;
    const mirror = memoryMirror(new Map([[held, bytesOf("picture one")]]));
    const pushed = await pushPins(mirror, cachedPins(SOURCES, [], at), log, { waits: [] });
    expect(pushed).toEqual({ pushed: 1, held: 1, absent: ["pdf/campaign.pdf", "scans/2.A.jpg"] });
    expect(mirror.objects.get(file("scans/1.A.jpg", "scan one").sha256)).toEqual(bytesOf("scan one"));

    const fresh = dirs();
    const pulled = await pullPins(mirror, cachedPins(SOURCES, [], fresh), log);
    expect(pulled).toEqual({ pulled: 2, missing: ["pdf/campaign.pdf", "scans/2.A.jpg"] });
    expect(readFileSync(path.join(fresh.scans, "1.A.jpg"), "utf8")).toBe("scan one");
    expect(readFileSync(path.join(fresh.pictures, "1.A.jpg"), "utf8")).toBe("picture one");
  });

  it("with --fetch, downloads a pin the cache misses from its URL, keeps it and pushes it, and skips bytes that are not the pin", async () => {
    const at = dirs();
    const mirror = memoryMirror();
    const served: Record<string, string> = { "https://example.test/scans/1.A.jpg": "scan one", "https://example.test/scans/2.A.jpg": "changed upstream" };
    const fetchSource = (url: string) => (served[url] ? Promise.resolve(bytesOf(served[url])) : Promise.reject(new Error(`GET ${url} answered 404`)));
    const pushed = await pushPins(mirror, cachedPins(SOURCES, ["scans"], at), log, { waits: [], fetchSource });
    expect(pushed).toEqual({ pushed: 1, held: 0, absent: ["scans/2.A.jpg"] });
    expect(readFileSync(path.join(at.scans, "1.A.jpg"), "utf8")).toBe("scan one");
  });
});
