// Rules: rr.objective-cards, rr.attachment-cards (data/rules/entries.json); ledger lines 01108:A:2, 01103:A:2.
//
// "Discarded objective cards are returned to the staging area": a claimed objective that is discarded, or that loses its hero, goes
// back to the staging area instead of a discard pile. Every place that sends a card away asks here (one decision, not four).
import { updateCard, type CardInstance, type ScenarioState } from "../state.ts";
import type { Destination } from "../zones.ts";
import { moveCard } from "../zones.ts";

// The staging area when the card is a claimed objective, otherwise `otherwise` (where the card would normally go).
export function claimedDestination(card: Pick<CardInstance, "claimed"> | undefined, otherwise: Destination): Destination {
  return card?.claimed ? { zone: "staging" } : otherwise;
}

// Moves the card to `otherwise`, or back to the staging area faceup when it is a claimed objective.
export function sendAway(state: ScenarioState, id: string, otherwise: Destination): ScenarioState {
  const card = state.cards[id];
  if (!card?.claimed) return moveCard(state, id, otherwise);
  return updateCard(moveCard(state, id, { zone: "staging" }), id, { face: "up" });
}

// DiscardRestricted: the card goes to its controller's discard pile, or back to the staging area when it is a claimed objective.
export function discardRestricted(state: ScenarioState, id: string): ScenarioState {
  const owner = state.cards[id]?.controller;
  return owner != null ? sendAway(state, id, { zone: "discard", seat: owner }) : state;
}
