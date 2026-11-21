// The web, the desktop and the tests make no audio players: they play no sound and no music yet (src/ui/sound/sound.ts, music.ts), so
// nothing calls these there, and expo-audio, which needs the app's runtime, stays out of their bundle. The phone reads audio-player.native.ts.
import type { AudioMode, AudioPlayer } from "expo-audio";

export type { AudioPlayer };

export function createAudioPlayer(_source: number): AudioPlayer {
  throw new Error("No audio player on this platform");
}

export function setAudioModeAsync(_mode: Partial<AudioMode>): Promise<void> {
  return Promise.resolve();
}
