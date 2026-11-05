// Rules: dcce.corsair-deck, dcce.boarding, emce.evil-creatures-deck (data/rules/entries.json). A separate encounter deck with a discard pile of its own, read through its zones (piles.ts): the
// refill from the discard pile when the deck runs out, and the reveal of its top card into play. The Corsair deck (families/sea/corsair.ts) and the Evil Creatures deck
// (families/wilderland/decks.ts) are rows of piles.ts DECKS and share these functions.
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { moveEncounter } from "../families/encounter/moves.ts";
import { type DeckZones, pileOf, shufflePile, topOf } from "./piles.ts";
import type { ScenarioState } from "./state.ts";
import { updateCard } from "./state.ts";
import { moveCard } from "./zones.ts";

/** The deck ran out: its discard pile is shuffled back into it, every card facedown ("shuffle the Evil Creatures discard pile back into the Evil Creatures deck", emce.evil-creatures-deck; "the Corsair
 * deck ... its discard pile is shuffled back into it at once", dcce.corsair-deck). A deck the game has not dealt, a deck with cards in it and a discard pile with none are left alone. */
export function refillDeck(state: ScenarioState, zones: DeckZones, dealt: boolean): ScenarioState {
  if (!dealt || zones.discard === null || pileOf(state, zones.deck).length > 0) return state;
  const discarded = pileOf(state, zones.discard);
  if (discarded.length === 0) return state;
  let next = state;
  for (const id of [...discarded]) next = updateCard(moveCard(next, id, { zone: zones.deck }), id, { face: "down" });
  return shufflePile(next, zones.deck);
}

/** Reveals the top card of the deck and puts it into play (`to`: engaged with the seat, or in the staging area); an announced entry, as every encounter card that enters play. The deck refills from its discard
 * pile first. Null when the deck and its discard pile are both empty. */
export function revealTop(state: ScenarioState, zones: DeckZones, dealt: boolean, to: "engaged" | "staging", seat: number, ctx: ReduceContext, steps: EngineStep[]): { state: ScenarioState; id: string | null } {
  const filled = refillDeck(state, zones, dealt);
  const top = topOf(filled, zones.deck);
  if (!top) return { state: filled, id: null };
  return { state: moveEncounter(filled, top, to, seat, ctx, steps), id: top };
}
