// Rules: rr.threat-threat-dial (data/rules/entries.json); ledger lines 145021:A:1, 145064:B:1. The two threat amounts the box's cards read, over the living players.
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";
import { highestThreatSeats, seatThreat } from "../play/hooks.ts";

/** "The threat of the player with the highest threat" (145064:B:1): the highest dial (under any threat ceiling) among the living players, 0 with none. */
export function highestThreat(state: ScenarioState): number {
  const [top] = highestThreatSeats(state);
  return top == null ? 0 : seatThreat(state, top);
}

/** "Each player with a threat of 35 or higher" counted (145021:A:1): the living players whose dial is at `min` or more. */
export function playersAtThreat(state: ScenarioState, min: number): number {
  return livingSeats(state).filter((seat) => seatThreat(state, seat) >= min).length;
}
