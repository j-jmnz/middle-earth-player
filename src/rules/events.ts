// Rules: rr.timing-of-ability-resolution, rr.forced, rr.response, rr.triggering-condition (data/rules/entries.json).
import { noteEvent } from "./families/costs-pay.ts";
import { noteEngaged } from "./families/attack-events.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { offerResponses } from "./responses.ts";
import type { GameEvent, ScenarioState } from "./state.ts";
import { fireForced } from "./triggers.ts";
import { pushFrame } from "./windows.ts";
import { board } from "./families/sea-boarding.ts";

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

// The queued events right after `event` that belong to its occurrence, up to the first that does not.
function sameOccurrence(event: GameEvent, queued: readonly GameEvent[]): GameEvent[] {
  if (!event.occurrence) return [];
  const end = queued.findIndex((other) => other.occurrence !== event.occurrence);
  return queued.slice(0, end < 0 ? queued.length : end);
}

// An enemy that came out from under its location is told in the log before the Forced effects that hear it (Crushing Arm's attack, 12052:A:3); the event's `other` is the location (dcce.grapple).
function noteDetached(event: GameEvent, steps: EngineStep[]): void {
  if (event.trigger === "grappleDetached" && event.subject != null && event.other != null) steps.push({ kind: "detach", enemyId: event.subject, locationId: event.other });
}

// Announces the oldest queued event (queue.ts): Responses are offered once the Forced effects have resolved, so the
// response frame goes down first and the Forced frames on top of it (rr.timing-of-ability-resolution). An open action
// window waits under a resume frame and comes back when everything above it is done, with the same seat and passes.
export function drainEvents(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const [event, ...queued] = state.pendingEvents ?? [];
  if (!event) return state;
  // The events of one occurrence (each character of one commit) are announced together: their Forced effects fire, and
  // their Responses share one window in which they are used in any order (rr.triggering-condition).
  const together = sameOccurrence(event, queued);
  const rest = queued.slice(together.length);
  const { pendingEvents: _queued, ...without } = state;
  for (const each of [event, ...together]) noteDetached(each, steps);
  // An engagement is remembered for the round (families/attack-events.ts).
  const cleared: ScenarioState = [event, ...together].reduce(
    (current, each) => board(noteEngaged(noteEvent(current, each, ctx), each, ctx), each, ctx, steps),
    rest.length > 0 ? { ...without, pendingEvents: rest } : (without as ScenarioState),
  );
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
