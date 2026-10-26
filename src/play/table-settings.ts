// The table's settings (docs/plans/table-experience.md): where the table stops to ask in a step's action window, the free
// Responses the player always uses, the readability options and the first-game guide. App-wide, kept in user.db by the
// screens (src/screens/settings-store.ts); a vanilla Zustand store here so src/play reads them without importing screens.
// A setting is the player's own standing answer, chosen on purpose: that is the confirmation an auto-pass or an auto-use
// stands on (brief, Screens, Table: no single tap sends an intent).
import { createStore } from "zustand/vanilla";

/** The step action windows the table can pass for the player, in round order (rail.ts names each). */
export const STOP_POINTS = ["resourceActions", "3.3", "3.4", "4.2", "5.2", "5.3", "6.2", "defense", "shadow", "damage", "end", "strike", "7.4"] as const;
export type StopPoint = (typeof STOP_POINTS)[number];

export type TableSettings = {
  // While on, a step window that is not a stop is passed for the player, unless a card usable there is new since the last stop.
  stopsOn: boolean;
  stops: readonly string[];
  // Effect ids of Responses with no cost and no choice that the player always uses (Sam Gamgee's ready, Pippin's draw).
  alwaysUse: readonly string[];
  // Larger cards: five across, the hand overlapping more.
  largeCards: boolean;
  // Effect pills and token counts drawn with stronger outlines.
  highContrast: boolean;
  // The first-game guide: a line under the dock's title the first two times each step comes up.
  guide: boolean;
  // How many times the guide has explained each step.
  guideSeen: Readonly<Record<string, number>>;
};

// The stops the video uses: after staging ("the golden action window") and before the shadow card turns.
export const DEFAULT_STOPS: readonly string[] = ["3.3", "shadow"];

export const DEFAULT_SETTINGS: TableSettings = { stopsOn: false, stops: DEFAULT_STOPS, alwaysUse: [], largeCards: false, highContrast: false, guide: true, guideSeen: {} };

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
    largeCards: flag(value.largeCards, false),
    highContrast: flag(value.highContrast, false),
    guide: flag(value.guide, true),
    guideSeen: seen,
  };
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
