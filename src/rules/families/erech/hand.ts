// Rules: rr.first-player (data/rules/entries.json: the player on the left is the next seat in player order); ledger line 50324:A:1. "Each player must pass his hand to the player on his left": every hand goes to the next living seat at once, so each player ends with the hand of the player before him.
// A player alone in the game discards his hand instead ("discard your hand instead if you are the only player in the game"). A card passed stays its owner's, so it goes to its owner's discard pile.
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

/** PassHand: the hands move one seat on, in seat order; the only seat discards its hand. */
export function passHand(state: ScenarioState): ScenarioState {
  const seats = livingSeats(state);
  const hands = seats.map((seat) => ({ seat, ids: [...(state.seats[seat]?.hand ?? [])] }));
  let next = state;
  hands.forEach(({ seat, ids }, index) => {
    const to = hands.length === 1 ? seat : hands[(index + 1) % hands.length]!.seat;
    for (const id of ids) {
      const owner = next.cards[id]?.owner ?? next.cards[id]?.controller ?? seat;
      const moved = moveCard(next, id, hands.length === 1 ? { zone: "discard", seat: owner } : { zone: "hand", seat: to });
      next = updateCard(moved, id, { owner: owner === to ? undefined : owner });
    }
  });
  return next;
}
