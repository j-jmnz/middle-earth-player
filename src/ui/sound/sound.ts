// The table's and the screens' sound effects (docs/design-system-table.md, Sound; user request, 2026-11-18). A sound plays at the
// moment its haptic or its motion does and adds to what the screen shows; it never replaces it. It follows the phone's silent switch
// and mixes with the player's own music. The Sound effects setting turns them all off. A bundle packed without the files (no asset
// mirror and no cache: scripts/build/pack-sounds.ts) plays none, and so do the web and the desktop for now (bundled.ts). A failed sound is not an
// error the player should see; a development build logs it. One player a slot is made the first time any sound plays and kept for the
// app's life: the set is small and fixed.
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";

import { accessibility } from "../accessibility.ts";
import { tableSettings } from "../table-settings.ts";
import { bundledSounds } from "./bundled";
import { audioFailed, startAudioSession } from "./session.ts";
import type { SoundSlot } from "./slots.ts";

// The same sound asked for again this soon (cards drawn in a row, tokens landing together) is not restarted: one plays for all.
const REPEAT_MS = 60;

// After an Undo, the table's own sounds (the threat dial, the rail, the cards and tokens moving back) stay quiet this long: the
// state it restores is not news, and Undo has its own sound.
const UNDO_QUIET_MS = 800;

const players = new Map<SoundSlot, AudioPlayer>();
let quietUntil = 0;
const lastPlayed = new Map<SoundSlot, number>();

/** Whether this bundle carries any sound and can play it: the Sound effects row shows only then. Fixed when the bundle loads. */
export const SOUNDS_BUNDLED = Platform.OS !== "web" && Object.keys(bundledSounds).length > 0;

function playerOf(slot: SoundSlot, source: number): AudioPlayer {
  const existing = players.get(slot);
  if (existing) return existing;
  const player = createAudioPlayer(source);
  players.set(slot, player);
  return player;
}

let loaded = false;

function startSession(): void {
  startAudioSession();
  if (loaded) return;
  loaded = true;
  // Every sound is loaded once the first one is asked for, so the next ones start on time.
  for (const [slot, source] of Object.entries(bundledSounds) as [SoundSlot, number][]) playerOf(slot, source);
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
  if (now - (lastPlayed.get(slot) ?? -Infinity) < REPEAT_MS) return;
  lastPlayed.set(slot, now);
  try {
    startSession();
    const player = playerOf(slot, source);
    player.volume = soundVolume;
    player.seekTo(0).catch(audioFailed);
    player.play();
  } catch (error) {
    audioFailed(error);
  }
}

/** Undo's sound, and quiet for the table's sounds of the state it restores (UNDO_QUIET_MS). */
export function playUndo(): void {
  playSound("ui.back");
  quietUntil = Date.now() + UNDO_QUIET_MS;
}
