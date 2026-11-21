// The phone's audio players and session (expo-audio). The tests read audio-player.ts, which plays nothing, and so do the web and the desktop
// unless they have a `.canvaskit` variant of their own (metro.config.js).
export { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
