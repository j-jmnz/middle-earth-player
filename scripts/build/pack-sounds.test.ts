import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { SOUND_SLOTS } from "../../src/ui/sound/slots.ts";
import { sha256, type SourceFile } from "../data/sources/fetch.ts";
import { createLog } from "../log.ts";
import { writeSource } from "./pack-audio.ts";
import { findSource, packSounds, SOUND_SOURCE, soundEnd } from "./pack-sounds.ts";
import { SOUND_PICKS } from "./sound-picks.ts";

const roots: string[] = [];
const log = createLog("test");

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function folder(): string {
  const root = mkdtempSync(path.join(tmpdir(), "pack-sounds-"));
  roots.push(root);
  return root;
}

function pin(slot: string, body: Uint8Array): SourceFile {
  return { path: `sounds/${slot}.m4a`, url: "ui.bank#x", sha256: sha256(body), bytes: body.length };
}

// A data/sources.json with a rules source and, unless `files` is null, a sounds source pinning `files`.
function sources(root: string, files: SourceFile[] | null): string {
  const record = (id: string, pins: SourceFile[]) => ({ id, site: "x", pin: { kind: "sha256", value: id }, fetchedAt: "", files: pins });
  const sourcesPath = path.join(root, "sources.json");
  writeFileSync(sourcesPath, JSON.stringify({ sources: { rules: record("rules", []), ...(files ? { sounds: record("sounds", files) } : {}) } }));
  return sourcesPath;
}

describe("pack sounds", () => {
  it("picks a sound for every slot and no other", () => {
    expect(Object.keys(SOUND_PICKS).sort()).toEqual([...SOUND_SLOTS].sort());
  });

  it("finds a pick by its bank and event, whatever number vgmstream gave it", () => {
    const from = folder();
    mkdirSync(path.join(from, "ui"));
    writeFileSync(path.join(from, "ui", "17-ui_shared_tab.ogg"), "");
    writeFileSync(path.join(from, "ui", "18-ui_shared_tab_v2.ogg"), "");
    expect(findSource(from, { bank: "ui", event: "ui_shared_tab", lufs: -24, maxSeconds: 1 })).toBe(path.join(from, "ui", "17-ui_shared_tab.ogg"));
    expect(findSource(from, { bank: "battle", event: "ui_shared_tab", lufs: -24, maxSeconds: 1 })).toBeUndefined();
  });

  it("ends a sound where its tail stays under 1% of the peak", () => {
    const samples = new Int16Array(8000);
    samples.fill(20_000, 0, 800);
    samples.fill(100, 800, 4000);
    expect(soundEnd(samples, 8000)).toBeCloseTo(0.1, 5);
    samples.fill(300, 800, 4000);
    expect(soundEnd(samples, 8000)).toBeCloseTo(0.5, 5);
  });

  it("copies the pinned sounds from the cache, or else from the mirror, and clears the rest", async () => {
    const root = folder();
    const cache = path.join(root, "cache");
    const out = path.join(root, "out");
    mkdirSync(cache);
    mkdirSync(out);
    const tab = new TextEncoder().encode("tab");
    const back = new TextEncoder().encode("back");
    writeFileSync(path.join(cache, "ui.tab.m4a"), tab);
    writeFileSync(path.join(out, ".gitkeep"), "");
    writeFileSync(path.join(out, "ui.old.m4a"), "stale");
    const sourcesPath = sources(root, [pin("ui.tab", tab), pin("ui.back", back)]);
    const mirror = (hash: string) => Promise.resolve(hash === sha256(back) ? back : null);
    expect(await packSounds({ sourcesPath, cacheDir: cache, outDir: out, mirror }, log)).toEqual(["ui.tab", "ui.back"]);
    expect(readdirSync(out).sort()).toEqual([".gitkeep", "ui.back.m4a", "ui.tab.m4a"]);
    expect(readFileSync(path.join(cache, "ui.back.m4a"), "utf8")).toBe("back");
  });

  it("leaves out a sound in neither the cache at its pin nor the mirror", async () => {
    const root = folder();
    writeFileSync(path.join(root, "ui.tab.m4a"), "changed");
    const sourcesPath = sources(root, [pin("ui.tab", new TextEncoder().encode("tab"))]);
    expect(await packSounds({ sourcesPath, cacheDir: root, outDir: path.join(root, "out") }, log)).toEqual([]);
  });

  it("bundles none without a sounds source", async () => {
    const root = folder();
    const out = path.join(root, "out");
    mkdirSync(out);
    writeFileSync(path.join(out, "ui.tab.m4a"), "old");
    expect(await packSounds({ sourcesPath: sources(root, null), cacheDir: root, outDir: out }, log)).toEqual([]);
    expect(existsSync(path.join(out, "ui.tab.m4a"))).toBe(false);
  });

  it("writes the sounds source beside the others, in order", () => {
    const root = folder();
    const sourcesPath = sources(root, null);
    writeSource(sourcesPath, { id: SOUND_SOURCE, site: "x", pin: { kind: "sha256", value: "v" }, fetchedAt: "", files: [] });
    const written = JSON.parse(readFileSync(sourcesPath, "utf8")) as { sources: Record<string, unknown> };
    expect(Object.keys(written.sources)).toEqual(["rules", "sounds"]);
  });
});
