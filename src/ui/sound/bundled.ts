// The tests carry no sound or music files, so they play none. The phone's bundle reads assets/sounds and assets/music (bundled.native.ts), and
// the web and the desktop read the same files through bundled.canvaskit.ts.
import type { MusicLoop } from "./music-map.ts";
import type { SoundSlot } from "./slots.ts";

export const bundledSounds: Partial<Record<SoundSlot, number>> = {};
export const bundledMusic: Partial<Record<MusicLoop, number>> = {};
