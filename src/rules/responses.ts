// Rules: rr.response, rr.triggering-condition, mec109.peril (data/rules/entries.json).
import { holds } from "./conditions.ts";
import { playableFromDeck } from "./deck-play.ts";
import { effectCause } from "./cause.ts";
import { pushEffectFrame } from "./effect-frames.ts";
import type { EngineStep, LegalIntent, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import type { GameEvent, ResponseOffer, ScenarioState } from "./state.ts";
import { inPlay, livingSeats, perilLock } from "./state.ts";
import { payUsage, controllerSeat, offerable, usable, usageReason, usedFromHand } from "./usage.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "./windows.ts";

type TriggerIntent = Extract<PlayerIntent, { type: "Trigger" }>;

// Responses are optional. After an event, each Response that applies is offered to the seat that
// controls its card (the first player, for an encounter or quest card). A seat may use it or pass.
function collect(state: ScenarioState, event: GameEvent, ctx: ReduceContext): ResponseOffer[] {
  const offers: ResponseOffer[] = [];
  const order = livingSeats(state);
  const cards = Object.values(state.cards).sort(
    (left, right) => left.enteredPlay - right.enteredPlay || left.id.localeCompare(right.id, undefined, { numeric: true }),
  );
  for (const instance of cards) {
    // An event about one card is heard by that card even after it has left play.
    // An event card in the hand hears every event; a card in play hears the events about itself or about the table. The
    // top card of a deck its controller may play as if it were in the hand (Gandalf, 142002) is in the hand for this.
    const inHand = instance.zone === "hand" || (instance.zone === "deck" && instance.controller != null && playableFromDeck(state, instance.id, instance.controller, ctx));
    if (event.cardId != null ? instance.id !== event.cardId : !(inPlay(instance.zone) || inHand)) continue;
    // A card nobody controls (a quest or encounter card) is answered by the first player, or, while a Peril card's
    // staging resolves, by the revealing player: the other players are the ones Peril keeps out (mec109.peril).
    const locked = perilLock(state);
    const seat = instance.controller == null && locked != null ? locked : controllerSeat(state, instance);
    // Peril: the other seats cannot trigger Responses while the card resolves.
    if (!order.includes(seat) || (locked != null && seat !== locked)) continue;
    for (const effect of ctx.effects) {
      if (effect.timing !== "response" || effect.cardCode !== instance.code || effect.trigger !== event.trigger) continue;
      // Only an event used from the hand, or a card whose record says so (01019:A:1), has a Response there.
      if (inHand !== usedFromHand(effect)) continue;
      const scope = { actor: seat, sourceId: instance.id, returned: 0, eventSeat: event.seat, ...(event.subject ? { subject: event.subject } : {}), ...(event.explored ? { explored: true } : {}) };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      if (!offerable(state, effect, instance.id, seat, ctx)) continue;
      offers.push({ cardId: instance.id, effectId: effect.id, seat, event });
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
export function offerResponses(state: ScenarioState, event: GameEvent, ctx: ReduceContext, steps: EngineStep[], also: readonly GameEvent[] = []): ScenarioState {
  if (ctx.effects.length === 0) return state;
  const order = livingSeats(state);
  const seen = new Set<string>();
  const offers = [event, ...also]
    .flatMap((each) => collect(state, each, ctx))
    .filter((offer) => {
      const key = `${offer.cardId}|${offer.effectId}`;
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

// The offers a seat can use now: those whose cost it can pay at this point of the window.
function liveOffers(state: ScenarioState, offers: readonly ResponseOffer[], ctx: ReduceContext): ResponseOffer[] {
  return offers.filter((offer) => {
    const effect = ctx.effects.find((entry) => entry.id === offer.effectId);
    return effect != null && usable(state, effect, offer.cardId, offer.seat, ctx);
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
  const used = frame.data.offers.find((offer) => offer.cardId === intent.cardId && offer.effectId === intent.effectId);
  const event = used?.event ?? frame.data.event;
  const left = frame.data.offers.filter((offer) => !(offer.cardId === intent.cardId && offer.effectId === intent.effectId));
  const paid = payUsage(patchTop(state, { data: { ...frame.data, offers: left } }), effect, intent.cardId, intent.payments ?? [], ctx, steps);
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
      eventSeat: event.seat,
      ...(event.participants ? { participants: event.participants } : {}),
      ...(effect.cost?.kind === "playEvent" ? { finish: "discardSource" as const } : {}),
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
