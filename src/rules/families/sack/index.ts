// Rules: hob.sack-deck, hob.sack-x, hob.sack-x-example, rr.travel (data/rules/entries.json); docs/scenarios/the-hobbit/we-must-away-ere-break-of-day.md, We Must Away, Ere Break of Day. The sack family: the Sack deck and Sack X (deck.ts), the When Sacked attach (attach.ts), the removal of the Trolls and Sack cards (remove.ts)
// and Troll Cave's Baggins travel cost (travel.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { attachSacked } from "./attach.ts";
import { prepareSackDeck, sack } from "./deck.ts";
import { announceEmptyDeck } from "./empty-deck.ts";
import { removeTraitFromGame } from "./remove.ts";
import { canPayTravel, spendBaggins } from "./travel.ts";

function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PrepareSackDeck":
      return prepareSackDeck(state, ctx);
    case "Sack":
      return sack(state, instruction, focus, ctx, steps);
    case "AttachSacked":
      return attachSacked(state, instruction, focus, ctx, steps);
    case "RemoveTraitFromGame":
      return removeTraitFromGame(state, instruction, ctx);
    case "SpendBagginsToTravel":
      return spendBaggins(state, instruction, ctx);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "sack",
  verbs: ["PrepareSackDeck", "Sack", "AttachSacked", "RemoveTraitFromGame", "SpendBagginsToTravel"],
  run,
  settle: { before: announceEmptyDeck },
  condition: (state, condition, _scope, ctx) => {
    if (condition.kind === "encounterDeckEmpty") return state.encounterDeck.length === 0;
    return condition.kind === "bagginsTravel" ? canPayTravel(state, condition, ctx) : null;
  },
};
