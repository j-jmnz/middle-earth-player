// Rules: mec108.time-x, rr.cannot, rr.engaged, rr.current-quest (data/rules/entries.json); ledger lines 07020:A:2, 07022:A:1, 07023:A:1, 07047:A:1.
// The verbs src/catalog/families/ring-maker.ts adds: time counters taken off the current quest (time.ts), a treachery that goes into a hand and stays there (hand.ts) and the enemy a discard puts into play engaged (engage.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { engageTopDiscarded } from "./engage.ts";
import { drawSelfIntoHand } from "./hand.ts";
import { removeTimeFromQuest } from "./time.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "RemoveTimeFromQuest":
      return removeTimeFromQuest(state, instruction, focus, ctx, steps);
    case "DrawSelfIntoHand":
      return drawSelfIntoHand(state, instruction, focus);
    case "EngageTopDiscarded":
      return engageTopDiscarded(state, instruction, focus, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "ring-maker", verbs: ["RemoveTimeFromQuest", "DrawSelfIntoHand", "EngageTopDiscarded"], run };
