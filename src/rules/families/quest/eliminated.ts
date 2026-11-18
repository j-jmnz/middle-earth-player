// Rules: rr.player-elimination, rr.forced (data/rules/entries.json); ledger lines 148003:B:2, 148004:B:2.
//
// "After a player is eliminated" (148003:B:2): every elimination the engine made (`eliminateSeat` records an `eliminate` step) is announced once, as `playerEliminated` about that seat, in a game with a card whose record hears it.
// The Forced effect of the stage in play resolves before the settle sweep discards the eliminated player's area, so a stage that player held is still in play to hear it.
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";
import { listens } from "../encounter/reveal.ts";

// The steps this call of settle has already looked at, per step list.
const SEEN = new WeakMap<object, number>();

export function announceEliminated(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const from = Math.min(SEEN.get(steps) ?? 0, steps.length);
  SEEN.set(steps, steps.length);
  if (steps.length === from || !listens(state, ctx, "playerEliminated")) return state;
  let next = state;
  for (const step of steps.slice(from)) if (step.kind === "eliminate") next = queueEvent(next, { trigger: "playerEliminated", seat: step.seat });
  return next;
}
