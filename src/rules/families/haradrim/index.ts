// Rules: rr.constant-ability, rr.triggered-ability, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 16014:A:2, 16016:A:1, 16045:A:2, 16066:B:1, 16067:B:1.
// The verbs, flags, triggers, conditions and amount src/catalog/families/haradrim.ts adds: the heat tracker (heat.ts), the stage that notes the round it came into play (stage.ts), the hand limit (hand.ts) and the card placed faceup under a location (under.ts).
// The flag `stageCapped` is read by putOnStage (src/rules/quest/quest.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { announceOverLimit } from "./hand.ts";
import { runHeat, temperatureAmount, temperatureCondition } from "./heat.ts";
import { haradrimCondition, noteStage } from "./stage.ts";
import { placeUnderFaceup } from "./under.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  return instruction.verb === "PlaceUnderSelfFaceup" ? placeUnderFaceup(state, focus, ctx, steps) : runHeat(state, instruction, focus, ctx);
}

export const manifest: RulesFamily = {
  name: "haradrim",
  verbs: ["PlaceUnderSelfFaceup", "SetTemperature", "RaiseTemperature", "LowerTemperature"],
  run,
  condition: (state, condition) => haradrimCondition(state, condition) ?? temperatureCondition(state, condition),
  amount: (state, found) => temperatureAmount(state, found),
  // The hook runs after the encounter deck is refilled: it notes the main quest card and announces a hand over the limit.
  settle: { after: (state, ctx, steps) => announceOverLimit(noteStage(state, gameReads(state, ctx, '"kind":"stageInPlayWholeRound"')), steps) },
};
