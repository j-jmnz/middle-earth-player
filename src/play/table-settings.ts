// The app's settings (docs/plans/done/table-experience.md, docs/plans/done/settings-theme-and-ui-scale.md): the theme and the UI scale,
// haptics and reduced motion, the card picture quality and the moving fog, keeping the screen awake, where the table stops to ask in a step's action window, the free
// Responses the player always uses, the readability options and the first-game guide. Kept in user.db by the screens
// (src/screens/settings-store.ts); a vanilla Zustand store here so src/play reads them without importing screens.
// A setting is the player's own standing answer, chosen on purpose: that is the confirmation an auto-pass or an auto-use
// stands on (brief, Screens, Table: no single tap sends an intent).
import { createStore } from "zustand/vanilla";

import { SPEEDS, type Speed } from "./motion-tokens.ts";

/** The step action windows the table can pass for the player, in round order (rail.ts names each). */
export const STOP_POINTS = ["resourceActions", "3.3", "3.4", "4.2", "5.2", "5.3", "6.2", "defense", "shadow", "damage", "end", "strike", "7.4"] as const;
export type StopPoint = (typeof STOP_POINTS)[number];

export type TableSettings = {
  // While on, a step window that is not a stop is passed for the player, unless a card usable there is new since the last stop.
  stopsOn: boolean;
  stops: readonly string[];
  // Effect ids of Responses with no cost and no choice that the player always uses (Sam Gamgee's ready, Pippin's draw).
  alwaysUse: readonly string[];
  // Effect pills and token counts drawn with stronger outlines.
  highContrast: boolean;
  // The first-game guide: a line under the dock's title the first two times each step comes up.
  guide: boolean;
  // How many times the guide has explained each step.
  guideSeen: Readonly<Record<string, number>>;
  // Animation speed (motion-tokens.ts, motionScale): Normal, or Quick at 0.6 of every length. Reduced motion snaps either.
  animationSpeed: Speed;
  // The combat spotlight (phase 24): when an attack deals or blocks damage the table plays it large. Off plays none, as reduced motion does.
  spotlight: boolean;
  // How large the whole UI draws: Small, Medium or Large (ui-scale.ts holds the factors).
  uiScale: UiScaleOption;
  // A buzz on the table's key moments. Off plays none.
  haptics: boolean;
  // Reduced motion: follow the phone's setting, or always snap whatever the phone says.
  reduceMotion: ReduceMotionOption;
  // Keep the screen from sleeping while a table is open.
  keepAwake: boolean;
  // The colors: Dark, Light, or whichever the phone is set to.
  theme: ThemeOption;
  // How sharp the table's and the hand's card pictures are kept: High at the phone's pixel ratio, Low at half of it (table-pictures.ts, pictureRatio).
  cardQuality: CardQualityOption;
  // Whether the fog behind every screen drifts. Off holds it still (src/screens/backdrop-drift.ts).
  fogDrift: boolean;
};

export const UI_SCALE_OPTIONS = ["small", "medium", "large"] as const;
export type UiScaleOption = (typeof UI_SCALE_OPTIONS)[number];
export const REDUCE_MOTION_OPTIONS = ["system", "always"] as const;
export type ReduceMotionOption = (typeof REDUCE_MOTION_OPTIONS)[number];
export const THEME_OPTIONS = ["dark", "light", "system"] as const;
export type ThemeOption = (typeof THEME_OPTIONS)[number];
export const CARD_QUALITY_OPTIONS = ["high", "low"] as const;
export type CardQualityOption = (typeof CARD_QUALITY_OPTIONS)[number];

// The stops the video uses: after staging ("the golden action window") and before the shadow card turns.
export const DEFAULT_STOPS: readonly string[] = ["3.3", "shadow"];

export const DEFAULT_SETTINGS: TableSettings = { stopsOn: false, stops: DEFAULT_STOPS, alwaysUse: [], highContrast: false, guide: true, guideSeen: {}, animationSpeed: "normal", spotlight: true, uiScale: "medium", haptics: true, reduceMotion: "system", keepAwake: true, theme: "dark", cardQuality: "high", fogDrift: true };

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
    highContrast: flag(value.highContrast, false),
    guide: flag(value.guide, true),
    guideSeen: seen,
    animationSpeed: SPEEDS.find((speed) => speed === value.animationSpeed) ?? DEFAULT_SETTINGS.animationSpeed,
    spotlight: flag(value.spotlight, true),
    uiScale: UI_SCALE_OPTIONS.find((option) => option === value.uiScale) ?? DEFAULT_SETTINGS.uiScale,
    haptics: flag(value.haptics, DEFAULT_SETTINGS.haptics),
    reduceMotion: REDUCE_MOTION_OPTIONS.find((option) => option === value.reduceMotion) ?? DEFAULT_SETTINGS.reduceMotion,
    keepAwake: flag(value.keepAwake, DEFAULT_SETTINGS.keepAwake),
    theme: THEME_OPTIONS.find((option) => option === value.theme) ?? DEFAULT_SETTINGS.theme,
    cardQuality: CARD_QUALITY_OPTIONS.find((option) => option === value.cardQuality) ?? DEFAULT_SETTINGS.cardQuality,
    fogDrift: flag(value.fogDrift, DEFAULT_SETTINGS.fogDrift),
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
