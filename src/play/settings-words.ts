// The words and lists the Settings screen (src/screens/settings-view.tsx) and the table's settings panel (reading-panels.tsx) share,
// so the two say the same thing (user request, 2026-10-28). Pure, so a test reads them.
import type { CardQualityOption, ReduceMotionOption, ThemeOption, UiScaleOption } from "./table-settings.ts";
import type { Speed } from "./motion-tokens.ts";

export const THEME_WORDS: Readonly<Record<ThemeOption, string>> = { dark: "Dark", light: "Light", system: "System" };
export const REDUCE_MOTION_WORDS: Readonly<Record<ReduceMotionOption, string>> = { system: "Follow system", always: "Always" };
export const SPEED_WORDS: Readonly<Record<Speed, string>> = { normal: "Normal", quick: "Quick" };
export const SCALE_WORDS: Readonly<Record<UiScaleOption, string>> = { small: "Small", medium: "Medium", large: "Large" };
export const QUALITY_WORDS: Readonly<Record<CardQualityOption, string>> = { high: "High", low: "Low" };

// Each row's detail says what the setting changes, in the player's words. A row that eases a slow phone or the battery says so in its
// detail and sits in the Performance group (setting-rows.tsx), so a player looking for a smoother table finds every such switch in one place.
export const THEME_LINE = "Dark or Light colours. System follows your phone.";
export const SCALE_LINE = "Makes text, buttons and cards bigger or smaller, the table included.";
export const CONTRAST_LINE = "Heavier outlines on effect marks and token counts, easier to read.";
export const PERFORMANCE_LINE = "For a phone that stutters, runs hot or drains fast. They change the look a little, never the game.";
export const QUALITY_LINE = "Low draws the cards on the table a little softer and uses less memory. Card close-ups stay sharp.";
export const FOG_LINE = "The fog behind every screen drifts slowly. Off holds it still and saves battery.";
// What the Moving fog row says when the fog is already still (the switch still saves its value).
export const FOG_LIGHT_LINE = "The Light theme has no fog, so this does nothing now.";
export const FOG_REDUCED_LINE = "Reduce motion already holds the fog still.";
export const SPEED_LINE = "Quick shortens every animation and skips the phase title.";
export const REDUCE_MOTION_LINE = "Always turns off most animation, the drifting fog and the combat replay, which also eases a slow phone. Follow system uses your phone's setting.";
export const SPOTLIGHT_LINE = "A large replay of each attack that deals or blocks damage. Tap to skip it.";
export const HAPTICS_LINE = "The phone vibrates gently at key moments of the game.";
export const GUIDE_LINE = "A short hint under the step title at the foot of the table, the first two times each step comes up.";
export const STOPS_LINE = "The game pauses where you could play a card. Choose the steps on the table's rail.";
export const AWAKE_LINE = "The screen stays on while a game is open. Uses more battery.";
export const NONE_YET = "None yet";
// The Responses list's detail: what lands in it, and how to take one out.
export const ALWAYS_EMPTY_LINE = "Free Responses you set to Always use are listed here, so the game plays them without asking.";
export const ALWAYS_LINE = "The game plays these without asking. Tap one to have it ask again.";

export const CREDITS =
  "Card data comes from RingsDB, Hall of Beorn and DragnCards. The type is Marcellus SC and Barlow Semi Condensed, under the SIL Open Font License. This is a fan-made, unofficial app, not made, endorsed or sponsored by Fantasy Flight Games or Asmodee.";

/** The Moving fog row's detail: why the fog is already still (the Light theme has none, Reduce motion holds it), else what the switch does. */
export function fogLine(light: boolean, reduced: boolean): string {
  if (light) return FOG_LIGHT_LINE;
  return reduced ? FOG_REDUCED_LINE : FOG_LINE;
}

export type AlwaysRow = { effectId: string; label: string };

/**
 * The Responses set to Always, one row each by its card's name (the id when the card is unknown), in the order they were chosen.
 * `name` finds a card's name by code; `prefix` begins each label ("Ask again: " on the table's panel).
 */
export function alwaysRows(alwaysUse: readonly string[], effects: readonly { id: string; cardCode: string }[], name: (code: string) => string | undefined, prefix = ""): AlwaysRow[] {
  return alwaysUse.map((effectId) => {
    const code = effects.find((effect) => effect.id === effectId)?.cardCode;
    return { effectId, label: `${prefix}${(code ? name(code) : undefined) ?? effectId}` };
  });
}

/** The card codes whose names the Responses list needs. */
export function alwaysCodes(alwaysUse: readonly string[], effects: readonly { id: string; cardCode: string }[]): string[] {
  const codes = new Set<string>();
  for (const effectId of alwaysUse) {
    const code = effects.find((effect) => effect.id === effectId)?.cardCode;
    if (code) codes.add(code);
  }
  return [...codes];
}
