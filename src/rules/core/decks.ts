// Rules: dcce.corsair-deck, emce.evil-creatures-deck (data/rules/entries.json). A separate encounter deck with a discard pile of its own, read through its zones (piles.ts): the refill from the discard pile when the deck runs
// out. The Corsair deck (families/sea/corsair.ts) and the Evil Creatures deck (families/wilderland/decks.ts) are rows of piles.ts DECKS and share it; revealing the top card into play is families/encounter/named-decks.ts.
import { type DeckZones, pileDealt, pileOf, shufflePile } from "./piles.ts";
import type { ScenarioState } from "./state.ts";
import { updateCard } from "./state.ts";
import { moveCard } from "./zones.ts";

/** The deck ran out: its discard pile is shuffled back into it, every card facedown ("shuffle the Evil Creatures discard pile back into the Evil Creatures deck", emce.evil-creatures-deck; "the Corsair
 * deck ... its discard pile is shuffled back into it at once", dcce.corsair-deck). A deck the game has not dealt, a deck with cards in it and a discard pile with none are left alone. */
export function refillDeck(state: ScenarioState, zones: DeckZones): ScenarioState {
  if (!pileDealt(state, zones.deck) || zones.discard === null || pileOf(state, zones.deck).length > 0) return state;
  const discarded = pileOf(state, zones.discard);
  if (discarded.length === 0) return state;
  let next = state;
  for (const id of [...discarded]) next = updateCard(moveCard(next, id, { zone: zones.deck }), id, { face: "down" });
  return shufflePile(next, zones.deck);
}
