// The sound effects on Android (starts-by-seek.native.ts): a player that waits at its start goes dead there, so every
// play is a seek to the start with the play sent behind it, and no player is put back after its sound.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `order`: what each player was asked, in order. `answer`: whether a seek's promise resolves (a busy phone answers late).
const calls = vi.hoisted(() => ({ order: [] as string[], answer: true }));
vi.mock("./session.ts", () => ({ startAudioSession: () => undefined, audioFailed: () => undefined }));
vi.mock("../accessibility.ts", () => ({ accessibility: () => ({ screenReader: false }) }));
vi.mock("./bundled", () => ({ bundledSounds: { "ui.tab": 1, "ui.confirm": 2 } }));
vi.mock("./starts-by-seek", () => ({ STARTS_BY_SEEK: true }));
vi.mock("./audio-player", () => ({
  createAudioPlayer: (source: number) => ({
    // A sound shorter than any timer of sound.ts, as the tab's is.
    playing: false,
    duration: 0.1,
    currentTime: 0,
    volume: 1,
    seekTo: () => {
      calls.order.push(`seek ${source}`);
      return calls.answer ? Promise.resolve() : new Promise<void>(() => undefined);
    },
    pause: () => void calls.order.push(`pause ${source}`),
    remove: () => undefined,
    play: () => void calls.order.push(`play ${source}`),
  }),
}));

// A fresh sound.ts with this file's mocks: the other sound tests load it with their own, and the module cache is shared
// (vitest.config.mts, isolate).
vi.resetModules();
const { playSound, primeSounds } = await import("./sound.ts");

let clock = 10_000;
beforeEach(() => {
  vi.useFakeTimers();
  clock += 100_000;
  vi.setSystemTime(clock);
  calls.order.length = 0;
  calls.answer = true;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sound effects on Android", () => {
  it("seeks a loaded player to its start and plays it, on its first play", () => {
    primeSounds(["ui.tab", "ui.confirm"]);
    // Long enough for a waiting player to go dead.
    vi.advanceTimersByTime(5000);
    playSound("ui.tab");
    expect(calls.order).toEqual(["seek 1", "play 1"]);
  });

  it("seeks again for a tab after another sound and a wait", () => {
    playSound("ui.tab");
    vi.advanceTimersByTime(3000);
    playSound("ui.confirm");
    vi.advanceTimersByTime(3000);
    calls.order.length = 0;
    playSound("ui.tab");
    expect(calls.order).toEqual(["seek 1", "play 1"]);
  });

  it("does not wait for the seek's answer before the play", () => {
    calls.answer = false;
    playSound("ui.tab");
    expect(calls.order).toEqual(["seek 1", "play 1"]);
  });

  it("does not put a player back after its sound", async () => {
    playSound("ui.tab");
    calls.order.length = 0;
    vi.advanceTimersByTime(10_000);
    await Promise.resolve();
    expect(calls.order).toEqual([]);
  });
});
