// Rules: rr.attachment-cards, rr.modifiers (data/rules/entries.json).
//
// The amounts the misc family adds (effect-schema-amount.ts): the cards attached facedown to the source, and the resource
// tokens the other copies of the source card hold above the number on this one.
import type { AmountExpr } from "../../catalog/boundary.ts";

import type { ScenarioState } from "../state.ts";

// The facedown attachments of a card (AttachFacedown) are out of play under it: zone "under", hosted by the card.
export function facedownCount(state: ScenarioState, hostId: string | null): number {
  if (!hostId) return 0;
  return Object.values(state.cards).filter((card) => card.zone === "under" && card.host === hostId).length;
}

// Keeping Count (04005:A:2): for the copies of the source card in play, the most resource tokens one holds, less the number the
// source holds; never below 0.
export function resourcesAboveCopies(state: ScenarioState, sourceId: string | null): number {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source) return 0;
  let most = 0;
  for (const card of Object.values(state.cards)) {
    if (card.id === source.id || card.code !== source.code || card.zone === "discard" || card.zone === "hand" || card.zone === "deck") continue;
    most = Math.max(most, card.resources);
  }
  return Math.max(0, most - source.resources);
}

export function miscAmount(state: ScenarioState, amount: AmountExpr, sourceId: string | null): number {
  if (amount.facedown) return facedownCount(state, sourceId);
  if (amount.resourcesAboveCopies) return resourcesAboveCopies(state, sourceId);
  return 0;
}
