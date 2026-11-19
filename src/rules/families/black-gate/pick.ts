// Rules: mec113.saga-staging-rules, rr.first-player (data/rules/entries.json); ledger lines 146072:B:1, 146026:A:1. What the black-gate family's pick filters and amount read: the cards of the Embassy from the Dark Tower's faceup row that are not paired yet, the cards with the highest Threat, and the total of a stat over a pick.
import type { Amount, PickSpec } from "../../../catalog/boundary.ts";

import { modifiedStat } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { tiedExtreme } from "../../interpret/tied-extreme.ts";
import type { AmountScope } from "../../interpret/amounts.ts";
import type { ScenarioState } from "../../core/state.ts";

/** The cards an `embassy` filter starts from: the row's player cards (`player`) or encounter cards (`encounter`) not in a pair yet. Null when the filter is not the family's. */
export function embassyPool(state: ScenarioState, spec: PickSpec): string[] | null {
  if (!spec.embassy) return null;
  const embassy = state.embassy;
  if (!embassy) return [];
  const row = spec.embassy === "player" ? embassy.players : embassy.encounter;
  const taken = new Set(embassy.pairs.map((pair) => (spec.embassy === "player" ? pair.player : pair.encounter)));
  return row.filter((id) => !taken.has(id) && state.cards[id]?.zone === "setAside");
}

/** Of the cards that matched, those with the highest current Threat (a card with none counts 0); every one when tied, and then the chooser decides ("the highest threat encounter card remaining", 146072:B:1). */
export function highestThreatOf(state: ScenarioState, found: readonly string[], ctx: ReduceContext): string[] {
  return tiedExtreme(found, (id) => {
    const card = state.cards[id];
    return card ? modifiedStat(state, card, "threat", ctx.cards) : 0;
  }, "highest");
}

const STATS = new Set(["willpower", "attack", "defense", "threat", "hitPoints", "engagementCost", "questPoints"]);

/** The amount `totalOf` with `stat`: the stat of every card that matches the pick, as the table shows it now, added up ("the total Threat of each engaged enemy", 146026:A:1); with `cost` the printed costs (a card with none counts 0), which Washed Away!'s Nightmare discard says (901701:A:2). Null when the amount is not the family's. */
export function totalOfStat(state: ScenarioState, amount: Exclude<Amount, number>, scope: AmountScope, ctx: ReduceContext): number | null {
  if (!amount.totalOf || amount.stat == null || !(STATS.has(amount.stat) || amount.stat === "cost")) return null;
  if (amount.stat === "cost") return pickCandidates(state, amount.totalOf, scope.actor, [], scope.sourceId ?? null, ctx, undefined, undefined, true).reduce((total, id) => total + (printedOf(ctx.cards, state.cards[id]?.code ?? "").cost ?? 0), 0);
  const stat = amount.stat as "willpower" | "attack" | "defense" | "threat" | "hitPoints" | "engagementCost" | "questPoints";
  return pickCandidates(state, amount.totalOf, scope.actor, [], scope.sourceId ?? null, ctx, undefined, undefined, true).reduce((total, id) => {
    const card = state.cards[id];
    return total + (card ? modifiedStat(state, card, stat, ctx.cards) : 0);
  }, 0);
}
