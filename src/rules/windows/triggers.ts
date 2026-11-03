// Rules: rr.forced, rr.triggered-ability, rr.in-play-and-out-of-play, rr.timing-of-ability-resolution (data/rules/entries.json).
import type { Effect } from "../../catalog/boundary.ts";
import { burnAtRoundEnd } from "../families/aflame/sweep.ts";

import { holds } from "../interpret/conditions.ts";
import { aboutCard, hears, hearsFromAnywhere } from "./listen.ts";
import { effectsOfCard } from "../families/misc/text.ts";
import { isPlayerType, printedOf } from "../core/printed.ts";
import { syncConstants } from "../interpret/constants.ts";
import { pushDue } from "./delayed.ts";
import { effectCause } from "../core/cause.ts";
import { limitSpent, noteForcedUse } from "../player/usage.ts";
import { pushEffectFrame } from "../interpret/effect-frames.ts";
import { offerResponses } from "./responses.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import type { CardInstance, Frame, GameEvent, ScenarioState } from "../core/state.ts";
import { inPlay } from "../core/state.ts";
import { patchTop, popFrame, pushFrame } from "./windows.ts";

type Found = { effect: Effect; instance: CardInstance };

// Whose a Forced effect is: a player card's, its controller's ("Forced: After ~ attacks, discard ~ or discard a card from your
// hand"); an encounter card's, the player the event happened to.
function forcedActor(state: ScenarioState, instance: CardInstance, event: GameEvent, ctx: ReduceContext): number {
  const player = instance.controller != null && isPlayerType(printedOf(ctx.cards, instance.code));
  return player ? (instance.controller ?? state.firstPlayer) : (event.seat ?? state.firstPlayer);
}

// A card set aside faceup next to the quest deck hears that the prisoner was rescued: its ability says it works from out of play
// ("move Nazgûl of Dol Guldur into the staging area", 01102:A:2; rr.in-play-and-out-of-play).
function hearsFromSetAside(instance: CardInstance, event: GameEvent): boolean {
  return event.trigger === "prisonerRescued" && instance.zone === "setAside";
}

function collect(state: ScenarioState, event: GameEvent, ctx: ReduceContext, timing: "forced" | "triggered"): Found[] {
  const found: Found[] = [];
  for (const instance of Object.values(state.cards)) {
    // "After this location leaves play" (141045:A:2, 141049:A:2) is heard by the card that left: an ability that requires
    // its card to be out of play resolves from there (rr.in-play-and-out-of-play).
    const leftItself = event.trigger === "leftPlay" && event.cardId === instance.id;
    for (const effect of effectsOfCard(state, ctx, instance)) {
      if (effect.timing !== timing || !hears(state, effect, instance, event, ctx)) continue;
      if (!inPlay(instance.zone) && !leftItself && !hearsFromAnywhere(effect, instance, event) && !hearsFromSetAside(instance, event)) continue;
      const owner = forcedActor(state, instance, event, ctx);
      const scope = { actor: owner, sourceId: instance.id, returned: 0, phase: event.phase, eventSeat: event.seat, ...(aboutCard(event) ? { subject: aboutCard(event) } : {}), ...(event.other ? { other: event.other } : {}), ...(event.trigger === "damaged" && event.amount != null ? { dealt: event.amount } : {}), ...(event.explored ? { explored: true } : {}), ...(event.byPlayerCard ? { byPlayerCard: true } : {}), ...(event.fromStaging ? { fromStaging: true } : {}) };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      // A Forced effect with a limit ("Limit once per game", 01130:A:4) does not fire once its uses are spent.
      if (effect.limit && limitSpent(state, effect, instance.id, owner)) continue;
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
function pushFound(state: ScenarioState, found: readonly Found[], event: GameEvent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const { effect, instance } of [...found].reverse()) {
    next = noteForcedUse(next, effect, instance.id, forcedActor(state, instance, event, ctx));
    next = pushEffectFrame(
      next,
      {
        frame: "forced",
        sourceId: instance.id,
        actor: forcedActor(state, instance, event, ctx),
        eventSeat: event.seat,
        ...(aboutCard(event) ? { subject: aboutCard(event) } : {}),
        ...(event.other ? { other: event.other } : {}),
        ...(event.trigger === "damageDealt" && event.cardId ? { dealt: event.amount ?? 0, hold: event.cardId } : {}),
        // Any other event's amount is the effect's X (the attachments an explored location had).
        ...(event.trigger !== "damageDealt" && event.amount != null ? { x: event.amount } : {}),
        ...((event.trigger === "damaged" || event.trigger === "damagedByAttack") && event.amount != null ? { dealt: event.amount } : {}),
        peril: state.perilSeat != null,
        effectId: effect.id,
        cause: effectCause(effect),
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
  if (triggered.length === 0) return pushFound(state, collect(state, event, ctx, "forced"), event, ctx, steps);
  const marker = pushFrame(
    state,
    { frame: "event", cardId: null, seat: event.seat ?? state.firstPlayer, peril: false, data: { kind: "event", event } },
    steps,
  );
  return pushFound(marker, triggered, event, ctx, steps);
}

// The marker frame sits under the triggered effects. When they are done it pushes the Forced ones.
export function eventStep(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (frame.data.kind !== "event") throw new Error("Event frame lost its event");
  if (frame.step > 0) return popFrame(state, steps);
  const event = frame.data.event;
  return pushFound(patchTop(state, { step: 1 }), collect(state, event, ctx, "forced"), event, ctx, steps);
}

// Called whenever the phase may have moved. When it has, the phase that ended fires its Forced
// effects and its delayed effects. They resolve in this order: Forced at the end of the phase,
// Forced at the end of the round, delayed at the end of the phase, delayed at the end of the round.
export function crossBoundary(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // Constant effects follow the cards in play, so they are brought up to date before anything else runs.
  const synced = syncConstants(state, ctx);
  if (synced !== state) return synced;
  if (state.phase === state.boundaryPhase) return state;
  const ended = state.boundaryPhase;
  let next: ScenarioState = { ...state, boundaryPhase: state.phase };
  if (ctx.effects.length === 0 && next.delayed.length === 0) return next;
  next = pushDue(next, ended, "endOfRound", steps);
  next = pushDue(next, ended, "endOfPhase", steps);
  if (ended === "End of round") {
    // Aflame X: each Aflame location in the staging area takes 1 damage (families/aflame/sweep.ts).
    next = burnAtRoundEnd(next, ctx, steps);
    // The Responses to the end of the round are offered once its Forced effects have resolved ("Response: At the end of each round, place 1
    // resource token here", 41050:A:3): their frame goes under the Forced ones.
    const event = { trigger: "endOfRound", seat: null, phase: ended } as const;
    next = fireForced(offerResponses(next, event, ctx, steps), event, ctx, steps);
  }
  return fireForced(next, { trigger: "endOfPhase", seat: null, phase: ended }, ctx, steps);
}
