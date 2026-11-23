// Rules: hob.setup-we-must-away-ere-break-of-day, rr.encounter-deck, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger line 131035:A:2. The verbs of the Western Lands encounter set that no other family has (src/catalog/families/western-lands.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import { shuffleIntoEncounterDeck } from "../../interpret/verbs.ts";
import { shadowCards } from "../../core/zones.ts";
import type { Focus } from "../index.ts";

/** ShuffleShadowIntoEncounterDeck: the shadow card with this code that the source enemy holds, else the topmost such card of the encounter discard pile, goes into the encounter deck, which is shuffled. */
function shuffleShadowBack(state: ScenarioState, code: string, focus: Focus): ScenarioState {
  const enemy = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const held = shadowCards(enemy).find((id) => state.cards[id]?.code === code);
  const id = held ?? [...state.encounterDiscard].reverse().find((other) => state.cards[other]?.code === code);
  return id ? shuffleIntoEncounterDeck(state, id) : state;
}

function run(state: ScenarioState, instruction: Instruction, focus: Focus, _ctx: ReduceContext, _steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "ShuffleShadowIntoEncounterDeck":
      return shuffleShadowBack(state, instruction.code, focus);
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "western-lands", verbs: ["ShuffleShadowIntoEncounterDeck"], run };
