// Rules: hon.archery, rr.keywords (data/rules/entries.json); ledger line 06052:A:2.
// Glade of Cleansing: "X is equal to the total archery value of the highest archery Wose enemy in play." The amount `archeryOf` (with `max`) is the total archery of the card among those the pick finds that has the most: its printed Archery and what effects gave it (Glade of Cleansing's
// own +1 for each Wose included) plus what it gives itself (`archeryBonus`, `archeryPlayers`), as the archery total counts it (combat.ts cardArchery). 0 when no card matches.
import type { AmountExpr } from "../../../catalog/boundary.ts";
import { cardArchery } from "../../combat/combat.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { AmountScope } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";

/** The amount's value, or null when it is not `archeryOf`. */
export function archeryOfAmount(state: ScenarioState, amount: AmountExpr, scope: AmountScope, ctx: ReduceContext): number | null {
  if (!amount.archeryOf) return null;
  let best = 0;
  for (const id of pickCandidates(state, amount.archeryOf, scope.actor, [], scope.sourceId, ctx)) {
    const instance = state.cards[id];
    if (!instance) continue;
    const { keyword, own } = cardArchery(state, ctx.cards, instance);
    best = Math.max(best, keyword + own);
  }
  return best;
}
