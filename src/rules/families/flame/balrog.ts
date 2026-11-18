// Rules: dwd.durins-bane, rr.shadow-effects (data/rules/entries.json); ledger lines 901801:A:2, 901801:A:3, 901801:A:4.
// The Balrog deck of Shadow and Flame's Nightmare deck: formed at Setup from the encounter cards with the Attack trait, the deck Durin's Bane is dealt its shadow cards from (interpret/interpret.ts dealAdditionalShadow) and the discard pile they go to
// (core/piles.ts DECKS.balrog; a card of the deck is routed there by moveCard). The deck is a zone of `piles` that exists only in a game that formed it.
import type { Instruction } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import { pileOf, shufflePile, withPile } from "../../core/piles.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

/** FormBalrogDeck: the encounter cards with the trait go facedown into the Balrog deck, which is shuffled; the Balrog discard pile starts empty. With no such card in the encounter deck nothing is formed. */
export function formBalrogDeck(state: ScenarioState, instruction: Extract<Instruction, { verb: "FormBalrogDeck" }>, ctx: ReduceContext): ScenarioState {
  const ids = state.encounterDeck.filter((id) => {
    const card = state.cards[id];
    return card != null && printedOf(ctx.cards, card.code).traits.includes(instruction.trait);
  });
  if (ids.length === 0) return state;
  let next = withPile(withPile(state, "balrogDeck", pileOf(state, "balrogDeck")), "balrogDiscard", pileOf(state, "balrogDiscard"));
  for (const id of ids) next = updateCard(moveCard(next, id, { zone: "balrogDeck" }), id, { face: "down" });
  return shufflePile(next, "balrogDeck");
}

/** ShuffleBalrogDiscard: every card of the Balrog discard pile goes back into the Balrog deck, which is shuffled (901801:A:4). A game with no Balrog deck, or an empty discard pile, is left as it is. */
export function shuffleBalrogDiscard(state: ScenarioState): ScenarioState {
  if (state.piles?.balrogDeck === undefined) return state;
  const discarded = pileOf(state, "balrogDiscard");
  if (discarded.length === 0) return state;
  let next = state;
  for (const id of [...discarded]) next = updateCard(moveCard(next, id, { zone: "balrogDeck" }), id, { face: "down" });
  return shufflePile(next, "balrogDeck");
}
