import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { SOUND_SLOTS } from "../../src/ui/sound/slots.ts";
import { sha256 } from "../data/sources/fetch.ts";
import { createLog } from "../log.ts";
import { findSource, packSounds, soundEnd, type SoundManifestEntry } from "./pack-sounds.ts";
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

function entry(slot: SoundManifestEntry["slot"], body: Uint8Array): SoundManifestEntry {
  return { slot, file: `${slot}.m4a`, sha256: sha256(body), source: { game: "Darkest Dungeon II", bank: "ui.bank", event: "x", sha256: "" }, seconds: 0.5, lufs: -24 };
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

  it("copies the cached sounds at their sha256 and clears the rest", () => {
    const cache = folder();
    const out = folder();
    const body = new TextEncoder().encode("tab");
    writeFileSync(path.join(cache, "ui.tab.m4a"), body);
    writeFileSync(path.join(cache, "manifest.json"), JSON.stringify([entry("ui.tab", body)]));
    writeFileSync(path.join(out, ".gitkeep"), "");
    writeFileSync(path.join(out, "ui.old.m4a"), "stale");
    expect(packSounds(cache, out, log).map((sound) => sound.slot)).toEqual(["ui.tab"]);
    expect(readdirSync(out).sort()).toEqual([".gitkeep", "ui.tab.m4a"]);
  });

  it("refuses a cached file that does not match its manifest", () => {
    const cache = folder();
    writeFileSync(path.join(cache, "ui.tab.m4a"), "changed");
    writeFileSync(path.join(cache, "manifest.json"), JSON.stringify([entry("ui.tab", new TextEncoder().encode("tab"))]));
    expect(() => packSounds(cache, folder(), log)).toThrow(/does not match its manifest/);
  });

  it("bundles none without a cache", () => {
    const out = folder();
    writeFileSync(path.join(out, "ui.tab.m4a"), "old");
    expect(packSounds(path.join(out, "missing"), out, log)).toEqual([]);
    expect(existsSync(path.join(out, "ui.tab.m4a"))).toBe(false);
  });
});
