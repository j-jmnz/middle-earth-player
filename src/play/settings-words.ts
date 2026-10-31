// The words and lists the Settings screen (src/screens/settings-view.tsx) and the table's settings panel (reading-panels.tsx) share,
// so the two say the same thing (user request, 2026-10-28). Pure, so a test reads them.
import type { CardQualityOption, ReduceMotionOption, ThemeOption, UiScaleOption } from "./table-settings.ts";
import type { Speed } from "./motion-tokens.ts";

export const THEME_WORDS: Readonly<Record<ThemeOption, string>> = { dark: "Dark", light: "Light", system: "System" };
export const REDUCE_MOTION_WORDS: Readonly<Record<ReduceMotionOption, string>> = { system: "Follow system", always: "Always" };
export const SPEED_WORDS: Readonly<Record<Speed, string>> = { normal: "Normal", quick: "Quick" };
export const SCALE_WORDS: Readonly<Record<UiScaleOption, string>> = { small: "Small", medium: "Medium", large: "Large" };
export const QUALITY_WORDS: Readonly<Record<CardQualityOption, string>> = { high: "High", low: "Low" };

export const SCALE_LINE = "Resizes the whole app, the table included.";
export const QUALITY_LINE = "Low draws the table's cards a little softer, easing a slow phone.";
export const FOG_LINE = "Off holds the fog still, easing a slow phone.";
// What the Moving fog row says when the fog is already still (the switch still saves its value).
export const FOG_LIGHT_LINE = "The Light theme has no fog.";
export const FOG_REDUCED_LINE = "Reduce motion already holds it still.";
// THEME_LINE and REDUCE_MOTION_LINE are spoken with their switches (setting-rows.tsx), not shown.
export const THEME_LINE = "System follows your phone.";
export const SPEED_LINE = "Quick shortens every motion and skips the phase title.";
export const REDUCE_MOTION_LINE = "Follow system uses your phone's setting. Always keeps motion off.";
export const SPOTLIGHT_LINE = "Big replay of attacks that deal or block damage. Tap skips.";
export const CONTRAST_LINE = "Effect marks and token counts drawn with heavier outlines.";
export const GUIDE_LINE = "A hint under the dock title, the first two times.";
export const HAPTICS_LINE = "A buzz on the table's key moments.";
export const STOPS_LINE = "Pause where a card can be played. Pick steps on the rail.";
export const AWAKE_LINE = "The screen does not sleep while a table is open.";
export const NONE_YET = "None yet";

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
