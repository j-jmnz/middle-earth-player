// Rules: rr.resources, rr.cost, rr.then (data/rules/entries.json); ledger lines 132048:A:2, 132045:A:2. The conditions and the one spending verb the Lonely Mountain's cards add to the core's: Baggins resources, the top card of the encounter deck.
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { frameScope, resolveAmount, type AmountScope } from "../../interpret/amounts.ts";
import type { Scope } from "../../interpret/conditions.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { spendablePools } from "../costs/verbs.ts";
import { noteSpent } from "../costs/pay.ts";
import type { Focus } from "../index.ts";

const read = (scope: Scope): AmountScope => ({ actor: scope.actor, sourceId: scope.sourceId, ...(scope.picked ? { picked: scope.picked } : {}), ...(scope.subject ? { subject: scope.subject } : {}), ...(scope.other ? { other: scope.other } : {}), ...(scope.x != null ? { x: scope.x } : {}) });

/** `bagginsAtLeast` and `encounterTop`, or null for any other condition. */
export function bagginsCondition(state: ScenarioState, condition: Condition, scope: Scope, ctx: ReduceContext): boolean | null {
  switch (condition.kind) {
    case "bagginsAtLeast":
      return spendablePools(state, scope.actor, { sphere: "baggins" }, ctx).total >= resolveAmount(state, condition.amount, read(scope), ctx);
    case "encounterTop": {
      const top = state.encounterDeck[0];
      const card = top ? state.cards[top] : undefined;
      return card != null && printedOf(ctx.cards, card.code).type === condition.cardType;
    }
    default:
      return null;
  }
}

/** SpendBaggins: the actor spends the amount from the pools of the heroes he controls with a Baggins icon, the pool with the most first; with fewer than that nothing is spent. Announced as spent, so what hears a hero's spending hears it. */
export function spendBaggins(state: ScenarioState, instruction: Extract<Instruction, { verb: "SpendBaggins" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  const { pools, total } = spendablePools(state, focus.seat, { sphere: "baggins" }, ctx);
  if (amount <= 0 || total < amount) return state;
  let next = state;
  let left = amount;
  const payments: { heroId: string; amount: number }[] = [];
  for (const id of [...pools].sort((a, b) => (state.cards[b]?.resources ?? 0) - (state.cards[a]?.resources ?? 0))) {
    const take = Math.min(left, state.cards[id]?.resources ?? 0);
    if (take <= 0) continue;
    next = updateCard(next, id, { resources: (state.cards[id]?.resources ?? 0) - take });
    payments.push({ heroId: id, amount: take });
    left -= take;
  }
  return noteSpent(next, payments, ctx);
}
