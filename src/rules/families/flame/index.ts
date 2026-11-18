// Rules: dwd.durins-bane, rr.hit-points, rr.cancel, rr.shadow-effects (data/rules/entries.json); ledger lines 04139:B:1, 04141:A:1, 04145:A:1, 901801:A:2, 901801:A:4.
// The verbs src/catalog/families/flame.ts adds: the Balrog deck of Shadow and Flame's Nightmare deck (balrog.ts), Dark Pit's discard of Durin's Bane and the event Counter-Spell cancels (bane.ts), and the hit points left and the heroes committed this round that its cards read.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import { namedInPlay } from "../misc/amounts.ts";
import { refCard } from "../../interpret/amounts.ts";
import type { Focus } from "../index.ts";
import { formBalrogDeck, shuffleBalrogDiscard } from "./balrog.ts";
import { cancelEventEffects, committedThisRound, discardNamedFromPlay, remainingHitPoints } from "./bane.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "FormBalrogDeck":
      return formBalrogDeck(state, instruction, ctx);
    case "ShuffleBalrogDiscard":
      return shuffleBalrogDiscard(state);
    case "DiscardNamedFromPlay":
      return discardNamedFromPlay(state, instruction, ctx);
    case "CancelEventEffects":
      return cancelEventEffects(state, focus);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "flame",
  verbs: ["FormBalrogDeck", "ShuffleBalrogDiscard", "DiscardNamedFromPlay", "CancelEventEffects"],
  run,
  condition: (state, condition, _scope, ctx) => committedThisRound(state, condition, ctx),
  amount: (state, amount, scope, ctx) => (amount.stat === "hitPoints" && amount.remaining === true ? remainingHitPoints(state, amount.ofNamed ? namedInPlay(state, amount.ofNamed, ctx) : refCard(state, amount.of ?? "self", scope), ctx) : null),
};
