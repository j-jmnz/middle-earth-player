// Rules: rr.search, rr.reveal, rr.cancel, rr.encounter-deck (data/rules/entries.json); ledger lines 51003:A:1, 51004:A:1, 51005:A:1, 51007:A:1, 51008:A:1, 51009:A:1 (docs/brief.md, The Wizard's Quest, readings 3 and 5).
// "The opposing team searches the top 5 cards of the encounter deck for a card with cost N or less, sets it aside, and shuffles the encounter deck. Reveal the set aside card. Its 'when revealed' effects cannot be canceled."
import type { Instruction } from "../../../catalog/boundary.ts";

import { addModifier } from "../../core/keywords.ts";
import type { EngineStep } from "../../core/intents.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { stageNumber } from "../caves/progress.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { searchable } from "../../interpret/search.ts";
import { shuffleEncounterDeck } from "../../interpret/verbs.ts";
import { startReveal } from "../../windows/frames.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** SearchTopReveal: the card nearest the top among the top cards of the encounter deck that cost no more than the limit is set aside, the deck is shuffled, and the card is revealed with its When Revealed effects uncancelable (`cancelable`: cancelable; `maxCostStage`: the limit is the stage number of the main quest). With none, only the shuffle. */
export function searchTopReveal(state: ScenarioState, instruction: Verb<"SearchTopReveal">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const stage = instruction.maxCostStage === true ? stageNumber(state) : undefined;
  const id = searchable(state, { top: instruction.top, maxCost: stage ?? instruction.maxCost, maxCostMulti: stage ?? instruction.maxCostMulti }, ctx)[0];
  if (!id) return shuffleEncounterDeck(state);
  const asideCard = updateCard(moveCard(state, id, { zone: "setAside" }), id, { face: "down" });
  const aside = shuffleEncounterDeck(instruction.cancelable === true ? asideCard : addModifier(asideCard, id, id, "revealUncancelable", 1, "endOfGame"));
  return startReveal(aside, focus.seat, ctx, steps, id);
}
