// What Settings and the table panel draw on the web and the desktop (settings-platform.ts is the phone's; metro.config.js serves this file in
// its place on the web platform only): no Haptics (a browser or the desktop app never vibrates), Table as a list with its own words (the web
// draws the canvas, and the setting is the way to the list), no Sound (the web and the desktop play none: src/ui/sound/sound.ts), and Saves
// (backup and restore, src/screens/settings/web).
import type { SettingsPlatform } from "./settings-catalog.ts";

export const SETTINGS_PLATFORM: SettingsPlatform = { haptics: false, tableList: true, saves: true, computer: true, sounds: false, music: false };

// Table as a list, worded for a browser and the desktop app (the phone's line names TalkBack, VoiceOver and Switch Access): a screen reader a browser cannot detect and keyboard play.
export const TABLE_LIST_DETAIL =
  "Lists the table's cards and choices as text, in place of the drawn table. Follow screen reader does it only while the app is told a screen reader is on; Always does it for a screen reader a browser cannot detect, for keyboard play, or if you prefer it.";

/** A detail line as a computer says it: it has no battery to spare, so the battery clauses are dropped. */
export function platformLine(line: string): string {
  return line.replace(/ (Off saves|Uses more) battery\./, "");
}
