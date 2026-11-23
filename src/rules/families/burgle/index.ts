// Rules: hob.burgle, hob.burgle-example (data/rules/entries.json); ledger lines 132039:A:2, 132042:A:3, 132043:A:2, 132071:A:1, 132072:B:1. The verbs src/catalog/families/burgle.ts adds: the burgle attempt (attempt.ts), the burgle effect markers, the treasures stacked under a card (stack.ts), the conditions (results.ts) and the Pick filter (pick.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { pushBurgle, takeRevealed } from "./attempt.ts";
import { burglePickMatches } from "./pick.ts";
import { burgleCondition } from "./results.ts";
import { stackUnder, takeStacked } from "./stack.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, _ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "BurgleAttempt":
      return pushBurgle(state, focus, steps);
    // A marker the attempt's step 3 reads from the card step 1 stopped at (match.ts burgleEffectOf).
    case "BurgleEffect":
      return state;
    case "BurgleTake":
      return takeRevealed(state);
    case "StackUnder":
      return stackUnder(state, instruction);
    case "TakeStacked":
      return takeStacked(state, instruction, focus);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "burgle",
  verbs: ["BurgleAttempt", "BurgleEffect", "BurgleTake", "StackUnder", "TakeStacked"],
  run,
  condition: (state, condition, scope, ctx) => burgleCondition(state, condition, scope, ctx),
  pick: (state, id, spec, at, ctx) => burglePickMatches(state, id, spec, at, ctx),
};
