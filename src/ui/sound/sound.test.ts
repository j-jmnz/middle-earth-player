// The Sound effects setting, the repeat guard and the players a slot keeps: with the setting off, or a slot this bundle has no file
// for, nothing reaches the module; quick taps each get a player that is not still playing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `silent`: a player asked to play does not start (it is not playing and stays at its start), as an Android player sometimes does.
const calls = vi.hoisted(() => ({ created: [] as number[], played: [] as number[], seeks: 0, pauses: 0, playing: false, silent: false }));
vi.mock("./session.ts", () => ({ startAudioSession: () => undefined, audioFailed: () => undefined }));
// The accessibility store is mocked whole: loaded here with the mocked react-native, it would stay in the shared module cache (vitest.config.mts, isolate).
vi.mock("../accessibility.ts", () => ({ accessibility: () => ({ screenReader: false }) }));
vi.mock("./bundled", () => ({ bundledSounds: { "ui.confirm": 1, "card.land": 2, "ui.back": 3 } }));
vi.mock("./audio-player", () => ({
  createAudioPlayer: (source: number) => {
    calls.created.push(source);
    // `calls.playing` stands for a sound still sounding: a quick tap then needs another player.
    const player = {
      playing: false,
      duration: 0.3,
      currentTime: 0,
      volume: 1,
      seekTo: () => ((calls.seeks += 1), Promise.resolve()),
      isLoaded: true,
      pause: () => {
        calls.pauses += 1;
        player.playing = false;
      },
      remove: () => undefined,
      play: () => {
        calls.played.push(source);
        player.playing = calls.playing && !calls.silent;
        player.currentTime = calls.silent ? 0 : 0.1;
      },
    };
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
  calls.silent = false;
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

  it("starts a sound that has ended at once, since its player was put back to its start", async () => {
    vi.advanceTimersByTime(1000);
    playSound("card.land");
    // The sound is 300 ms long: its player is put back after it, and the next play waits for no seek.
    vi.advanceTimersByTime(500);
    await settled();
    calls.played.length = 0;
    const seeks = calls.seeks;
    playSound("card.land");
    expect(calls.played).toEqual([2]);
    expect(calls.seeks).toBe(seeks);
  });

  it("starts a sound that is still sounding again from its start, after the seek", async () => {
    vi.advanceTimersByTime(1000);
    playSound("ui.back");
    vi.advanceTimersByTime(100);
    calls.played.length = 0;
    const seeks = calls.seeks;
    // More taps than the slot keeps players: the one that started longest ago is taken while it sounds.
    for (let tap = 0; tap < 4; tap += 1) {
      playSound("ui.back");
      vi.advanceTimersByTime(30);
    }
    expect(calls.seeks).toBeGreaterThan(seeks);
    await settled();
    expect(calls.played.filter((source) => source === 3)).toHaveLength(4);
  });

  it("asks a player that did not start to play again, then puts a new player in its place", async () => {
    vi.advanceTimersByTime(1000);
    calls.silent = true;
    const made = calls.created.length;
    playSound("card.land");
    await settled();
    expect(calls.played).toEqual([2]);
    // The first check: it has not started, so it is put at its start and asked again.
    const seeks = calls.seeks;
    vi.advanceTimersByTime(150);
    await settled();
    expect(calls.seeks).toBe(seeks + 1);
    expect(calls.played).toEqual([2, 2]);
    // The second check: still silent, so a new player takes its place and plays.
    calls.silent = false;
    vi.advanceTimersByTime(150);
    expect(calls.created.length).toBe(made + 1);
    expect(calls.played).toEqual([2, 2, 2]);
    // It sounds now: nothing more is asked.
    vi.advanceTimersByTime(1000);
    await settled();
    expect(calls.played).toEqual([2, 2, 2]);
  });

  it("does not stop a sound that started late and still sounds when its rewind is due", async () => {
    vi.advanceTimersByTime(1000);
    calls.playing = true;
    playSound("card.land");
    await settled();
    const pauses = calls.pauses;
    // Past its length on the clock, but the player says it is still playing: it is left to sound.
    vi.advanceTimersByTime(600);
    await settled();
    expect(calls.pauses).toBe(pauses);
    expect(calls.played).toEqual([2]);
  });

  it("leaves a player that started alone", async () => {
    vi.advanceTimersByTime(1000);
    playSound("card.land");
    await settled();
    vi.advanceTimersByTime(1000);
    await settled();
    expect(calls.played).toEqual([2]);
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
