import { describe, expect, it } from "vitest";

import type { MusicLoop } from "../../src/ui/sound/music-map.ts";
import { MUSIC_PICKS } from "./music-picks.ts";
import { framesOf, longerLoop, onBeat, SEAM_RATE, WEAK_SEAM } from "./music-seam.ts";
import { withPicks } from "./pack-music.ts";

// A track of `seconds`: a note every half second, struck and fading, its pitch from `noteAt` (a semitone count over 220 Hz).
function track(seconds: number, noteAt: (index: number) => number): Int16Array {
  const samples = new Int16Array(Math.round(seconds * SEAM_RATE));
  const noteLength = SEAM_RATE / 2;
  for (let i = 0; i < samples.length; i += 1) {
    const index = Math.floor(i / noteLength);
    const within = (i - index * noteLength) / noteLength;
    const hz = 220 * 2 ** (noteAt(index) / 12);
    samples[i] = Math.round(12_000 * Math.exp(-3 * within) * Math.sin((2 * Math.PI * hz * i) / SEAM_RATE));
  }
  return samples;
}

// A seeded sequence of pitches with no pattern, the same on every run.
function wander(index: number): number {
  return Math.floor(((Math.sin(index * 12.9898) * 43758.5453) % 1 + 1) % 1 * 12);
}

// A 16-note tune (8 s) that repeats from 20 s to 100 s of a 120 s track; before and after it the notes wander.
const TUNE = [0, 4, 7, 12, 11, 7, 4, 2, 0, 5, 9, 12, 10, 7, 3, 2];
const tuneTrack = track(120, (index) => (index >= 40 && index < 200 ? (TUNE[(index - 40) % 16] ?? 0) : wander(index)));

describe("music seam", () => {
  it("finds a loop twice as long around the old one that ends where the tune comes round", () => {
    const old = { start: 44, end: 60 };
    const found = longerLoop(framesOf(tuneTrack), 120, old, 2);
    expect(found).not.toBeNull();
    if (!found) return;
    expect(found.start).toBeLessThanOrEqual(old.start + 0.05);
    expect(found.end).toBeGreaterThanOrEqual(old.end - 0.05);
    // The tune is 8 s long: a loop of it repeats with no seam only at a whole number of tunes, and 32 s is the target.
    const end = onBeat(tuneTrack, found.start, found.end);
    expect(end - found.start).toBeCloseTo(32, 1);
    expect(found.seam).toBeLessThan(WEAK_SEAM / 5);
    expect(found.short).toBe(false);
  });

  it("gives the longest loop a short track holds, and none when the old loop fills it", () => {
    const frames = framesOf(tuneTrack.subarray(0, 70 * SEAM_RATE));
    const found = longerLoop(frames, 70, { start: 36, end: 60 }, 4);
    expect(found?.short).toBe(true);
    expect((found?.end ?? 0) - (found?.start ?? 0)).toBeGreaterThan(24);
    expect(longerLoop(frames, 70, { start: 2, end: 69 }, 2)).toBeNull();
  });

  it("names a seam weak where no passage repeats", () => {
    const samples = track(120, wander);
    const found = longerLoop(framesOf(samples), 120, { start: 50, end: 66 }, 2);
    expect(found?.seam ?? 0).toBeGreaterThan(WEAK_SEAM);
  });

  it("writes new starts and ends into the picks file and leaves the rest", () => {
    const source = '// head\n  menu: { file: "01 - The Prophecy", start: 137.46, end: 197.6 },\n  shire: { file: "02 The Shire", start: 67.59, end: 135.44 },\n';
    const picks = { ...MUSIC_PICKS, menu: { file: "01 - The Prophecy", start: 100.2, end: 220.35 } };
    const loops = Object.keys(MUSIC_PICKS) as MusicLoop[];
    expect(() => withPicks(source, picks)).toThrow(/no pick line/);
    const whole = `// head\n${loops.map((loop) => `  ${loop}: { file: "${MUSIC_PICKS[loop].file}", start: 1, end: 2 },`).join("\n")}\n`;
    const text = withPicks(whole, picks);
    expect(text).toContain('menu: { file: "01 - The Prophecy", start: 100.2, end: 220.35 },');
    expect(text).toContain(`shire: { file: "02 The Shire", start: ${MUSIC_PICKS.shire.start}, end: ${MUSIC_PICKS.shire.end} },`);
    expect(text.startsWith("// head\n")).toBe(true);
  });
});
