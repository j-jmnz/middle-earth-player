// How Settings is laid out (docs/design-system.md, Settings; user decision, 2026-11-21): the settings by id, the categories that hold
// them, the rows the table's settings panel keeps, the search over names, details and the words players use, and the quick setups
// that change several settings at once. Pure, so a test reads it; the rows themselves are drawn by setting-row.tsx.
import { EFFECTS_VOLUME_LINE, MUSIC_LINE, MUSIC_VOLUME_LINE, STOP_OTHER_AUDIO_LINE, SOUNDS_LINE, CONTRAST_LINE, CONFIRM_TIME_LINE, FOG_LINE, GUIDE_LINE, HAPTICS_LINE, PERFORMANCE_LINE, QUALITY_LINE, QUALITY_WORDS, REDUCE_MOTION_LINE, REDUCE_MOTION_WORDS, SCALE_LINE, SCALE_WORDS, SPEED_LINE, SPEED_WORDS, SPOTLIGHT_LINE, STOPS_LINE, STRONG_OUTLINES_WORDS, TABLE_LIST_LINE, TABLE_LIST_WORDS, THEME_LINE, THEME_WORDS, TIMING_TIPS_LINE, TITLE_FACE_LINE, TITLE_FACE_WORDS, ALWAYS_EMPTY_LINE, AWAKE_LINE, DEBUG_LABEL, DEBUG_LINE } from "./settings-words.ts";
import type { TableSettings } from "../../ui/table-settings.ts";
import { CHECK_LABEL, CHECK_LINE } from "../../ui/update/offer.ts";
import { volumeWords } from "../../ui/sound/volume.ts";

export type SettingId =
  | "theme"
  | "scale"
  | "contrast"
  | "titleFace"
  | "quality"
  | "fog"
  | "speed"
  | "reduceMotion"
  | "spotlight"
  | "haptics"
  | "sounds"
  | "soundVolume"
  | "music"
  | "musicVolume"
  | "stopOtherAudio"
  | "guide"
  | "stops"
  | "tableList"
  | "confirmTime"
  | "timingTips"
  | "awake"
  | "always"
  | "checkUpdates"
  | "debugTools";

export type CategoryId = "look" | "motion" | "sound" | "playing" | "accessibility" | "performance" | "saves" | "about";

// What a platform draws: the phone has haptics and leaves Table as a list out of a web build that has no canvas; the sound effects and the
// music show only in a bundle packed with their files (src/ui/sound/sound.ts, music.ts); Saves is the web's and the desktop's (settings-platform.ts).
export type SettingsPlatform = { haptics: boolean; tableList: boolean; saves: boolean; computer: boolean; sounds: boolean; music: boolean };

// The name of each setting and what the search reads besides its detail: the words a player may type for it.
export const SETTING_TITLES: Readonly<Record<SettingId, string>> = {
  theme: "Theme",
  scale: "UI scale",
  contrast: "Strong outlines",
  titleFace: "Title face",
  quality: "Card pictures",
  fog: "Moving fog",
  speed: "Animation speed",
  reduceMotion: "Reduce motion",
  spotlight: "Combat spotlight",
  haptics: "Haptics",
  sounds: "Sound effects",
  soundVolume: "Effects volume",
  music: "Music",
  musicVolume: "Music volume",
  stopOtherAudio: "Stop other audio",
  guide: "First-game guide",
  stops: "Stops on",
  tableList: "Table as a list",
  confirmTime: "Confirm time",
  timingTips: "Explain timing words",
  awake: "Keep screen awake",
  always: "Responses used every time",
  checkUpdates: CHECK_LABEL,
  debugTools: DEBUG_LABEL,
};

const SETTING_DETAILS: Readonly<Record<SettingId, string>> = {
  theme: THEME_LINE,
  scale: SCALE_LINE,
  contrast: CONTRAST_LINE,
  titleFace: TITLE_FACE_LINE,
  quality: QUALITY_LINE,
  fog: FOG_LINE,
  speed: SPEED_LINE,
  reduceMotion: REDUCE_MOTION_LINE,
  spotlight: SPOTLIGHT_LINE,
  haptics: HAPTICS_LINE,
  sounds: SOUNDS_LINE,
  soundVolume: EFFECTS_VOLUME_LINE,
  music: MUSIC_LINE,
  musicVolume: MUSIC_VOLUME_LINE,
  stopOtherAudio: STOP_OTHER_AUDIO_LINE,
  guide: GUIDE_LINE,
  stops: STOPS_LINE,
  tableList: TABLE_LIST_LINE,
  confirmTime: CONFIRM_TIME_LINE,
  timingTips: TIMING_TIPS_LINE,
  awake: AWAKE_LINE,
  always: ALWAYS_EMPTY_LINE,
  checkUpdates: CHECK_LINE,
  debugTools: DEBUG_LINE,
};

export const SETTING_KEYWORDS: Readonly<Record<SettingId, string>> = {
  theme: "dark light night mode colour color appearance",
  scale: "text size font big bigger larger small zoom",
  contrast: "contrast outline border see visibility",
  titleFace: "font typeface letters readable dyslexia",
  quality: "graphics resolution memory sharp blurry lag slow stutter",
  fog: "background animation mist lag stutter",
  speed: "animation fast faster quick slow slower",
  reduceMotion: "animation motion sickness still",
  spotlight: "combat attack damage replay animation",
  haptics: "vibrate vibration buzz rumble feedback",
  sounds: "audio sfx click noise mute quiet",
  soundVolume: "audio sfx loud quiet louder softer",
  music: "audio soundtrack score song film mute quiet",
  musicVolume: "audio soundtrack score loud quiet louder softer",
  stopOtherAudio: "audio music podcast spotify apps background mix pause interrupt",
  guide: "tutorial help hint learn new beginner",
  stops: "pause stop step skip pass auto",
  tableList: "screen reader voiceover talkback blind switch keyboard text",
  confirmTime: "double tap second tap confirm time motor",
  timingTips: "rules keyword help chip tooltip",
  awake: "sleep lock screen dim",
  always: "response auto automatic ask again sam pippin",
  checkUpdates: "update version release new github",
  debugTools: "bug report developer copy game state",
};

export type Category = {
  id: CategoryId;
  title: string;
  // A line under the page's title that says what the whole category is for.
  note?: string;
  rows: readonly SettingId[];
  // The words a search for the category itself matches, besides its title.
  words: string;
};

export const ACCESSIBILITY_LINE = "Every setting that helps with sight, touch or motion. Some are also in another category.";

// The categories in order. A setting is in one category, its home; Accessibility also lists the ones that help with sight, touch or motion.
export const CATEGORIES: readonly Category[] = [
  { id: "look", title: "Look", rows: ["theme", "scale", "titleFace", "contrast"], words: "display appearance" },
  { id: "motion", title: "Motion", rows: ["speed", "reduceMotion", "spotlight", "haptics"], words: "animation feel" },
  { id: "sound", title: "Sound", rows: ["sounds", "soundVolume", "music", "musicVolume", "stopOtherAudio"], words: "audio volume" },
  { id: "playing", title: "Playing", rows: ["guide", "stops", "timingTips", "confirmTime", "awake", "always"], words: "game table play" },
  { id: "accessibility", title: "Accessibility", note: ACCESSIBILITY_LINE, rows: ["tableList", "scale", "contrast", "reduceMotion", "confirmTime"], words: "a11y access" },
  { id: "performance", title: "Performance", note: PERFORMANCE_LINE, rows: ["quality", "fog"], words: "battery speed slow lag stutter hot" },
  { id: "saves", title: "Saves", rows: [], words: "backup back up restore export import file" },
  { id: "about", title: "About", rows: ["checkUpdates", "debugTools"], words: "version update privacy support credits licence license restore defaults reset" },
];

// The rows the table's settings panel keeps: what a player changes during a game. The rest is one tap away in All settings.
export const PANEL_ROWS: readonly SettingId[] = ["speed", "spotlight", "haptics", "sounds", "soundVolume", "music", "musicVolume", "timingTips", "always"];

export function categoryOf(id: CategoryId): Category {
  const category = CATEGORIES.find((each) => each.id === id);
  if (!category) throw new Error(`No settings category ${id}`);
  return category;
}

export function isCategoryId(value: unknown): value is CategoryId {
  return CATEGORIES.some((each) => each.id === value);
}

/** The first category that lists a setting: where the search says it lives. */
export function homeOf(id: SettingId): CategoryId {
  return (CATEGORIES.find((each) => each.rows.includes(id)) ?? categoryOf("about")).id;
}

/** Whether the platform draws a setting. */
export function shown(id: SettingId, platform: SettingsPlatform): boolean {
  if (id === "haptics") return platform.haptics;
  if (id === "tableList") return platform.tableList;
  if (id === "sounds" || id === "soundVolume") return platform.sounds;
  if (id === "music" || id === "musicVolume") return platform.music;
  // Only a phone can stop another app's audio, and only an app that plays something has a reason to.
  if (id === "stopOtherAudio") return !platform.computer && (platform.sounds || platform.music);
  return true;
}

/** The categories the platform shows: Saves only where the app backs up its own saves, Sound only in a bundle with sounds or music. */
export function categoriesFor(platform: SettingsPlatform): readonly Category[] {
  return CATEGORIES.filter((each) => (each.id !== "saves" || platform.saves) && (each.id !== "sound" || platform.sounds || platform.music));
}

/** The rows of a category, or of the panel, that the platform draws. */
export function rowsFor(rows: readonly SettingId[], platform: SettingsPlatform): SettingId[] {
  return rows.filter((id) => shown(id, platform));
}

const onOff = (value: boolean): string => (value ? "on" : "off");

/** The line under a category's name in the list: what it is set to now. About's line is the screen's (it reads the version). */
export function categorySummary(id: CategoryId, settings: TableSettings, platform: SettingsPlatform): string {
  switch (id) {
    case "look":
      return `${THEME_WORDS[settings.theme]} · ${SCALE_WORDS[settings.uiScale]} · ${TITLE_FACE_WORDS[settings.titleFace]} titles`;
    case "motion": {
      const parts = [`${SPEED_WORDS[settings.animationSpeed]} speed`, `Spotlight ${onOff(settings.spotlight)}`];
      if (platform.haptics) parts.push(`Haptics ${onOff(settings.haptics)}`);
      return parts.join(" · ");
    }
    case "sound": {
      const parts: string[] = [];
      if (platform.sounds) parts.push(settings.sounds ? `Effects ${volumeWords(settings.soundVolume)}` : "Effects off");
      if (platform.music) parts.push(settings.music ? `Music ${volumeWords(settings.musicVolume)}` : "Music off");
      return parts.join(" · ");
    }
    case "playing":
      return `Guide ${onOff(settings.guide)} · Stops ${onOff(settings.stopsOn)} · Timing words ${onOff(settings.timingTips)}`;
    case "accessibility": {
      const parts = platform.tableList ? [`List: ${TABLE_LIST_WORDS[settings.tableAsList]}`] : [`Reduce motion: ${REDUCE_MOTION_WORDS[settings.reduceMotion]}`];
      parts.push(`Outlines: ${STRONG_OUTLINES_WORDS[settings.highContrast]}`);
      return parts.join(" · ");
    }
    case "performance":
      return `Card pictures ${QUALITY_WORDS[settings.cardQuality]} · Fog ${settings.fogDrift ? "moving" : "still"}`;
    case "saves":
      return "Back up and restore";
    case "about":
      return "Version, updates, credits";
  }
}

export type SearchHit = { kind: "setting"; id: SettingId; home: CategoryId } | { kind: "category"; id: CategoryId };

const words = (text: string): string[] => text.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * The settings and categories a query finds. Every word of the query must appear in a setting's name, detail, search words or home
 * category's name; a setting whose name holds the query comes first, then the rest in category order. A category is found by its own
 * name or words, after the settings. An empty query finds nothing.
 */
export function searchSettings(query: string, platform: SettingsPlatform): SearchHit[] {
  const asked = words(query);
  if (asked.length === 0) return [];
  const matches = (text: string) => {
    const lower = text.toLowerCase();
    return asked.every((word) => lower.includes(word));
  };
  const seen = new Set<SettingId>();
  const named: SearchHit[] = [];
  const described: SearchHit[] = [];
  for (const category of categoriesFor(platform)) {
    for (const id of rowsFor(category.rows, platform)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const home = homeOf(id);
      const title = SETTING_TITLES[id];
      if (matches(title)) named.push({ kind: "setting", id, home });
      else if (matches(`${title} ${SETTING_DETAILS[id]} ${SETTING_KEYWORDS[id]} ${categoryOf(home).title}`)) described.push({ kind: "setting", id, home });
    }
  }
  const categories: SearchHit[] = categoriesFor(platform)
    .filter((category) => matches(`${category.title} ${category.words}`))
    .map((category) => ({ kind: "category", id: category.id }));
  return [...named, ...described, ...categories];
}

export type QuickSetup = { id: "read" | "calm" | "light"; title: string; line: string; change: Partial<TableSettings> };

/**
 * The quick setups: each changes several settings at once, and every setting stays its own after. A computer has no battery, so its
 * third setup eases a slow computer and leaves Keep screen awake alone.
 */
export function quickSetups(platform: SettingsPlatform): readonly QuickSetup[] {
  const light: QuickSetup = platform.computer
    ? { id: "light", title: "Lighter load", line: "Card pictures Low and the fog still, for a slow computer.", change: { cardQuality: "low", fogDrift: false } }
    : { id: "light", title: "Save battery", line: "Card pictures Low, the fog still, and the screen may sleep during a game.", change: { cardQuality: "low", fogDrift: false, keepAwake: false } };
  return [
    { id: "read", title: "Easier to read", line: "UI scale Large, plain titles and strong outlines.", change: { uiScale: "large", titleFace: "plain", highContrast: "always" } },
    { id: "calm", title: "Calm table", line: "Reduce motion, no combat spotlight and a long confirm time.", change: { reduceMotion: "always", spotlight: false, confirmTime: "long" } },
    light,
  ];
}

/** Whether every setting a quick setup changes already has its value. */
export function setupInUse(settings: TableSettings, setup: QuickSetup): boolean {
  return Object.entries(setup.change).every(([key, value]) => settings[key as keyof TableSettings] === value);
}
