// Rules: dcce.uncharted, dcce.uncharted-deck (data/rules/entries.json). The Uncharted deck as a zone: moveCard (zones.ts) asks for the route of every card that would be discarded and
// for the deck's own detaching and attaching. Types and pure helpers only, so zones.ts can use them.
import type { CardInstance, ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import { shuffleIds } from "../seed.ts";
import type { Destination } from "../zones.ts";

/** Where a double-sided location that would be discarded, or put into the encounter deck, really goes: shuffled back into the Uncharted deck, Lost Island side faceup
 * ("Double-sided locations cannot enter the encounter deck. If a double-sided location would enter the discard pile, it is instead shuffled back into the Uncharted deck", dcce.uncharted). */
export function unchartedRoute(state: ScenarioState, current: Pick<CardInstance, "code">, wanted: Destination): Destination {
  if (!state.uncharted?.codes.includes(current.code)) return wanted;
  return wanted.zone === "encounterDiscard" || wanted.zone === "encounterDeck" ? { zone: "unchartedDeck" } : wanted;
}

/** The card leaves the Uncharted deck. */
export function leaveUnchartedDeck(state: ScenarioState, id: string): ScenarioState {
  const uncharted = state.uncharted;
  if (!uncharted || !uncharted.deck.includes(id)) return state;
  return { ...state, uncharted: { ...uncharted, deck: uncharted.deck.filter((other) => other !== id) } };
}

/** The card joins the bottom of the Uncharted deck, Lost Island side up and bare of tokens. */
export function joinUnchartedDeck(state: ScenarioState, id: string): ScenarioState {
  const uncharted = state.uncharted ?? { deck: [], codes: [] };
  const joined: ScenarioState = { ...state, uncharted: { ...uncharted, deck: uncharted.deck.includes(id) ? uncharted.deck : [...uncharted.deck, id] } };
  return updateCard(joined, id, { face: "B", progress: 0, damage: 0, resources: 0, exhausted: false, controller: null });
}

/** The Uncharted deck shuffled by the seed ("shuffled back into the Uncharted deck"). */
export function shuffleUnchartedDeck(state: ScenarioState): ScenarioState {
  const uncharted = state.uncharted;
  if (!uncharted || uncharted.deck.length < 2) return state;
  const shuffled = shuffleIds(uncharted.deck, state.seed, state.seedCursor);
  return { ...state, uncharted: { ...uncharted, deck: shuffled.ids }, seedCursor: shuffled.cursor };
}

/** A double-sided location that reaches the victory display lies on its real side, face A: it was explored there, and only the Uncharted deck holds a card Lost Island side up. */
export function unchartedWon(state: ScenarioState, id: string): ScenarioState {
  const card = state.cards[id];
  return card?.face === "B" && state.uncharted?.codes.includes(card.code) ? updateCard(state, id, { face: "A" }) : state;
}
