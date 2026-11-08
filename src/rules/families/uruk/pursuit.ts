// Rules: mec112.pursuit, mec112.setup-the-uruk-hai (data/rules/entries.json); ledger lines 143069:A:1, 143069:B:1, 143022:A:2, 143070:B:2.
//
// The pursuit value: the pursuit tracker beside the quest deck (ScenarioState.pursuit). The quest card's Setup sets it to 10; locations, treacheries and shadow cards raise it, an enemy's defeat lowers it, and the quest stages' quest points
// are X, the pursuit value. At 30 or more at the end of the refresh phase the players lose (To Isengard!, 143022:A:2).
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";

// The pursuit value becomes `value`; a step tells the change (the log's line, the dial's badge), none when it did not move.
function setPursuitTo(state: ScenarioState, value: number, steps: EngineStep[]): ScenarioState {
  const change = value - (state.pursuit ?? 0);
  if (change !== 0) steps.push({ kind: "pursuit", amount: change, cause: currentCause(steps, UNATTRIBUTED) });
  return { ...state, pursuit: value };
}

/** The verbs of the pursuit value (src/catalog/families/uruk.ts): null when the verb is not one of them. */
export function runPursuit(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "SetPursuit":
      return setPursuitTo(state, instruction.value, steps);
    case "RaisePursuit":
      return setPursuitTo(state, (state.pursuit ?? 0) + resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx), steps);
    case "LowerPursuit":
      return setPursuitTo(state, Math.max(0, (state.pursuit ?? 0) - resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx)), steps);
    default:
      return null;
  }
}
