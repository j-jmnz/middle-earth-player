// Rules: rr.travel, rr.active-location, rr.step-4-2, ltp.phase-4-travel, ltp.traveling-to-locations (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { effectCause, ruleCause } from "./cause.ts";
import { pushEffectFrame } from "./effect-frames.ts";
import { textBlank } from "./families/attachments/hold.ts";
import { recordsOfFace } from "./families/dreamchaser/faces.ts";
import { grantedTravel } from "./families/grapple/travel.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { travelTo } from "./quest.ts";
import { offerResponses } from "./responses.ts";
import { travelBlocked } from "./restrictions.ts";
import type { ScenarioState } from "./state.ts";
import { withView } from "./families/breaking/areas.ts";
import { livingSeats, markReached } from "./state.ts";
import { fireForced } from "./triggers.ts";

// A seat's travel opportunity is taken or declined. Stages that are separate give each living seat one in player order, so the Travel phase's opportunity is
// over only when the last has had its own (mec109.multiple-staging-areas); with one staging area it is over at once.
export function travelTaken(state: ScenarioState): ScenarioState {
  if (state.separate && livingSeats(state).some((seat) => !(state.travelDone ?? []).includes(seat))) return state;
  const { travelDone: _done, ...rest } = state;
  return markReached(rest, "traveled");
}

const TRAVEL_HERE: Instruction = { verb: "Travel", to: "self" };

// The players move to the location: it becomes the active location, the Travel phase ends, and
// Responses to the travel are offered. Forced effects on the location "after it becomes the active location" (141048:A:2)
// resolve first, so their frames go on top. Null if the location cannot be traveled to.
export function travelNow(state: ScenarioState, locationId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  if (travelBlocked(state, ctx, locationId)) return null;
  const traveled = travelTo(state, locationId, ctx.cards, steps);
  if (!traveled) return null;
  // The travel opportunity is taken; the Travel phase ends after the window that follows it (rr.framework-steps, 4.2).
  const moved = traveled.mode === "travel" ? travelTaken(traveled) : traveled;
  const offered = offerResponses(moved, { trigger: "traveled", seat: null, cardId: locationId }, ctx, steps);
  // A Forced effect "After travelling to ~" (01107:A:1) resolves before the Responses, as every Forced effect does (rr.forced).
  const forced = fireForced(offered, { trigger: "traveled", seat: null, cardId: locationId }, ctx, steps);
  // The Responses "after it becomes the active location" (12026:A:2) are offered once its Forced effects (141048:A:2) have resolved.
  const became = { trigger: "becameActive", seat: null, cardId: locationId } as const;
  return fireForced(offerResponses(forced, became, ctx, steps), became, ctx, steps);
}

// The Travel intent. A location with a Travel effect makes the first player resolve it first, in a
// frame that can wait for a player, and the travel happens when the frame reaches its last step.
export function travelIntent(state: ScenarioState, locationId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const location = state.cards[locationId];
  if (!location) return state;
  // A location whose printed text box is blank has no Travel effect (rr.blank).
  // Only the Travel effect of the side the location shows works (12068:B:3, families/dreamchaser/faces.ts).
  const effects = textBlank(state, locationId) ? [] : recordsOfFace(location, ctx.effects.filter((effect) => effect.cardCode === location.code)).filter((effect) => effect.timing === "travel");
  const first = effects[0];
  // A Travel cost another card gave the location comes after its own (families/grapple/travel.ts).
  const granted = grantedTravel(state, locationId);
  if (!first && granted.length === 0) {
    // Once stages are separate the seat travels to its own active location (families/breaking/areas.ts).
    let refused = false;
    const traveled = withView(state, state.separate ? state.activeSeat : undefined, (view) => {
      const moved = travelNow(view, locationId, ctx, steps);
      refused = moved == null;
      return moved ?? view;
    });
    return refused ? state : { ...traveled, window: null };
  }
  return pushEffectFrame(
    { ...state, window: null },
    {
      frame: "travel",
      sourceId: locationId,
      // The seat that travels, once stages are separate; the first player otherwise (rr.first-player).
      actor: state.separate ? state.activeSeat : state.firstPlayer,
      peril: false,
      effectId: first?.id ?? `${location.code}:travel`,
      instructions: [...effects.flatMap((effect) => effect.instructions), ...granted, TRAVEL_HERE],
      causes: [...effects.flatMap((effect) => effect.instructions.map(() => effectCause(effect))), ...granted.map(() => ruleCause("rr.travel"))],
      cancel: null,
      blockCancel: null,
    },
    steps,
  );
}
