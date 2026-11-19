// Rules: rr.objective-cards, rr.attachment-cards (data/rules/entries.json); ledger lines 01108:A:2, 01103:A:2.
//
// "Discarded objective cards are returned to the staging area": a claimed objective whose printed text says it returns ("If detached, return
// Gandalf's Map to the staging area", 01108:A:2; "If unattached, return Gate Key to the staging area", 12071:A:1; the flag `returnsToStagingArea`
// those records set) goes back to the staging area when it is discarded or loses its hero. Any other claimed objective (Athelas 02063, the
// Rhudaur Clues 10110, 10112, 10114) counts as an attachment and is discarded with its host to its own deck's discard pile (rr.attachment-cards).
// Every place that sends a card away asks here (one decision, not four).
import { flagged, updateCard, type CardInstance, type ScenarioState } from "../../core/state.ts";
import type { Destination } from "../../core/zones.ts";
import { moveCard } from "../../core/zones.ts";

// The card is a claimed objective whose printed text returns it to the staging area.
function returnsToStaging(state: ScenarioState, card: CardInstance | undefined): boolean {
  return card?.claimed === true && flagged(state, card.id, "returnsToStagingArea");
}

// The staging area when the card is a claimed objective, otherwise `otherwise` (where the card would normally go).
export function claimedDestination(state: ScenarioState, card: CardInstance | undefined, otherwise: Destination): Destination {
  return returnsToStaging(state, card) ? { zone: "staging" } : otherwise;
}

// Moves the card to `otherwise`, or back to the staging area faceup when it is a claimed objective.
export function sendAway(state: ScenarioState, id: string, otherwise: Destination): ScenarioState {
  if (!returnsToStaging(state, state.cards[id])) return moveCard(state, id, otherwise);
  return updateCard(moveCard(state, id, { zone: "staging" }), id, { face: "up" });
}

// DiscardRestricted: the card goes to its controller's discard pile, or back to the staging area when its text returns it.
export function discardRestricted(state: ScenarioState, id: string): ScenarioState {
  const owner = state.cards[id]?.controller;
  return owner != null ? sendAway(state, id, { zone: "discard", seat: owner }) : state;
}

// A claimed objective that says it returns to the top of the encounter deck when its hero leaves play (the flag `returnsToEncounterDeck`, "Forced: After attached hero is damaged or leaves play, return this card to the top of the encounter deck", 02014:A:2) goes there
// facedown, controlled by nobody; null for any other card.
export function returnedToDeck(state: ScenarioState, id: string): ScenarioState | null {
  if (!state.cards[id]?.claimed || !flagged(state, id, "returnsToEncounterDeck")) return null;
  const moved = updateCard(moveCard(state, id, { zone: "encounterDeck" }), id, { face: "down", controller: null });
  return { ...moved, encounterDeck: [id, ...moved.encounterDeck.filter((entry) => entry !== id)] };
}
