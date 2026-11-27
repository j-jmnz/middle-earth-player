// Rules: rr.constant-ability, rr.triggered-ability, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 16014:A:2, 16016:A:1, 16045:A:2, 16066:B:1, 16067:B:1.
// The verbs, flags, triggers, conditions and amount src/catalog/families/haradrim.ts adds: the heat tracker (heat.ts), the stage that notes the round it came into play (stage.ts), the hand limit (hand.ts), the card placed faceup under a location (under.ts), The Mûmakil's Captures (capture.ts), the explored-this-round note (explored.ts) and the pick filter `sameTitleAsDiscarded` (pick.ts).
// Beneath the Sands: the Search objective's flips, Track X and the search for On Track cards (track.ts).
// Race Across Harad: the Orcs' area (orcs-area.ts, orcs-stage.ts, orcs-values.ts, orcs-zone.ts, orcs-types.ts) and the Tamed Mûmak (mumak.ts). The flag `stageCapped` is read by putOnStage (src/rules/quest/quest.ts). The Long Arm of Mordor's heroes in the staging area are in staged.ts, its Uruks' Threat against Willpower in combat.ts, the Chieftain's engagement in engage.ts.
import type { Instruction } from "../../../catalog/boundary.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { addWithHostToVictory, attachRandomSetAside } from "./capture.ts";
import { exploredCondition } from "./explored.ts";
import { eliminateAfterAttack, takeObjectiveAlly, undefendedMumak } from "./mumak.ts";
import { moveToOrcsArea, prepareOrcsArea, syncOrcsArea } from "./orcs-area.ts";
import { addOrcsProgress, orcsProgress } from "./orcs-stage.ts";
import { orcsCondition } from "./orcs-values.ts";
import { revealRandomSetAside } from "./random-aside.ts";
import { haradrimPickMatches } from "./pick.ts";
import { allyBelowThreat, threatAboveWillpower, willpowerGap } from "./combat.ts";
import { attackSeatWithMost, engageSeatWithMost } from "./engage.ts";
import { attachCaptive, discardUntilAlly, heldPrintedAmount, rescueCaptured, seatsWithoutCaptives, stripCaptive } from "./captured.ts";
import { announceOverLimit } from "./hand.ts";
import { runHeat, temperatureAmount, temperatureCondition } from "./heat.ts";
import { guardStagedHeroes, markStagedHeroes, moveHeroesToStaging, releaseStagedHero, takeObjectiveHero, undefendedStaged } from "./staged.ts";
import { haradrimCondition, noteStage } from "./stage.ts";
import { addTopmostFromDiscard, everySeatHasAlly, flipSearchObjective, resolveTrack, setAsideCode, stageMarkedFromTop } from "./track.ts";
import { placeUnderFaceup } from "./under.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PlaceUnderSelfFaceup":
      return placeUnderFaceup(state, focus, ctx, steps);
    case "MoveHeroesToStaging":
      return moveHeroesToStaging(state);
    case "TakeObjectiveHero":
      return takeObjectiveHero(state, instruction, focus, steps);
    case "ReleaseStagedHero":
      return releaseStagedHero(state, instruction, focus, steps);
    case "GuardStagedHeroes":
      return guardStagedHeroes(state, instruction, focus, ctx, steps);
    case "EngageSeatWithMost":
      return engageSeatWithMost(state, instruction, focus, ctx, steps);
    case "AttackSeatWithMost":
      return attackSeatWithMost(state, instruction, focus, ctx, steps);
    case "AttachCaptive":
      return attachCaptive(state, instruction, focus, ctx, steps);
    case "RescueCaptured":
      return rescueCaptured(state, instruction, focus, ctx, steps);
    case "StripCaptive":
      return stripCaptive(state, instruction, focus, ctx, steps);
    case "DiscardUntilAlly":
      return discardUntilAlly(state, instruction, focus, ctx);
    case "AttachRandomSetAside":
      return attachRandomSetAside(state, instruction, ctx, steps);
    case "RevealRandomSetAside":
      return revealRandomSetAside(state, instruction, focus, ctx, steps);
    case "AddWithHostToVictory":
      return addWithHostToVictory(state, focus, ctx);
    case "PrepareOrcsArea":
      return prepareOrcsArea(state, instruction);
    case "MoveToOrcsArea":
      return moveToOrcsArea(state, instruction, focus);
    case "OrcsProgress":
      return orcsProgress(state, instruction, ctx, steps);
    case "AddOrcsProgress":
      return addOrcsProgress(state, instruction, focus, ctx, steps);
    case "TakeObjectiveAlly":
      return takeObjectiveAlly(state, instruction, focus, steps);
    case "EliminateAfterAttack":
      return eliminateAfterAttack(state, focus, ctx, steps);
    case "FlipSearchObjective":
      return flipSearchObjective(state, instruction, steps);
    case "ResolveTrack":
      return resolveTrack(state, instruction, focus, ctx, steps);
    case "StageMarkedFromTop":
      return stageMarkedFromTop(state, instruction, focus, ctx, steps);
    case "AddTopmostFromDiscard":
      return addTopmostFromDiscard(state, instruction, focus, ctx, steps);
    case "SetAsideCode":
      return setAsideCode(state, instruction);
    default:
      return runHeat(state, instruction, focus, ctx);
  }
}

export const manifest: RulesFamily = {
  name: "haradrim",
  verbs: ["PlaceUnderSelfFaceup", "SetTemperature", "RaiseTemperature", "LowerTemperature", "MoveHeroesToStaging", "TakeObjectiveHero", "ReleaseStagedHero", "GuardStagedHeroes", "EngageSeatWithMost", "AttackSeatWithMost", "AttachCaptive", "RescueCaptured", "StripCaptive", "DiscardUntilAlly", "AttachRandomSetAside", "RevealRandomSetAside", "AddWithHostToVictory", "PrepareOrcsArea", "MoveToOrcsArea", "OrcsProgress", "AddOrcsProgress", "TakeObjectiveAlly", "EliminateAfterAttack", "FlipSearchObjective", "ResolveTrack", "StageMarkedFromTop", "AddTopmostFromDiscard", "SetAsideCode"],
  run,
  condition: (state, condition, scope, ctx) => {
    switch (condition.kind) {
      case "threatAboveWillpower":
        return threatAboveWillpower(state, ctx.cards);
      case "everySeatHasAlly":
        return everySeatHasAlly(state, scope.sourceId ?? null, ctx);
      default:
        return haradrimCondition(state, condition) ?? orcsCondition(state, condition) ?? exploredCondition(state, condition) ?? temperatureCondition(state, condition);
    }
  },
  amount: (state, found, scope, ctx) => {
    if (found.seatsWithoutCaptives) return seatsWithoutCaptives(state);
    if (found.heldPrinted) return heldPrintedAmount(state, found.heldPrinted, scope, ctx);
    if (found.willpowerGap) return willpowerGap(state, scope.sourceId ?? null, ctx.cards);
    return temperatureAmount(state, found);
  },
  pick: haradrimPickMatches,
  combat: {
    defense: (state, defender, cards, defenderId) => allyBelowThreat(state, defender, cards, defenderId),
    undefended: (state) => {
      const mumak = undefendedMumak(state);
      return mumak.length > 0 ? mumak : undefendedStaged(state);
    },
  },
  // The hook runs after the encounter deck is refilled: it notes the main quest card and announces a hand over the limit.
  settle: {
    after: (state, ctx, steps) => announceOverLimit(noteStage(syncOrcsArea(state), gameReads(state, ctx, '"kind":"stageInPlayWholeRound"')), steps),
    sweep: (state, ctx) => markStagedHeroes(state, ctx),
  },
};
