// Rules: rr.running-out-of-cards, rr.staging-area (data/rules/entries.json); ledger line 10103:A:1. "Any time the encounter deck runs out of cards, return the topmost Undead enemy in the encounter discard pile to the staging area before resetting the encounter deck": while a card in play holds
// `returnsUndeadOnRunOut` (Ghostly Ruins, staged or active), the encounter deck's reset first puts that enemy in the staging area, not revealed, so the new deck never holds it.
import type { EngineStep } from "../../core/intents.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { moveEncounter } from "../encounter/moves.ts";
import { topOfEncounterDiscard } from "../nightmare/index.ts";

/** The deck is out of cards and about to be reset (the caller checked the phase): the topmost Undead enemy of the discard pile returns to the staging area first, when a card in play says so. */
export function returnUndeadBeforeReset(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.modifiers.length === 0 || state.encounterDeck.length > 0 || state.encounterDiscard.length === 0 || !flagged(state, "table", "returnsUndeadOnRunOut")) return state;
  const id = topOfEncounterDiscard(state, ["enemy"], ctx, "Undead");
  return id ? moveEncounter(state, id, "staging", state.firstPlayer, ctx, steps) : state;
}
