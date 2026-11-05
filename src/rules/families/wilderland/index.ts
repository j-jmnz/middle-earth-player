// Rules: emce.treasure, emce.boon-allies, emce.campaign-pool-encounter, emce.campaign-log, emce.caves-deck, emce.deep, emce.evil-creatures-deck, emce.discover, emce.loot, rr.guarded (data/rules/entries.json).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { addFromNamed, refillEvilCreatures, shuffleIntoNamed, shuffleNamed, shuffleNamedIntoEncounter } from "./decks.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import { resolveDeep } from "./deep.ts";
import { discover } from "./discover.ts";
import { logCondition } from "./log.ts";
import { attachRandomTreasure, claimRandomTreasure } from "./treasure.ts";
import { wilderlandAmount } from "./amounts.ts";
import { controlFreedObjectives } from "./control.ts";
import { wilderlandPickMatches } from "./pick.ts";
import { setAsideDiscardForPool } from "./discard-pool.ts";
import { flipOver } from "./flip.ts";
import { addSourceToHandOfMost } from "./hand.ts";
import { advanceToLetterStage, grantSurge, freeTreasures, searchGuardForTreasure, takeControlOfSetAside } from "./mirkwood.ts";
import { topFrame } from "../../windows/windows.ts";

// The verbs src/catalog/families/wilderland.ts adds. AttachRandomTreasure runs in the game. The others are not run by the engine: the Resolution
// ones (DiscoverTreasure, BoonAllyOrLogLine, AddEncounterToPool, RemoveFromPool) are run by rules/setup/resolution.ts, and RemoveFromEncounterDeckIfLogged is dealt by
// the campaign checklist (campaign/checklist.ts), so they change nothing here. The decks, Deep and Discover run in the game; Loot and IgnoreKeyword are constants other code reads (markers.ts), so run alone they do nothing.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "AttachRandomTreasure":
      return attachRandomTreasure(state, instruction, focus, ctx, steps);
    case "ClaimRandomTreasure":
      return claimRandomTreasure(state, instruction, focus, ctx, steps);
    case "SetAsideDiscardForPool":
      return setAsideDiscardForPool(state, instruction, focus, ctx, steps);
    case "FlipOver":
      return flipOver(state, instruction, focus);
    case "AddSourceToHandOfMost":
      return addSourceToHandOfMost(state, instruction, focus, ctx, steps);
    // A Shadow card's "attach this card to attacking enemy" (18018:A:2) needs no question, so it runs inline; every other AttachSelf is the effect frame's.
    case "AttachSelf": {
      if (instruction.to.kind !== "attackingEnemy") return null;
      const attacker = state.pendingAttack?.enemyId;
      return attacker && focus.sourceId && state.cards[attacker] ? attachSelf(state, focus.sourceId, attacker, ctx) : state;
    }
    case "ShufflePile":
      return shuffleNamed(state, instruction);
    case "ShuffleIntoPile":
      return shuffleIntoNamed(state, instruction);
    case "AddFromPile":
      return addFromNamed(state, instruction, focus, ctx, steps);
    case "ShufflePileIntoEncounterDeck":
      return shuffleNamedIntoEncounter(state, instruction);
    case "Deep":
      return resolveDeep(state, focus, ctx, steps);
    case "Discover":
      return discover(state, instruction, focus, ctx, steps);
    case "AdvanceToLetterStage":
      return advanceToLetterStage(state, instruction, ctx, steps);
    case "TakeControlOfSetAside":
      return takeControlOfSetAside(state, instruction, focus);
    case "SearchGuardForTreasure":
      return searchGuardForTreasure(state, instruction, focus);
    case "GrantSurgeToSubject": {
      const data = topFrame(state)?.data;
      return grantSurge(state, data?.kind === "effect" ? (data.subject ?? null) : null);
    }
    case "Loot":
    case "Undiscardable":
    case "DiscardToPoolFromSets":
    case "PutObjectiveLocationAfterDiscard":
    case "GainControlWhenFree":
    case "IgnoreKeyword":
      return state;
    case "DiscoverTreasure":
    case "BoonAllyOrLogLine":
    case "AddEncounterToPool":
    case "RemoveFromPool":
    case "RemoveFromEncounterDeckIfLogged":
      return state;
    default:
      return null;
  }
}

// The conditions that read the Campaign Log's facts (log.ts). A game dealt without the facts holds neither.
function condition(state: ScenarioState, found: Condition): boolean | null {
  return logCondition(found, state.campaignFacts);
}

export const manifest: RulesFamily = {
  name: "wilderland",
  condition,
  amount: wilderlandAmount,
  pick: wilderlandPickMatches,
  // The Evil Creatures deck runs out: its own discard pile is shuffled back into it at once (emce.evil-creatures-deck).
  settle: { after: (state) => refillEvilCreatures(state), sweep: (state, ctx, steps) => freeTreasures(controlFreedObjectives(state, ctx), ctx, steps) },
  verbs: ["AttachRandomTreasure", "ClaimRandomTreasure", "SetAsideDiscardForPool", "FlipOver", "AddSourceToHandOfMost", "DiscoverTreasure", "BoonAllyOrLogLine", "AddEncounterToPool", "RemoveFromPool", "RemoveFromEncounterDeckIfLogged", "ShufflePile", "ShuffleIntoPile", "AddFromPile", "ShufflePileIntoEncounterDeck", "Deep", "Discover", "Loot", "Undiscardable", "GainControlWhenFree", "IgnoreKeyword", "AdvanceToLetterStage", "TakeControlOfSetAside", "SearchGuardForTreasure", "GrantSurgeToSubject", "DiscardToPoolFromSets", "PutObjectiveLocationAfterDiscard"],
  run,
};
