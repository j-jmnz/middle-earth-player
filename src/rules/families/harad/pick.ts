// Rules: mec112.setup-journey-to-the-cross-roads, rr.first-player (data/rules/entries.json); ledger lines 144036:A:2, 144038:A:2. The Pick filters `lowestAttack` and `lowestThreat`: of the cards that matched, only those with the lowest value as the table shows it.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";

/** Of the cards that matched, those with the lowest Attack or Threat as the table shows it; every one when tied, and then the chooser (the revealing player) decides. */
export function lowestOf(state: ScenarioState, found: readonly string[], stat: "attack" | "threat", ctx: ReduceContext): string[] {
  const values = found.map((id) => {
    const card = state.cards[id];
    return card ? modifiedStat(state, card, stat, ctx.cards) : Number.MAX_SAFE_INTEGER;
  });
  const lowest = Math.min(...values);
  return found.filter((_id, at) => values[at] === lowest);
}
