// Rules: rr.timing-of-ability-resolution, rr.triggering-condition (data/rules/entries.json).
import type { GameEvent } from "./frame-types.ts";
import type { ScenarioState } from "../core/state.ts";

// Code that cannot offer responses itself (it has no effect list) records the event here. settle announces the queue
// once no window is open (events.ts).
export function queueEvent(state: ScenarioState, event: GameEvent): ScenarioState {
  return { ...state, pendingEvents: [...(state.pendingEvents ?? []), event] };
}

// Every exit of a played event ends here: "After an event is played" is heard once the event's own effects are done
// (rr.forced, rr.response). The exits are the frame's end (canceled or not), an event with no Action to run, an event that
// goes on into an attack, an event that returns to its hand, and a Response event.
export function announceEventResolved(state: ScenarioState, seat: number, cardId: string): ScenarioState {
  return queueEvent(state, { trigger: "eventResolved", seat, cardId });
}
