// Whether every play of a sound effect must be a seek to the start with the play behind it (sound.ts). True on Android: expo-audio's
// player there is Media3's ExoPlayer, and a paused one that stands at its start goes dead when its file is short. It writes the whole
// file into its audio output while it waits, and at the file's end it marks that output stopped, on its next turn of work, about a
// second later (`AudioTrackAudioOutput.stop`). A stopped output is never started by a later play (`AudioTrackAudioOutput.play`), so the
// play is silent, while the player says it plays. Only a seek, which empties the output, makes it sound again. An iPhone's waiting
// player plays at once. The tests, the web and the desktop read starts-by-seek.ts.
import { Platform } from "react-native";

export const STARTS_BY_SEEK = Platform.OS === "android";
