// Rules: ats.ally-objectives, rr.current-quest, hon.battle, hon.siege (data/rules/entries.json); ledger lines 05025:A:1, 05026:A:1.
// The ally objectives of Into Ithilien (Celador, the Ithilien Guardians) that "are committed to the current quest" while they lie in the staging area. A constant on the card sets `committedInStaging`; no instance field
// is written, so nothing is cleared at the end of the quest phase. Only a game with such a card holds the flag, so no other game reads a different state.
import { flagged, type ScenarioState } from "../../core/state.ts";

/** The cards in the staging area that hold `committedInStaging`: each counts as a character committed to the current quest (quest total, "committed" pick filter, archery recipients). With `only` and stages that are separate, none: Into Ithilien has a single stage. */
export function stagedCommitted(state: ScenarioState, only?: number): readonly string[] {
  if (state.modifiers.length === 0 || (only != null && state.separate)) return [];
  return state.staging.filter((id) => flagged(state, id, "committedInStaging"));
}

/** Whether this card lies in the staging area committed by its own text. */
export function committedInStaging(state: ScenarioState, id: string): boolean {
  return state.modifiers.length > 0 && state.cards[id]?.zone === "staging" && flagged(state, id, "committedInStaging");
}
