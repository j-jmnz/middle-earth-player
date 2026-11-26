// Rules: rr.constant-ability, rr.triggered-ability, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 16014:A:2, 16016:A:1, 16045:A:2, 16066:B:1, 16067:B:1.
// The verbs, flags, triggers, conditions and amount src/catalog/families/haradrim.ts adds: the heat tracker (heat.ts), the stage that notes the round it came into play (stage.ts), the hand limit (hand.ts), the card placed faceup under a location (under.ts), The Mûmakil's Captures (capture.ts), the explored-this-round note (explored.ts) and the pick filter `sameTitleAsDiscarded` (pick.ts).
// The flag `stageCapped` is read by putOnStage (src/rules/quest/quest.ts). The Long Arm of Mordor's heroes in the staging area are in staged.ts, its Uruks' Threat against Willpower in combat.ts, the Chieftain's engagement in engage.ts.
import type { Instruction } from "../../../catalog/boundary.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { addWithHostToVictory, attachRandomSetAside } from "./capture.ts";
import { exploredCondition } from "./explored.ts";
import { haradrimPickMatches } from "./pick.ts";
import { allyBelowThreat, threatAboveWillpower, willpowerGap } from "./combat.ts";
import { engageSeatWithMost } from "./engage.ts";
import { announceOverLimit } from "./hand.ts";
import { runHeat, temperatureAmount, temperatureCondition } from "./heat.ts";
import { guardStagedHeroes, markStagedHeroes, moveHeroesToStaging, releaseStagedHero, takeObjectiveHero, undefendedStaged } from "./staged.ts";
import { haradrimCondition, noteStage } from "./stage.ts";
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
    case "AttachRandomSetAside":
      return attachRandomSetAside(state, instruction, ctx);
    case "AddWithHostToVictory":
      return addWithHostToVictory(state, focus, ctx);
    default:
      return runHeat(state, instruction, focus, ctx);
  }
}

export const manifest: RulesFamily = {
  name: "haradrim",
  verbs: ["PlaceUnderSelfFaceup", "SetTemperature", "RaiseTemperature", "LowerTemperature", "MoveHeroesToStaging", "TakeObjectiveHero", "ReleaseStagedHero", "GuardStagedHeroes", "EngageSeatWithMost", "AttachRandomSetAside", "AddWithHostToVictory"],
  run,
  condition: (state, condition, _scope, ctx) => (condition.kind === "threatAboveWillpower" ? threatAboveWillpower(state, ctx.cards) : (haradrimCondition(state, condition) ?? exploredCondition(state, condition) ?? temperatureCondition(state, condition))),
  amount: (state, found, scope, ctx) => (found.willpowerGap ? willpowerGap(state, scope.sourceId ?? null, ctx.cards) : temperatureAmount(state, found)),
  pick: haradrimPickMatches,
  combat: { defense: (state, defender, cards, defenderId) => allyBelowThreat(state, defender, cards, defenderId), undefended: (state) => undefendedStaged(state) },
  // The hook runs after the encounter deck is refilled: it notes the main quest card and announces a hand over the limit.
  settle: {
    after: (state, ctx, steps) => announceOverLimit(noteStage(state, gameReads(state, ctx, '"kind":"stageInPlayWholeRound"')), steps),
    sweep: (state, ctx) => markStagedHeroes(state, ctx),
  },
};
