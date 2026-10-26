// Rules: rr.timing-of-ability-resolution, rr.forced, rr.response, rr.triggering-condition (data/rules/entries.json).
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { offerResponses } from "./responses.ts";
import type { ScenarioState } from "./state.ts";
import { fireForced } from "./triggers.ts";
import { pushFrame } from "./windows.ts";

// Whether an event may be announced now. A Response is used immediately after its triggering condition has occurred and
// resolved (rr.response), so an event is announced over any window the framework opened since (an action window, an
// attack's defense, archery, the choice of an enemy, the next attack, the optional engagement, the travel choice): the
// announcement sets that window aside and gives it back. It waits while an effect or a revealed card is still resolving
// and asks for a choice or a Hide commit, while another event's Responses or cancel are being offered, and at setup.
export function canAnnounce(state: ScenarioState): boolean {
  const kind = state.window?.kind;
  return (
    kind === undefined ||
    kind === "pass" ||
    kind === "frameAction" ||
    kind === "playerAttack" ||
    kind === "optionalEngage" ||
    kind === "travel" ||
    kind === "defense" ||
    kind === "archery" ||
    kind === "chooseEnemy"
  );
}

// Announces the oldest queued event (queue.ts): Responses are offered once the Forced effects have resolved, so the
// response frame goes down first and the Forced frames on top of it (rr.timing-of-ability-resolution). An open action
// window waits under a resume frame and comes back when everything above it is done, with the same seat and passes.
export function drainEvents(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const [event, ...queued] = state.pendingEvents ?? [];
  if (!event) return state;
  // The events of one occurrence (each character of one commit) are announced together: their Forced effects fire, and
  // their Responses share one window in which they are used in any order (rr.triggering-condition).
  const together = event.occurrence ? queued.filter((other, index) => other.occurrence === event.occurrence && queued.slice(0, index).every((before) => before.occurrence === event.occurrence)) : [];
  const rest = queued.slice(together.length);
  const { pendingEvents: _queued, ...without } = state;
  const cleared: ScenarioState = rest.length > 0 ? { ...without, pendingEvents: rest } : without;
  // The Forced effects go on top of the response frame, the first event's last, so they resolve in the order of the events.
  const announce = (from: ScenarioState): ScenarioState =>
    [event, ...together].reverse().reduce((current, each) => fireForced(current, each, ctx, steps), offerResponses(from, event, ctx, steps, together));
  const window = cleared.window;
  if (!window) return announce(cleared);
  const before = steps.length;
  const marker = pushFrame(
    { ...cleared, window: null },
    { frame: "event", cardId: null, seat: cleared.activeSeat, peril: false, data: { kind: "resume", window, seat: cleared.activeSeat, passed: cleared.passed } },
    steps,
  );
  const next = announce(marker);
  if (next.stack.length > marker.stack.length) return next;
  // Nobody hears it: the window stays as it was.
  steps.length = before;
  return cleared;
}
