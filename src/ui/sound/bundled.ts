// The web, the desktop and the tests carry no sound files: they play no sound yet (src/ui/sound/sound.ts), and an export packed on a
// machine with the cut sounds must not put them in an installer. The phone's bundle reads assets/sounds (bundled.native.ts).
import type { SoundSlot } from "./slots.ts";

export const bundledSounds: Partial<Record<SoundSlot, number>> = {};
