// Test helper. The option of the open choice that the keys name (an option id, or the code of the card the option is), the first option when none matches.
import type { ScenarioState } from "../../src/rules/core/state.ts";

export const pick = (...keys: string[]) => (state: ScenarioState): string => {
  const options = state.window?.kind === "choose" ? state.window.options : [];
  for (const key of keys) {
    const hit = options.find((option) => option === key || state.cards[option]?.code === key);
    if (hit !== undefined) return hit;
  }
  return options[0] ?? "";
};
