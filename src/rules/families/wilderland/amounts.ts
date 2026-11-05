// Rules: (data/rules/entries.json) none; ledger lines 18023:A:1. The amounts the wilderland family adds (effect-schema-amount.ts).
import type { Amount } from "../../../catalog/boundary.ts";

import type { AmountScope } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { countMatching } from "../../interpret/pick.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";

/** `mostPerPlayer`: the most cards matching the pick that any one player controls, counted from each player's own side ("the player with the most characters"); null for any other amount. */
export function wilderlandAmount(state: ScenarioState, amount: Exclude<Amount, number>, scope: AmountScope, ctx: ReduceContext): number | null {
  const pick = amount.mostPerPlayer;
  if (pick == null) return null;
  return Math.max(0, ...livingSeats(state).map((seat) => countMatching(state, pick, seat, scope.sourceId, ctx)));
}
