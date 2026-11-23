// Rules: rr.triggered-ability, rr.cost (data/rules/entries.json).
// The idle check of the encounter family's verbs (src/rules/player/potential.ts, Whether an ability could change the game): MoveEncounterCard of the top card of the encounter discard
// pile changes nothing when that pile is empty, and so does a move of the top card of the encounter deck when that deck is empty and the move does not refill it (Sting: "discard the top card of the encounter deck").
import type { IdleHook } from "../../interpret/family-manifest.ts";
import { refillsEmptyDeckNow } from "../../interpret/verbs.ts";

export const encounterIdle: IdleHook = (state, instruction) => {
  if (instruction.verb !== "MoveEncounterCard") return null;
  if (instruction.card === "discardTop") return state.encounterDiscard.length === 0;
  // The move reads the deck as it stands: the refill from the discard pile comes at the end of a reveal and in Hide (rr.running-out-of-cards), not in the move, so an empty deck has no card
  // to move in any phase unless the Nightmare refill at any time puts the discard pile back first (`refillsEmptyDeckNow`).
  if (instruction.card === "deckTop") return state.encounterDeck.length === 0 && !refillsEmptyDeckNow(state);
  return false;
};
