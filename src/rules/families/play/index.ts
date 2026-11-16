import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { changeControl, doomed, switchActor, takeFirstPlayer } from "./control.ts";
import { placeTokens, putFromHand, putIntoPlay } from "./enter.ts";
import { attachFacedown, discardSameTitle, returnAttachments, spendFrom, takeIntoHand } from "./leave.ts";

// The verbs src/catalog/families/play.ts adds, for putting cards into play, leaving play, delayed returns, control changes and card type changes. Null when the verb is not one of them.
// The constants (ControlledBy, DiscardWhen) are kept by the settle sweep (families/play/sweep.ts): they do nothing when run.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PutIntoPlay":
      return putIntoPlay(state, instruction, focus, ctx, steps);
    case "PutIntoPlayFromHand":
      return putFromHand(state, instruction, focus, ctx, steps);
    case "ChangeControl":
      return changeControl(state, instruction, focus, steps);
    case "TakeFirstPlayer":
      return takeFirstPlayer(state, focus.seat);
    case "Doomed":
      return doomed(state, instruction.amount, steps);
    case "TakeIntoHand":
      return takeIntoHand(state, instruction, focus);
    case "ReturnAttachments":
      return returnAttachments(state);
    case "AttachFacedown":
      return attachFacedown(state, instruction, focus);
    case "SwitchActor":
      return switchActor(state);
    case "PlaceDamage":
      return placeTokens(state, instruction, focus, steps, ctx);
    case "SpendFrom":
      return spendFrom(state, instruction, focus, ctx);
    case "DiscardSameTitle":
      return discardSameTitle(state, focus, ctx);
    case "ControlledBy":
    case "DiscardWhen":
      return state;
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "play", verbs: ["PutIntoPlay", "PutIntoPlayFromHand", "ChangeControl", "TakeFirstPlayer", "Doomed", "TakeIntoHand", "ReturnAttachments", "AttachFacedown", "SwitchActor", "PlaceDamage", "SpendFrom", "DiscardSameTitle", "ControlledBy", "DiscardWhen"], run };
