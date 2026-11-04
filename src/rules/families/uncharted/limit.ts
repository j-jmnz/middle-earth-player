// Rules: dcce.uncharted (data/rules/entries.json); ledger line 11181:A:3. The damage limit of a card: no more than this much damage is placed on it at a time.
import type { ScenarioState } from "../../core/state.ts";
import { modifierActive } from "../../core/state.ts";

/** The damage placed on a card that holds a `damageLimit` ("When 3 or more damage would be placed on Revenant, place 2 damage instead", 11181:A:3): the amount, or the smallest limit
 * the card holds. A card with none takes the amount. */
export function placedLimit(state: ScenarioState, id: string, amount: number): number {
  let limit = amount;
  for (const modifier of state.modifiers) if (modifier.stat === "damageLimit" && modifier.instanceId === id && modifier.amount > 0 && modifierActive(state, modifier)) limit = Math.min(limit, modifier.amount);
  return limit;
}
