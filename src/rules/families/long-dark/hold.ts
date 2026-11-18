// Rules: rr.forced, rr.active-location (data/rules/entries.json); ledger line 04092:A:1. Progress that would be placed on a location that holds `holdsProgress` (Twisting Passage) waits for its Forced effect: the placement is not made and `progressWouldBePlaced` is queued with the amount
// (progress.ts places it once the locate test is passed). One placement is one event: a quest phase's progress, a Cave Torch Action, any other effect each make their own test.
import { flagged, type ScenarioState } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";

/** The location holds `holdsProgress`: what would be placed on it is held back. */
export function holdsProgress(state: ScenarioState, id: string): boolean {
  return state.modifiers.length > 0 && flagged(state, id, "holdsProgress");
}

/** The placement of `amount` progress on the location is held: its record hears it with the amount. */
export function holdPlacement(state: ScenarioState, id: string, amount: number): ScenarioState {
  return amount > 0 ? queueEvent(state, { trigger: "progressWouldBePlaced", seat: null, cardId: id, amount }) : state;
}
