// Rules: dcce.corsair-deck, emce.evil-creatures-deck (data/rules/entries.json). A separate encounter deck with a discard pile of its own, read through its zones (piles.ts): the refill from the discard pile when the deck runs
// out. The Corsair deck (families/sea/corsair.ts) and the Evil Creatures deck (families/wilderland/decks.ts) are rows of piles.ts DECKS and share it; revealing the top card into play is families/encounter/named-decks.ts.
import { ruleCause } from "./cause.ts";
import type { EngineStep } from "./intents.ts";
import { type DeckZones, pileDealt, pileOf, shufflePile } from "./piles.ts";
import type { ScenarioState } from "./state.ts";
import { updateCard } from "./state.ts";
import { moveCard } from "./zones.ts";

/** The deck ran out: its discard pile is shuffled back into it, every card facedown ("shuffle the Evil Creatures discard pile back into the Evil Creatures deck", emce.evil-creatures-deck; "the Corsair
 * deck ... its discard pile is shuffled back into it at once", dcce.corsair-deck). A deck the game has not dealt, a deck with cards in it and a discard pile with none are left alone. */
export function refillDeck(state: ScenarioState, zones: DeckZones, steps: EngineStep[]): ScenarioState {
  if (!pileDealt(state, zones.deck) || zones.discard === null || pileOf(state, zones.deck).length > 0) return state;
  const discarded = pileOf(state, zones.discard);
  if (discarded.length === 0) return state;
  return reshuffleIntoDeck(state, zones, discarded, steps);
}

/** The cards go facedown into the deck's list, in the order given, and nothing is shuffled (the Setup that forms a deck shuffles it later). */
export function moveIntoDeck(state: ScenarioState, zones: DeckZones, ids: readonly string[]): ScenarioState {
  let next = state;
  for (const id of ids) next = updateCard(moveCard(next, id, { zone: zones.deck }), id, { face: "down" });
  return next;
}

/** The cards go facedown into the deck and the deck is shuffled with the game's seed, with a reshuffleDeck step that names the deck and the rule it cites. No card to move still shuffles and logs nothing. */
export function reshuffleIntoDeck(state: ScenarioState, zones: DeckZones, ids: readonly string[], steps: EngineStep[]): ScenarioState {
  const moved = moveIntoDeck(state, zones, [...ids]);
  if (ids.length > 0) steps.push({ kind: "reshuffleDeck", deck: zones.deck, count: ids.length, cause: ruleCause(REFILL_RULE[zones.deck] ?? "rr.running-out-of-cards") });
  return shufflePile(moved, zones.deck);
}

// The rule each deck's refill cites; the others run out as any deck does.
const REFILL_RULE: Readonly<Record<string, string>> = { corsairDeck: "dcce.corsair-deck", evilCreaturesDeck: "emce.evil-creatures-deck", ravenDeck: "rm.raven-deck" };
