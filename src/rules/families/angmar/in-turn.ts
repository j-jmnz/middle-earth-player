// Rules: rr.first-player (data/rules/entries.json). A verb that asks each player in turn, the first player first (ChooseBoon, TradeDamageForResources): the seat whose turn it is, the instruction to ask it with, and the step that queues the next seat's turn once this one has answered.
import type { Cause } from "../../core/cause.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";
import { queueFront } from "../play/refs.ts";

export type SeatTurn<Verb extends Instruction> = {
  seat: number;
  cause: Cause;
  /** The instruction to ask this seat with: the verb carrying the seat. */
  asked: Verb;
  /** The state with the next living seat's turn queued in front of the effect's queue, or the state itself after the last seat. */
  goOn: (current: ScenarioState) => ScenarioState;
};

/** The turn of `instruction.seat` (the first living seat when the verb has none yet), or null when no seat is living. */
export function seatTurn<Verb extends Instruction & { seat?: number }>(state: ScenarioState, instruction: Verb, steps: EngineStep[]): SeatTurn<Verb> | null {
  const order = livingSeats(state);
  const seat = instruction.seat ?? order[0];
  if (seat == null) return null;
  const next = order[order.indexOf(seat) + 1];
  const cause = currentCause(steps, UNATTRIBUTED);
  const at = (turn: number): Verb => ({ ...instruction, seat: turn });
  return { seat, cause, asked: at(seat), goOn: (current) => (next != null ? queueFront(current, [{ instruction: at(next), seat: next, chosen: null, cause }]) : current) };
}
