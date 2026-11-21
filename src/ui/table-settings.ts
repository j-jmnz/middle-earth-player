// The app's settings (docs/design-system-table.md, Overview, docs/design-system.md, Settings): the theme and the UI scale,
// haptics, sound effects and reduced motion, the card picture quality and the moving fog, keeping the screen awake, where the table stops to ask
// in a step's action window, the free Responses the player always uses, the readability options and the first-game guide. Kept in
// user.db by the screens (src/screens/settings/store.ts); a vanilla Zustand store here so src/play reads them without importing screens.
// A setting is the player's own standing answer, chosen on purpose: that is the confirmation an auto-pass or an auto-use
// stands on (brief, Screens, Table: no single tap sends an intent).
import { createStore } from "zustand/vanilla";

import { SPEEDS, type Speed } from "./motion-tokens.ts";
import { clampVolume } from "./sound/volume.ts";

/** The step action windows the table can pass for the player, in round order (rail.ts names each). */
export const STOP_POINTS = ["resourceActions", "3.3", "3.4", "4.2", "5.2", "5.3", "6.2", "defense", "shadow", "damage", "end", "strike", "7.4"] as const;
export type StopPoint = (typeof STOP_POINTS)[number];

export type TableSettings = {
  // While on, a step window that is not a stop is passed for the player, unless a card usable there is new since the last stop.
  stopsOn: boolean;
  stops: readonly string[];
  // Effect ids of Responses with no cost and no choice that the player always uses (Sam Gamgee's ready, Pippin's draw).
  alwaysUse: readonly string[];
  // Strong outlines: effect pills and token counts drawn with stronger outlines. Follow system turns them on with the phone's Increase Contrast
  // (iOS) or High contrast text (Android); Always and Off decide it. The key keeps its first name, when it was a switch (parseSettings).
  highContrast: StrongOutlinesOption;
  // The first-game guide: a line under the dock's title the first two times each step comes up.
  guide: boolean;
  // How many times the guide has explained each step.
  guideSeen: Readonly<Record<string, number>>;
  // Animation speed (src/ui/motion-tokens.ts, motionScale): Normal, Quick at 0.6 of every length or Slow at 1.5. Reduced motion snaps all three.
  animationSpeed: Speed;
  // The combat spotlight (phase 24): when an attack deals or blocks damage the table plays it large. Off plays none, as reduced motion does.
  spotlight: boolean;
  // How large the whole UI draws: Small, Medium, Large or Extra large (ui-scale.ts holds the factors).
  uiScale: UiScaleOption;
  // A buzz on the table's key moments. Off plays none.
  haptics: boolean;
  // Sound effects on the table's and the screens' moments (src/ui/sound/sound.ts). Off plays none; a bundle without the files plays none either.
  sounds: boolean;
  // How loud the sound effects play, 0 to 1 in steps of 5% (src/ui/sound/volume.ts).
  soundVolume: number;
  // Reduced motion: follow the phone's setting, or always snap whatever the phone says.
  reduceMotion: ReduceMotionOption;
  // Keep the screen from sleeping while a table is open.
  keepAwake: boolean;
  // The colors: Dark, Light, or whichever the phone is set to.
  theme: ThemeOption;
  // How sharp the table's and the hand's card pictures are kept: High at the phone's pixel ratio, Low at half of it (table-pictures.ts, pictureRatio).
  cardQuality: CardQualityOption;
  // Whether the fog behind every screen drifts. Off holds it still (src/screens/art/backdrop-drift.ts).
  fogDrift: boolean;
  // Table as a list: the reader table (the tray as the default path, the reader notes) follows the phone's screen reader, or is always on, for a
  // player whose Switch Control, Voice Control or Switch Access cannot reach a card drawn on the canvas. Native only (screen-reader.ts, useReaderMode).
  tableAsList: TableListOption;
  // Confirm time: how long an armed two-tap button waits for its second tap (dock/armed-room.ts, armMs).
  confirmTime: ConfirmTimeOption;
  // Banner closes: after a few seconds (readouts/banner-time.ts), or only when the player taps or swipes it, or a new moment replaces it.
  bannerCloses: BannerClosesOption;
  // Title face: Carved is Marcellus SC (small capitals) for every `font-display` text and the canvas's numbers; Plain is Barlow Semi Condensed semibold.
  titleFace: TitleFaceOption;
  // Explain timing words: the table's card preview also draws a chip for each timing word the card's text opens a line with (When Revealed, Shadow, Forced, ...).
  timingTips: boolean;
  // Check for new versions: once a day the app asks GitHub for its latest release and offers a later one (src/ui/update/offer.ts). On by default (user decision, 2026-11-17).
  checkUpdates: boolean;
  // Debug tools: the table menu gains Copy game state, which copies the whole game, hidden cards included, as text for a bug report
  // (src/play/store/debug-snapshot.ts). Off by default.
  debugTools: boolean;
};

export const UI_SCALE_OPTIONS = ["small", "medium", "large", "xlarge"] as const;
export type UiScaleOption = (typeof UI_SCALE_OPTIONS)[number];
export const REDUCE_MOTION_OPTIONS = ["system", "always"] as const;
export type ReduceMotionOption = (typeof REDUCE_MOTION_OPTIONS)[number];
export const THEME_OPTIONS = ["dark", "light", "system"] as const;
export type ThemeOption = (typeof THEME_OPTIONS)[number];
export const TABLE_LIST_OPTIONS = ["system", "always"] as const;
export type TableListOption = (typeof TABLE_LIST_OPTIONS)[number];
export const CONFIRM_TIME_OPTIONS = ["standard", "long", "none"] as const;
export type ConfirmTimeOption = (typeof CONFIRM_TIME_OPTIONS)[number];
export const BANNER_CLOSES_OPTIONS = ["timer", "tap"] as const;
export type BannerClosesOption = (typeof BANNER_CLOSES_OPTIONS)[number];
export const STRONG_OUTLINES_OPTIONS = ["system", "always", "off"] as const;
export type StrongOutlinesOption = (typeof STRONG_OUTLINES_OPTIONS)[number];
export const TITLE_FACE_OPTIONS = ["carved", "plain"] as const;
export type TitleFaceOption = (typeof TITLE_FACE_OPTIONS)[number];
export const CARD_QUALITY_OPTIONS = ["high", "low"] as const;
export type CardQualityOption = (typeof CARD_QUALITY_OPTIONS)[number];

/** Whether Strong outlines is in effect: Always and Off decide it; Follow system is on while the phone's Increase Contrast or High contrast text is. */
export function strongOutlines(option: StrongOutlinesOption, increaseContrast: boolean): boolean {
  if (option === "always") return true;
  return option === "system" && increaseContrast;
}

// The stops the video uses: after staging ("the golden action window") and before the shadow card turns.
export const DEFAULT_STOPS: readonly string[] = ["3.3", "shadow"];

export const DEFAULT_SETTINGS: TableSettings = { stopsOn: false, stops: DEFAULT_STOPS, alwaysUse: [], highContrast: "system", guide: true, guideSeen: {}, animationSpeed: "normal", spotlight: true, uiScale: "medium", haptics: true, sounds: true, soundVolume: 0.8, reduceMotion: "system", keepAwake: true, theme: "dark", cardQuality: "high", fogDrift: true, tableAsList: "system", confirmTime: "standard", bannerCloses: "timer", titleFace: "carved", timingTips: false, checkUpdates: true, debugTools: false };

/** Settings read back from storage: unknown keys dropped, missing ones defaulted, wrong types replaced. */
export function parseSettings(raw: unknown): TableSettings {
  const value = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const strings = (input: unknown, fallback: readonly string[]): readonly string[] => (Array.isArray(input) && input.every((item) => typeof item === "string") ? input : fallback);
  const flag = (input: unknown, fallback: boolean): boolean => (typeof input === "boolean" ? input : fallback);
  const seen: Record<string, number> = {};
  if (value.guideSeen != null && typeof value.guideSeen === "object") {
    for (const [key, count] of Object.entries(value.guideSeen as Record<string, unknown>)) if (typeof count === "number") seen[key] = count;
  }
  return {
    stopsOn: flag(value.stopsOn, DEFAULT_SETTINGS.stopsOn),
    stops: strings(value.stops, DEFAULT_SETTINGS.stops).filter((stop) => (STOP_POINTS as readonly string[]).includes(stop)),
    alwaysUse: strings(value.alwaysUse, []),
    // An older build stored a switch: on is Always, off is Follow system.
    highContrast: value.highContrast === true ? "always" : (STRONG_OUTLINES_OPTIONS.find((option) => option === value.highContrast) ?? DEFAULT_SETTINGS.highContrast),
    guide: flag(value.guide, true),
    guideSeen: seen,
    animationSpeed: SPEEDS.find((speed) => speed === value.animationSpeed) ?? DEFAULT_SETTINGS.animationSpeed,
    spotlight: flag(value.spotlight, true),
    uiScale: UI_SCALE_OPTIONS.find((option) => option === value.uiScale) ?? DEFAULT_SETTINGS.uiScale,
    haptics: flag(value.haptics, DEFAULT_SETTINGS.haptics),
    sounds: flag(value.sounds, DEFAULT_SETTINGS.sounds),
    soundVolume: typeof value.soundVolume === "number" ? clampVolume(value.soundVolume) : DEFAULT_SETTINGS.soundVolume,
    reduceMotion: REDUCE_MOTION_OPTIONS.find((option) => option === value.reduceMotion) ?? DEFAULT_SETTINGS.reduceMotion,
    keepAwake: flag(value.keepAwake, DEFAULT_SETTINGS.keepAwake),
    theme: THEME_OPTIONS.find((option) => option === value.theme) ?? DEFAULT_SETTINGS.theme,
    cardQuality: CARD_QUALITY_OPTIONS.find((option) => option === value.cardQuality) ?? DEFAULT_SETTINGS.cardQuality,
    fogDrift: flag(value.fogDrift, DEFAULT_SETTINGS.fogDrift),
    tableAsList: TABLE_LIST_OPTIONS.find((option) => option === value.tableAsList) ?? DEFAULT_SETTINGS.tableAsList,
    confirmTime: CONFIRM_TIME_OPTIONS.find((option) => option === value.confirmTime) ?? DEFAULT_SETTINGS.confirmTime,
    bannerCloses: BANNER_CLOSES_OPTIONS.find((option) => option === value.bannerCloses) ?? DEFAULT_SETTINGS.bannerCloses,
    titleFace: TITLE_FACE_OPTIONS.find((option) => option === value.titleFace) ?? DEFAULT_SETTINGS.titleFace,
    timingTips: flag(value.timingTips, DEFAULT_SETTINGS.timingTips),
    checkUpdates: flag(value.checkUpdates, DEFAULT_SETTINGS.checkUpdates),
    debugTools: flag(value.debugTools, DEFAULT_SETTINGS.debugTools),
  };
}

/** Every setting back to its default, except the guide's count: the guide switches back on, but steps already seen twice do not replay. */
export function restoreDefaults(settings: TableSettings): TableSettings {
  return { ...DEFAULT_SETTINGS, guideSeen: settings.guideSeen };
}

export type SettingsState = { settings: TableSettings; update: (change: Partial<TableSettings>) => void; hydrate: (settings: TableSettings) => void };

/** The app's one settings store. The screens hydrate it from user.db and write each change back. */
export const tableSettings = createStore<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  update: (change) => set({ settings: { ...get().settings, ...change } }),
  hydrate: (settings) => set({ settings }),
}));

/** A stop toggled on or off, kept in round order. */
export function toggleStop(stops: readonly string[], point: string): readonly string[] {
  const next = stops.includes(point) ? stops.filter((stop) => stop !== point) : [...stops, point];
  return STOP_POINTS.filter((stop) => next.includes(stop));
}

/** A free Response set to Always, or back to asking. */
export function toggleAlways(always: readonly string[], effectId: string): readonly string[] {
  return always.includes(effectId) ? always.filter((id) => id !== effectId) : [...always, effectId];
}
