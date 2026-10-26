import type { Instruction } from "../../catalog/boundary.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";
import { livingSeats, withSeat } from "../state.ts";
import type { Focus } from "./index.ts";

// Rules: rr.player-elimination (data/rules/entries.json).
// The verbs src/catalog/families/sidequests.ts adds, for player side quests, contracts, encounter-keyword player cards and the victory display. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  void ctx;
  switch (instruction.verb) {
    case "EliminatePlayer":
      return eliminate(state, focus.seat, steps);
    default:
      return null;
  }
}

// "A player is eliminated from the game if ... a card effect forces their elimination" (rr.player-elimination): the seat leaves
// the game, and settle puts its cards in their owners' discard piles and returns its enemies to the staging area (clearEliminated).
// With no player left, the game is lost.
function eliminate(state: ScenarioState, seatIndex: number, steps: EngineStep[]): ScenarioState {
  const seat = state.seats[seatIndex];
  if (!seat || seat.eliminated) return state;
  steps.push({ kind: "eliminate", seat: seatIndex });
  const next = withSeat(state, seatIndex, { ...seat, eliminated: true });
  return livingSeats(next).length === 0 && !next.lost ? { ...next, lost: true, lossReason: "No seats remain" } : next;
}
