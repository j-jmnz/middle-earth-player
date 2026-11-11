// Rules: rr.threat-threat-dial (data/rules/entries.json); ledger lines 145021:A:1, 145064:B:1. The two threat amounts the box's cards read, over the living players.
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";

/** "The threat of the player with the highest threat" (145064:B:1): the highest dial among the living players, 0 with none. */
export function highestThreat(state: ScenarioState): number {
  return Math.max(0, ...livingSeats(state).map((seat) => state.seats[seat]?.threat ?? 0));
}

/** "Each player with a threat of 35 or higher" counted (145021:A:1): the living players whose dial is at `min` or more. */
export function playersAtThreat(state: ScenarioState, min: number): number {
  return livingSeats(state).filter((seat) => (state.seats[seat]?.threat ?? 0) >= min).length;
}
