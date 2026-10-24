// Rules: rr.planning-phase (data/rules/entries.json).
import { attachmentHostIds, enforceRestricted, playCost } from "./attach.ts";
import type { EngineStep, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { playerCardEffectCanChoose, uniqueBlocked } from "./keywords.ts";
import { heroPays } from "./payments.ts";
import { printedOf, type PrintedCard } from "./printed.ts";
import { attachBlocked } from "./restrictions.ts";
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
    return enforceRestricted(next, intent.hostId, ctx, steps);
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
    if (!host || !attachmentHostIds(state, state.activeSeat, instance.code, ctx).includes(intent.hostId)) {
      if (host && !playerCardEffectCanChoose(printedOf(ctx.cards, host.code))) {
        return "Immune to player card effects";
      }
      if (host && attachBlocked(state, ctx, host.id, instance.code)) return "That card cannot have that attachment";
      return "That host is illegal";
    }
  }
  return paymentReason(state, state.activeSeat, printed, playCost(state, intent.cardId, state.activeSeat, ctx), intent.payments, ctx);
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
  printed: PrintedCard,
  cost: number | null,
  payments: readonly { heroId: string; amount: number }[],
  ctx: ReduceContext,
): string | null {
  if (printed.cost == null || cost == null) return "That card has no printed cost";
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
    if (!heroPays(state, heroId, printed.sphere, ctx)) return "Wrong sphere";
    if (hero.resources < amount) return "That hero does not have those resources";
  }
  if (sum > cost) return "Overpay";
  if (sum < cost) return "Underpay";
  return null;
}
