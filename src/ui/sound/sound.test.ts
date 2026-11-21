// The Sound effects setting and the repeat guard: with the setting off, or a slot this bundle has no file for, nothing reaches the module.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tableSettings } from "../table-settings.ts";

const calls = vi.hoisted(() => ({ created: [] as number[], played: [] as number[], moded: 0 }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("./bundled", () => ({ bundledSounds: { "ui.confirm": 1, "card.land": 2, "ui.back": 3 } }));
vi.mock("expo-audio", () => ({
  setAudioModeAsync: () => {
    calls.moded += 1;
    return Promise.resolve();
  },
  createAudioPlayer: (source: number) => {
    calls.created.push(source);
    return { seekTo: () => Promise.resolve(), play: () => calls.played.push(source) };
  },
}));

const { playSound, playUndo, SOUNDS_BUNDLED } = await import("./sound.ts");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
});

afterEach(() => {
  tableSettings.getState().update({ sounds: true });
  calls.played.length = 0;
  vi.useRealTimers();
});

describe("sound effects", () => {
  it("says the bundle carries sounds", () => {
    expect(SOUNDS_BUNDLED).toBe(true);
  });

  it("plays a bundled slot, loading every sound and setting the session once", () => {
    playSound("ui.confirm");
    vi.advanceTimersByTime(100);
    playSound("card.land");
    expect(calls.played).toEqual([1, 2]);
    expect(calls.created.sort()).toEqual([1, 2, 3]);
    expect(calls.moded).toBe(1);
  });

  it("plays nothing for a slot without a file", () => {
    playSound("dread.win");
    expect(calls.played).toEqual([]);
  });

  it("plays one sound for the same slot asked for twice at once", () => {
    vi.advanceTimersByTime(1000);
    playSound("card.land");
    playSound("card.land");
    vi.advanceTimersByTime(100);
    playSound("card.land");
    expect(calls.played).toEqual([2, 2]);
  });

  it("is silent while Sound effects is off", () => {
    vi.advanceTimersByTime(1000);
    tableSettings.getState().update({ sounds: false });
    playSound("ui.confirm");
    expect(calls.played).toEqual([]);
  });

  it("keeps the table quiet for a moment after an Undo, but not the interface", () => {
    vi.advanceTimersByTime(1000);
    playUndo();
    playSound("card.land");
    playSound("ui.confirm");
    vi.advanceTimersByTime(900);
    playSound("card.land");
    expect(calls.played).toEqual([3, 1, 2]);
  });

  it("plays nothing at a volume of 0", () => {
    vi.advanceTimersByTime(1000);
    tableSettings.getState().update({ soundVolume: 0 });
    playSound("ui.confirm");
    tableSettings.getState().update({ soundVolume: 0.8 });
    expect(calls.played).toEqual([]);
  });
});
