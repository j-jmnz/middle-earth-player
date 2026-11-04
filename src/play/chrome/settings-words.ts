// The words and lists the Settings screen (src/screens/settings/view.tsx) and the table's settings panel (reading-panels.tsx) share,
// so the two say the same thing (user request, 2026-10-28). Pure, so a test reads them.
import type { CardQualityOption, ReduceMotionOption, ThemeOption, UiScaleOption } from "../../ui/table-settings.ts";
import type { Speed } from "../../ui/motion-tokens.ts";

// The themes go by Middle-earth names: Ringwraith is the dark theme, Rivendell the light. A screen reader hears which is which (THEME_LABELS).
export const THEME_WORDS: Readonly<Record<ThemeOption, string>> = { dark: "Ringwraith", light: "Rivendell", system: "System" };
export const THEME_LABELS: Readonly<Record<ThemeOption, string>> = { dark: "Ringwraith, dark", light: "Rivendell, light", system: "System" };
export const REDUCE_MOTION_WORDS: Readonly<Record<ReduceMotionOption, string>> = { system: "Follow system", always: "Always" };
export const SPEED_WORDS: Readonly<Record<Speed, string>> = { normal: "Normal", quick: "Quick" };
export const SCALE_WORDS: Readonly<Record<UiScaleOption, string>> = { small: "Small", medium: "Medium", large: "Large" };
export const QUALITY_WORDS: Readonly<Record<CardQualityOption, string>> = { high: "High", low: "Low" };

// Each row's detail states what the setting changes. The settings that exist to lighten the load on the device sit in the Performance
// group (setting-rows.tsx); Reduce motion and Keep screen awake, which also affect it, say so in their detail.
export const THEME_LINE = "Ringwraith is dark, Rivendell is light. System follows the device's setting.";
export const SCALE_LINE = "Size of text, buttons and cards, the table included.";
export const CONTRAST_LINE = "Thicker outlines on effect marks and token counts.";
export const PERFORMANCE_LINE = "Lower these if the table stutters or the device runs hot. Gameplay is unchanged.";
export const QUALITY_LINE = "Low draws table cards at a lower resolution and uses less memory. Previews stay sharp.";
export const FOG_LINE = "Animated fog behind every screen. Off saves battery.";
// What the Moving fog row says when the fog is already still (the switch still saves its value).
export const FOG_LIGHT_LINE = "No effect: Rivendell has no fog.";
export const FOG_REDUCED_LINE = "No effect: Reduce motion already stops the fog.";
export const SPEED_LINE = "Quick shortens animations and skips the phase title.";
export const REDUCE_MOTION_LINE = "Always turns off most animation, the fog and the combat replay, which lowers the load on the device. Follow system uses the device's setting.";
export const SPOTLIGHT_LINE = "A replay of each attack that deals or blocks damage. Tap to skip.";
export const HAPTICS_LINE = "Vibration at key moments.";
export const GUIDE_LINE = "A hint under the step title, the first two times each step comes up.";
export const STOPS_LINE = "Pauses where a card can be played. Choose the steps on the table's rail.";
export const AWAKE_LINE = "Keeps the screen on during a game. Uses more battery.";
export const NONE_YET = "None yet";
// The Responses row's detail, empty and not.
export const ALWAYS_EMPTY_LINE = "Free Responses set to Always use. The game plays them without asking.";
export const ALWAYS_LINE = "Played without asking. Tap one to be asked again.";

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
