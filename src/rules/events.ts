import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { offerResponses } from "./responses.ts";
import type { ScenarioState } from "./state.ts";
import { fireForced } from "./triggers.ts";
import { pushFrame } from "./windows.ts";

// Whether an event may be announced now: no window is open, or one that only waits for the player's next step is (an action
// window, the next attack, the optional engagement, the travel choice), which the announcement closes and then gives back.
export function canAnnounce(state: ScenarioState): boolean {
  const kind = state.window?.kind;
  return kind === undefined || kind === "pass" || kind === "frameAction" || kind === "playerAttack" || kind === "optionalEngage" || kind === "travel";
}

// Announces the oldest queued event (queue.ts): Responses are offered once the Forced effects have resolved, so the
// response frame goes down first and the Forced frames on top of it (rr.timing-of-ability-resolution). An open action
// window waits under a resume frame and comes back when everything above it is done, with the same seat and passes.
export function drainEvents(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const [event, ...rest] = state.pendingEvents ?? [];
  if (!event) return state;
  const { pendingEvents: _queued, ...without } = state;
  const cleared: ScenarioState = rest.length > 0 ? { ...without, pendingEvents: rest } : without;
  const window = cleared.window;
  if (!window) return fireForced(offerResponses(cleared, event, ctx, steps), event, ctx, steps);
  const before = steps.length;
  const marker = pushFrame(
    { ...cleared, window: null },
    { frame: "event", cardId: null, seat: cleared.activeSeat, peril: false, data: { kind: "resume", window, seat: cleared.activeSeat, passed: cleared.passed } },
    steps,
  );
  const next = fireForced(offerResponses(marker, event, ctx, steps), event, ctx, steps);
  if (next.stack.length > marker.stack.length) return next;
  // Nobody hears it: the window stays as it was.
  steps.length = before;
  return cleared;
}
