// Rules: mec108.time-x, rr.cannot, rr.engaged, rr.current-quest (data/rules/entries.json); ledger lines 07020:A:2, 07022:A:1, 07023:A:1, 07047:A:1.
// The verbs src/catalog/families/ring-maker.ts adds: time counters taken off the current quest (time.ts), a treachery that goes into a hand and stays there (hand.ts) and the enemy a discard puts into play engaged (engage.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { engageCaptiveHolders, returnAttachedByName } from "./captor.ts";
import { engageTopDiscarded } from "./engage.ts";
import { buryDamaged, placeDestroyedUnder, placeRandomHandUnder } from "./orcs-search.ts";
import { triggerScour } from "./scour.ts";
import { announceThreatZero, attackNalir, eliminateAtLevel } from "./nalir.ts";
import { drawSelfIntoHand } from "./hand.ts";
import { createOutOfPlayDecks, discardEliminatedDecks, revealOutOfPlay, shuffleHandCardIntoOutOfPlay, shuffleIntoOutOfPlayDecks } from "./outofplay.ts";
import { capRefresh } from "./refresh-cap.ts";
import { revealChosenFromDiscard } from "./reveal-chosen.ts";
import { inOwnSurgeChain } from "./surge-chain.ts";
import { removeTimeFromQuest } from "./time.ts";
import { announceAlliesOverLimit, announceTrialKey, engageSeats } from "./trial-sweeps.ts";
import { addInPlayToVictory, addPickedToStaging, advanceToChosenStage, attachPickedToPrevious, pickSetAside, revealFromVictory, shufflePickedIntoBottom } from "./trials.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "RemoveTimeFromQuest":
      return removeTimeFromQuest(state, instruction, focus, ctx, steps);
    case "DrawSelfIntoHand":
      return drawSelfIntoHand(state, instruction, focus);
    case "EngageTopDiscarded":
      return engageTopDiscarded(state, instruction, focus, ctx, steps);
    case "CreateOutOfPlayDecks":
      return createOutOfPlayDecks(state, instruction);
    case "ShuffleIntoOutOfPlayDecks":
      return shuffleIntoOutOfPlayDecks(state, instruction);
    case "RevealOutOfPlay":
      return revealOutOfPlay(state, instruction, focus, ctx, steps);
    case "ReturnAttachedEnemy":
      return returnAttachedByName(state, instruction, ctx);
    case "ShuffleHandCardIntoOutOfPlay":
      return shuffleHandCardIntoOutOfPlay(state, focus);
    case "CapRefresh":
      return capRefresh(state, instruction, focus, ctx, steps);
    case "RevealChosenFromDiscard":
      return revealChosenFromDiscard(state, instruction, focus, ctx, steps);
    case "AdvanceToChosenStage":
      return advanceToChosenStage(state, instruction, focus, steps);
    case "PickSetAside":
      return pickSetAside(state, instruction, focus, ctx);
    case "AttachPickedToPrevious":
      return attachPickedToPrevious(state);
    case "AddPickedToStaging":
      return addPickedToStaging(state, focus, ctx, steps);
    case "ShufflePickedIntoBottom":
      return shufflePickedIntoBottom(state, instruction);
    case "RevealFromVictory":
      return revealFromVictory(state, instruction, focus, ctx, steps);
    case "AddInPlayToVictory":
      return addInPlayToVictory(state, instruction, ctx);
    case "NoteEncounterDiscards":
      return { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: focus.sourceId ?? "table", stat: "noteEncounterDiscards", amount: 1, until: "endOfGame" }] };
    case "AttackNalir":
      return attackNalir(state, ctx, steps, instruction.enemy);
    case "EliminateAtLevel":
      return eliminateAtLevel(state, steps);
    case "TriggerScour":
      return triggerScour(state, instruction, focus, ctx, steps);
    case "PlaceRandomHandUnder":
      return placeRandomHandUnder(state, instruction);
    case "PlaceDestroyedUnder":
      return placeDestroyedUnder(state, instruction, focus);
    case "ExcessToActiveLocation":
      return state.pendingAttack ? { ...state, pendingAttack: { ...state.pendingAttack, excessToActive: true } } : state;
    case "EngageCaptiveHolder":
    case "EngageSeat":
    case "BuryDamagedLocations":
      return state;
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "ring-maker", verbs: ["NoteEncounterDiscards", "RemoveTimeFromQuest", "DrawSelfIntoHand", "EngageTopDiscarded", "CreateOutOfPlayDecks", "ShuffleIntoOutOfPlayDecks", "RevealOutOfPlay", "ShuffleHandCardIntoOutOfPlay", "ReturnAttachedEnemy", "RevealChosenFromDiscard", "CapRefresh", "EngageCaptiveHolder", "AdvanceToChosenStage", "PickSetAside", "AttachPickedToPrevious", "AddPickedToStaging", "ShufflePickedIntoBottom", "RevealFromVictory", "AddInPlayToVictory", "EngageSeat", "AttackNalir", "EliminateAtLevel", "TriggerScour", "BuryDamagedLocations", "PlaceRandomHandUnder", "PlaceDestroyedUnder", "ExcessToActiveLocation"], run, settle: { sweep: (state, ctx, steps) => buryDamaged(announceThreatZero(announceAlliesOverLimit(announceTrialKey(engageSeats(discardEliminatedDecks(engageCaptiveHolders(state, ctx, steps)), ctx, steps), ctx), ctx), ctx), ctx, steps) }, deckReset: { hold: inOwnSurgeChain } };
