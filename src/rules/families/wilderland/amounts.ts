// Rules: (data/rules/entries.json) none; ledger lines 18023:A:1, 18049:A:2, 18050:A:1. The amounts the wilderland family adds (effect-schema-amount.ts).
import type { Amount } from "../../../catalog/boundary.ts";

import type { AmountScope } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { countMatching } from "../../interpret/pick.ts";
import { printedOf } from "../../core/printed.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";
import { cardsUnder } from "../../core/zones.ts";

const printedCost = (state: ScenarioState, id: string | undefined, ctx: ReduceContext): number => {
  return id ? (printedOf(ctx.cards, state.cards[id]?.code ?? "").cost ?? 0) : 0;
};

/** `mostPerPlayer`: the most cards matching the pick that any one player controls, counted from each player's own side ("the player with the most characters"). `guardedCost`: the printed cost of the card the source guards (under it, or the player card it guards). `excessOf`: the damage on the subject beyond its printed hit points. Null for any other amount. */
export function wilderlandAmount(state: ScenarioState, amount: Exclude<Amount, number>, scope: AmountScope, ctx: ReduceContext): number | null {
  if (amount.guardedCost) {
    const source = scope.sourceId ? state.cards[scope.sourceId] : undefined;
    if (!source) return 0;
    const guarded = [...cardsUnder(state, source.id), ...(source.guard && source.host ? [source.host] : [])];
    return guarded.reduce((sum, id) => sum + printedCost(state, id, ctx), 0);
  }
  if (amount.excessOf) {
    const subject = scope.subject ? state.cards[scope.subject] : undefined;
    const health = subject ? printedOf(ctx.cards, subject.code).health : null;
    return subject && health != null ? Math.max(0, subject.damage - health) : 0;
  }
  const pick = amount.mostPerPlayer;
  if (pick == null) return null;
  return Math.max(0, ...livingSeats(state).map((seat) => countMatching(state, pick, seat, scope.sourceId, ctx)));
}
