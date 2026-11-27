// Rules: rr.forced, rr.triggered-ability, rr.in-play-and-out-of-play, rr.timing-of-ability-resolution (data/rules/entries.json).
import type { Effect } from "../../catalog/boundary.ts";
import { burnAtRoundEnd } from "../families/aflame/sweep.ts";
import { mireAtRefreshEnd } from "../families/mire/index.ts";
import { timeAtRefreshEnd } from "../families/angmar/time.ts";

import { holds } from "../interpret/conditions.ts";
import { aboutCard, effectById, hears, hearsFromAnywhere } from "./listen.ts";
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

export type Found = { effect: Effect; instance: CardInstance };

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
  // The oldest card first.
  return found.sort((left, right) => left.instance.enteredPlay - right.instance.enteredPlay || left.instance.id.localeCompare(right.instance.id, undefined, { numeric: true }));
}

// The Forced effects of one event are initiated in the order the first player chooses (rr.forced: "the first player determines the order in which the abilities initiate, regardless of who controls the cards bearing those
// abilities"; "each forced ability must resolve as completely as possible before the next ... may initiate"). With effects that differ on two or more cards a frame asks the first player (OrderForced); otherwise the
// default order stands: the oldest card first.
function pushForced(state: ScenarioState, found: readonly Found[], event: GameEvent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (found.length === 0 || !forcedOrderDiffers(found)) return pushFound(state, found, event, ctx, steps);
  // The frame is named for the effect that may initiate first (what the cards print holds the others back).
  const first = found.find((one) => one.instance.id === orderOptions(found)[0]) ?? found[0];
  if (!first) return state;
  // An effect with a limit spends its use as it triggers, so an effect that waits for the order cannot fire a second time meanwhile ("Limit once per round").
  const spent = found.reduce((current, one) => noteForcedUse(current, one.effect, one.instance.id, forcedActor(state, one.instance, event, ctx)), state);
  return pushEffectFrame(
    spent,
    {
      frame: "ResolveEffect",
      sourceId: null,
      actor: state.firstPlayer,
      eventSeat: event.seat,
      peril: state.perilSeat != null,
      effectId: first.effect.id,
      orderEvent: event,
      instructions: [{ verb: "OrderForced", entries: found.map((one) => ({ effectId: one.effect.id, sourceId: one.instance.id })), total: found.length }],
      cancel: null,
      blockCancel: null,
    },
    steps,
  );
}

// The effects the card `sourceId` bears among `entries`, as one string: two cards with the same string change nothing by their order.
function bornEffects(entries: readonly { effectId: string; sourceId: string }[], sourceId: string): string {
  return entries.filter((entry) => entry.sourceId === sourceId).map((entry) => entry.effectId).join(",");
}

const entriesOf = (found: readonly Found[]): { effectId: string; sourceId: string }[] => found.map((one) => ({ effectId: one.effect.id, sourceId: one.instance.id }));

// Two or more cards bear effects, and not all of them the same effects (two copies of one card change nothing by their order).
function forcedOrderDiffers(found: readonly Found[]): boolean {
  const entries = entriesOf(found);
  return new Set(found.map((one) => bornEffects(entries, one.instance.id))).size >= 2;
}

/** How many cards among the `entries` print the same card as `sourceId` and bear the same effects: the copies a row of the order window stands for. */
export function copiesInOrder(entries: readonly { effectId: string; sourceId: string }[], codeOf: (sourceId: string) => string | undefined, sourceId: string): number {
  const sign = bornEffects(entries, sourceId);
  return new Set(entries.filter((entry) => codeOf(entry.sourceId) === codeOf(sourceId) && bornEffects(entries, entry.sourceId) === sign).map((entry) => entry.sourceId)).size;
}

/**
 * The cards whose effects may initiate next, one card for each set of effects, in the default order. What the cards print holds back some: an effect printed "After resolving the Forced
 * effect on X" (`afterForcedOn`) waits while a card with that code still has effects to initiate (docs/scenarios/standalone-scenarios/attack-on-dol-guldur.md, Attack on Dol Guldur, reading 5).
 */
export function orderOptions(found: readonly Found[]): string[] {
  const waiting = (one: Found): boolean => {
    const codes = [one.effect.afterForcedOn ?? []].flat();
    return found.some((other) => other.instance.id !== one.instance.id && codes.includes(other.instance.code));
  };
  const free = found.filter((one) => !waiting(one));
  const ready = free.length > 0 ? free : found;
  const entries = entriesOf(found);
  const seen = new Set<string>();
  const options: string[] = [];
  for (const one of ready) {
    const sign = bornEffects(entries, one.instance.id);
    if (seen.has(sign) || options.includes(one.instance.id)) continue;
    seen.add(sign);
    options.push(one.instance.id);
  }
  return options;
}

/** The effects OrderForced still has to initiate, as the effects and the cards that bear them (an entry whose card or effect is gone is left out). */
export function foundOf(state: ScenarioState, ctx: ReduceContext, entries: readonly { effectId: string; sourceId: string }[]): Found[] {
  return entries.flatMap((entry) => {
    const effect = effectById(ctx, entry.effectId);
    const instance = state.cards[entry.sourceId];
    return effect && instance ? [{ effect, instance }] : [];
  });
}

// Each matching effect gets its own forced frame. The oldest resolves first, so it is pushed last. The uses of the effects with a limit are spent as they trigger.
export function pushFound(state: ScenarioState, found: readonly Found[], event: GameEvent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  return pushFrames(state, found, event, ctx, steps, true);
}

/** pushFound for effects whose limit use was already spent when they triggered (pushForced), so none is spent again. */
export function pushCounted(state: ScenarioState, found: readonly Found[], event: GameEvent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  return pushFrames(state, found, event, ctx, steps, false);
}

function pushFrames(state: ScenarioState, found: readonly Found[], event: GameEvent, ctx: ReduceContext, steps: EngineStep[], spend: boolean): ScenarioState {
  let next = state;
  for (const { effect, instance } of [...found].reverse()) {
    const actor = forcedActor(state, instance, event, ctx);
    next = announceAbility(spend ? noteForcedUse(next, effect, instance.id, actor) : next, instance.id, actor, ctx);
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
  if (triggered.length === 0) return pushForced(state, collect(state, event, ctx, "forced"), event, ctx, steps);
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
  return pushForced(patchTop(state, { step: 1 }), collect(state, event, ctx, "forced"), event, ctx, steps);
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
  // The Responses offered at the same end hear them too ("Response: At the end of each round", 41050:A:3).
  const holdingLapsed = (current: ScenarioState, run: (held: ScenarioState) => ScenarioState): ScenarioState => {
    if (lapsed.length === 0) return run(current);
    const done = run({ ...current, modifiers: [...current.modifiers, ...lapsed] });
    return { ...done, modifiers: done.modifiers.filter((modifier) => !lapsed.includes(modifier)) };
  };
  const forcedAtEnd = (current: ScenarioState, event: GameEvent): ScenarioState => holdingLapsed(current, (held) => fireForced(held, event, ctx, steps));
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
    next = forcedAtEnd(holdingLapsed(next, (held) => offerResponses(held, event, ctx, steps)), event);
  }
  const fired = forcedAtEnd(next, { trigger: "endOfPhase", seat: null, phase: ended });
  // The effects of the end of the round resolve while the table is still in the End of round phase; the beginning of the round shows again once they are done (machine.ts, beginRound).
  return ended === "End of round" && fired.stack.length > state.stack.length && state.mode === "beginRound" ? { ...fired, phase: "End of round", boundaryPhase: "End of round" } : fired;
}
