// Rules: mec109.stage-4, rr.active-location, rr.engaged, rr.in-player-order (data/rules/entries.json).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { captureRingBearer, releaseRingBearer } from "./captive.ts";
import { assignDamage, discardEach, noneDiscarded } from "./damage.ts";
import { assignFaceup } from "./faceup.ts";
import { attachToActiveLocation, makeSetAsideActive, pickHighestEngagement, revealUntilThreat } from "./reveal.ts";
import { attackFromStaging, markLocationDamage } from "./watcher.ts";
import { damageLoss } from "./locations.ts";

// The verbs src/catalog/families/south.ts adds, for The Ring Goes South: the second active location, the facedown Ring-bearer, the
// enemy engaged with every player and the Council of Elrond's faceup cards. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "MakeSetAsideActive":
      return makeSetAsideActive(state, instruction, focus, ctx, steps);
    case "DiscardEach":
      return discardEach(state, instruction, focus, ctx);
    case "AssignDamage":
      return assignDamage(state, instruction, focus, ctx, steps);
    case "RevealUntilThreat":
      return revealUntilThreat(state, instruction, focus, ctx, steps);
    case "AssignFaceup":
      return assignFaceup(state, instruction, focus, ctx, steps);
    case "CaptureRingBearer":
      return captureRingBearer(state, instruction, ctx);
    case "ReleaseRingBearer":
      return releaseRingBearer(state, instruction, focus, ctx);
    case "DamageActiveLocation":
      return markLocationDamage(state);
    case "AttackFromStaging":
      return attackFromStaging(state, instruction, focus, ctx, steps);
    case "PickHighestEngagement":
      return pickHighestEngagement(state, instruction, focus, ctx, steps);
    case "AttachToActiveLocation":
      return attachToActiveLocation(state, focus, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "south", settle: { before: (state, ctx) => damageLoss(state, ctx.cards) }, condition: (state, condition) => noneDiscarded(state, condition), verbs: ["MakeSetAsideActive", "DiscardEach", "AssignDamage", "RevealUntilThreat", "AssignFaceup", "CaptureRingBearer", "ReleaseRingBearer", "DamageActiveLocation", "AttackFromStaging", "PickHighestEngagement", "AttachToActiveLocation"], run };
