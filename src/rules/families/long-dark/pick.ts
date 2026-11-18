// Rules: rr.first-player, rr.staging-area (data/rules/entries.json); ledger line 04095:A:1. The long-dark family's pick filter.
import { modifiedStat } from "../../core/keywords.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { tiedExtreme } from "../../interpret/tied-extreme.ts";
import type { ScenarioState } from "../../core/state.ts";
import { questPointsOf } from "../../quest/quest.ts";

/** Of the cards that matched, those with the highest current Threat plus remaining quest points (the quest points as they stand, less the progress on the card; a card with no quest points adds none); every one when tied, and then the chooser decides (04095:A:1). */
export function highestThreatPlusRemaining(state: ScenarioState, found: readonly string[], ctx: ReduceContext): string[] {
  return tiedExtreme(found, (id) => {
    const card = state.cards[id];
    if (!card) return 0;
    const points = questPointsOf(state, card, ctx.cards);
    return modifiedStat(state, card, "threat", ctx.cards) + (points == null ? 0 : Math.max(0, points - card.progress));
  }, "highest");
}
