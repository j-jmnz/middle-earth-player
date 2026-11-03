// Rules: rr.search, rr.in-play-and-out-of-play (data/rules/entries.json).
//
// The Pick filter the deck family adds: `looked` (only the cards the running effect looked at or discarded: "add 1 of those
// cards to its owner's hand", "Put up to 2 allies discarded by this effect into play").
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";

/** The cards the running effect looked at (LookAtTop) or discarded (DiscardFromDeck), still in the zone the filter names
 * (a deck by default for a look, the discard pile for a discard), of the seats it names. */
export function lookedPool(state: ScenarioState, spec: PickSpec, seats: readonly number[]): string[] {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect") return [];
  const zone = spec.from === "discard" ? "discard" : "deck";
  return (data.looked ?? []).filter((id) => {
    const card = state.cards[id];
    return card != null && card.zone === zone && card.controller != null && seats.includes(card.controller);
  });
}
