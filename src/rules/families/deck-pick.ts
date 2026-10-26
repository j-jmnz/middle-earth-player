// Rules: rr.search, rr.in-play-and-out-of-play, rr.traits (data/rules/entries.json).
//
// The Pick filters the deck family adds: `looked` (only the cards the running effect looked at or discarded: "add 1 of those
// cards to its owner's hand", "Put up to 2 allies discarded by this effect into play") and `sharesTrait` ("an ally who shares
// at least 1 Trait with him").
import type { PickSpec } from "../../catalog/boundary.ts";

import { grantedTraits, hasTrait } from "../conditions.ts";
import type { ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { topFrame } from "../windows.ts";

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

/** Whether the card passes the deck family's filters. `sharesTrait`: one of the source card's traits (printed, or gained from
 * an attachment) is one of the card's. */
export function deckPickMatches(state: ScenarioState, id: string, spec: PickSpec, sourceId: string | null, ctx: ReduceContext): boolean {
  if (spec.sharesTrait === "self") {
    const source = sourceId ? state.cards[sourceId] : undefined;
    if (!source) return false;
    const traits = [...printedOf(ctx.cards, source.code).traits, ...grantedTraits(state, source.id, ctx)];
    if (!traits.some((trait) => hasTrait(state, id, trait, ctx))) return false;
  }
  return true;
}
