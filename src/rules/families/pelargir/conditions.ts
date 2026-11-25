// Rules: rr.reveal, rr.step-5-2, rr.running-out-of-cards (data/rules/entries.json); ledger line 05067:B:2.
// The conditions the Pelargir family answers (the family's `condition` hook): the first enemy of the round (noted by first-enemy.ts), the underworld, the encounter deck that can still reveal, and an empty deck.
import type { Condition } from "../../../catalog/boundary.ts";

import type { Scope } from "../../interpret/conditions.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { someDeckEmpty } from "./empty-deck.ts";
import { underworldReleased } from "./underworld.ts";

/** The conditions `firstEnemy`, `underworldReleased`, `encounterCanReveal` and `deckEmpty`: the enemy the answered reveal is about is the first the encounter deck revealed this round. Null for any other condition. */
export function pelargirCondition(state: ScenarioState, condition: Condition, scope: Scope): boolean | null {
  if (condition.kind === "underworldReleased") return underworldReleased(state);
  if (condition.kind === "deckEmpty") return someDeckEmpty(state);
  // The encounter deck is reset from the discard pile in the quest phase only (rr.running-out-of-cards).
  if (condition.kind === "encounterCanReveal") return state.encounterDeck.length > 0 || (state.phase === "Quest" && state.encounterDiscard.length > 0);
  return condition.kind === "firstEnemy" ? scope.subject != null && flagged(state, scope.subject, "firstEnemy") : null;
}
