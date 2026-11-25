// Rules: rr.after, rr.forced, rr.timing-of-ability-resolution (data/rules/entries.json); ledger lines 07018:A:2, 07021:A:1, 07022:A:1, 07046:A:1 (docs/scenarios/the-ring-maker/the-fords-of-isen.md, Readings).
// The Forced effects that hear what a When Revealed or Forced effect with `holdsEvents` does (a draw, the last time counter taken off the stage) resolve after the whole effect, not between its steps or between two players' turns in it.
import type { ScenarioState } from "../../core/state.ts";

/** An effect whose record says `holdsEvents` (a When Revealed or Forced effect that draws or takes counters off) is still resolving: the queue waits. */
export function holdsEvents(state: ScenarioState): boolean {
  return state.stack.some((frame) => frame.data.kind === "effect" && frame.data.holdsEvents === true);
}
