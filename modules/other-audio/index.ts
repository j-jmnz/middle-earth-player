// Whether another app's audio is playing (the player's own music or a podcast), so the app's music does not start over it
// (src/ui/sound/music.ts; docs/design-system-table.md, Sound). iOS reads AVAudioSession's secondaryAudioShouldBeSilencedHint, Android
// AudioManager's isMusicActive. A build without the native module (the web, a development client built before it) answers false.
import { requireOptionalNativeModule } from "expo-modules-core";

type OtherAudioModule = {
  isOtherAudioPlaying(): boolean;
};

export function otherAudioPlaying(): boolean {
  try {
    return requireOptionalNativeModule<OtherAudioModule>("OtherAudio")?.isOtherAudioPlaying() ?? false;
  } catch {
    return false;
  }
}
