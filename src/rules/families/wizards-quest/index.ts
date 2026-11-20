// Rules: docs/brief.md (The Wizard's Quest), rr.search, rr.guarded (data/rules/entries.json); ledger lines 51001:A:1, 51003:A:1, 51004:B:1, 51013:A:1.
// The verbs src/catalog/families/wizards-quest.ts adds: the kit's Quick-build (quick.ts), the quest stages' searches of the top of the encounter deck (top.ts) and the player cards held under an encounter card (held.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { arrangeTopByChallenge, hideUnderQuest } from "./hidden.ts";
import { holdPickedUnder, releaseHeld, titleHeld } from "./held.ts";
import { buildQuickDeck, chooseQuestStage } from "./quick.ts";
import { exploredPendingHolds, removeDefender, searchTopShadow } from "./khazad.ts";
import { searchTopReveal } from "./top.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "BuildQuickDeck":
      return buildQuickDeck(state, instruction, ctx);
    case "ChooseQuestStage":
      return chooseQuestStage(state, instruction, focus, steps);
    case "SearchTopReveal":
      return searchTopReveal(state, instruction, focus, ctx, steps);
    case "HoldPickedUnder":
      return holdPickedUnder(state, instruction, focus, ctx, steps);
    case "HideUnderQuest":
      return hideUnderQuest(state, instruction, ctx);
    case "ArrangeTopByChallenge":
      return arrangeTopByChallenge(state, ctx);
    case "RemoveDefender":
      return removeDefender(state);
    case "SearchTopShadow":
      return searchTopShadow(state, instruction, ctx);
    // A constant marker: the bar on the held titles is the play hook below.
    case "BarHeldTitles":
    // A constant marker: the cancel's replacement is read by CancelEffect (khazad.ts, bonesCancel).
    case "ReplacesRevealCancel":
      return state;
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "wizards-quest",
  verbs: ["BuildQuickDeck", "ChooseQuestStage", "SearchTopReveal", "HoldPickedUnder", "BarHeldTitles", "HideUnderQuest", "ArrangeTopByChallenge", "RemoveDefender", "SearchTopShadow", "ReplacesRevealCancel"],
  run,
  condition: (state, condition) => exploredPendingHolds(state, condition),
  settle: { sweep: (state) => releaseHeld(state) },
  play: (state, cardId, ctx, how) => titleHeld(state, cardId, ctx, how?.putting === true),
};
