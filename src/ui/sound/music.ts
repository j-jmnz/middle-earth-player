// The music (docs/design-system-table.md, Sound; user request, 2026-11-18): one loop at a time, the table's while a table is open
// (use-table-music.ts) and the menu's otherwise. A loop plays without a seam: its file holds MUSIC_LEAD_SECONDS of the music before the
// loop's start, and as one copy reaches its last MUSIC_LEAD_SECONDS a fresh copy starts and the two crossfade, so the repeat lands
// on the loop's start with no gap (a platform's own repeat can leave one). A new loop crossfades in over the same time. The Music
// setting and its volume apply at once; the music pauses while the app is in the background. A bundle packed without the loops plays
// none, and so do the web and the desktop for now (bundled.ts). Players are made for a loop as it starts and released once faded out.
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { AppState, Platform } from "react-native";

import { tableSettings } from "../table-settings.ts";
import { bundledMusic } from "./bundled";
import { MUSIC_LEAD_SECONDS } from "./music-lead.ts";
import type { MusicLoop } from "./music-map.ts";
import { audioFailed, startAudioSession } from "./session.ts";

/** Whether this bundle carries any music and can play it: the Music rows show only then. Fixed when the bundle loads. */
export const MUSIC_BUNDLED = Platform.OS !== "web" && Object.keys(bundledMusic).length > 0;

// How often the fades step and the repeat is checked. A fade takes MUSIC_LEAD_SECONDS, so it moves in about 15 steps.
export const MUSIC_TICK_MS = 100;

type Voice = { loop: MusicLoop; player: AudioPlayer; gain: number; target: 0 | 1; repeated: boolean };

let voices: Voice[] = [];
let appLoop: MusicLoop | null = null;
let tableLoop: MusicLoop | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let foreground = true;
let started = false;

// The loop that should be heard now, or null for silence.
function wanted(): MusicLoop | null {
  const { music, musicVolume } = tableSettings.getState().settings;
  if (!MUSIC_BUNDLED || !music || musicVolume <= 0) return null;
  return tableLoop ?? appLoop;
}

function voiceOf(loop: MusicLoop): Voice | null {
  const source = bundledMusic[loop];
  if (source == null) return null;
  try {
    startAudioSession();
    const player = createAudioPlayer(source);
    player.volume = 0;
    player.play();
    return { loop, player, gain: 0, target: 1, repeated: false };
  } catch (error) {
    audioFailed(error);
    return null;
  }
}

function release(voice: Voice): void {
  try {
    voice.player.pause();
    voice.player.remove();
  } catch (error) {
    audioFailed(error);
  }
}

// One step of the mix: each voice's gain moves toward its target over MUSIC_LEAD_SECONDS, the loop heard now starts its next copy as
// it reaches its last MUSIC_LEAD_SECONDS, and a voice that has faded out is released. The clock stops when nothing plays.
function tick(): void {
  const volume = tableSettings.getState().settings.musicVolume;
  const step = MUSIC_TICK_MS / 1000 / MUSIC_LEAD_SECONDS;
  const next: Voice[] = [];
  for (const voice of voices) {
    voice.gain = voice.target === 1 ? Math.min(1, voice.gain + step) : Math.max(0, voice.gain - step);
    try {
      voice.player.volume = voice.gain * volume;
      const { duration, currentTime, isLoaded } = voice.player;
      if (voice.target === 1 && !voice.repeated && isLoaded && duration > MUSIC_LEAD_SECONDS && currentTime >= duration - MUSIC_LEAD_SECONDS) {
        voice.repeated = true;
        voice.target = 0;
        const again = voiceOf(voice.loop);
        if (again) next.push(again);
      }
    } catch (error) {
      audioFailed(error);
    }
    if (voice.target === 0 && voice.gain <= 0) release(voice);
    else next.push(voice);
  }
  voices = next;
  if (voices.length === 0) stopClock();
}

function startClock(): void {
  if (timer == null && foreground && voices.length > 0) timer = setInterval(tick, MUSIC_TICK_MS);
}

function stopClock(): void {
  if (timer != null) clearInterval(timer);
  timer = null;
}

// Brings the voices in line with the loop wanted: the one heard keeps playing, any other fades out, a new one fades in.
function sync(): void {
  const loop = wanted();
  const heard = voices.find((voice) => voice.target === 1);
  if (heard?.loop === loop) return;
  for (const voice of voices) voice.target = 0;
  if (loop && foreground) {
    const voice = voiceOf(loop);
    if (voice) voices.push(voice);
  }
  startClock();
}

/** The loop the screens ask for when no table is open: the menu's. */
export function setAppMusic(loop: MusicLoop | null): void {
  appLoop = loop;
  sync();
}

/** The loop an open table asks for, or null when it closes or is hidden. */
export function setTableMusic(loop: MusicLoop | null): void {
  tableLoop = loop;
  sync();
}

function onAppState(state: string): void {
  const active = state === "active";
  if (active === foreground) return;
  foreground = active;
  if (!active) {
    stopClock();
    for (const voice of voices) {
      try {
        voice.player.pause();
      } catch (error) {
        audioFailed(error);
      }
    }
    return;
  }
  for (const voice of voices) {
    try {
      voice.player.play();
    } catch (error) {
      audioFailed(error);
    }
  }
  sync();
  startClock();
}

/**
 * Starts the music once for the app's life (the root layout calls it): the menu's loop, and the listeners that follow the Music
 * setting, its volume and the app going to the background. Returns the stop for the layout's cleanup.
 */
export function startMusic(): () => void {
  if (started || !MUSIC_BUNDLED) return () => undefined;
  started = true;
  const settings = tableSettings.subscribe((state, before) => {
    if (state.settings.music !== before.settings.music || (state.settings.musicVolume > 0) !== (before.settings.musicVolume > 0)) sync();
  });
  const appState = AppState.addEventListener("change", onAppState);
  setAppMusic("menu");
  return () => {
    settings();
    appState.remove();
    stopClock();
    for (const voice of voices) release(voice);
    voices = [];
    appLoop = null;
    tableLoop = null;
    started = false;
  };
}
