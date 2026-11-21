// The music (docs/design-system-table.md, Sound; user request, 2026-11-18): one loop at a time, the table's while a table is open
// (src/play/chrome/table-music.tsx) and the menu's otherwise. A loop repeats without a seam: its file holds MUSIC_LEAD_SECONDS of
// the music before the loop's start, the next copy is loaded a few seconds early, and as one copy reaches its last MUSIC_LEAD_SECONDS
// the next starts at the matching point and the two crossfade, landing on the loop's start (a platform's own repeat can leave a gap).
// A new loop crossfades in over the same time; a loop left mid-piece is paused where it was and goes on from there when it comes back.
// The fades are equal-power. The music does not start while another app's audio plays (other-audio.native.ts), and pauses while the app is not in
// front. The Music setting and its volume apply at once; a screen reader halves the volume. A bundle packed without the loops plays
// none; the web and the desktop play the same loops (bundled.canvaskit.ts), and the desktop app starts them before a click (desktop/main.ts).
import { createAudioPlayer, type AudioPlayer } from "./audio-player";
import { AppState } from "react-native";

import { accessibility } from "../accessibility.ts";
import { tableSettings } from "../table-settings.ts";
import { bundledMusic } from "./bundled";
import { MUSIC_LEAD_SECONDS } from "./music-lead.ts";
import type { MusicLoop } from "./music-map.ts";
import { otherAudioPlaying } from "./other-audio";
import { audioFailed, startAudioSession } from "./session.ts";

/** Whether this bundle carries any music and can play it: the Music rows show only then. Fixed when the bundle loads. */
export const MUSIC_BUNDLED = Object.keys(bundledMusic).length > 0;

// How often the fades step and the repeat is checked. A fade takes MUSIC_LEAD_SECONDS, so it moves in about 15 steps.
export const MUSIC_TICK_MS = 100;
// The next copy of a loop is loaded this long before it starts, so it starts on time.
const PRELOAD_SECONDS = 5;
// Loops left mid-piece and kept paused, to go on from where they were (a table's calm loop across a fight): at most this many.
const PARKED_MAX = 2;
// While a screen reader runs, the music plays at this share of its volume, under the speech.
const READER_SHARE = 0.5;

// `gain` runs 0 to 1 toward `target` over a fade; `next` is the loop's next copy, loaded and paused; `repeated` once it has started.
type Voice = { loop: MusicLoop; player: AudioPlayer; gain: number; target: 0 | 1; next: AudioPlayer | null; repeated: boolean; volume: number };

let voices: Voice[] = [];
let parked: Voice[] = [];
let appLoop: MusicLoop | null = null;
let tableLoop: MusicLoop | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let quietTimer: ReturnType<typeof setTimeout> | null = null;
let quietUntil = 0;
let foreground = true;
let otherAudio = false;
let started = false;

// The loop that should be heard now, or null for silence.
function wanted(): MusicLoop | null {
  const { music, musicVolume } = tableSettings.getState().settings;
  if (!MUSIC_BUNDLED || !music || musicVolume <= 0 || otherAudio || Date.now() < quietUntil) return null;
  return tableLoop ?? appLoop;
}

function newPlayer(loop: MusicLoop): AudioPlayer | null {
  const source = bundledMusic[loop];
  if (source == null) return null;
  try {
    startAudioSession();
    const player = createAudioPlayer(source);
    player.volume = 0;
    return player;
  } catch (error) {
    audioFailed(error);
    return null;
  }
}

function play(player: AudioPlayer): void {
  try {
    player.play();
  } catch (error) {
    audioFailed(error);
  }
}

function pause(player: AudioPlayer): void {
  try {
    player.pause();
  } catch (error) {
    audioFailed(error);
  }
}

function remove(player: AudioPlayer | null): void {
  if (!player) return;
  try {
    player.pause();
    player.remove();
  } catch (error) {
    audioFailed(error);
  }
}

function release(voice: Voice): void {
  remove(voice.player);
  remove(voice.next);
}

/** An equal-power fade: a voice at gain `g` plays at sin(g·π/2), so two crossfading voices keep the loudness of one. */
export function fadeLevel(gain: number): number {
  return Math.sin((Math.max(0, Math.min(1, gain)) * Math.PI) / 2);
}

// A voice that has faded out: kept paused when it stopped mid-piece (it may come back), released when it was a copy that had finished.
function retire(voice: Voice): void {
  if (voice.repeated) {
    release(voice);
    return;
  }
  pause(voice.player);
  remove(voice.next);
  voice.next = null;
  parked = [voice, ...parked.filter((other) => other.loop !== voice.loop)];
  for (const old of parked.splice(PARKED_MAX)) release(old);
}

// The loop heard now reaches its last MUSIC_LEAD_SECONDS: its next copy starts at the same point past the loop's start, and the two
// crossfade. Without a loaded copy one is made now; if none can be, the voice plays on to its end.
function repeat(voice: Voice, currentTime: number, duration: number): void {
  voice.repeated = true;
  const next = voice.next ?? newPlayer(voice.loop);
  voice.next = null;
  if (!next) return;
  voice.target = 0;
  const offset = Math.max(0, currentTime - (duration - MUSIC_LEAD_SECONDS));
  next.seekTo(offset).catch(audioFailed);
  play(next);
  voices.push({ loop: voice.loop, player: next, gain: 0, target: 1, next: null, repeated: false, volume: -1 });
}

// One step of the mix: each voice's gain moves toward its target over MUSIC_LEAD_SECONDS, the loop heard now loads and then starts its
// next copy, and a voice that has faded out is retired. The clock stops when nothing plays.
function tick(): void {
  const share = accessibility().screenReader ? READER_SHARE : 1;
  const volume = tableSettings.getState().settings.musicVolume * share;
  const step = MUSIC_TICK_MS / 1000 / MUSIC_LEAD_SECONDS;
  for (const voice of [...voices]) {
    voice.gain = voice.target === 1 ? Math.min(1, voice.gain + step) : Math.max(0, voice.gain - step);
    const level = fadeLevel(voice.gain) * volume;
    try {
      if (level !== voice.volume) {
        voice.player.volume = level;
        voice.volume = level;
      }
      const { duration, currentTime, isLoaded } = voice.player;
      if (voice.target === 1 && !voice.repeated && isLoaded && duration > MUSIC_LEAD_SECONDS) {
        if (!voice.next && currentTime >= duration - MUSIC_LEAD_SECONDS - PRELOAD_SECONDS) voice.next = newPlayer(voice.loop);
        if (currentTime >= duration - MUSIC_LEAD_SECONDS) repeat(voice, currentTime, duration);
      }
    } catch (error) {
      audioFailed(error);
    }
  }
  voices = voices.filter((voice) => {
    if (voice.target === 1 || voice.gain > 0) return true;
    retire(voice);
    return false;
  });
  if (voices.length === 0) stopClock();
}

function startClock(): void {
  if (timer == null && foreground && voices.length > 0) timer = setInterval(tick, MUSIC_TICK_MS);
}

function stopClock(): void {
  if (timer != null) clearInterval(timer);
  timer = null;
}

// Brings the voices in line with the loop wanted: the one heard keeps playing and any other fades out. The loop wanted comes back
// from a voice still fading out, else from where it was paused, else from a new copy at its start.
function sync(): void {
  const loop = wanted();
  for (const voice of voices) voice.target = voice.loop === loop && !voice.repeated ? 1 : 0;
  if (loop && foreground && !voices.some((voice) => voice.target === 1)) {
    const kept = parked.find((voice) => voice.loop === loop);
    if (kept) {
      parked = parked.filter((voice) => voice !== kept);
      kept.target = 1;
      play(kept.player);
      voices.push(kept);
    } else {
      const player = newPlayer(loop);
      if (player) {
        play(player);
        voices.push({ loop, player, gain: 0, target: 1, next: null, repeated: false, volume: -1 });
      }
    }
  }
  startClock();
}

/** The loop the screens ask for when no table is open: the menu's. */
export function setAppMusic(loop: MusicLoop | null): void {
  appLoop = loop;
  sync();
}

/** The loop an open table asks for, or null when the player has left the table. */
export function setTableMusic(loop: MusicLoop | null): void {
  tableLoop = loop;
  sync();
}

/** Silence for `ms` (the win or loss sting plays alone), then the music wanted fades back in. */
export function quietMusic(ms: number): void {
  quietUntil = Date.now() + ms;
  if (quietTimer != null) clearTimeout(quietTimer);
  quietTimer = setTimeout(() => {
    quietTimer = null;
    sync();
  }, ms);
  sync();
}

function onAppState(state: string): void {
  const active = state === "active";
  if (active === foreground) return;
  foreground = active;
  if (!active) {
    stopClock();
    for (const voice of voices) pause(voice.player);
    return;
  }
  // Back in front: another app's audio that started meanwhile keeps the music silent; the app's own players are paused, so the answer is the other app's.
  otherAudio = otherAudioPlaying();
  for (const voice of voices) play(voice.player);
  sync();
}

/**
 * Starts the music once for the app's life (the root layout calls it): the menu's loop, and the listeners that follow the Music
 * setting, its volume and the app going to the background. Returns the stop for the layout's cleanup.
 */
export function startMusic(): () => void {
  if (started || !MUSIC_BUNDLED) return () => undefined;
  started = true;
  foreground = AppState.currentState == null || AppState.currentState === "active";
  otherAudio = otherAudioPlaying();
  const settings = tableSettings.subscribe((state, before) => {
    if (state.settings.music !== before.settings.music || (state.settings.musicVolume > 0) !== (before.settings.musicVolume > 0)) sync();
    else if (state.settings.musicVolume !== before.settings.musicVolume) startClock();
  });
  const appState = AppState.addEventListener("change", onAppState);
  setAppMusic("menu");
  return () => {
    settings();
    appState.remove();
    stopClock();
    if (quietTimer != null) clearTimeout(quietTimer);
    quietTimer = null;
    quietUntil = 0;
    for (const voice of [...voices, ...parked]) release(voice);
    voices = [];
    parked = [];
    appLoop = null;
    tableLoop = null;
    started = false;
  };
}
