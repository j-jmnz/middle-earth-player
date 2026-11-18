// Rules: rr.travel, rr.step-4-2 (data/rules/entries.json); ledger line 901605:A:1. A Travel effect that ends the travel without moving: the players have used their opportunity for the round, the travel itself (the last instruction of the travel frame) is not made.
import type { ScenarioState } from "../../core/state.ts";
import { travelTaken } from "../../quest/travel.ts";
import { effectData } from "../encounter/moves.ts";
import { patchTop } from "../../windows/windows.ts";

/** EndTravel: the Travel instruction still waiting in the running effect is dropped and the travel opportunity is taken. */
export function endTravel(state: ScenarioState): ScenarioState {
  const data = effectData(state);
  if (!data) return state;
  return travelTaken(patchTop(state, { data: { ...data, queue: data.queue.filter((item) => item.instruction.verb !== "Travel") } }));
}
