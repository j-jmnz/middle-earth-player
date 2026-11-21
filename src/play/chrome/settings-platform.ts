// What the phone's Settings and table panel draw (settings-catalog.ts, SettingsPlatform): Haptics, Table as a list but in a web build with no
// canvas, which is already a list, Sound in a bundle packed with the sounds or the music, and no Saves (the phone's saves are in the system's
// own backup). settings-platform.canvaskit.ts is the web's and the desktop's, which metro.config.js serves in its place on the web platform only.
import { Platform } from "react-native";

import type { SettingsPlatform } from "./settings-catalog.ts";
import { TABLE_LIST_LINE } from "./settings-words.ts";
import { MUSIC_BUNDLED } from "../../ui/sound/music.ts";
import { SOUNDS_BUNDLED } from "../../ui/sound/sound.ts";

export const SETTINGS_PLATFORM: SettingsPlatform = { haptics: true, tableList: Platform.OS !== "web", saves: false, computer: false, sounds: SOUNDS_BUNDLED, music: MUSIC_BUNDLED };

// Table as a list's detail, which names the phone's screen reader.
export const TABLE_LIST_DETAIL = TABLE_LIST_LINE;

/** A detail line as this platform says it: the phone keeps its battery clauses. */
export function platformLine(line: string): string {
  return line;
}
