// Android's SoundPool for the short sound effects (src/ui/sound/pool.native.ts; docs/design-system-table.md, Sound): it keeps each
// file decoded in memory and starts it with no seek and no wait for the phone's main thread. Android only: an iPhone, the web and a
// development client built before the module have none, and play the sounds through expo-audio.
import { requireOptionalNativeModule } from "expo-modules-core";

export type SoundPoolModule = {
  /** Starts loading the file at a `file://` URI or a path, and returns its sample id (0: the file could not be opened). */
  load(uri: string): number;
  /** Plays a sample at a volume from 0 to 1. One still loading plays as its load ends, when that is soon enough to be the same moment. */
  play(sample: number, volume: number): void;
  /** Frees a sample. */
  unload(sample: number): void;
};

export function soundPool(): SoundPoolModule | null {
  try {
    return requireOptionalNativeModule<SoundPoolModule>("SoundPool");
  } catch {
    return null;
  }
}
