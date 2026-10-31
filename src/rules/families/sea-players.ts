// Rules: dcce.last-player (data/rules/entries.json). The last player is the player sitting directly to the right of the first player; with only one
// player in the game that player is both the first and the last player. Players are seated in player order (clockwise), so the player to the right
// of the first is the one before them in that order.
import type { ScenarioState } from "../state.ts";
import { livingSeats } from "../state.ts";

/** The last player: the seat before the first player in the seating order, or the first player alone. */
export function lastPlayer(state: ScenarioState): number {
  const seats = livingSeats(state);
  return seats[seats.length - 1] ?? state.firstPlayer;
}
