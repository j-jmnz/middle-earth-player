// The app's one audio session, shared by the sound effects and the music (docs/design-system-table.md, Sound): on iOS it follows the
// silent switch; on Android the media volume sets it, so a phone on silent or vibrate still plays it. It stops with the app. With
// Stop other audio on (the default; user decision, 2026-11-25), a phone stops the audio of other apps as the app opens and as it
// comes back to the front; with it off, the app mixes with that audio and never ducks or stops it. A failed call is asked again
// next time.
import { Platform } from "react-native";

import { setAudioModeAsync } from "./audio-player";
import { tableSettings } from "../table-settings.ts";
import { allowOtherAudio, stopOtherAudio } from "./other-audio";

// The Stop other audio setting the session's mode was last set for; null before the first call and after a failed one.
let moded: boolean | null = null;

/** A failed sound or music call: a development build logs it; the player never sees it. */
export function audioFailed(error: unknown): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("audio failed", error);
}

/** Whether the app stops the audio of other apps (the Stop other audio setting). Only a phone can. */
export function stopsOtherAudio(): boolean {
  return tableSettings.getState().settings.stopOtherAudio;
}

/** Sets the session's mode for the Stop other audio setting as it is now, once for each value of it. */
export function startAudioSession(): void {
  const stop = stopsOtherAudio();
  if (moded === stop) return;
  moded = stop;
  // expo-audio on Android pauses every player while the ringer is silent or vibrate unless `playsInSilentMode` is on. Android has no
  // silent switch for media: the ringer mode is for calls and notifications, and the media volume is the player's control.
  const playsInSilentMode = Platform.OS === "android";
  // On iOS the session's category decides: one that does not mix stops other audio as the session is activated. On Android
  // expo-audio always mixes and the app takes the audio focus itself (modules/other-audio), so the sounds that play through no
  // expo-audio player (pool-samples.ts) and an app with its music off stop other audio too.
  const interruptionMode = stop && Platform.OS === "ios" ? "doNotMix" : "mixWithOthers";
  setAudioModeAsync({ playsInSilentMode, interruptionMode, shouldPlayInBackground: false, allowsRecording: false, shouldRouteThroughEarpiece: false })
    .then(() => {
      // The setting can change while the call runs: the newer call owns the answer.
      if (moded !== stop) return;
      if (stop) stopOtherAudio();
      else allowOtherAudio();
    })
    .catch((error: unknown) => {
      if (moded === stop) moded = null;
      audioFailed(error);
    });
}

/**
 * Stops the audio of other apps when the setting says so: as the app opens, as it comes back to the front (another app can have
 * started meanwhile) and as the setting changes. With the setting off it only puts the session back to mixing.
 */
export function claimAudio(): void {
  if (moded === stopsOtherAudio()) {
    if (moded) stopOtherAudio();
    return;
  }
  startAudioSession();
}
