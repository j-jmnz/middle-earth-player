// The music player: the menu's loop, a table's loop crossfading in, the repeat that loads and starts the next copy in step, a loop
// that comes back where it was, the Music setting, another app's audio, the sting's quiet and the pause while the app is not in front.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tableSettings } from "../table-settings.ts";

type FakePlayer = { source: number; volume: number; currentTime: number; duration: number; isLoaded: boolean; playing: boolean; removed: boolean; seeks: number[]; play: () => void; pause: () => void; remove: () => void; seekTo: (at: number) => Promise<void> };

const audio = vi.hoisted(() => ({ players: [] as FakePlayer[], appState: null as ((state: string) => void) | null, other: false, reader: false }));
vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_: string, listener: (state: string) => void) => {
      audio.appState = listener;
      return { remove: () => (audio.appState = null) };
    },
  },
}));
vi.mock("./other-audio", () => ({ otherAudioPlaying: () => audio.other }));
// Mocked whole: loaded here with the mocked react-native, it would stay in the shared module cache (vitest.config.mts, isolate).
vi.mock("../accessibility.ts", () => ({ accessibility: () => ({ screenReader: audio.reader }) }));
vi.mock("./session.ts", () => ({ startAudioSession: () => undefined, audioFailed: () => undefined }));
vi.mock("./bundled", () => ({ bundledSounds: {}, bundledMusic: { menu: 1, shire: 2, nazgul: 3 } }));
vi.mock("./audio-player", () => ({
  createAudioPlayer: (source: number) => {
    const player: FakePlayer = {
      source,
      volume: 0,
      currentTime: 0,
      duration: 60,
      isLoaded: true,
      playing: false,
      removed: false,
      seeks: [],
      play: () => (player.playing = true),
      pause: () => (player.playing = false),
      remove: () => (player.removed = true),
      seekTo: (at: number) => {
        player.seeks.push(at);
        return Promise.resolve();
      },
    };
    audio.players.push(player);
    return player;
  },
}));

const { fadeLevel, MUSIC_TICK_MS, quietMusic, setTableMusic, startMusic } = await import("./music.ts");

// Long enough for any fade (1.5 s) to finish.
const FADE = MUSIC_TICK_MS * 20;
const live = () => audio.players.filter((player) => !player.removed);
const playing = () => live().filter((player) => player.playing);
let stop: () => void = () => undefined;

beforeEach(() => {
  vi.useFakeTimers();
  audio.players.length = 0;
  audio.other = false;
  audio.reader = false;
  tableSettings.getState().update({ music: true, musicVolume: 0.5 });
  stop = startMusic();
});

afterEach(() => {
  setTableMusic(null);
  stop();
  vi.useRealTimers();
});

describe("music", () => {
  it("fades the menu's loop in to the music volume, equal-power", () => {
    expect(playing().map((player) => player.source)).toEqual([1]);
    vi.advanceTimersByTime(FADE);
    expect(live()[0]?.volume).toBeCloseTo(0.5);
    expect(fadeLevel(0.5)).toBeCloseTo(Math.SQRT1_2);
  });

  it("halves the volume while a screen reader runs", () => {
    audio.reader = true;
    vi.advanceTimersByTime(FADE);
    expect(live()[0]?.volume).toBeCloseTo(0.25);
  });

  it("crossfades to a table's loop and pauses the menu's where it was", () => {
    vi.advanceTimersByTime(FADE);
    setTableMusic("shire");
    vi.advanceTimersByTime(FADE);
    const [menu, shire] = audio.players;
    expect(menu?.playing).toBe(false);
    expect(menu?.removed).toBe(false);
    expect(shire?.playing).toBe(true);
  });

  it("takes back a loop still fading out, with no second copy", () => {
    setTableMusic("shire");
    vi.advanceTimersByTime(FADE);
    setTableMusic("nazgul");
    vi.advanceTimersByTime(MUSIC_TICK_MS * 3);
    setTableMusic("shire");
    vi.advanceTimersByTime(FADE);
    expect(audio.players.filter((player) => player.source === 2)).toHaveLength(1);
    expect(playing().map((player) => player.source)).toEqual([2]);
  });

  it("goes on from where a loop was paused when it comes back", () => {
    setTableMusic("shire");
    vi.advanceTimersByTime(FADE);
    setTableMusic("nazgul");
    vi.advanceTimersByTime(FADE);
    const shire = audio.players.find((player) => player.source === 2);
    setTableMusic("shire");
    expect(audio.players.filter((player) => player.source === 2)).toHaveLength(1);
    expect(shire?.playing).toBe(true);
  });

  it("loads the next copy early and starts it at the matching point, so the repeat has no gap", () => {
    vi.advanceTimersByTime(FADE);
    const first = audio.players[0];
    if (first) first.currentTime = 55;
    vi.advanceTimersByTime(MUSIC_TICK_MS);
    const next = audio.players[1];
    expect(next?.playing).toBe(false);
    if (first) first.currentTime = 58.62;
    vi.advanceTimersByTime(MUSIC_TICK_MS);
    expect(next?.playing).toBe(true);
    expect(next?.seeks[0]).toBeCloseTo(0.12);
    vi.advanceTimersByTime(FADE);
    expect(first?.removed).toBe(true);
    expect(playing()).toEqual([next]);
  });

  it("fades out when Music is turned off, and back in when it is turned on", () => {
    vi.advanceTimersByTime(FADE);
    tableSettings.getState().update({ music: false });
    vi.advanceTimersByTime(FADE);
    expect(playing()).toHaveLength(0);
    tableSettings.getState().update({ music: true });
    expect(playing()).toHaveLength(1);
  });

  it("starts nothing while another app's audio plays, and checks again on return", () => {
    setTableMusic(null);
    stop();
    audio.players.length = 0;
    audio.other = true;
    stop = startMusic();
    expect(playing()).toHaveLength(0);
    audio.appState?.("background");
    audio.other = false;
    audio.appState?.("active");
    expect(playing().map((player) => player.source)).toEqual([1]);
  });

  it("stays silent while a sting plays, then fades back in", () => {
    vi.advanceTimersByTime(FADE);
    quietMusic(5000);
    vi.advanceTimersByTime(FADE);
    expect(playing()).toHaveLength(0);
    vi.advanceTimersByTime(5000);
    expect(playing()).toHaveLength(1);
  });

  it("pauses while the app is not in front and plays again on return", () => {
    vi.advanceTimersByTime(FADE);
    audio.appState?.("background");
    expect(live()[0]?.playing).toBe(false);
    audio.appState?.("active");
    expect(live()[0]?.playing).toBe(true);
  });
});
