// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play, mec108.objective-allies, mec108.campaign-setup-intruders-in-chetwood, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 09024:A:1, 09024:A:2, 09024:A:3, 09049:A:2, 09051:A:1, 10156:A:2, 10158:A:1.
// The vocabulary Angmar Awakened adds (src/catalog/families/angmar.ts): Time X, the card held under a side quest, the current quest among the quest cards in play and the campaign card's Setup of Intruders in Chetwood. Its side quests read the shared reads of
// families/wilderland/night-quest.ts (the current quest, the progress placed on it, a defeated side quest).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { chooseBoon } from "./boons.ts";
import { attachRandomBurden, attachSelfToNamed, moveToHero } from "./burdens.ts";
import { placeHandUnderSelf } from "./cards-under.ts";
import { determinedMatches } from "./determined.ts";
import { flipTimeObjective, timeOfDayHolds } from "./day-night.ts";
import { placeLoggedDamageOn } from "./logged.ts";
import { endPhase } from "./phase.ts";
import { travelUnpayable } from "./travel.ts";
import { noteFirstTrait } from "./weather.ts";
import { discardHeld, holdUnder } from "./hold.ts";
import { chooseCurrentQuest, currentQuestHolds, hitPointsLeftHolds, questCardsAmount, questLeadsHolds } from "./quest.ts";
import { removeTimeCounters, timeOnReveal } from "./time.ts";
import { attachNewTo, tradeDamageForResources } from "./trade.ts";

// The verbs src/catalog/families/angmar.ts adds. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "Time":
      return state;
    case "RemoveTimeCounters":
      return removeTimeCounters(state, ctx);
    case "HoldUnder":
      return holdUnder(state, instruction, focus);
    case "DiscardHeld":
      return discardHeld(state, focus, ctx, steps);
    case "PlaceHandUnderSelf":
      return placeHandUnderSelf(state, focus, ctx);
    case "ChooseCurrentQuest":
      return chooseCurrentQuest(state, instruction, focus, ctx, steps);
    case "AttachNewTo":
      return attachNewTo(state, instruction, ctx);
    case "TradeDamageForResources":
      return tradeDamageForResources(state, instruction, focus, steps);
    // A marker the reveal hook reads (weather.ts).
    case "FirstTraitSurge":
      return state;
    case "EndPhase":
      return endPhase(state, focus);
    case "PlaceLoggedDamageOn":
      return placeLoggedDamageOn(state, instruction);
    case "ChooseBoon":
      return chooseBoon(state, instruction, focus, ctx, steps);
    case "AttachRandomBurden":
      return attachRandomBurden(state, instruction, focus, ctx);
    case "MoveToHero":
      return moveToHero(state, instruction, focus, ctx, steps);
    case "AttachSelfToNamed":
      return attachSelfToNamed(state, instruction, focus, ctx);
    case "FlipTimeObjective":
      return flipTimeObjective(state, instruction);
    case "RecordStartingThreat":
      return { ...state, resolutionLog: { ...state.resolutionLog, startingThreat: (state.resolutionLog.startingThreat ?? 0) + instruction.amount } };
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "angmar",
  verbs: ["Time", "RemoveTimeCounters", "HoldUnder", "DiscardHeld", "PlaceHandUnderSelf", "ChooseCurrentQuest", "AttachNewTo", "TradeDamageForResources", "FirstTraitSurge", "EndPhase", "PlaceLoggedDamageOn", "ChooseBoon", "AttachRandomBurden", "MoveToHero", "AttachSelfToNamed", "FlipTimeObjective", "RecordStartingThreat"],
  run,
  revealed: (state, id, ctx) => noteFirstTrait(timeOnReveal(state, id, ctx), id, ctx),
  travel: { unpayable: travelUnpayable },
  pick: (state, id, spec) => determinedMatches(state, id, spec),
  condition: (state, condition, scope, ctx) => timeOfDayHolds(state, condition) ?? currentQuestHolds(state, condition, scope, ctx) ?? questLeadsHolds(state, condition, ctx) ?? hitPointsLeftHolds(state, condition, ctx),
  amount: (state, found, scope, ctx) => questCardsAmount(state, found, scope.actor, ctx),
};
