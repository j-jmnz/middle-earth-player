// Rules: rr.triggered-ability, rr.cost (data/rules/entries.json).
// The idle check of the encounter family's verbs (src/rules/player/potential.ts, Whether an ability could change the game): MoveEncounterCard of the top card of the encounter discard
// pile changes nothing when that pile is empty, and so does a move of the top card of the encounter deck when that deck is empty and stays empty (Sting: "discard the top card of the encounter deck").
import type { IdleHook } from "../../interpret/family-manifest.ts";

export const encounterIdle: IdleHook = (state, instruction) => {
  if (instruction.verb !== "MoveEncounterCard") return null;
  if (instruction.card === "discardTop") return state.encounterDiscard.length === 0;
  // An encounter deck that is out of cards in the quest phase is refilled from the discard pile (rr.running-out-of-cards): only then is there a card to discard.
  if (instruction.card === "deckTop") return state.encounterDeck.length === 0 && (state.phase !== "Quest" || state.encounterDiscard.length === 0);
  return false;
};
