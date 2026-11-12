// Rules: mec113.setup-the-tower-of-cirith-ungol, rr.lasting-effects, rr.discard-pile-and-victory-display, faq.lasting-effects (data/rules/entries.json); ledger lines 146068:A:1, 146023:A:1, 146023:A:2. The verbs src/catalog/families/cirith-ungol.ts adds. The numbers its lasting effects add to a stat (Threat or Attack per damage, Threat per Willpower of the host) are read in values.ts, which modifiedStat (core/keywords.ts) calls.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { resolveAgainst } from "../defense/shadow.ts";
import type { Focus } from "../index.ts";
import { turnIntoInStaging } from "../wilderland/rhovanion.ts";

/** ReturnFromVictory: the card of the victory display with the code returns to the staging area as the card `into`, faceup and ready, with no damage and no controller; the card it was is kept as its other side. */
function returnFromVictory(state: ScenarioState, instruction: Extract<Instruction, { verb: "ReturnFromVictory" }>): ScenarioState {
  const id = state.victory.find((candidate) => state.cards[candidate]?.code === instruction.code);
  return id ? turnIntoInStaging(state, id, instruction.into) : state;
}

function run(state: ScenarioState, instruction: Instruction, _focus: Focus): ScenarioState | null {
  switch (instruction.verb) {
    case "ReturnFromVictory":
      return returnFromVictory(state, instruction);
    case "ResolveAttackAgainst":
      return resolveAgainst(state, lastPicked(state));
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "cirith-ungol", verbs: ["ReturnFromVictory", "ResolveAttackAgainst"], run };
