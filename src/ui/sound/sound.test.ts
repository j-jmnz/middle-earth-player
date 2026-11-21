// The Sound effects setting, the repeat guard and the players a slot keeps: with the setting off, or a slot this bundle has no file
// for, nothing reaches the module; quick taps each get a player that is not still playing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ created: [] as number[], played: [] as number[], playing: false }));
vi.mock("./session.ts", () => ({ startAudioSession: () => undefined, audioFailed: () => undefined }));
// The accessibility store is mocked whole: loaded here with the mocked react-native, it would stay in the shared module cache (vitest.config.mts, isolate).
vi.mock("../accessibility.ts", () => ({ accessibility: () => ({ screenReader: false }) }));
vi.mock("./bundled", () => ({ bundledSounds: { "ui.confirm": 1, "card.land": 2, "ui.back": 3 } }));
vi.mock("./audio-player", () => ({
  createAudioPlayer: (source: number) => {
    calls.created.push(source);
    // `calls.playing` stands for a sound still sounding: a quick tap then needs another player.
    const player = { playing: false, duration: 0.3, seekTo: () => Promise.resolve(), pause: () => undefined, play: () => (calls.played.push(source), (player.playing = calls.playing)) };
    return player;
  },
}));

// A fresh sound.ts with this file's mocks: sound-players.test.ts loads it with its own, and the module cache is shared (vitest.config.mts,
// isolate). The settings come from the same fresh load, so the store this file changes is the one sound.ts reads.
vi.resetModules();
const { playSound, playUndo, SOUNDS_BUNDLED } = await import("./sound.ts");
const { tableSettings } = await import("../table-settings.ts");

// A replayed player starts once its seek to the start resolves.
const settled = () => new Promise<void>((resolve) => queueMicrotask(() => queueMicrotask(resolve)));

// Each test starts later than the last ended, so no sound of one counts as a repeat in the next.
let clock = 10_000;
beforeEach(() => {
  vi.useFakeTimers();
  clock += 100_000;
  vi.setSystemTime(clock);
});

afterEach(() => {
  tableSettings.getState().update({ sounds: true });
  calls.played.length = 0;
  calls.playing = false;
  vi.useRealTimers();
});

describe("sound effects", () => {
  it("says the bundle carries sounds", () => {
    expect(SOUNDS_BUNDLED).toBe(true);
  });

  it("plays a bundled slot, loading every sound once", () => {
    playSound("ui.confirm");
    vi.advanceTimersByTime(100);
    playSound("card.land");
    expect(calls.played).toEqual([1, 2]);
    expect(calls.created.sort()).toEqual([1, 2, 3]);
  });

  it("plays nothing for a slot without a file", () => {
    playSound("dread.win");
    expect(calls.played).toEqual([]);
  });

  it("plays one table sound for the same slot asked for twice at once", async () => {
    vi.advanceTimersByTime(1000);
    playSound("card.land");
    playSound("card.land");
    vi.advanceTimersByTime(100);
    playSound("card.land");
    await settled();
    expect(calls.played).toEqual([2, 2]);
  });

  it("plays every quick tap, each on a player that is not still sounding", async () => {
    vi.advanceTimersByTime(1000);
    calls.playing = true;
    const before = calls.created.length;
    for (let tap = 0; tap < 3; tap += 1) {
      playSound("ui.confirm");
      vi.advanceTimersByTime(40);
    }
    await settled();
    expect(calls.played.filter((source) => source === 1)).toHaveLength(3);
    expect(calls.created.length - before).toBe(2);
  });

  it("is silent while Sound effects is off", () => {
    vi.advanceTimersByTime(1000);
    tableSettings.getState().update({ sounds: false });
    playSound("ui.confirm");
    expect(calls.played).toEqual([]);
  });

  it("keeps the table quiet for a moment after an Undo, but not the interface", async () => {
    vi.advanceTimersByTime(1000);
    playUndo();
    playSound("card.land");
    playSound("ui.confirm");
    vi.advanceTimersByTime(900);
    playSound("card.land");
    await settled();
    expect(calls.played.sort()).toEqual([1, 2, 3]);
  });

  it("plays nothing at a volume of 0", () => {
    vi.advanceTimersByTime(1000);
    tableSettings.getState().update({ soundVolume: 0 });
    playSound("ui.confirm");
    tableSettings.getState().update({ soundVolume: 0.8 });
    expect(calls.played).toEqual([]);
  });
});
