// Rules: rr.engagement-check, rr.optional-engagement (data/rules/entries.json); ledger line 10020:A:2. "While a player is making an engagement check against Hunting Pack, it gets -1 engagement cost for each damaged character that player controls": the enemy holds the
// flag `checkCostPerDamaged` (the amount for each), and the cost it checks against a seat is read with the damaged characters that seat controls (families/costs/stats.ts checkCost). Optional engagement does not read it.
import { characters } from "../../combat/combat.ts";
import type { PrintedCard } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { modifierActive } from "../../core/state.ts";

/** What the enemy's engagement cost changes by while the seat's check reads it: the flag's amount for each damaged character (hero or ally) the seat controls. */
export function checkCostPerDamaged(state: ScenarioState, enemy: CardInstance, seat: number, cards: ReadonlyMap<string, PrintedCard>): number {
  let per = 0;
  for (const modifier of state.modifiers) if (modifier.stat === "checkCostPerDamaged" && modifier.instanceId === enemy.id && modifierActive(state, modifier)) per += modifier.amount;
  if (per === 0) return 0;
  return per * characters(state, seat, cards).filter((id) => (state.cards[id]?.damage ?? 0) > 0).length;
}
