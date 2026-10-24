import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { offerResponses } from "./responses.ts";
import type { ScenarioState } from "./state.ts";
import { fireForced } from "./triggers.ts";

// Announces the oldest queued event (queue.ts): Responses are offered once the Forced effects have resolved, so the
// response frame goes down first and the Forced frames on top of it (rr.timing-of-ability-resolution).
export function drainEvents(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const [event, ...rest] = state.pendingEvents ?? [];
  if (!event) return state;
  const { pendingEvents: _queued, ...without } = state;
  const cleared: ScenarioState = rest.length > 0 ? { ...without, pendingEvents: rest } : without;
  return fireForced(offerResponses(cleared, event, ctx, steps), event, ctx, steps);
}
