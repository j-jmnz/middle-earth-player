import { characters } from "./combat.ts";
import type { EngineStep, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { playerCardEffectCanChoose, uniqueBlocked } from "./keywords.ts";
import { printedOf, spherePays, type PrintedCard } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { updateCard } from "./state.ts";
import { runEffects } from "./interpret.ts";
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
  const instance = next.cards[intent.cardId];
  if (!instance) return next;
  const printed = printedOf(ctx.cards, instance.code);
  const seat = state.activeSeat;
  if (printed.type === "event") {
    next = runEffects(next, intent.cardId, ["action"], seat, ctx, steps);
    return moveCard(next, intent.cardId, { zone: "discard", seat });
  }
  next = moveCard(next, intent.cardId, { zone: "play", seat });
  next = updateCard(next, intent.cardId, { exhausted: false });
  if (printed.type === "attachment" && intent.hostId) {
    next = attachTo(next, intent.cardId, intent.hostId);
  }
  return next;
}

export function playReason(
  state: ScenarioState,
  intent: Extract<PlayerIntent, { type: "PlayCard" }>,
  ctx: ReduceContext,
): string | null {
  if (state.window?.kind !== "pass" || state.mode !== "planning") return "That intent is not legal in this window";
  const instance = state.cards[intent.cardId];
  if (!instance || instance.zone !== "hand" || instance.controller !== state.activeSeat) return "That card is not in hand";
  const printed = printedOf(ctx.cards, instance.code);
  if (printed.type !== "ally" && printed.type !== "attachment" && printed.type !== "event") {
    return "That card cannot be played";
  }
  if (uniqueBlocked(state, printed, ctx.cards)) return "A second copy of that unique card cannot enter play";
  if (printed.type === "attachment") {
    if (!intent.hostId) return "Choose a host";
    const host = state.cards[intent.hostId];
    if (!host || !attachmentHosts(state, state.activeSeat, ctx).includes(intent.hostId)) {
      if (host && !playerCardEffectCanChoose(printedOf(ctx.cards, host.code))) {
        return "Immune to player card effects";
      }
      return "That host is illegal";
    }
  }
  return paymentReason(state, state.activeSeat, printed, intent.payments, ctx);
}

export function attachmentTargets(state: ScenarioState, code: string | undefined, ctx: ReduceContext): readonly string[] {
  if (!code) return [];
  const printed = ctx.cards.get(code);
  if (!printed || printed.type !== "attachment") return [];
  return attachmentHosts(state, state.activeSeat, ctx);
}

function paymentReason(
  state: ScenarioState,
  seat: number,
  printed: PrintedCard,
  payments: readonly { heroId: string; amount: number }[],
  ctx: ReduceContext,
): string | null {
  if (printed.cost == null) return "That card has no printed cost";
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
    const heroPrinted = printedOf(ctx.cards, hero.code);
    if (!spherePays(heroPrinted.sphere, printed.sphere)) return "Wrong sphere";
    if (hero.resources < amount) return "That hero does not have those resources";
  }
  if (sum > printed.cost) return "Overpay";
  if (sum < printed.cost) return "Underpay";
  return null;
}

function attachmentHosts(state: ScenarioState, seat: number, ctx: ReduceContext): string[] {
  return characters(state, seat, ctx.cards).filter((id) => {
    const instance = state.cards[id];
    return instance != null && playerCardEffectCanChoose(printedOf(ctx.cards, instance.code));
  });
}
