// Rules: mec113.setup-the-tower-of-cirith-ungol, rr.lasting-effects, rr.victory-display, faq.lasting-effects (data/rules/entries.json); ledger lines 146068:A:1, 146023:A:1. The verbs src/catalog/families/cirith-ungol.ts adds and the hook the core calls: the Threat per damage is added where a Threat is read (modifiedStat in core/keywords.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";

/** ReturnFromVictory: the card of the victory display with the code returns to the staging area as the card `into`, faceup and ready, with no damage and no controller; the card it was is kept as its other side. */
function returnFromVictory(state: ScenarioState, instruction: Extract<Instruction, { verb: "ReturnFromVictory" }>): ScenarioState {
  const id = state.victory.find((candidate) => state.cards[candidate]?.code === instruction.code);
  const card = id ? state.cards[id] : undefined;
  if (!id || !card) return state;
  return updateCard(moveCard(state, id, { zone: "staging" }), id, { code: instruction.into, other: card.code, face: "up", controller: null, damage: 0, exhausted: false });
}

function run(state: ScenarioState, instruction: Instruction, _focus: Focus): ScenarioState | null {
  switch (instruction.verb) {
    case "ReturnFromVictory":
      return returnFromVictory(state, instruction);
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "cirith-ungol", verbs: ["ReturnFromVictory"], run };
