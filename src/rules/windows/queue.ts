// Rules: rr.timing-of-ability-resolution, rr.triggering-condition (data/rules/entries.json).
import type { GameEvent } from "./frame-types.ts";
import type { ScenarioState } from "../core/state.ts";

// Code that cannot offer responses itself (it has no effect list) records the event here. settle announces the queue
// once no window is open (events.ts).
export function queueEvent(state: ScenarioState, event: GameEvent): ScenarioState {
  return { ...state, pendingEvents: [...(state.pendingEvents ?? []), event] };
}
