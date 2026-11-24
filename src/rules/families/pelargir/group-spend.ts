// Rules: rr.travel, rr.cost, rr.resources (data/rules/entries.json); ledger line 06051:A:2.
// Garden of Poisons: "Travel: Each player must pay 1 resource to travel here." Every living player, the first player first, spends the amount from his own heroes' pools (SpendResources for his seat: he chooses the hero for each resource when more than one can pay).
// The players cannot travel here while any one of them cannot pay it (rr.travel), which `ForEachPlayer [SpendResources]` leaves unchecked (rules/interpret/restrictions.ts reads only the first player's pools), so the cost has a verb of its own and the family's travel hook says
// when it is unpayable. A pool locked by `cannotSpendResources` pays nothing.
import type { Instruction } from "../../../catalog/boundary.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { spendablePools } from "../costs/verbs.ts";

type Verb = Extract<Instruction, { verb: "EachPlayerSpends" }>;

/** EachPlayerSpends: a SpendResources step for each living player, first player first, queued ahead of the rest of the effect (the same expansion ForEachPlayer makes). */
export function eachPlayerSpends(state: ScenarioState, instruction: Verb): ScenarioState {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect") return state;
  const spends: Instruction = { verb: "SpendResources", amount: instruction.amount };
  const expanded = livingSeats(state).map((seat) => ({ instruction: spends, seat, chosen: null }));
  return patchTop(state, { data: { ...data, queue: [...expanded, ...data.queue] } });
}

/** Whether a Travel cost of this verb cannot be paid now: some living player's own pools hold fewer resources than the amount (the amount is read for the first player, who travels). */
export function eachPlayerSpendsUnpayable(state: ScenarioState, instruction: Instruction, ctx: ReduceContext, locationId: string): boolean {
  if (instruction.verb !== "EachPlayerSpends") return false;
  const amount = resolveAmount(state, instruction.amount, frameScope(state, state.firstPlayer, locationId), ctx);
  return livingSeats(state).some((seat) => spendablePools(state, seat, {}, ctx).total < amount);
}
