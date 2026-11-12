// Rules: mec108.campaign-log-tracking (data/rules/entries.json); ledger line 10159:A:2. The Campaign Setup of The Weather Hills puts Protect the Innocent into the staging area with the damage the Campaign Log noted for it.
import type { Instruction } from "../../../catalog/boundary.ts";

import { inPlay, updateCard, type ScenarioState } from "../../core/state.ts";

/** PlaceLoggedDamageOn: the card in play with the code (Protect the Innocent or Arnor Ravaged, the only two the schema accepts: they share the one number in the log) takes the damage the Campaign Log noted for them (`campaignFacts.angmar.protectDamage`), none when the log notes none. The tokens are placed, not dealt: nothing cancels them. */
export function placeLoggedDamageOn(state: ScenarioState, instruction: Extract<Instruction, { verb: "PlaceLoggedDamageOn" }>): ScenarioState {
  const damage = state.campaignFacts?.angmar?.protectDamage ?? 0;
  const card = Object.values(state.cards).find((candidate) => candidate.code === instruction.code && inPlay(candidate.zone));
  return card && damage > 0 ? updateCard(state, card.id, { damage: card.damage + damage }) : state;
}
