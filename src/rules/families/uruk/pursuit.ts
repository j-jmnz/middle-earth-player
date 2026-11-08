// Rules: mec112.pursuit, mec112.setup-the-uruk-hai (data/rules/entries.json); ledger lines 143069:A:1, 143069:B:1, 143022:A:2, 143070:B:2.
//
// The pursuit value: the pursuit tracker beside the quest deck (ScenarioState.pursuit). The quest card's Setup sets it to 10; locations, treacheries and shadow cards raise it, an enemy's defeat lowers it, and the quest stages' quest points
// are X, the pursuit value. At 30 or more at the end of the refresh phase the players lose (To Isengard!, 143022:A:2).
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";

/** The verbs of the pursuit value (src/catalog/families/uruk.ts): null when the verb is not one of them. */
export function runPursuit(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext): ScenarioState | null {
  switch (instruction.verb) {
    case "SetPursuit":
      return { ...state, pursuit: instruction.value };
    case "RaisePursuit":
      return { ...state, pursuit: (state.pursuit ?? 0) + resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx) };
    case "LowerPursuit":
      return { ...state, pursuit: Math.max(0, (state.pursuit ?? 0) - resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx)) };
    default:
      return null;
  }
}
