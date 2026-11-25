// The sound effects on a phone with a sample pool (pool.native.ts: Android's SoundPool): every sound is a sample's play, and no
// audio player is made for it. The settings and the repeat guard hold as they do for the players.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ primed: [] as string[], played: [] as [string, number][], players: 0 }));
vi.mock("./session.ts", () => ({ startAudioSession: () => undefined, audioFailed: () => undefined }));
vi.mock("../accessibility.ts", () => ({ accessibility: () => ({ screenReader: false }) }));
vi.mock("./bundled", () => ({ bundledSounds: { "ui.tab": 1, "ui.confirm": 2, "card.land": 3 } }));
vi.mock("./pool", () => ({
  pool: {
    prime: (slot: string) => void calls.primed.push(slot),
    play: (slot: string, _source: number, volume: number) => void calls.played.push([slot, volume]),
  },
}));
vi.mock("./audio-player", () => ({
  createAudioPlayer: () => {
    calls.players += 1;
    throw new Error("no audio player is made for a sample");
  },
}));

// A fresh sound.ts with this file's mocks: the other sound tests load it with their own, and the module cache is shared
// (vitest.config.mts, isolate).
vi.resetModules();
const { playSound, primeSounds } = await import("./sound.ts");
const { tableSettings } = await import("../table-settings.ts");

let clock = 10_000;
beforeEach(() => {
  vi.useFakeTimers();
  clock += 100_000;
  vi.setSystemTime(clock);
  calls.primed.length = 0;
  calls.played.length = 0;
});

afterEach(() => {
  tableSettings.getState().update({ sounds: true, soundVolume: 0.8 });
  vi.useRealTimers();
});

describe("sound effects with a sample pool", () => {
  it("loads the screens' sounds this bundle has with the first sound, and plays it as a sample", () => {
    playSound("card.land");
    expect(calls.primed).toEqual(["ui.confirm", "ui.tab"]);
    expect(calls.played).toEqual([["card.land", 0.8]]);
    expect(calls.players).toBe(0);
  });

  it("primes the slots asked, and plays none", () => {
    primeSounds(["ui.tab", "card.land", "ui.back"]);
    expect(calls.primed).toEqual(["ui.tab", "card.land"]);
    expect(calls.played).toEqual([]);
  });

  it("plays every tap at the Effects volume, and one for a tap counted twice", () => {
    tableSettings.getState().update({ soundVolume: 0.4 });
    playSound("ui.tab");
    playSound("ui.tab");
    vi.advanceTimersByTime(100);
    playSound("ui.tab");
    expect(calls.played).toEqual([
      ["ui.tab", 0.4],
      ["ui.tab", 0.4],
    ]);
  });

  it("plays and loads nothing while Sound effects is off", () => {
    tableSettings.getState().update({ sounds: false });
    playSound("ui.tab");
    primeSounds(["ui.tab"]);
    expect(calls.played).toEqual([]);
    expect(calls.primed).toEqual([]);
  });
});
