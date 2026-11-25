// The audio of other apps (the player's own music or a podcast): whether it plays, so the app's music does not start over it, and
// stopping it when the player wants this app to sound alone (src/ui/sound/music.ts, src/ui/sound/session.ts;
// docs/design-system-table.md, Sound). iOS reads AVAudioSession's secondaryAudioShouldBeSilencedHint and activates the session, whose
// category expo-audio sets; Android reads AudioManager's isMusicActive and takes the audio focus. A build without the native module
// (the web, a development client built before it) answers false and stops nothing.
import { requireOptionalNativeModule } from "expo-modules-core";

type OtherAudioModule = {
  isOtherAudioPlaying(): boolean;
  // Absent in a development client built before them.
  stopOtherAudio?(): Promise<boolean>;
  allowOtherAudio?(): Promise<void>;
};

function native(): OtherAudioModule | null {
  try {
    return requireOptionalNativeModule<OtherAudioModule>("OtherAudio");
  } catch {
    return null;
  }
}

export function otherAudioPlaying(): boolean {
  try {
    return native()?.isOtherAudioPlaying() ?? false;
  } catch {
    return false;
  }
}

/** Asks the phone to stop the audio of other apps. The other app decides: a call or a navigation voice can go on. */
export function stopOtherAudio(): void {
  native()
    ?.stopOtherAudio?.()
    .catch(() => undefined);
}

/** Gives up what stopOtherAudio took, so another app's audio is no longer stopped. It does not start that audio again. */
export function allowOtherAudio(): void {
  native()
    ?.allowOtherAudio?.()
    .catch(() => undefined);
}
