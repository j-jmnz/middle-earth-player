// The app's one audio session, shared by the sound effects and the music (docs/design-system-table.md, Sound): it follows the silent
// switch, never ducks or stops the player's own music, and stops with the app. A failed call is asked again next time.
import { setAudioModeAsync } from "./audio-player";

let moded = false;

/** A failed sound or music call: a development build logs it; the player never sees it. */
export function audioFailed(error: unknown): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("audio failed", error);
}

export function startAudioSession(): void {
  if (moded) return;
  moded = true;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false, allowsRecording: false, shouldRouteThroughEarpiece: false }).catch((error: unknown) => {
    moded = false;
    audioFailed(error);
  });
}
