// Rules: dcce.uncharted, dcce.uncharted-deck (data/rules/entries.json). The Uncharted deck as a zone: moveCard (zones.ts) asks for the route of every card that would be discarded and
// for the deck's own detaching and attaching. Types and pure helpers only, so zones.ts can use them.
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { shufflePile } from "../../core/piles.ts";
import type { Destination } from "../../core/zones.ts";

/** A card of the Grotto deck, whichever side it shows: its Grotto side is a code of the deck, or the side it does not show is (an Underwater side lying on top of its Grotto side, `other`). */
function isGrottoCard(state: ScenarioState, card: Pick<CardInstance, "code" | "other">): boolean {
  const codes = state.uncharted?.codes ?? [];
  return codes.includes(card.code) || (card.other != null && codes.includes(card.other));
}

/** Where a double-sided location that would be discarded, or put into the encounter deck, really goes: shuffled back into the Uncharted deck, Lost Island side faceup
 * ("Double-sided locations cannot enter the encounter deck. If a double-sided location would enter the discard pile, it is instead shuffled back into the Uncharted deck", dcce.uncharted).
 * A Grotto location on its Underwater side is routed the same way and lies Grotto side up in the deck ("cannot enter the encounter deck or discard pile for any reason", dcce.grotto-deck). */
export function unchartedRoute(state: ScenarioState, current: Pick<CardInstance, "code" | "other">, wanted: Destination): Destination {
  if (!isGrottoCard(state, current)) return wanted;
  return wanted.zone === "encounterDiscard" || wanted.zone === "encounterDeck" ? { zone: "unchartedDeck" } : wanted;
}

/** The card joins the bottom of the Uncharted deck, Lost Island side up and bare of tokens. A double-sided card of two catalog cards (the Grotto deck, dcce.grotto-deck) lies faceup on its Grotto side. */
export function joinUnchartedDeck(state: ScenarioState, id: string): ScenarioState {
  const uncharted = state.uncharted ?? { deck: [], codes: [] };
  const joined: ScenarioState = { ...state, uncharted: { ...uncharted, deck: uncharted.deck.includes(id) ? uncharted.deck : [...uncharted.deck, id] } };
  const card = state.cards[id];
  const twoCards = card?.other != null || uncharted.pairs?.[card?.code ?? ""] != null;
  // The Grotto deck lies Grotto side up: a card that shows its Underwater side turns back as it joins.
  const showsUnderwater = card?.other != null && !joined.uncharted?.codes.includes(card.code) && joined.uncharted?.codes.includes(card.other) === true;
  const sides = card && showsUnderwater ? { code: card.other, other: card.code } : {};
  return updateCard(joined, id, { ...sides, face: twoCards ? "up" : "B", progress: 0, damage: 0, resources: 0, exhausted: false, controller: null });
}

/** The Uncharted deck shuffled by the seed ("shuffled back into the Uncharted deck"). */
export function shuffleUnchartedDeck(state: ScenarioState): ScenarioState {
  if ((state.uncharted?.deck.length ?? 0) < 2) return state;
  return shufflePile(state, "unchartedDeck");
}

/** A double-sided location that reaches the victory display lies on its real side, face A: it was explored there, and only the Uncharted deck holds a card Lost Island side up. */
export function unchartedWon(state: ScenarioState, id: string): ScenarioState {
  const card = state.cards[id];
  return card?.face === "B" && state.uncharted?.codes.includes(card.code) ? updateCard(state, id, { face: "A" }) : state;
}
