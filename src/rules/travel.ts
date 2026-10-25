// Rules: rr.travel, rr.active-location, rr.step-4-2, ltp.phase-4-travel, ltp.traveling-to-locations (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { effectCause } from "./cause.ts";
import { pushEffectFrame } from "./effect-frames.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { travelTo } from "./quest.ts";
import { offerResponses } from "./responses.ts";
import { travelBlocked } from "./restrictions.ts";
import type { ScenarioState } from "./state.ts";
import { markReached } from "./state.ts";
import { fireForced } from "./triggers.ts";

const TRAVEL_HERE: Instruction = { verb: "Travel", to: "self" };

// The players move to the location: it becomes the active location, the Travel phase ends, and
// Responses to the travel are offered. Forced effects on the location "after it becomes the active location" (141048:A:2)
// resolve first, so their frames go on top. Null if the location cannot be traveled to.
export function travelNow(state: ScenarioState, locationId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  if (travelBlocked(state, ctx, locationId)) return null;
  const traveled = travelTo(state, locationId, ctx.cards);
  if (!traveled) return null;
  // The travel opportunity is taken; the Travel phase ends after the window that follows it (rr.framework-steps, 4.2).
  const moved = traveled.mode === "travel" ? markReached(traveled, "traveled") : traveled;
  const offered = offerResponses(moved, { trigger: "traveled", seat: null, cardId: locationId }, ctx, steps);
  return fireForced(offered, { trigger: "becameActive", seat: null, cardId: locationId }, ctx, steps);
}

// The Travel intent. A location with a Travel effect makes the first player resolve it first, in a
// frame that can wait for a player, and the travel happens when the frame reaches its last step.
export function travelIntent(state: ScenarioState, locationId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const location = state.cards[locationId];
  if (!location) return state;
  const effects = ctx.effects.filter((effect) => effect.cardCode === location.code && effect.timing === "travel");
  const first = effects[0];
  if (!first) {
    const traveled = travelNow(state, locationId, ctx, steps);
    return traveled ? { ...traveled, window: null } : state;
  }
  return pushEffectFrame(
    { ...state, window: null },
    {
      frame: "travel",
      sourceId: locationId,
      actor: state.firstPlayer,
      peril: false,
      effectId: first.id,
      instructions: [...effects.flatMap((effect) => effect.instructions), TRAVEL_HERE],
      causes: effects.flatMap((effect) => effect.instructions.map(() => effectCause(effect))),
      cancel: null,
      blockCancel: null,
    },
    steps,
  );
}
