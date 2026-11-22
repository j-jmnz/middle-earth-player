import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PLAYABLE_SCENARIOS } from "../../src/campaign/playable.ts";
import { MUSIC_LEAD_SECONDS } from "../../src/ui/sound/music-lead.ts";
import { MUSIC_LOOPS, MUSIC_SCENARIOS, tableMusic } from "../../src/ui/sound/music-map.ts";
import { MUSIC_PICKS } from "./music-picks.ts";
import { findTrack, loopWindow } from "./pack-music.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("pack music", () => {
  it("picks a passage for every loop and no other, each long enough to hold its lead", () => {
    expect(Object.keys(MUSIC_PICKS).sort()).toEqual([...MUSIC_LOOPS].sort());
    for (const pick of Object.values(MUSIC_PICKS)) expect(() => loopWindow(pick)).not.toThrow();
  });

  it("cuts the lead before the loop's start into its file", () => {
    expect(loopWindow({ file: "x", start: 10, end: 70 })).toEqual({ from: 10 - MUSIC_LEAD_SECONDS, to: 70 });
    expect(() => loopWindow({ file: "x", start: 1, end: 70 })).toThrow(/at least/);
  });

  it("finds a pick's track with any audio extension", () => {
    const from = mkdtempSync(path.join(tmpdir(), "pack-music-"));
    roots.push(from);
    mkdirSync(path.join(from, "other"));
    writeFileSync(path.join(from, "05 - The Black Rider.opus"), "");
    expect(findTrack(from, { file: "05 - The Black Rider", start: 2, end: 70 })).toBe(path.join(from, "05 - The Black Rider.opus"));
    expect(findTrack(from, { file: "05 - The Black", start: 2, end: 70 })).toBeUndefined();
    // An album a folder: the track is found under it.
    writeFileSync(path.join(from, "other", "02 The Shire.mp3"), "");
    expect(findTrack(from, { file: "02 The Shire", start: 2, end: 70 })).toBe(path.join(from, "other", "02 The Shire.mp3"));
  });

  it("gives every playable scenario its own calm and combat loops", () => {
    expect(PLAYABLE_SCENARIOS.filter((id) => !MUSIC_SCENARIOS.includes(id))).toEqual([]);
    expect(tableMusic("a-knife-in-the-dark", false)).toBe("bree");
    expect(tableMusic("a-knife-in-the-dark", true)).toBe("weathertop");
    expect(tableMusic("no-such-scenario", true)).toBe("menu");
  });
});
