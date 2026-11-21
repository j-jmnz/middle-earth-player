// What Settings and the table panel draw (settings-catalog.ts, SettingsPlatform): Haptics, Table as a list but in a web build with no canvas,
// which is already a list, and no Saves (the phone's saves are in the system's own backup).
import { Platform } from "react-native";

import type { SettingsPlatform } from "./settings-catalog.ts";
import { TABLE_LIST_LINE } from "./settings-words.ts";

export const SETTINGS_PLATFORM: SettingsPlatform = { haptics: true, tableList: Platform.OS !== "web", saves: false, computer: false };

// Table as a list's detail, which names the phone's screen reader.
export const TABLE_LIST_DETAIL = TABLE_LIST_LINE;

/** A detail line as this platform says it: the phone keeps its battery clauses. */
export function platformLine(line: string): string {
  return line;
}
