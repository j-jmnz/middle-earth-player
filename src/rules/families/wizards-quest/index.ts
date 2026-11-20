// Rules: docs/brief.md (The Wizard's Quest), rr.search, rr.guarded (data/rules/entries.json); ledger lines 51001:A:1, 51003:A:1, 51004:B:1, 51013:A:1.
// The verbs src/catalog/families/wizards-quest.ts adds: the kit's Quick-build (quick.ts), the quest stages' searches of the top of the encounter deck (top.ts) and the player cards held under an encounter card (held.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { holdPickedUnder, titleHeld } from "./held.ts";
import { buildQuickDeck, chooseQuestStage } from "./quick.ts";
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
      return holdPickedUnder(state, focus, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "wizards-quest",
  verbs: ["BuildQuickDeck", "ChooseQuestStage", "SearchTopReveal", "HoldPickedUnder"],
  run,
  play: (state, cardId, ctx) => titleHeld(state, cardId, ctx),
};
