// Rules: rr.attachment-cards, rr.drawing-cards, rr.reveal (data/rules/entries.json); ledger lines 01105:A:1 and 01105:A:2.
//
// Iron Shackles: an encounter card attached to the top of a player's deck, in play, controlled by nobody. "The next time a player would draw
// 1 or more cards from attached deck, discard Iron Shackles instead": the draw does not happen, and the card is discarded. The card is in
// the seat's `deckAttached` list; nothing else knows it is there.
import type { ScenarioState } from "../state.ts";
import { updateCard, withSeat } from "../state.ts";
import { moveCard, unhost } from "../zones.ts";
import type { Focus } from "./index.ts";

// AttachToDeck: the source card goes onto the first player's deck.
export function attachToDeck(state: ScenarioState, focus: Focus): ScenarioState {
  const id = focus.sourceId;
  const seat = state.seats[state.firstPlayer];
  if (!id || !state.cards[id] || !seat) return state;
  // A shadow card or a guard that is attached leaves the card it was dealt to or guarded: it has no host, and that card forgets it
  // (a guarded objective with Iron Shackles gone to the deck is free of encounters, rr.guarded).
  const moved = updateCard(unhost(moveCard(state, id, { zone: "attached" }), id), id, { face: "up", host: null });
  return withSeat(moved, state.firstPlayer, { ...seat, deckAttached: [...(seat.deckAttached ?? []), id] });
}

// The draw of `count` cards: replaced as a whole by discarding the oldest Iron Shackles on the seat's deck, if any (a draw of nothing is
// not a draw). Otherwise `drawOne` draws them one after the other (the caller has checked that the seat can draw).
export function drawCards(state: ScenarioState, seat: number, count: number, drawOne: (state: ScenarioState) => ScenarioState): ScenarioState {
  if (count <= 0) return state;
  const replaced = shackled(state, seat);
  if (replaced) return replaced;
  let next = state;
  for (let draw = 0; draw < count; draw += 1) next = drawOne(next);
  return next;
}

// The state after Iron Shackles replaced a draw from this seat's deck, or null when none is attached to it.
export function shackled(state: ScenarioState, seat: number): ScenarioState | null {
  const held = state.seats[seat]?.deckAttached;
  const id = held?.[0];
  const current = state.seats[seat];
  if (!held || !id || !current) return null;
  const rest = held.slice(1);
  const { deckAttached: _old, ...bare } = current;
  const unlisted = withSeat(state, seat, rest.length > 0 ? { ...bare, deckAttached: rest } : bare);
  return updateCard(moveCard(unlisted, id, { zone: "encounterDiscard" }), id, { face: "up" });
}
