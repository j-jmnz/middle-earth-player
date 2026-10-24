import type { Effect } from "../catalog/boundary.ts";

import { holds } from "./conditions.ts";
import { pushDue } from "./delayed.ts";
import { pushEffectFrame } from "./effect-frames.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import type { CardInstance, Frame, GameEvent, ScenarioState } from "./state.ts";
import { inPlay } from "./state.ts";
import { patchTop, popFrame, pushFrame } from "./windows.ts";

type Found = { effect: Effect; instance: CardInstance };

function collect(state: ScenarioState, event: GameEvent, ctx: ReduceContext, timing: "forced" | "triggered"): Found[] {
  const found: Found[] = [];
  const actor = event.seat ?? state.firstPlayer;
  for (const instance of Object.values(state.cards)) {
    if (!inPlay(instance.zone)) continue;
    if (event.cardId != null && instance.id !== event.cardId) continue;
    for (const effect of ctx.effects) {
      if (effect.cardCode !== instance.code || effect.trigger !== event.trigger) continue;
      if (effect.timing !== timing) continue;
      const scope = { actor, sourceId: instance.id, returned: 0, phase: event.phase };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      found.push({ effect, instance });
    }
  }
  // Oldest card first.
  return found.sort(
    (left, right) =>
      left.instance.enteredPlay - right.instance.enteredPlay ||
      left.instance.id.localeCompare(right.instance.id, undefined, { numeric: true }),
  );
}

// Each matching effect gets its own forced frame. The oldest resolves first, so it is pushed last.
function pushFound(state: ScenarioState, found: readonly Found[], event: GameEvent, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const { effect, instance } of [...found].reverse()) {
    next = pushEffectFrame(
      next,
      {
        frame: "forced",
        sourceId: instance.id,
        actor: event.seat ?? state.firstPlayer,
        peril: state.perilSeat != null,
        effectId: effect.id,
        instructions: effect.instructions,
        cancel: effect.cancel
          ? { amount: effect.cancel.cost, sphere: effect.cancel.sphere ?? null, unless: effect.cancel.unless ?? null }
          : null,
        blockCancel: null,
      },
      steps,
    );
  }
  return next;
}

// Triggered effects resolve first. Forced effects on the same event are collected only after they have
// resolved, because a triggered effect can change which Forced effects apply.
export function fireForced(state: ScenarioState, event: GameEvent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (ctx.effects.length === 0) return state;
  const triggered = collect(state, event, ctx, "triggered");
  if (triggered.length === 0) return pushFound(state, collect(state, event, ctx, "forced"), event, steps);
  const marker = pushFrame(
    state,
    { frame: "event", cardId: null, seat: event.seat ?? state.firstPlayer, peril: false, data: { kind: "event", event } },
    steps,
  );
  return pushFound(marker, triggered, event, steps);
}

// The marker frame sits under the triggered effects. When they are done it pushes the Forced ones.
export function eventStep(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (frame.data.kind !== "event") throw new Error("Event frame lost its event");
  if (frame.step > 0) return popFrame(state, steps);
  const event = frame.data.event;
  return pushFound(patchTop(state, { step: 1 }), collect(state, event, ctx, "forced"), event, steps);
}

// Called whenever the phase may have moved. When it has, the phase that ended fires its Forced
// effects and its delayed effects. They resolve in this order: Forced at the end of the phase,
// Forced at the end of the round, delayed at the end of the phase, delayed at the end of the round.
export function crossBoundary(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.phase === state.boundaryPhase) return state;
  const ended = state.boundaryPhase;
  let next: ScenarioState = { ...state, boundaryPhase: state.phase };
  if (ctx.effects.length === 0 && next.delayed.length === 0) return next;
  next = pushDue(next, ended, "endOfRound", steps);
  next = pushDue(next, ended, "endOfPhase", steps);
  if (ended === "End of round") next = fireForced(next, { trigger: "endOfRound", seat: null, phase: ended }, ctx, steps);
  return fireForced(next, { trigger: "endOfPhase", seat: null, phase: ended }, ctx, steps);
}
