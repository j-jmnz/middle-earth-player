// Rules: rr.planning-phase, rr.step-2-2, rr.step-2-3, rr.resource-match, ltp.planning-order, ltp.paying-costs-multiple,
// ltp.unique-cards, ltp.neutral-cards (data/rules/entries.json).
import type { Effect } from "../catalog/boundary.ts";

import { attachmentHostIds, enforceRestricted, playCost } from "./attach.ts";
import { effectCause } from "./cause.ts";
import { deckPlayHero, markDeckPlay, playableFromDeck } from "./deck-play.ts";
import { holds } from "./conditions.ts";
import { pushEffectFrame } from "./effect-frames.ts";
import type { EngineStep, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { pickCandidates } from "./pick.ts";
import { queueEvent } from "./queue.ts";
import { playerCardEffectCanChoose, uniqueBlocked } from "./keywords.ts";
import { targetCandidates } from "./effect-verbs.ts";
import { planningTurn } from "./pass.ts";
import { hasResourceMatch, heroPays } from "./payments.ts";
import { printedOf, type PrintedCard } from "./printed.ts";
import { attachBlocked } from "./restrictions.ts";
import type { ScenarioState } from "./state.ts";
import { updateCard } from "./state.ts";
import { attachTo, moveCard } from "./zones.ts";

export function playCard(
  state: ScenarioState,
  intent: Extract<PlayerIntent, { type: "PlayCard" }>,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  let next = state;
  for (const payment of intent.payments) {
    const hero = next.cards[payment.heroId];
    if (!hero) continue;
    next = updateCard(next, payment.heroId, { resources: hero.resources - payment.amount });
  }
  let instance = next.cards[intent.cardId];
  if (!instance) return next;
  const printed = printedOf(ctx.cards, instance.code);
  const seat = state.activeSeat;
  // The top card of the deck, played as if it were in the hand: the permission is used up, and the card leaves the deck.
  if (instance.zone === "deck") {
    const permission = deckPlayHero(next, seat, ctx);
    if (permission) next = markDeckPlay(next, permission);
    next = moveCard(next, intent.cardId, { zone: "hand", seat });
    instance = next.cards[intent.cardId] ?? instance;
  }
  if (printed.type === "event") {
    const x = printed.costX ? intent.payments.reduce((sum, payment) => sum + payment.amount, 0) : undefined;
    return playEvent(next, intent.cardId, seat, ctx, steps, x);
  }
  next = moveCard(next, intent.cardId, { zone: "play", seat });
  next = updateCard(next, intent.cardId, { exhausted: false });
  if (printed.type === "attachment" && intent.hostId) {
    next = attachTo(next, intent.cardId, intent.hostId);
    next = queueEvent(next, { trigger: "played", seat, cardId: intent.cardId });
    return enforceRestricted(next, intent.hostId, ctx, steps);
  }
  // The card is announced to the Responses that hear it: it was played, and it entered play.
  next = queueEvent(next, { trigger: "played", seat, cardId: intent.cardId });
  return queueEvent(next, { trigger: "enteredPlay", seat, cardId: intent.cardId });
}

function actionRecords(ctx: ReduceContext, code: string): Effect[] {
  return ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "action");
}

// The effects of an event whose condition holds now.
function runningActions(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): Effect[] {
  const code = state.cards[cardId]?.code ?? "";
  const scope = { actor: seat, sourceId: cardId, returned: 0 };
  return actionRecords(ctx, code).filter((effect) => !effect.condition || holds(state, effect.condition, scope, ctx));
}

// The event's Action effects resolve in a frame of their own, so a choice can stop them. The card stays in the hand while
// they resolve (it cannot be a target of its own effect) and goes to the discard pile after, whatever happened to the effect.
function playEvent(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext, steps: EngineStep[], x?: number): ScenarioState {
  const running = runningActions(state, cardId, seat, ctx);
  const first = running[0];
  if (!first) return moveCard(state, cardId, { zone: "discard", seat });
  return pushEffectFrame(
    { ...state, window: null },
    {
      frame: "ResolveEffect",
      sourceId: cardId,
      actor: seat,
      peril: state.perilSeat != null,
      effectId: first.id,
      instructions: running.flatMap((effect) => effect.instructions),
      causes: running.flatMap((effect) => effect.instructions.map(() => effectCause(effect))),
      cancel: null,
      blockCancel: null,
      finish: "discardSource",
      ...(x != null ? { x } : {}),
      ...(state.window ? { resume: { window: state.window, seat } } : {}),
    },
    steps,
  );
}

// Why an event cannot be played in this window: no Action of its has its condition hold (a Combat Action outside combat), or
// an effect has nothing to choose (rr.initiating-abilities-playing-cards, step 1: check play restrictions).
function eventReason(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): string | null {
  const records = actionRecords(ctx, state.cards[cardId]?.code ?? "");
  if (records.length === 0) {
    // An event whose only records are Responses is played from its Response window, never as an ordinary play.
    const code = state.cards[cardId]?.code ?? "";
    return ctx.effects.some((effect) => effect.cardCode === code && effect.timing === "response") ? "That card cannot be played" : null;
  }
  const running = runningActions(state, cardId, seat, ctx);
  if (running.length === 0) return "That card cannot be played now";
  for (const effect of running) {
    for (const instruction of effect.instructions) {
      // "Choose an enemy engaged with a player" with none engaged (Feint): there is no valid target (rr.the-word-choose).
      if ((instruction.verb === "BarAttack" || instruction.verb === "PlaceProgressOnLocation") && !instruction.when) {
        if (targetCandidates(state, instruction, seat, ctx).length === 0) return "That card has no legal target";
        continue;
      }
      if (instruction.verb !== "Pick" || instruction.pick.different || instruction.pick.attackableByPicked) continue;
      if (pickCandidates(state, instruction.pick, seat, [], cardId, ctx).length === 0) return "That card has no legal target";
    }
  }
  return null;
}

// Whether a card in the active seat's hand may be played in the open window, before its host and its cost are looked at.
export function playWindowReason(state: ScenarioState, cardId: string, ctx: ReduceContext): string | null {
  if (state.window?.kind !== "pass" && state.window?.kind !== "frameAction") return "That intent is not legal in this window";
  const instance = state.cards[cardId];
  const fromDeck = instance?.zone === "deck" && playableFromDeck(state, cardId, state.activeSeat, ctx);
  if (!instance || (instance.zone !== "hand" && !fromDeck) || instance.controller !== state.activeSeat) return "That card is not in hand";
  const printed = printedOf(ctx.cards, instance.code);
  if (printed.type !== "ally" && printed.type !== "attachment" && printed.type !== "event") return "That card cannot be played";
  // Events are Actions: any action window. Allies and attachments are played in the planning phase only, by the
  // player whose planning window it is (rr.step-2-2).
  if (printed.type !== "event" && state.mode !== "planning") return "That intent is not legal in this window";
  if (printed.type !== "event" && planningTurn(state) !== state.activeSeat) return "Only the active player plays allies and attachments now";
  if (uniqueBlocked(state, printed, ctx.cards)) return "A second copy of that unique card cannot enter play";
  if (!hasResourceMatch(state, state.activeSeat, printed.sphere, ctx, cardId)) return "No hero matches that card's sphere";
  return printed.type === "event" ? eventReason(state, cardId, state.activeSeat, ctx) : null;
}

export function playReason(
  state: ScenarioState,
  intent: Extract<PlayerIntent, { type: "PlayCard" }>,
  ctx: ReduceContext,
): string | null {
  const refused = playWindowReason(state, intent.cardId, ctx);
  if (refused) return refused;
  const instance = state.cards[intent.cardId];
  if (!instance) return "That card is not in hand";
  const printed = printedOf(ctx.cards, instance.code);
  if (printed.type === "attachment") {
    if (!intent.hostId) return "Choose a host";
    const host = state.cards[intent.hostId];
    if (!host || !attachmentHostIds(state, state.activeSeat, instance.code, ctx).includes(intent.hostId)) {
      if (host && !playerCardEffectCanChoose(printedOf(ctx.cards, host.code))) {
        return "Immune to player card effects";
      }
      if (host && attachBlocked(state, ctx, host.id, instance.code)) return "That card cannot have that attachment";
      return "That host is illegal";
    }
  }
  return paymentReason(state, state.activeSeat, intent.cardId, printed, playCost(state, intent.cardId, state.activeSeat, ctx), intent.payments, ctx);
}

export function attachmentTargets(state: ScenarioState, code: string | undefined, ctx: ReduceContext): readonly string[] {
  if (!code) return [];
  const printed = ctx.cards.get(code);
  if (!printed || printed.type !== "attachment") return [];
  return attachmentHostIds(state, state.activeSeat, code, ctx);
}

function paymentReason(
  state: ScenarioState,
  seat: number,
  cardId: string,
  printed: PrintedCard,
  cost: number | null,
  payments: readonly { heroId: string; amount: number }[],
  ctx: ReduceContext,
): string | null {
  if (!printed.costX && (printed.cost == null || cost == null)) return "That card has no printed cost";
  let sum = 0;
  const spent = new Map<string, number>();
  for (const payment of payments) {
    if (!Number.isInteger(payment.amount) || payment.amount < 0) return "That payment is not a cost";
    sum += payment.amount;
    spent.set(payment.heroId, (spent.get(payment.heroId) ?? 0) + payment.amount);
  }
  for (const [heroId, amount] of spent) {
    const hero = state.cards[heroId];
    if (!hero || hero.zone !== "heroes" || hero.controller !== seat) return "That hero cannot pay";
    if (!heroPays(state, heroId, printed.sphere, ctx, cardId)) return "Wrong sphere";
    if (hero.resources < amount) return "That hero does not have those resources";
  }
  if (sum === 0 && !hasResourceMatch(state, seat, printed.sphere, ctx, cardId)) return "No hero matches that card's sphere";
  // X is whatever the player pays.
  if (printed.costX) return null;
  if (cost == null) return "That card has no printed cost";
  if (sum > cost) return "Overpay";
  if (sum < cost) return "Underpay";
  return null;
}
