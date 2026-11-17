// Rules: sotm.escape-test, sotm.escape-test-example (data/rules/entries.json); ledger lines 02107:A:2, 02114:A:1, 900807:A:1. The verbs src/catalog/families/escape.ts adds and the hooks the core calls: the escape test (test.ts, commit.ts, value.ts), its result conditions (results.ts) and the
// tokens placed on Gollum (gollum-tokens.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { shuffleFullCards } from "./gollum-tokens.ts";
import { escapeCondition } from "./results.ts";
import { pushEscape } from "./test.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "EscapeTest":
      return pushEscape(state, instruction, focus, ctx, steps);
    // A marker the dealt card's total reads.
    case "EscapeValue":
      return state;
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "escape",
  verbs: ["EscapeTest", "EscapeValue"],
  run,
  condition: (state, condition) => escapeCondition(state, condition),
  settle: { sweep: (state, ctx, steps) => shuffleFullCards(state, ctx, steps) },
};
