// The table's and the screens' sound effects (docs/design-system-table.md, Sound; user request, 2026-11-18). A sound plays at the
// moment its haptic or its motion does and adds to what the screen shows; it never replaces it. It follows the iPhone's silent switch (not an Android ringer: session.ts)
// and mixes with the player's own music. The Sound effects setting turns them all off. A bundle packed without the files (no asset
// mirror and no cache: scripts/build/pack-sounds.ts) plays none; the web and the desktop play the same files (bundled.canvaskit.ts). A failed sound is not an
// error the player should see; a development build logs it. A slot keeps a few players, so quick taps each get one that is not still
// playing, and all the slots together keep at most PLAYERS_MAX: a new player releases the one used longest ago, so the music always
// finds a decoder for its next loop.
//
// A sound starts with no wait when its player is loaded and stands at its start, so both are done ahead of the moment: a slot whose
// moment is known to come is loaded before it (primeSounds), and a player that has sounded is put back to its start once it ends (rewind).
//
// On Android a player that waits at its start cannot be trusted (STARTS_BY_SEEK, starts-by-seek.native.ts): there every play is a seek to
// the start with the play sent right behind it, and no player is put back.
import { createAudioPlayer, type AudioPlayer } from "./audio-player";

import { accessibility } from "../accessibility.ts";
import { tableSettings } from "../table-settings.ts";
import { bundledSounds } from "./bundled";
import { audioFailed, startAudioSession } from "./session.ts";
import { SCREEN_SOUNDS, type SoundSlot } from "./slots.ts";
import { STARTS_BY_SEEK } from "./starts-by-seek";

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
// sound, found none and stayed silent. The music keeps a few players of its own (music.ts). It holds the sounds a screen or the table
// plays most (SCREEN_SOUNDS, TABLE_SOUNDS: slots.ts), so those never load at the moment they play.
export const PLAYERS_MAX = 12;
// How long after a sound's end its player is put back to its start, and the longest a player whose length never loads is left to sound
// (the longest sound is kept to 4.5 s: scripts/build/sound-picks.ts).
const REWIND_MS = 80;
// A player past this point of its file has started.
const STARTED_SECONDS = 0.02;
const LONGEST_MS = 5000;

// After an Undo, the table's own sounds (the threat dial, the rail, the cards and tokens moving back) stay quiet this long: the
// state it restores is not news, and Undo has its own sound.
const UNDO_QUIET_MS = 800;

// `started`: when it last played (0: never). `used`: when it last played or was asked to be ready, which decides the one released.
// `cued`: it stands at its start, loaded or loading, so play() alone starts it. `volume`: the level last set on it.
// `length`: its file's length in ms once loaded (0 before), kept so a native player is not asked again.
type Timer = ReturnType<typeof setTimeout> | null;
type Voice = { player: AudioPlayer; started: number; used: number; cued: boolean; volume: number; length: number; rewind: Timer };
const pools = new Map<SoundSlot, Voice[]>();
let quietUntil = 0;
const lastPlayed = new Map<SoundSlot, number>();

// With Debug tools on, each play is logged, so a sound that is lost on one phone can be traced from its log.
function trace(message: string): void {
  if (tableSettings.getState().settings.debugTools) console.log(`[sound] ${message}`);
}

/** Whether this bundle carries any sound and can play it: the Sound effects row shows only then. Fixed when the bundle loads. */
export const SOUNDS_BUNDLED = Object.keys(bundledSounds).length > 0;

function playerCount(): number {
  let count = 0;
  for (const pool of pools.values()) count += pool.length;
  return count;
}

// Releases the player used longest ago that is not sounding, so a new one fits under PLAYERS_MAX. A slot in `keep` gives up none.
// False when every other player is still sounding.
function makeRoom(now: number, keep?: ReadonlySet<SoundSlot>): boolean {
  if (playerCount() < PLAYERS_MAX) return true;
  let oldest: { slot: SoundSlot; voice: Voice } | null = null;
  for (const [slot, pool] of pools) {
    if (keep?.has(slot)) continue;
    for (const voice of pool) if (!busy(voice, now) && (!oldest || voice.used < oldest.voice.used)) oldest = { slot, voice };
  }
  if (!oldest) return false;
  const { slot, voice } = oldest;
  const rest = (pools.get(slot) ?? []).filter((other) => other !== voice);
  if (rest.length > 0) pools.set(slot, rest);
  else pools.delete(slot);
  if (voice.rewind != null) clearTimeout(voice.rewind);
  voice.rewind = null;
  try {
    voice.player.remove();
  } catch (error) {
    audioFailed(error);
  }
  return true;
}

// A new player for the slot, when one fits under PLAYERS_MAX.
function addVoice(slot: SoundSlot, source: number, now: number, keep?: ReadonlySet<SoundSlot>): Voice | null {
  if (!makeRoom(now, keep)) return null;
  const voice: Voice = { player: createAudioPlayer(source), started: 0, used: now, cued: true, volume: -1, length: 0, rewind: null };
  pools.set(slot, [...(pools.get(slot) ?? []), voice]);
  return voice;
}

// Whether a player may still be sounding: it says so, or it started less than its length ago (its own flag turns on a moment after
// play, so a quick second tap must not take it).
function busy(voice: Voice, now: number): boolean {
  if (now - voice.started < lengthOf(voice)) return true;
  // Past a known length it has ended. Each read of a native player's state waits for the phone's main thread, so it is asked only
  // while its length is not known.
  return voice.length > 0 ? false : voice.player.playing;
}

function lengthOf(voice: Voice): number {
  if (voice.length > 0) return voice.length;
  const seconds = voice.player.duration;
  if (seconds > 0) voice.length = seconds * 1000;
  return voice.length > 0 ? voice.length : BUSY_MS;
}

// Puts a player that has sounded back to its start once the sound has ended, so its next play starts at once and waits for no seek.
// `token` is the play it follows: a player that has played again since has that play's own rewind.
function rewindAfter(voice: Voice, token: number, wait: number): void {
  if (voice.rewind != null) clearTimeout(voice.rewind);
  voice.rewind = setTimeout(() => rewind(voice, token), wait);
}

function rewind(voice: Voice, token: number): void {
  voice.rewind = null;
  if (voice.started !== token) return;
  const { player } = voice;
  try {
    const since = Date.now() - token;
    // What the player itself says, not the time since it was asked: on a busy phone a sound starts late (the play waits for the
    // phone's main thread while a screen is built), and this timer runs late too, so the clock alone would stop a sound that had
    // just begun.
    const playing = player.playing;
    const at = player.currentTime;
    if (playing && since < LONGEST_MS) return rewindAfter(voice, token, Math.max(REWIND_MS, lengthOf(voice) - at * 1000 + REWIND_MS));
    // It stands at its start and is not playing: it has not begun yet, or was put back already. It is left as it is.
    if (!playing && at <= STARTED_SECONDS) {
      voice.cued = true;
      return;
    }
    // Paused first: a player that reached its end and is still set to play would start again as the seek lands.
    player.pause();
    player
      .seekTo(0)
      .then(() => {
        if (voice.started === token) voice.cued = true;
      })
      .catch(audioFailed);
  } catch (error) {
    audioFailed(error);
  }
}

// Loads a player for each slot that has none, in place of the players used longest ago, and counts the slots' players as just used.
function load(slots: readonly SoundSlot[], now: number): void {
  const keep = new Set(slots);
  for (const slot of keep) {
    const source = bundledSounds[slot];
    if (source == null) continue;
    const pool = pools.get(slot);
    if (!pool) addVoice(slot, source, now, keep);
    else for (const voice of pool) voice.used = now;
  }
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
  // The first sound asked for loads the screens' sounds when the launch did not (primeSounds), so the next taps start on time; any
  // other slot loads when it is primed or the first time it plays, in place of the player used longest ago.
  load(SCREEN_SOUNDS, now);
}

function soundsOn(): boolean {
  const { sounds, soundVolume } = tableSettings.getState().settings;
  return SOUNDS_BUNDLED && sounds && soundVolume > 0;
}

/**
 * Loads the slots' players ahead of the moment they play, so each starts with no load: the screens' sounds at launch, the table's as
 * it opens, a state's motion sounds as it is drawn and a spotlight's strikes as it starts. It plays nothing, and loads nothing while
 * the sounds are off.
 */
export function primeSounds(slots: readonly SoundSlot[]): void {
  if (slots.length === 0 || !soundsOn()) return;
  try {
    startAudioSession();
    loaded = true;
    load(slots.slice(0, PLAYERS_MAX), Date.now());
  } catch (error) {
    audioFailed(error);
  }
}

/** Plays a slot's sound from its start, when the setting is on and this bundle has the file. */
export function playSound(slot: SoundSlot): void {
  if (!soundsOn()) return;
  const { soundVolume } = tableSettings.getState().settings;
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
    if (!voice) return trace(`${slot}: no player is free`);
    const { player } = voice;
    const { cued } = voice;
    voice.started = now;
    voice.used = now;
    voice.cued = false;
    if (voice.volume !== soundVolume) {
      player.volume = soundVolume;
      voice.volume = soundVolume;
    }
    if (STARTS_BY_SEEK) {
      // The seek empties the player's audio output, which also wakes a player that went dead while it waited (starts-by-seek.native.ts).
      // The play is sent right behind it and does not wait for the seek's answer: a tab's press builds a screen, and the answer would
      // wait for it. The player is not put back after the sound: the next play seeks again.
      trace(`${slot}: seek and play${voice.length > 0 ? "" : " (length not loaded)"}`);
      player.seekTo(0).catch(audioFailed);
      player.play();
      return;
    }
    // A player at its start plays at once. One still sounding, or not yet put back (rewind), starts again only once its seek to the
    // start is done, so it never plays on from where it stopped.
    trace(`${slot}: ${cued ? "play" : "seek, then play"}${voice.length > 0 ? "" : " (length not loaded)"}`);
    if (cued) {
      player.play();
    } else {
      player.pause();
      player
        .seekTo(0)
        .then(() => player.play())
        .catch(audioFailed);
    }
    rewindAfter(voice, now, lengthOf(voice) + REWIND_MS);
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
