// Rules: rr.attachment-cards, rr.guarded, rr.blank, rr.step-6-8 (data/rules/entries.json).
import type { Instruction } from "../../catalog/boundary.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";
import type { Focus } from "./index.ts";
import { attachSourceTo, guardWith, putAttachmentIntoPlay } from "./attachments-play.ts";
import { answerQuestProgress } from "./attachments-quest.ts";
import { declareAttack, healAmong, lookAtEncounterCards } from "./attachments-verbs.ts";

// The verbs src/catalog/families/attachments.ts adds, for attachments on enemies, locations, quests and threat dials: Traps, Guarded, played unattached. Null when the verb is not one of them.
// PlayInto and Guarded are constants the engine reads when the card is played (attachments-play.ts): run alone they do nothing.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PlayInto":
    case "Guarded":
      return state;
    case "AttachSourceTo":
      return attachSourceTo(state, instruction, focus, ctx);
    case "GuardWith":
      return guardWith(state, instruction, focus, ctx, steps);
    case "PutAttachmentIntoPlay":
      return putAttachmentIntoPlay(state, instruction, focus, ctx, steps);
    case "HealAmong":
      return healAmong(state, instruction, focus, ctx);
    case "LookAtEncounterCards":
      return lookAtEncounterCards(state, instruction, focus, ctx);
    case "DeclareAttack":
      return declareAttack(state, instruction, focus, ctx, steps);
    case "QuestProgressFirst":
      return answerQuestProgress(state, instruction.first, focus.sourceId);
    default:
      return null;
  }
}
