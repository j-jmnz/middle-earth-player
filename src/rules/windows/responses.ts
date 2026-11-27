// Rules: rr.response, rr.triggering-condition, mec109.peril (data/rules/entries.json).
import { costOfKind } from "../../catalog/costs.ts";

import { holds } from "../interpret/conditions.ts";
import { triggerHears } from "../families/play/hooks.ts";
import { cancelBarred } from "../families/encounter/cancel.ts";
import { whenRevealedUncancelable } from "../families/wilderland/heath.ts";
import { cancelNotAllowed } from "../families/nightmare/index.ts";
import { aboutCard, answeringController, answeringSeat, effectById, hears, hearsFromAnywhere } from "./listen.ts";
import { effectsOfCard } from "../families/misc/text.ts";
import { playableFromDeck } from "../player/deck-play.ts";
import { effectCause } from "../core/cause.ts";
import { withPlayed } from "../core/played.ts";
import { pushEffectFrame } from "../interpret/effect-frames.ts";
import type { EngineStep, LegalIntent, PlayerIntent } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import type { GameEvent, ResponseOffer, ScenarioState } from "../core/state.ts";
import { inPlay, livingSeats, perilLock } from "../core/state.ts";
import { hostLostToCost, payUsage, offerable, usable, usageReason } from "../player/usage.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "./windows.ts";
import { queueEvent } from "./queue.ts";
import { announceAbility, announcePlayerAbility } from "../families/deck/pressure.ts";
import { isPlayerCardEffect } from "../core/keywords.ts";
import { guardianSeat } from "../families/guardian/seats.ts";
import { hostEngagedSeat } from "../families/haradrim/capture.ts";
import type { Effect } from "../../catalog/boundary.ts";

type TriggerIntent = Extract<PlayerIntent, { type: "Trigger" }>;
export type ResponseOrder = "when" | "rest";

// Whether any record of the list is a "When" Response (`whenFirst`), found once for each effect list: the list is never changed after the reducer is handed it.
const WHEN_FIRST = new WeakMap<readonly Effect[], boolean>();
function anyWhenFirst(ctx: ReduceContext): boolean {
  let found = WHEN_FIRST.get(ctx.effects);
  if (found == null) {
    found = ctx.effects.some((effect) => effect.whenFirst === true);
    WHEN_FIRST.set(ctx.effects, found);
  }
  return found;
}

// Whether a Response belongs to the pass `only` asks for: "when" takes the `whenFirst` records, "rest" the others, unset takes all.
function inPass(effect: Effect, only?: ResponseOrder): boolean {
  return only == null || (effect.whenFirst === true) === (only === "when");
}

// The seat that answers a Response, or null when none can: `seat` is the card's own (its controller, else the first player).
// `eventSeat`: the seat the event happened to (12125:A:3). `guardian`: the player guarding Gollum (02134:A:1). `hostEngaged`: the player the source's host enemy is engaged with, none while it is in the staging area (the Captures, 17011:A:1).
// `defender`: the controller of the character the event names as `other`, the defender of an attack (17014:A:1).
function answeredSeat(state: ScenarioState, effect: Effect, event: GameEvent, sourceId: string, seat: number): number | null {
  switch (effect.answeredBy) {
    case "eventSeat":
      return event.seat ?? null;
    case "guardian":
      return guardianSeat(state);
    case "hostEngaged":
      return hostEngagedSeat(state, sourceId);
    case "defender":
      return state.cards[event.other ?? ""]?.controller ?? null;
    default:
      return seat;
  }
}

// Whether the card is the source of an effect frame on the stack: the event it is playing has not finished.
function resolving(state: ScenarioState, cardId: string): boolean {
  return state.stack.some((frame) => frame.data.kind === "effect" && frame.cardId === cardId);
}

// Responses are optional. After an event, each Response that applies is offered to the seat that
// controls its card (the first player, for an encounter or quest card). A seat may use it or pass.
// `only` narrows the records by `whenFirst`: "when" takes those that resolve before the event's Forced effects, "rest" the others; unset takes all.
function collect(state: ScenarioState, event: GameEvent, ctx: ReduceContext, only?: ResponseOrder): ResponseOffer[] {
  const offers: ResponseOffer[] = [];
  const order = livingSeats(state);
  // Only the cards with a Response to this trigger are sorted and looked at.
  const cards = Object.values(state.cards)
    .filter((instance) => effectsOfCard(state, ctx, instance).some((effect) => effect.timing === "response" && triggerHears(effect.trigger, event.trigger)))
    .sort((left, right) => left.enteredPlay - right.enteredPlay || left.id.localeCompare(right.id, undefined, { numeric: true }));
  for (const instance of cards) {
    // An event about one card is heard by that card even after it has left play.
    // An event card in the hand hears every event; a card in play hears the events about itself or about the table. The
    // top card of a deck its controller may play as if it were in the hand (Gandalf, 142002) is in the hand for this.
    const inHand = instance.zone === "hand" || (instance.zone === "deck" && instance.controller != null && playableFromDeck(state, instance.id, instance.controller, ctx));
    const records = effectsOfCard(state, ctx, instance).filter((effect) => effect.timing === "response" && inPass(effect, only) && hears(state, effect, instance, event, ctx));
    if (records.length === 0) continue;
    // A card nobody controls (a quest or encounter card) is answered by the first player, or, while a Peril card's
    // staging resolves, by the revealing player: the other players are the ones Peril keeps out (mec109.peril).
    const locked = perilLock(state);
    const seat = answeringController(instance, ctx) == null && locked != null ? locked : answeringSeat(state, instance, ctx);
    // Peril: the other seats cannot trigger Responses while the card resolves.
    if (!order.includes(seat) || (locked != null && seat !== locked)) continue;
    for (const effect of records) {
      // Only an event used from the hand has a Response there; any other listens in play, or from wherever its card went
      // for an event about itself ("After ~ leaves play").
      const fromHand = costOfKind(effect, "playEvent") != null || effect.fromHand === true;
      if (fromHand ? !inHand : !(inPlay(instance.zone) || hearsFromAnywhere(effect, instance, event))) continue;
      // A card whose own effect is resolving (an event just played) cannot answer its own play from the hand.
      if (fromHand && resolving(state, instance.id)) continue;
      // "The engaged player may ...": the seat the event happened to answers it, whoever controls the card (12125:A:3).
      const answering = answeredSeat(state, effect, event, instance.id, seat);
      if (answering == null || !order.includes(answering) || (locked != null && answering !== locked)) continue;
      // `other`: the second card the event names ("After a Trap card you control is attached to an enemy": the new host).
      const scope = { actor: answering, sourceId: instance.id, returned: 0, eventSeat: event.seat, ...(event.phase ? { phase: event.phase } : {}), ...(aboutCard(event) ? { subject: aboutCard(event) } : {}), ...(event.explored ? { explored: true } : {}), ...(event.exhaustedToDefend ? { exhaustedToDefend: true } : {}), ...(event.other ? { other: event.other } : {}) };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      // "Any player may trigger this response": each seat is offered it, the controller first.
      // While a Peril card's staging resolves the other players cannot trigger Responses, whoever "any player may" names (mec109.peril).
      const seats = effect.anyPlayer && locked == null ? [answering, ...order.filter((other) => other !== answering)] : [answering];
      for (const offered of seats) if (offerable(state, effect, instance.id, offered, ctx)) offers.push({ cardId: instance.id, effectId: effect.id, seat: offered, event });
    }
  }
  return offers;
}

/**
 * Offers the Responses to one event, or to the events of one occurrence together (each character of one commit; rule
 * rr.triggering-condition): one window, first player first, in which the player uses them in any order. An offer whose cost
 * cannot be paid yet waits in the window and is listed once it can (Théodred adds the resource Aragorn spends, the video's
 * combo). With nothing usable now, no window opens.
 */
export function offerResponses(state: ScenarioState, event: GameEvent, ctx: ReduceContext, steps: EngineStep[], also: readonly GameEvent[] = [], only?: ResponseOrder): ScenarioState {
  if (ctx.effects.length === 0 || (only === "when" && !anyWhenFirst(ctx))) return state;
  const order = livingSeats(state);
  const seen = new Set<string>();
  const offers = [event, ...also]
    .flatMap((each) => collect(state, each, ctx, only))
    .filter((offer) => !barred(state, offer, ctx))
    .filter((offer) => {
      // Each event of the occurrence is its own triggering condition: a card that hears two of them is offered twice.
      const key = `${offer.cardId}|${offer.effectId}|${offer.seat}|${offer.event ? (aboutCard(offer.event) ?? "") : ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => order.indexOf(left.seat) - order.indexOf(right.seat));
  const first = liveOffers(state, offers, ctx)[0];
  if (!first) return state;
  return pushFrame(
    state,
    { frame: "response", cardId: event.cardId ?? null, seat: first.seat, peril: false, data: { kind: "responses", event, offers } },
    steps,
  );
}

// An offer whose effect cancels an encounter card's effect while The Eaves of Mirkwood bars it (families/encounter/cancel.ts).
function barred(state: ScenarioState, offer: ResponseOffer, ctx: ReduceContext): boolean {
  const effect = effectById(ctx, offer.effectId);
  return effect != null && offer.event != null && (cancelBarred(state, offer.event, effect) || cancelNotAllowed(state, offer, effect, ctx) || whenRevealedUncancelable(state, offer.event, effect, ctx));
}

// The offers a seat can use now: those whose cost it can pay at this point of the window.
function liveOffers(state: ScenarioState, offers: readonly ResponseOffer[], ctx: ReduceContext): ResponseOffer[] {
  return offers.filter((offer) => {
    const effect = effectById(ctx, offer.effectId);
    return effect != null && usable(state, effect, offer.cardId, offer.seat, ctx, offer.event);
  });
}

function offersOf(state: ScenarioState): readonly ResponseOffer[] {
  const data = topFrame(state)?.data;
  return data?.kind === "responses" ? data.offers : [];
}

// The response frame opens a window for the first seat that has an offer it can use now, or pops. An offer that cannot be
// paid yet stays in the frame: a Response used meanwhile may pay for it (rr.triggering-condition). With nothing usable,
// the window closes and the waiting offers with it.
export function responseStep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const frame = topFrame(state);
  if (frame?.data.kind !== "responses") return state;
  const first = liveOffers(state, frame.data.offers, ctx)[0];
  if (!first) return popFrame({ ...patchTop(state, { data: { ...frame.data, offers: [] } }), window: null }, steps);
  return { ...state, window: { kind: "response", seat: first.seat }, activeSeat: first.seat, passed: [] };
}

export function responseIntents(state: ScenarioState, ctx: ReduceContext): LegalIntent[] {
  if (state.window?.kind !== "response") return [];
  const seat = state.window.seat;
  return liveOffers(state, offersOf(state), ctx)
    .filter((offer) => offer.seat === seat)
    .map((offer): LegalIntent => ({ type: "Trigger", cardId: offer.cardId, effectId: offer.effectId }));
}

export function responseReason(state: ScenarioState, intent: TriggerIntent, ctx: ReduceContext): string | null {
  if (state.window?.kind !== "response") return "That intent is not legal in this window";
  const seat = state.window.seat;
  const offer = offersOf(state).find((entry) => entry.cardId === intent.cardId && entry.effectId === intent.effectId && entry.seat === seat);
  const effect = offer ? effectById(ctx, offer.effectId) : undefined;
  if (!offer || !effect) return "That effect cannot be triggered";
  return usageReason(state, effect, offer.cardId, seat, intent.payments ?? [], ctx, offer.event);
}

// The cost is paid, the offer is spent, and the effect resolves in a frame above the response frame.
// When it pops, the response frame offers whatever is left.
export function applyResponse(state: ScenarioState, intent: TriggerIntent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const frame = topFrame(state);
  const effect = effectById(ctx, intent.effectId);
  if (frame?.data.kind !== "responses" || !effect || state.window?.kind !== "response") return state;
  const seat = state.window.seat;
  // The event the used Response answers: one of the occurrence's events, when the window holds several.
  const event = frame.data.offers.find((offer) => offer.cardId === intent.cardId && offer.effectId === intent.effectId && offer.seat === seat)?.event ?? frame.data.event;
  const opened = frame.data.event;
  // The offer is spent for this event only (every seat's, for "any player may trigger"); one for another event of the
  // occurrence stays, and the effect's limit decides whether it is still usable.
  const left = frame.data.offers.filter((offer) => !(offer.cardId === intent.cardId && offer.effectId === intent.effectId && (offer.event ?? opened) === event));
  // The seat answering pays: its threat for a raiseThreat cost, its deck for discardDeckTop, its use of a per-player limit.
  const paid = payUsage(patchTop(state, { data: { ...frame.data, offers: left } }), effect, intent.cardId, intent.payments ?? [], ctx, steps, seat);
  // A Response event is played like an Action event: it joins this round's plays, and its card hears "When an event is played" first (planning.ts, playEvent).
  const played = costOfKind(effect, "playEvent") ? withPlayed(paid, intent.cardId, paid.cards[intent.cardId]?.code ?? "", seat) : paid;
  const heard = costOfKind(effect, "playEvent") ? queueEvent(played, { trigger: "played", seat, cardId: intent.cardId }) : played;
  const framed = pushEffectFrame(
    { ...heard, window: null },
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
      eventSeat: event.seat,
      ...(event.participants ? { participants: event.participants } : {}),
      ...(aboutCard(event) ? { subject: aboutCard(event) } : {}),
      ...(event.other ? { other: event.other } : {}),
      ...hostLostToCost(state, paid, intent.cardId),
      // A Response to damage just dealt resolves before the damaged card can be destroyed (rr.cancel).
      ...(event.trigger === "damageDealt" && event.cardId ? { dealt: event.amount ?? 0, hold: event.cardId } : {}),
      // Any other event's amount is the effect's X (the attachments an explored location had, 19026:A:2).
      ...(event.trigger !== "damageDealt" && event.amount != null ? { x: event.amount } : {}),
      // "For each point of damage he just suffered": the damage a damaged event reports.
      ...((event.trigger === "damaged" || event.trigger === "damagedByAttack") && event.amount != null ? { dealt: event.amount } : {}),
      ...(costOfKind(effect, "playEvent") ? { finish: "discardSource" as const, announceResolved: true as const } : {}),
    },
    steps,
  );
  // Only a player card's Response is "a player triggers a Response effect" (09040:A:1): an encounter card's (Iârion's) is not.
  return isPlayerCardEffect(framed, ctx.cards, intent.cardId) ? announcePlayerAbility(framed, intent.cardId, seat, ctx) : announceAbility(framed, intent.cardId, seat, ctx);
}

// Pass: the seat gives up every Response it was offered for this event.
export function declineResponses(state: ScenarioState): ScenarioState {
  const frame = topFrame(state);
  if (frame?.data.kind !== "responses" || state.window?.kind !== "response") return state;
  const seat = state.window.seat;
  const left = frame.data.offers.filter((offer) => offer.seat !== seat);
  return { ...patchTop(state, { data: { ...frame.data, offers: left } }), window: null };
}
