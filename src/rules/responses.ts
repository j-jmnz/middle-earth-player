// Rules: rr.response (data/rules/entries.json).
import { holds } from "./conditions.ts";
import { effectCause } from "./cause.ts";
import { pushEffectFrame } from "./effect-frames.ts";
import type { EngineStep, LegalIntent, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import type { GameEvent, ResponseOffer, ScenarioState } from "./state.ts";
import { inPlay, livingSeats } from "./state.ts";
import { payUsage, controllerSeat, usable, usageReason } from "./usage.ts";
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
    // An event card in the hand hears every event; a card in play hears the events about itself or about the table.
    const inHand = instance.zone === "hand";
    if (event.cardId != null ? instance.id !== event.cardId : !(inPlay(instance.zone) || inHand)) continue;
    const seat = controllerSeat(state, instance);
    // Peril: the other seats cannot trigger Responses while the card resolves.
    if (!order.includes(seat) || (state.perilSeat != null && seat !== state.perilSeat)) continue;
    for (const effect of ctx.effects) {
      if (effect.timing !== "response" || effect.cardCode !== instance.code || effect.trigger !== event.trigger) continue;
      // Only an event used from the hand has a Response there.
      if (inHand !== (effect.cost?.kind === "playEvent")) continue;
      const scope = { actor: seat, sourceId: instance.id, returned: 0, eventSeat: event.seat, ...(event.subject ? { subject: event.subject } : {}) };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      if (!usable(state, effect, instance.id, seat, ctx)) continue;
      offers.push({ cardId: instance.id, effectId: effect.id, seat });
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
      eventSeat: frame.data.event.seat,
      ...(frame.data.event.participants ? { participants: frame.data.event.participants } : {}),
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
