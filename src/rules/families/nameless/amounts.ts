// Rules: rr.attachment-cards (data/rules/entries.json); ledger lines 04125:A:2, 04126:A:2, 901704:A:2, 901705:A:2.
import type { Amount } from "../../../catalog/boundary.ts";

import type { AmountScope } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { attachedCost, namelessCards } from "./attach.ts";

/** The amount `namelessCost`: the printed cost of the cards attached to the source, or the number the amount names when none is attached. Null for any other amount. */
export function namelessAmount(state: ScenarioState, amount: Exclude<Amount, number>, scope: AmountScope, ctx: ReduceContext): number | null {
  if (amount.namelessCost === undefined) return null;
  const source = scope.sourceId;
  if (!source || namelessCards(state, source).length === 0) return amount.namelessCost;
  return attachedCost(state, source, ctx.cards);
}
