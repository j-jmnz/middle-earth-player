// The table's and the screens' sound effects (docs/design-system-table.md, Sound; user request, 2026-11-18). A sound plays at the
// moment its haptic or its motion does and adds to what the screen shows; it never replaces it. It follows the phone's silent switch
// and mixes with the player's own music. The Sound effects setting turns them all off. A bundle packed without the files (no asset
// mirror and no cache: scripts/build/pack-sounds.ts) plays none, and so do the web and the desktop for now (bundled.ts). A failed sound is not an
// error the player should see; a development build logs it. Each slot keeps a few players for the app's life, so quick taps each get
// one that is not still playing: one player a slot is loaded the first time any sound plays, and more only as quick repeats need them.
import { createAudioPlayer, type AudioPlayer } from "./audio-player";
import { Platform } from "react-native";

import { accessibility } from "../accessibility.ts";
import { tableSettings } from "../table-settings.ts";
import { bundledSounds } from "./bundled";
import { audioFailed, startAudioSession } from "./session.ts";
import type { SoundSlot } from "./slots.ts";

// The same table sound asked for again this soon (cards drawn in a row, tokens landing together) plays once for all. An interface
// sound plays for every tap: only a second call for the same tap, this close, is dropped.
const REPEAT_MS = 60;
const TAP_REPEAT_MS = 25;
// The most players a slot keeps: quick taps play over each other up to this many, then the oldest starts again.
const POOL = 4;
// How long a player that has not loaded its length yet counts as sounding.
const BUSY_MS = 400;

// After an Undo, the table's own sounds (the threat dial, the rail, the cards and tokens moving back) stay quiet this long: the
// state it restores is not news, and Undo has its own sound.
const UNDO_QUIET_MS = 800;

type Voice = { player: AudioPlayer; started: number };
const pools = new Map<SoundSlot, Voice[]>();
let quietUntil = 0;
const lastPlayed = new Map<SoundSlot, number>();

/** Whether this bundle carries any sound and can play it: the Sound effects row shows only then. Fixed when the bundle loads. */
export const SOUNDS_BUNDLED = Platform.OS !== "web" && Object.keys(bundledSounds).length > 0;

function poolOf(slot: SoundSlot, source: number): Voice[] {
  const existing = pools.get(slot);
  if (existing) return existing;
  const pool = [{ player: createAudioPlayer(source), started: 0 }];
  pools.set(slot, pool);
  return pool;
}

// Whether a player may still be sounding: it says so, or it started less than its length ago (its own flag turns on a moment after
// play, so a quick second tap must not take it).
function busy(voice: Voice, now: number): boolean {
  const length = voice.player.duration > 0 ? voice.player.duration * 1000 : BUSY_MS;
  return voice.player.playing || now - voice.started < length;
}

// A player of the slot that is not sounding, a new one while the pool has room, else the one that started longest ago.
function voiceOf(slot: SoundSlot, source: number, now: number): Voice {
  const pool = poolOf(slot, source);
  const idle = pool.find((voice) => !busy(voice, now));
  if (idle) return idle;
  if (pool.length < POOL) {
    const voice = { player: createAudioPlayer(source), started: 0 };
    pool.push(voice);
    return voice;
  }
  return pool.reduce((oldest, voice) => (voice.started < oldest.started ? voice : oldest));
}

let loaded = false;

function startSession(): void {
  startAudioSession();
  if (loaded) return;
  loaded = true;
  // Every sound is loaded once the first one is asked for, so the next ones start on time.
  for (const [slot, source] of Object.entries(bundledSounds) as [SoundSlot, number][]) poolOf(slot, source);
}

/** Plays a slot's sound from its start, when the setting is on and this bundle has the file. */
export function playSound(slot: SoundSlot): void {
  const { sounds, soundVolume } = tableSettings.getState().settings;
  if (!SOUNDS_BUNDLED || !sounds || soundVolume <= 0) return;
  const source = bundledSounds[slot];
  if (source == null) return;
  const now = Date.now();
  const ui = slot.startsWith("ui.");
  // A screen reader plays its own sound for each control it activates or moves to: the interface sounds would double them.
  if (ui && accessibility().screenReader) return;
  if (!ui && now < quietUntil) return;
  if (now - (lastPlayed.get(slot) ?? -Infinity) < (ui ? TAP_REPEAT_MS : REPEAT_MS)) return;
  lastPlayed.set(slot, now);
  try {
    startSession();
    const voice = voiceOf(slot, source, now);
    const { player } = voice;
    const fresh = voice.started === 0;
    voice.started = now;
    player.volume = soundVolume;
    // A player that has played before starts again only once its seek to the start is done, so it never plays on from where it stopped.
    if (fresh) player.play();
    else {
      player.pause();
      player
        .seekTo(0)
        .then(() => player.play())
        .catch(audioFailed);
    }
  } catch (error) {
    audioFailed(error);
  }
}

/** Undo's sound, and quiet for the table's sounds of the state it restores (UNDO_QUIET_MS). */
export function playUndo(): void {
  playSound("ui.back");
  quietUntil = Date.now() + UNDO_QUIET_MS;
}

/** A tap's handler that plays its sound first: every button's click (docs/design-system-table.md, Sound). */
export function withSound(onPress: () => void, slot: SoundSlot): () => void {
  return () => {
    playSound(slot);
    onPress();
  };
}
