// Rules: (data/rules/entries.json) none; ledger lines 18023:A:1, 18049:A:2, 18050:A:1. The amounts the wilderland family adds (effect-schema-amount.ts).
import type { Amount } from "../../../catalog/boundary.ts";

import type { AmountScope } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { countMatching, matchesPick } from "../../interpret/pick.ts";
import { effectData } from "../encounter/moves.ts";
import { printedOf } from "../../core/printed.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";
import { cardsUnder } from "../../core/zones.ts";

const printedCost = (state: ScenarioState, id: string | undefined, ctx: ReduceContext): number => {
  return id ? (printedOf(ctx.cards, state.cards[id]?.code ?? "").cost ?? 0) : 0;
};

/** `mostPerPlayer`: the most cards matching the pick that any one player controls, counted from each player's own side ("the player with the most characters"). `guardedCost`: the printed cost of the card the source guards (under it, or the player card it guards). `excessOf`: the damage the destroyed character took beyond its remaining hit points when it was dealt (the event's amount). Null for any other amount. */
export function wilderlandAmount(state: ScenarioState, amount: Exclude<Amount, number>, scope: AmountScope, ctx: ReduceContext): number | null {
  if (amount.guardedCost) {
    const source = scope.sourceId ? state.cards[scope.sourceId] : undefined;
    if (!source) return 0;
    const guarded = [...cardsUnder(state, source.id), ...(source.guard && source.host ? [source.host] : [])];
    return guarded.reduce((sum, id) => sum + printedCost(state, id, ctx), 0);
  }
  // "For each enemy discarded this way": the cards DiscardEncounterTop discarded, still in the encounter discard pile, that match the pick.
  if (amount.discardedMatching) {
    const pick = amount.discardedMatching;
    return (effectData(state)?.looked ?? []).filter((id) => state.cards[id]?.zone === "encounterDiscard" && matchesPick(state, id, pick, { seat: scope.actor, sourceId: scope.sourceId, counting: true }, ctx)).length;
  }
  // The event's amount, the X of the frame: the combat damage beyond the character's remaining hit points (defense/excess.ts).
  if (amount.excessOf) return Math.max(0, scope.x ?? 0);
  const pick = amount.mostPerPlayer;
  if (pick == null) return null;
  return Math.max(0, ...livingSeats(state).map((seat) => countMatching(state, pick, seat, scope.sourceId, ctx)));
}
