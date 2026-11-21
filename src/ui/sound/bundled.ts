// The web, the desktop and the tests carry no sound or music files: they play none yet (src/ui/sound/sound.ts), and an export packed on
// a machine with the cut files must not put them in an installer. The phone's bundle reads assets/sounds and assets/music (bundled.native.ts).
import type { MusicLoop } from "./music-map.ts";
import type { SoundSlot } from "./slots.ts";

export const bundledSounds: Partial<Record<SoundSlot, number>> = {};
export const bundledMusic: Partial<Record<MusicLoop, number>> = {};
