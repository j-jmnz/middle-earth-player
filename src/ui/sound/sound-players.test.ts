// The limit on loaded sound players over every slot (sound.ts, PLAYERS_MAX): each holds one of the phone's few audio decoders, and
// the music needs some for its loops, so a new slot's player releases the one used longest ago.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SOUND_SLOTS } from "./slots.ts";

type Fake = { source: number; removed: boolean; playing: boolean };
const calls = vi.hoisted(() => ({ players: [] as Fake[], playing: false }));
vi.mock("./session.ts", () => ({ startAudioSession: () => undefined, audioFailed: () => undefined }));
vi.mock("../accessibility.ts", () => ({ accessibility: () => ({ screenReader: false }) }));
// Every slot has a file: the bundle a release carries.
vi.mock("./bundled", async () => {
  const { SOUND_SLOTS: slots } = await import("./slots.ts");
  return { bundledSounds: Object.fromEntries(slots.map((slot, index) => [slot, index + 1])) };
});
vi.mock("./audio-player", () => ({
  createAudioPlayer: (source: number) => {
    const fake: Fake = { source, removed: false, playing: false };
    calls.players.push(fake);
    return {
      duration: 0.3,
      get playing() {
        return fake.playing;
      },
      seekTo: () => Promise.resolve(),
      pause: () => undefined,
      play: () => {
        fake.playing = calls.playing;
      },
      remove: () => {
        fake.removed = true;
      },
    };
  },
}));

// A fresh sound.ts with this file's mocks: sound.test.ts loads it with its own, and the module cache is shared (vitest.config.mts, isolate).
vi.resetModules();
const { playSound, PLAYERS_MAX } = await import("./sound.ts");

const loaded = () => calls.players.filter((player) => !player.removed);
const sourceOf = (slot: (typeof SOUND_SLOTS)[number]) => SOUND_SLOTS.indexOf(slot) + 1;

let clock = 10_000;
beforeEach(() => {
  vi.useFakeTimers();
  clock += 100_000;
  vi.setSystemTime(clock);
});

// The workers share one module scope (vitest.config.mts, isolate: false), so fake timers left on would stall the next
// file's setTimeout.
afterEach(() => {
  vi.useRealTimers();
});

describe("sound players", () => {
  it("never keeps more than PLAYERS_MAX loaded, however many slots play", () => {
    for (const slot of SOUND_SLOTS) {
      playSound(slot);
      vi.advanceTimersByTime(1000);
      expect(loaded().length).toBeLessThanOrEqual(PLAYERS_MAX);
    }
    // Far fewer than one a slot: the music's loops find decoders free.
    expect(PLAYERS_MAX).toBeLessThan(SOUND_SLOTS.length / 2);
  });

  it("releases the player used longest ago and keeps the ones played since", () => {
    playSound("ui.confirm");
    vi.advanceTimersByTime(1000);
    for (const slot of SOUND_SLOTS.filter((other) => other !== "ui.confirm").slice(0, PLAYERS_MAX - 1)) {
      playSound(slot);
      vi.advanceTimersByTime(1000);
    }
    playSound("ui.confirm");
    vi.advanceTimersByTime(1000);
    playSound("dread.win");
    const live = loaded().map((player) => player.source);
    expect(live).toContain(sourceOf("ui.confirm"));
    expect(live).toContain(sourceOf("dread.win"));
  });

});
