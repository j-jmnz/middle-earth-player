// Rules: rr.limits (data/rules/entries.json).
import type { Effect } from "../catalog/boundary.ts";

import { playCost } from "./attach.ts";
import type { EngineStep, Payment } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { destroyCard } from "./keywords.ts";
import { deckPlayHero, markDeckPlay } from "./deck-play.ts";
import { heroPays, validatePayments } from "./payments.ts";
import { printedOf, type Sphere } from "./printed.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { inPlay, updateCard } from "./state.ts";
import { moveCard } from "./zones.ts";

// Costs and limits on an Action or a Response. A cost is paid when the effect is triggered, before
// it resolves. A limit is spent by the use, whether or not the effect then does anything.

export function controllerSeat(state: ScenarioState, source: CardInstance): number {
  return source.controller ?? state.firstPlayer;
}

// A limit counts the uses of this record on this card in this round, in this phase for a phase limit, by this player for a
// per-player limit (rr.limits). "Limit X per phase" allows X of them (01070:A:2).
function limitSpent(state: ScenarioState, effect: Effect, sourceId: string, seat: number): boolean {
  if (!effect.limit) return false;
  const used = state.uses.filter(
    (use) =>
      use.effectId === effect.id &&
      use.sourceId === sourceId &&
      use.round === state.round &&
      (effect.limit !== "oncePerPhase" || use.phase === state.phase) &&
      (effect.limit !== "oncePerRoundEachPlayer" || use.seat === seat),
  ).length;
  return used >= (effect.limitTimes ?? 1);
}

// A Response used from the hand: an event, or a card whose record says so (Brok Ironfist, 01019:A:1).
export function usedFromHand(effect: Effect): boolean {
  return effect.cost?.kind === "playEvent" || effect.from === "hand";
}

// Heroes of the seat that can pay `sphere` and the resources they hold.
function pool(state: ScenarioState, seat: number, sphere: Sphere | null, ctx: ReduceContext, forCard?: string): number {
  let total = 0;
  for (const id of state.seats[seat]?.heroes ?? []) {
    const hero = state.cards[id];
    if (hero && heroPays(state, id, sphere, ctx, forCard)) total += hero.resources;
  }
  return total;
}

function costSphere(effect: Effect, source: CardInstance, ctx: ReduceContext): Sphere | null {
  const cost = effect.cost;
  return cost?.kind === "resources" ? (cost.sphere ?? printedOf(ctx.cards, source.code).sphere) : null;
}

// True when the cost could be paid and the limit is not spent. Used to decide what to offer.
export function usable(state: ScenarioState, effect: Effect, sourceId: string, seat: number, ctx: ReduceContext): boolean {
  const source = state.cards[sourceId];
  if (!source || limitSpent(state, effect, sourceId, seat)) return false;
  const cost = effect.cost;
  if (!cost) return true;
  switch (cost.kind) {
    case "exhaustSelf":
      return !source.exhausted;
    case "addSelfToVictory":
    case "discardSelf":
      return inPlay(source.zone);
    case "resources":
      return pool(state, seat, costSphere(effect, source, ctx), ctx) >= cost.amount;
    case "playEvent": {
      const price = playCost(state, sourceId, seat, ctx);
      return price != null && pool(state, seat, printedOf(ctx.cards, source.code).sphere, ctx, sourceId) >= price;
    }
    // From the source hero's own pool (01001:A:2, 01011:A:1).
    case "selfResources":
      return source.resources >= cost.amount;
  }
}

// Why this use is refused, or null. `payments` is what the player offers toward a resource cost.
export function usageReason(
  state: ScenarioState,
  effect: Effect,
  sourceId: string,
  seat: number,
  payments: readonly Payment[],
  ctx: ReduceContext,
): string | null {
  const source = state.cards[sourceId];
  if (!source) return "That effect cannot be triggered";
  if (limitSpent(state, effect, sourceId, seat)) return "That effect has already been used";
  const cost = effect.cost;
  if (cost?.kind === "playEvent") {
    const price = playCost(state, sourceId, seat, ctx);
    if (price == null) return "That card has no printed cost";
    return validatePayments(state, payments, { seat, sphere: printedOf(ctx.cards, source.code).sphere, amount: price, forCard: sourceId }, ctx);
  }
  if (cost?.kind !== "resources") {
    if (payments.length > 0) return "That effect has no resource cost";
    return usable(state, effect, sourceId, seat, ctx) ? null : "That cost cannot be paid";
  }
  return validatePayments(state, payments, { seat, sphere: costSphere(effect, source, ctx), amount: cost.amount }, ctx);
}

// Pays the cost and records the use. Call it only after usageReason accepted the use.
export function payUsage(
  state: ScenarioState,
  effect: Effect,
  sourceId: string,
  payments: readonly Payment[],
  ctx: ReduceContext,
  steps: EngineStep[],
  seat = 0,
): ScenarioState {
  let next = state;
  const source = next.cards[sourceId];
  switch (effect.cost?.kind) {
    case "exhaustSelf":
      next = updateCard(next, sourceId, { exhausted: true });
      break;
    case "addSelfToVictory":
      next = moveCard(next, sourceId, { zone: "victory" });
      break;
    case "discardSelf":
      next = destroyCard(next, sourceId, ctx.cards, steps);
      break;
    case "playEvent":
      // A Response event played from the top of the deck (Gandalf, 142002) spends that permission and is held like a card
      // in the hand until its effect is done.
      if (source?.zone === "deck" && source.controller != null) {
        const permission = deckPlayHero(next, source.controller, ctx);
        if (permission) next = markDeckPlay(next, permission);
        next = moveCard(next, sourceId, { zone: "hand", seat: source.controller });
      }
      for (const payment of payments) {
        const hero = next.cards[payment.heroId];
        if (hero) next = updateCard(next, payment.heroId, { resources: hero.resources - payment.amount });
      }
      break;
    case "resources":
      for (const payment of payments) {
        const hero = next.cards[payment.heroId];
        if (hero) next = updateCard(next, payment.heroId, { resources: hero.resources - payment.amount });
      }
      break;
    case "selfResources":
      if (source) next = updateCard(next, sourceId, { resources: source.resources - effect.cost.amount });
      break;
    default:
      break;
  }
  if (!effect.limit || !source) return next;
  const use = { effectId: effect.id, sourceId, round: next.round, phase: next.phase, ...(effect.limit === "oncePerRoundEachPlayer" ? { seat } : {}) };
  return { ...next, uses: [...next.uses, use] };
}

// Uses from earlier rounds can never block anything again.
export function pruneUses(state: ScenarioState): ScenarioState {
  const kept = state.uses.filter((use) => use.round === state.round);
  return kept.length === state.uses.length ? state : { ...state, uses: kept };
}
