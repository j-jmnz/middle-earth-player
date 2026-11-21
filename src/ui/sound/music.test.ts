// The music player: the menu's loop, a table's loop crossfading in, the repeat that starts a fresh copy before the last one ends, the
// Music setting, and the pause while the app is in the background.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tableSettings } from "../table-settings.ts";

type FakePlayer = { source: number; volume: number; currentTime: number; duration: number; isLoaded: boolean; playing: boolean; removed: boolean; play: () => void; pause: () => void; remove: () => void };

const audio = vi.hoisted(() => ({ players: [] as FakePlayer[], appState: null as ((state: string) => void) | null }));
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      audio.appState = listener;
      return { remove: () => (audio.appState = null) };
    },
  },
}));
vi.mock("./session.ts", () => ({ startAudioSession: () => undefined, audioFailed: () => undefined }));
vi.mock("./bundled", () => ({ bundledSounds: {}, bundledMusic: { menu: 1, shire: 2 } }));
vi.mock("expo-audio", () => ({
  setAudioModeAsync: () => Promise.resolve(),
  createAudioPlayer: (source: number) => {
    const player: FakePlayer = {
      source,
      volume: 0,
      currentTime: 0,
      duration: 60,
      isLoaded: true,
      playing: false,
      removed: false,
      play: () => (player.playing = true),
      pause: () => (player.playing = false),
      remove: () => (player.removed = true),
    };
    audio.players.push(player);
    return player;
  },
}));

const { MUSIC_TICK_MS, setTableMusic, startMusic } = await import("./music.ts");

// Long enough for any fade (1.5 s) to finish.
const FADE_TICKS = 20;
const live = () => audio.players.filter((player) => !player.removed);
let stop: () => void = () => undefined;

beforeEach(() => {
  vi.useFakeTimers();
  audio.players.length = 0;
  tableSettings.getState().update({ music: true, musicVolume: 0.5 });
  stop = startMusic();
});

afterEach(() => {
  setTableMusic(null);
  stop();
  vi.useRealTimers();
});

describe("music", () => {
  it("fades the menu's loop in to the music volume", () => {
    expect(live().map((player) => player.source)).toEqual([1]);
    vi.advanceTimersByTime(MUSIC_TICK_MS * FADE_TICKS);
    expect(live()[0]?.volume).toBeCloseTo(0.5);
    expect(live()[0]?.playing).toBe(true);
  });

  it("crossfades to a table's loop and releases the menu's once it has faded out", () => {
    vi.advanceTimersByTime(MUSIC_TICK_MS * FADE_TICKS);
    setTableMusic("shire");
    vi.advanceTimersByTime(MUSIC_TICK_MS * 5);
    const [menu, shire] = audio.players;
    expect(menu?.volume).toBeLessThan(0.5);
    expect(shire?.volume).toBeGreaterThan(0);
    vi.advanceTimersByTime(MUSIC_TICK_MS * FADE_TICKS);
    expect(live().map((player) => player.source)).toEqual([2]);
  });

  it("starts a fresh copy as a loop reaches its last 1.5 seconds, so the repeat has no gap", () => {
    vi.advanceTimersByTime(MUSIC_TICK_MS * FADE_TICKS);
    const first = audio.players[0];
    if (first) first.currentTime = 59;
    vi.advanceTimersByTime(MUSIC_TICK_MS);
    expect(live().map((player) => player.source)).toEqual([1, 1]);
    vi.advanceTimersByTime(MUSIC_TICK_MS * FADE_TICKS);
    expect(first?.removed).toBe(true);
    expect(live()).toHaveLength(1);
  });

  it("fades out when Music is turned off, and back in when it is turned on", () => {
    vi.advanceTimersByTime(MUSIC_TICK_MS * FADE_TICKS);
    tableSettings.getState().update({ music: false });
    vi.advanceTimersByTime(MUSIC_TICK_MS * FADE_TICKS);
    expect(live()).toHaveLength(0);
    tableSettings.getState().update({ music: true });
    expect(live()).toHaveLength(1);
  });

  it("pauses in the background and plays again in the foreground", () => {
    vi.advanceTimersByTime(MUSIC_TICK_MS * FADE_TICKS);
    audio.appState?.("background");
    expect(live()[0]?.playing).toBe(false);
    audio.appState?.("active");
    expect(live()[0]?.playing).toBe(true);
  });
});
