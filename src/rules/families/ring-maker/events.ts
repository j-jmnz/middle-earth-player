// Rules: rr.after, rr.forced, rr.timing-of-ability-resolution (data/rules/entries.json); ledger lines 07021:A:1, 07022:A:1 (docs/scenarios/the-ring-maker/the-fords-of-isen.md, Readings).
// The Forced effects that hear what a When Revealed does (a draw, the last time counter taken off the stage) resolve after the whole When Revealed, not between its steps or between two players' turns in it.
import type { ScenarioState } from "../../core/state.ts";

// The records whose When Revealed holds the queued events back until it has resolved completely.
const HOLDS_EVENTS: ReadonlySet<string> = new Set(["07021:whenRevealed:1", "07022:whenRevealed:1"]);

/** A When Revealed that holds back the events it queues is still resolving: the queue waits. */
export function holdsEvents(state: ScenarioState): boolean {
  return state.stack.some((frame) => frame.frame === "whenRevealed" && frame.data.kind === "effect" && HOLDS_EVENTS.has(frame.data.effectId));
}
