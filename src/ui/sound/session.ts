// The app's one audio session, shared by the sound effects and the music (docs/design-system-table.md, Sound): on iOS it follows the
// silent switch; on Android the media volume sets it, so a phone on silent or vibrate still plays it. It never ducks or stops the
// player's own music, and stops with the app. A failed call is asked again next time.
import { Platform } from "react-native";

import { setAudioModeAsync } from "./audio-player";

let moded = false;

/** A failed sound or music call: a development build logs it; the player never sees it. */
export function audioFailed(error: unknown): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("audio failed", error);
}

export function startAudioSession(): void {
  if (moded) return;
  moded = true;
  // expo-audio on Android pauses every player while the ringer is silent or vibrate unless `playsInSilentMode` is on. Android has no
  // silent switch for media: the ringer mode is for calls and notifications, and the media volume is the player's control.
  const playsInSilentMode = Platform.OS === "android";
  setAudioModeAsync({ playsInSilentMode, interruptionMode: "mixWithOthers", shouldPlayInBackground: false, allowsRecording: false, shouldRouteThroughEarpiece: false }).catch((error: unknown) => {
    moded = false;
    audioFailed(error);
  });
}
