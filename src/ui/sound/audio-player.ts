// The tests make no audio players: they carry no sound or music files (bundled.ts), so nothing calls these there, and expo-audio, which needs
// the app's runtime, stays out of them. The phone reads audio-player.native.ts, and the web and the desktop audio-player.canvaskit.ts.
import type { AudioMode, AudioPlayer } from "expo-audio";

export type { AudioPlayer };

export function createAudioPlayer(_source: number): AudioPlayer {
  throw new Error("No audio player on this platform");
}

export function setAudioModeAsync(_mode: Partial<AudioMode>): Promise<void> {
  return Promise.resolve();
}
