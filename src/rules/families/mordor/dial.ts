// Rules: rr.threat-threat-dial, rr.attachment-cards, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 21065:A:1, 21065:A:2 (docs/scenarios/vengeance-of-mordor/the-temple-of-doom.md, Readings).
// The cards a player has facedown under his threat dial (Lost in the Dark): they lie facedown in the zone `under` of the side quest that put them there, still the player's cards (`owner`), in the order of the deck they came from (`stackedAt`, 0 on top).
import type { Instruction } from "../../../catalog/boundary.ts";

import { cardsUnder, moveCard } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats, updateCard } from "../../core/state.ts";
import { shuffleSeatDeck } from "../deck/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The cards under the dial of the seat that the source holds, the top one first. */
function underDial(state: ScenarioState, source: string | null, seat: number): string[] {
  if (source == null) return [];
  return cardsUnder(state, source)
    .filter((id) => state.cards[id]?.owner === seat && state.cards[id]?.stackedAt != null)
    .sort((left, right) => (state.cards[left]?.stackedAt ?? 0) - (state.cards[right]?.stackedAt ?? 0));
}

/** PutUnderDial: the top `count` cards of the actor's deck, without looking, go facedown under his threat dial (the source holds them). A deck of fewer cards puts all it has. */
export function putUnderDial(state: ScenarioState, instruction: Verb<"PutUnderDial">, focus: Focus): ScenarioState {
  const source = focus.sourceId;
  const seat = state.seats[focus.seat];
  if (source == null || !seat || seat.eliminated) return state;
  return seat.deck.slice(0, instruction.count).reduce((next, id, index) => updateCard(moveCard(next, id, { zone: "under", locationId: source }), id, { owner: focus.seat, stackedAt: index }), state);
}

/** DiscardUnderDial: the top card under the actor's threat dial goes to his discard pile. Nothing happens with none under it. */
export function discardUnderDial(state: ScenarioState, focus: Focus): ScenarioState {
  const top = underDial(state, focus.sourceId, focus.seat)[0];
  return top == null ? state : updateCard(moveCard(state, top, { zone: "discard", seat: focus.seat }), top, { owner: undefined, stackedAt: undefined });
}

/**
 * The settle sweep that ends the hold: "When this stage is defeated, each player shuffles all cards under his threat dial back into his deck" (21065:A:1). A side quest that is defeated lies in the victory display; the cards it holds under the dials
 * go back into their owners' decks, which are shuffled. A side quest that leaves play any other way leaves them where they are.
 */
export function returnUnderDialSweep(state: ScenarioState): ScenarioState {
  if (state.victory.length === 0) return state;
  const held = state.victory.filter((id) => cardsUnder(state, id).some((under) => state.cards[under]?.owner != null && state.cards[under]?.stackedAt != null));
  return held.reduce((next, quest) => livingSeats(next).reduce((current, seat) => {
    const cards = underDial(current, quest, seat);
    if (cards.length === 0) return current;
    const back = cards.reduce((inner, id) => updateCard(moveCard(inner, id, { zone: "deck", seat }), id, { owner: undefined, stackedAt: undefined }), current);
    return shuffleSeatDeck(back, seat);
  }, next), state);
}
