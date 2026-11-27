// Rules: rr.forced, rr.triggered-ability, rr.in-play-and-out-of-play, rr.timing-of-ability-resolution (data/rules/entries.json).
import type { Effect } from "../../catalog/boundary.ts";
import { burnAtRoundEnd } from "../families/aflame/sweep.ts";
import { mireAtRefreshEnd } from "../families/mire/index.ts";
import { timeAtRefreshEnd } from "../families/angmar/time.ts";

import { holds } from "../interpret/conditions.ts";
import { aboutCard, hears, hearsFromAnywhere } from "./listen.ts";
import { effectsOfCard } from "../families/misc/text.ts";
import { isPlayerType, printedOf } from "../core/printed.ts";
import { syncConstants } from "../interpret/constants.ts";
import { pushDue } from "./delayed.ts";
import { effectCause } from "../core/cause.ts";
import { announceAbility } from "../families/deck/pressure.ts";
import { limitSpent, noteForcedUse } from "../player/usage.ts";
import { pushEffectFrame } from "../interpret/effect-frames.ts";
import { offerResponses } from "./responses.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import type { CardInstance, Frame, GameEvent, ScenarioState } from "../core/state.ts";
import { inPlay } from "../core/state.ts";
import { patchTop, popFrame, pushFrame } from "./windows.ts";
import { sideOf } from "../families/breaking/areas.ts";

type Found = { effect: Effect; instance: CardInstance };

// Whose a Forced effect is: a player card's, its controller's ("Forced: After ~ attacks, discard ~ or discard a card from your
// hand"); an encounter card's, the player the event happened to, or, when the event is no player's and the areas are isolated by a stage (Fog on the Barrow-downs, Flies and Spiders, not the captured areas of Escape from Mount Gram), the first player of the area the card lies in
// ("the resolution of each phase occurs as if only the player or players that share any given staging area are currently present in the game", hob.staging-area-creating).
function forcedActor(state: ScenarioState, instance: CardInstance, event: GameEvent, ctx: ReduceContext): number {
  const player = instance.controller != null && isPlayerType(printedOf(ctx.cards, instance.code));
  if (player) return instance.controller ?? state.firstPlayer;
  return event.seat ?? (state.isolated === true && state.capture == null ? (sideOf(state, instance) ?? state.firstPlayer) : state.firstPlayer);
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
      // A Forced effect an encounter card gains in a player's hand works from there (`fromHand`, 18026:A:1).
      if (!inPlay(instance.zone) && !leftItself && !hearsFromAnywhere(effect, instance, event) && !hearsFromSetAside(instance, event) && !(effect.fromHand === true && instance.zone === "hand") && !(effect.fromVictory === true && instance.zone === "victory")) continue;
      const owner = forcedActor(state, instance, event, ctx);
      const scope = { actor: owner, sourceId: instance.id, returned: 0, phase: event.phase, eventSeat: event.seat, ...(aboutCard(event) ? { subject: aboutCard(event) } : {}), ...(event.other ? { other: event.other } : {}), ...(event.trigger === "damaged" && event.amount != null ? { dealt: event.amount } : {}), ...(event.explored ? { explored: true } : {}), ...(event.byPlayerCard ? { byPlayerCard: true } : {}), ...(event.fromStaging ? { fromStaging: true } : {}), ...(event.exhaustedToDefend ? { exhaustedToDefend: true } : {}), ...(event.shadowBlank ? { shadowBlank: true } : {}) };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      // A Forced effect with a limit ("Limit once per game", 01130:A:4) does not fire once its uses are spent.
      if (effect.limit && limitSpent(state, effect, instance.id, owner)) continue;
      found.push({ effect, instance });
    }
  }
  // An `early` effect first, then the oldest card first.
  return found.sort(
    (left, right) =>
      Number(right.effect.early === true) - Number(left.effect.early === true) ||
      left.instance.enteredPlay - right.instance.enteredPlay ||
      left.instance.id.localeCompare(right.instance.id, undefined, { numeric: true }),
  );
}

// Each matching effect gets its own forced frame. The oldest resolves first, so it is pushed last.
function pushFound(state: ScenarioState, found: readonly Found[], event: GameEvent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const { effect, instance } of [...found].reverse()) {
    const actor = forcedActor(state, instance, event, ctx);
    next = announceAbility(noteForcedUse(next, effect, instance.id, actor), instance.id, actor, ctx);
    next = pushEffectFrame(
      next,
      {
        frame: "forced",
        sourceId: instance.id,
        actor,
        eventSeat: event.seat,
        ...(aboutCard(event) ? { subject: aboutCard(event) } : {}),
        ...(event.other ? { other: event.other } : {}),
        ...(event.participants ? { participants: event.participants } : {}),
        ...(event.trigger === "damageDealt" && event.cardId ? { dealt: event.amount ?? 0, hold: event.cardId } : {}),
        // Any other event's amount is the effect's X (the attachments an explored location had).
        ...(event.trigger !== "damageDealt" && event.amount != null ? { x: event.amount } : {}),
        ...((event.trigger === "damaged" || event.trigger === "damagedByAttack") && event.amount != null ? { dealt: event.amount } : {}),
        peril: state.perilSeat != null,
        effectId: effect.id,
        cause: effectCause(effect),
        ...(effect.holdsEvents ? { holdsEvents: true as const } : {}),
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
  // An additional instance of the phase in progress (phaseSeq, state.ts) ends the instance before it.
  const instance = state.phaseSeq ?? 0;
  if (state.phase === state.boundaryPhase && instance === (state.boundarySeq ?? 0)) return state;
  // The frames the refresh phase's first player token pass pushed (Gollum follows the token, rr.step-7-4) resolve before the phase's end (rr.step-7-5).
  if (state.boundaryPhase === "Refresh" && state.stack.length > 0) return state;
  const ended = state.boundaryPhase;
  const { lapsedModifiers, ...settled } = state;
  let next: ScenarioState = { ...settled, boundaryPhase: state.phase, ...(instance > 0 ? { boundarySeq: instance } : {}) };
  if (ctx.effects.length === 0 && next.delayed.length === 0) return next;
  // The Forced effects of the end of a phase or round are collected while the lasting effects that ended with it still hold ("until the end of the phase" includes that phase's own end).
  const lapsed = lapsedModifiers ?? [];
  const forcedAtEnd = (current: ScenarioState, event: GameEvent): ScenarioState => {
    if (lapsed.length === 0) return fireForced(current, event, ctx, steps);
    const fired = fireForced({ ...current, modifiers: [...current.modifiers, ...lapsed] }, event, ctx, steps);
    return { ...fired, modifiers: fired.modifiers.filter((modifier) => !lapsed.includes(modifier)) };
  };
  next = pushDue(next, ended, "endOfRound", steps);
  next = pushDue(next, ended, "endOfPhase", steps);
  // The effects delayed to the beginning of the travel phase (148004:B:2) come due as it begins.
  if (next.phase === "Travel" && next.delayed.length > 0) next = pushDue(next, ended, "beginningOfTravel", steps);
  // Mire X: each Mire location in the staging area gets a mire token as the refresh phase ends, before the Forced effects of that moment (families/mire/index.ts).
  if (ended === "Refresh") next = mireAtRefreshEnd(next, ctx, steps);
  // Time X: a frame that takes one time counter off each Time card goes down under the Forced effects of this moment, so it resolves after them (families/angmar/time.ts).
  if (ended === "Refresh") next = timeAtRefreshEnd(next, ctx, steps);
  if (ended === "End of round") {
    // Aflame X: each Aflame location in the staging area takes 1 damage (families/aflame/sweep.ts).
    next = burnAtRoundEnd(next, ctx, steps);
    // The Responses to the end of the round are offered once its Forced effects have resolved ("Response: At the end of each round, place 1
    // resource token here", 41050:A:3): their frame goes under the Forced ones.
    const event = { trigger: "endOfRound", seat: null, phase: ended } as const;
    next = forcedAtEnd(offerResponses(next, event, ctx, steps), event);
  }
  const fired = forcedAtEnd(next, { trigger: "endOfPhase", seat: null, phase: ended });
  // The effects of the end of the round resolve while the table is still in the End of round phase; the beginning of the round shows again once they are done (machine.ts, beginRound).
  return ended === "End of round" && fired.stack.length > state.stack.length && state.mode === "beginRound" ? { ...fired, phase: "End of round", boundaryPhase: "End of round" } : fired;
}
