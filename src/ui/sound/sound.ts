// The table's and the screens' sound effects (docs/design-system-table.md, Sound; user request, 2026-11-18). A sound plays at the
// moment its haptic or its motion does and adds to what the screen shows; it never replaces it. It follows the iPhone's silent switch (not an Android ringer: session.ts)
// and mixes with the player's own music. The Sound effects setting turns them all off. A bundle packed without the files (no asset
// mirror and no cache: scripts/build/pack-sounds.ts) plays none; the web and the desktop play the same files (bundled.canvaskit.ts). A failed sound is not an
// error the player should see; a development build logs it. A slot keeps a few players, so quick taps each get one that is not still
// playing, and all the slots together keep at most PLAYERS_MAX: a new player releases the one used longest ago, so the music always
// finds a decoder for its next loop.
import { createAudioPlayer, type AudioPlayer } from "./audio-player";

import { accessibility } from "../accessibility.ts";
import { tableSettings } from "../table-settings.ts";
import { bundledSounds } from "./bundled";
import { audioFailed, startAudioSession } from "./session.ts";
import { SOUND_SLOTS, type SoundSlot } from "./slots.ts";

// The same table sound asked for again this soon (cards drawn in a row, tokens landing together) plays once for all. An interface
// sound plays for every tap: only a second call for the same tap, this close, is dropped.
const REPEAT_MS = 60;
const TAP_REPEAT_MS = 25;
// The most players a slot keeps: quick taps play over each other up to this many, then the oldest starts again.
const POOL = 4;
// How long a player that has not loaded its length yet counts as sounding.
const BUSY_MS = 400;
// The most sound players loaded at once, over every slot. Each loaded player holds one of the phone's audio decoders, and Android
// gives an app only a few dozen: a player for every slot took them all, and the table's music, which loads its loop after the first
// sound, found none and stayed silent. The music keeps a few players of its own (music.ts).
export const PLAYERS_MAX = 8;

// After an Undo, the table's own sounds (the threat dial, the rail, the cards and tokens moving back) stay quiet this long: the
// state it restores is not news, and Undo has its own sound.
const UNDO_QUIET_MS = 800;

type Voice = { player: AudioPlayer; started: number };
const pools = new Map<SoundSlot, Voice[]>();
let quietUntil = 0;
const lastPlayed = new Map<SoundSlot, number>();

/** Whether this bundle carries any sound and can play it: the Sound effects row shows only then. Fixed when the bundle loads. */
export const SOUNDS_BUNDLED = Object.keys(bundledSounds).length > 0;

function playerCount(): number {
  let count = 0;
  for (const pool of pools.values()) count += pool.length;
  return count;
}

// Releases the player used longest ago that is not sounding (one loaded and never played first), so a new one fits under
// PLAYERS_MAX. False when every player is still sounding.
function makeRoom(now: number): boolean {
  if (playerCount() < PLAYERS_MAX) return true;
  let oldest: { slot: SoundSlot; voice: Voice } | null = null;
  for (const [slot, pool] of pools) {
    for (const voice of pool) if (!busy(voice, now) && (!oldest || voice.started < oldest.voice.started)) oldest = { slot, voice };
  }
  if (!oldest) return false;
  const { slot, voice } = oldest;
  const rest = (pools.get(slot) ?? []).filter((other) => other !== voice);
  if (rest.length > 0) pools.set(slot, rest);
  else pools.delete(slot);
  try {
    voice.player.remove();
  } catch (error) {
    audioFailed(error);
  }
  return true;
}

// A new player for the slot, when one fits under PLAYERS_MAX.
function addVoice(slot: SoundSlot, source: number, now: number): Voice | null {
  if (!makeRoom(now)) return null;
  const voice = { player: createAudioPlayer(source), started: 0 };
  pools.set(slot, [...(pools.get(slot) ?? []), voice]);
  return voice;
}

// Whether a player may still be sounding: it says so, or it started less than its length ago (its own flag turns on a moment after
// play, so a quick second tap must not take it).
function busy(voice: Voice, now: number): boolean {
  const length = voice.player.duration > 0 ? voice.player.duration * 1000 : BUSY_MS;
  return voice.player.playing || now - voice.started < length;
}

// A player of the slot that is not sounding, a new one while the pool and PLAYERS_MAX have room, else the slot's player that started
// longest ago. Null only when the slot has none and every other player is still sounding.
function voiceOf(slot: SoundSlot, source: number, now: number): Voice | null {
  const pool = pools.get(slot) ?? [];
  const idle = pool.find((voice) => !busy(voice, now));
  if (idle) return idle;
  const added = pool.length < POOL ? addVoice(slot, source, now) : null;
  if (added) return added;
  if (pool.length === 0) return null;
  return pool.reduce((oldest, voice) => (voice.started < oldest.started ? voice : oldest));
}

let loaded = false;

function startSession(now: number): void {
  startAudioSession();
  if (loaded) return;
  loaded = true;
  // The first sound asked for loads the first PLAYERS_MAX slots (the interface's come first: slots.ts), so the next taps start on
  // time; any other slot loads the first time it plays, in place of the player used longest ago.
  for (const slot of SOUND_SLOTS) {
    const source = bundledSounds[slot];
    if (source == null || pools.has(slot)) continue;
    if (playerCount() >= PLAYERS_MAX) break;
    addVoice(slot, source, now);
  }
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
    startSession(now);
    const voice = voiceOf(slot, source, now);
    if (!voice) return;
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
