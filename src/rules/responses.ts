// Rules: rr.response, mec109.peril (data/rules/entries.json).
import { costOfKind } from "../catalog/costs.ts";

import { holds } from "./conditions.ts";
import { triggerHears } from "./families/play-hooks.ts";
import { aboutCard, effectsOf, hears, hearsFromAnywhere } from "./listen.ts";
import { playableFromDeck } from "./deck-play.ts";
import { effectCause } from "./cause.ts";
import { pushEffectFrame } from "./effect-frames.ts";
import type { EngineStep, LegalIntent, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import type { GameEvent, ResponseOffer, ScenarioState } from "./state.ts";
import { inPlay, livingSeats, perilLock } from "./state.ts";
import { payUsage, controllerSeat, usable, usageReason } from "./usage.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "./windows.ts";

type TriggerIntent = Extract<PlayerIntent, { type: "Trigger" }>;

// Responses are optional. After an event, each Response that applies is offered to the seat that
// controls its card (the first player, for an encounter or quest card). A seat may use it or pass.
function collect(state: ScenarioState, event: GameEvent, ctx: ReduceContext): ResponseOffer[] {
  const offers: ResponseOffer[] = [];
  const order = livingSeats(state);
  // Only the cards with a Response to this trigger are sorted and looked at.
  const cards = Object.values(state.cards)
    .filter((instance) => effectsOf(ctx, instance.code).some((effect) => effect.timing === "response" && triggerHears(effect.trigger, event.trigger)))
    .sort((left, right) => left.enteredPlay - right.enteredPlay || left.id.localeCompare(right.id, undefined, { numeric: true }));
  for (const instance of cards) {
    // An event about one card is heard by that card even after it has left play.
    // An event card in the hand hears every event; a card in play hears the events about itself or about the table. The
    // top card of a deck its controller may play as if it were in the hand (Gandalf, 142002) is in the hand for this.
    const inHand = instance.zone === "hand" || (instance.zone === "deck" && instance.controller != null && playableFromDeck(state, instance.id, instance.controller, ctx));
    const records = effectsOf(ctx, instance.code).filter((effect) => effect.timing === "response" && hears(state, effect, instance, event, ctx));
    if (records.length === 0) continue;
    // A card nobody controls (a quest or encounter card) is answered by the first player, or, while a Peril card's
    // staging resolves, by the revealing player: the other players are the ones Peril keeps out (mec109.peril).
    const locked = perilLock(state);
    const seat = instance.controller == null && locked != null ? locked : controllerSeat(state, instance);
    // Peril: the other seats cannot trigger Responses while the card resolves.
    if (!order.includes(seat) || (locked != null && seat !== locked)) continue;
    for (const effect of records) {
      // Only an event used from the hand has a Response there; any other listens in play, or from wherever its card went
      // for an event about itself ("After ~ leaves play").
      const fromHand = costOfKind(effect, "playEvent") != null || effect.fromHand === true;
      if (fromHand ? !inHand : !(inPlay(instance.zone) || hearsFromAnywhere(effect, instance, event))) continue;
      const scope = { actor: seat, sourceId: instance.id, returned: 0, eventSeat: event.seat, ...(aboutCard(event) ? { subject: aboutCard(event) } : {}), ...(event.explored ? { explored: true } : {}) };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      // "Any player may trigger this response": each seat is offered it, the controller first.
      const seats = effect.anyPlayer ? [seat, ...order.filter((other) => other !== seat)] : [seat];
      for (const offered of seats) if (usable(state, effect, instance.id, offered, ctx)) offers.push({ cardId: instance.id, effectId: effect.id, seat: offered });
    }
  }
  return offers.sort((left, right) => order.indexOf(left.seat) - order.indexOf(right.seat));
}

export function offerResponses(state: ScenarioState, event: GameEvent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (ctx.effects.length === 0) return state;
  const offers = collect(state, event, ctx);
  const first = offers[0];
  if (!first) return state;
  return pushFrame(
    state,
    { frame: "response", cardId: event.cardId ?? null, seat: first.seat, peril: false, data: { kind: "responses", event, offers } },
    steps,
  );
}

function offersOf(state: ScenarioState): readonly ResponseOffer[] {
  const data = topFrame(state)?.data;
  return data?.kind === "responses" ? data.offers : [];
}

// The response frame opens a window for the first seat that still has an offer, or pops.
export function responseStep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const frame = topFrame(state);
  if (frame?.data.kind !== "responses") return state;
  const live = frame.data.offers.filter((offer) => {
    const effect = ctx.effects.find((entry) => entry.id === offer.effectId);
    return effect != null && usable(state, effect, offer.cardId, offer.seat, ctx);
  });
  const first = live[0];
  const trimmed = patchTop(state, { data: { ...frame.data, offers: live } });
  if (!first) return popFrame({ ...trimmed, window: null }, steps);
  return { ...trimmed, window: { kind: "response", seat: first.seat }, activeSeat: first.seat, passed: [] };
}

export function responseIntents(state: ScenarioState): LegalIntent[] {
  if (state.window?.kind !== "response") return [];
  const seat = state.window.seat;
  return offersOf(state)
    .filter((offer) => offer.seat === seat)
    .map((offer): LegalIntent => ({ type: "Trigger", cardId: offer.cardId, effectId: offer.effectId }));
}

export function responseReason(state: ScenarioState, intent: TriggerIntent, ctx: ReduceContext): string | null {
  if (state.window?.kind !== "response") return "That intent is not legal in this window";
  const seat = state.window.seat;
  const offer = offersOf(state).find((entry) => entry.cardId === intent.cardId && entry.effectId === intent.effectId && entry.seat === seat);
  const effect = offer ? ctx.effects.find((entry) => entry.id === offer.effectId) : undefined;
  if (!offer || !effect) return "That effect cannot be triggered";
  return usageReason(state, effect, offer.cardId, seat, intent.payments ?? [], ctx);
}

// The cost is paid, the offer is spent, and the effect resolves in a frame above the response frame.
// When it pops, the response frame offers whatever is left.
export function applyResponse(state: ScenarioState, intent: TriggerIntent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const frame = topFrame(state);
  const effect = ctx.effects.find((entry) => entry.id === intent.effectId);
  if (frame?.data.kind !== "responses" || !effect || state.window?.kind !== "response") return state;
  const seat = state.window.seat;
  const left = frame.data.offers.filter((offer) => !(offer.cardId === intent.cardId && offer.effectId === intent.effectId));
  // The seat answering pays: its threat for a raiseThreat cost, its deck for discardDeckTop, its use of a per-player limit.
  const paid = payUsage(patchTop(state, { data: { ...frame.data, offers: left } }), effect, intent.cardId, intent.payments ?? [], ctx, steps, seat);
  return pushEffectFrame(
    { ...paid, window: null },
    {
      frame: "ResolveEffect",
      sourceId: intent.cardId,
      actor: seat,
      peril: false,
      effectId: effect.id,
      instructions: effect.instructions,
      cancel: null,
      blockCancel: null,
      cause: effectCause(effect),
      eventSeat: frame.data.event.seat,
      ...(frame.data.event.participants ? { participants: frame.data.event.participants } : {}),
      ...(aboutCard(frame.data.event) ? { subject: aboutCard(frame.data.event) } : {}),
      ...(frame.data.event.other ? { other: frame.data.event.other } : {}),
      // A Response to damage just dealt resolves before the damaged card can be destroyed (rr.cancel).
      ...(frame.data.event.trigger === "damageDealt" && frame.data.event.cardId ? { dealt: frame.data.event.amount ?? 0, hold: frame.data.event.cardId } : {}),
      ...(costOfKind(effect, "playEvent") ? { finish: "discardSource" as const } : {}),
    },
    steps,
  );
}

// Pass: the seat gives up every Response it was offered for this event.
export function declineResponses(state: ScenarioState): ScenarioState {
  const frame = topFrame(state);
  if (frame?.data.kind !== "responses" || state.window?.kind !== "response") return state;
  const seat = state.window.seat;
  const left = frame.data.offers.filter((offer) => offer.seat !== seat);
  return { ...patchTop(state, { data: { ...frame.data, offers: left } }), window: null };
}
