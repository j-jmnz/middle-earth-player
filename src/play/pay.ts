// Rules: rr.resource-match, rr.resources, rr.cancel, mec109.archery (data/rules/entries.json).
//
// Choosing which pools pay a cost, and how a fixed total is split (archery). The engine computed the total; the player
// only names where it comes from or goes, one token at a time, and the sheet confirms only when the shares sum to it.
// The reducer still checks every payment (validatePayments) and refuses a wrong one with a reason.
import type { Effect } from "../catalog/boundary.ts";
import { costOfKind } from "../catalog/costs.ts";
import { playCost } from "../rules/attach.ts";
import type { Payment } from "../rules/intents.ts";
import type { ReduceContext } from "../rules/interpret.ts";
import { heroPays } from "../rules/payments.ts";
import { printedOf, type Sphere } from "../rules/printed.ts";
import type { ScenarioState } from "../rules/state.ts";
import { costPayer, costSphere } from "../rules/usage.ts";
import { topFrame } from "../rules/windows.ts";

export type Share = { id: string; amount: number };

// What a pay sheet asks: the pools that may pay, what each holds, and the total. `exact` is false for an X cost, where the
// amount paid is X.
export type PayRequest = {
  seat: number;
  cardId: string;
  total: number;
  exact: boolean;
  pools: readonly { heroId: string; max: number }[];
};

function poolsFor(state: ScenarioState, ctx: ReduceContext, seat: number, sphere: Sphere | null, forCard?: string): { heroId: string; max: number }[] {
  const pools: { heroId: string; max: number }[] = [];
  for (const heroId of state.seats[seat]?.heroes ?? []) {
    const hero = state.cards[heroId];
    if (!hero || hero.resources <= 0) continue;
    if (!heroPays(state, heroId, sphere, ctx, forCard)) continue;
    pools.push({ heroId, max: hero.resources });
  }
  return pools;
}

/** The pay request for playing a card from the hand (or the top of the deck), or null when it costs nothing to name. */
export function playRequest(state: ScenarioState, ctx: ReduceContext, cardId: string, hostId: string | null = null): PayRequest | null {
  const seat = state.activeSeat;
  const instance = state.cards[cardId];
  if (!instance) return null;
  const printed = printedOf(ctx.cards, instance.code);
  const cost = playCost(state, cardId, seat, ctx, hostId) ?? 0;
  const pools = poolsFor(state, ctx, seat, printed.sphere, cardId);
  if (!printed.costX && cost === 0) return null;
  return { seat, cardId, total: cost, exact: !printed.costX, pools };
}

/** The pay request for an Action or Response with a resource cost, or null when its cost takes no resources. */
export function triggerRequest(state: ScenarioState, ctx: ReduceContext, cardId: string, effect: Effect): PayRequest | null {
  const seat = state.activeSeat;
  const instance = state.cards[cardId];
  if (!instance) return null;
  const printed = printedOf(ctx.cards, instance.code);
  if (costOfKind(effect, "playEvent")) {
    const cost = playCost(state, cardId, seat, ctx) ?? 0;
    if (!printed.costX && cost === 0) return null;
    return { seat, cardId, total: cost, exact: !printed.costX, pools: poolsFor(state, ctx, seat, printed.sphere, cardId) };
  }
  const resources = costOfKind(effect, "resources");
  if (!resources) return null;
  // A cost paid from one card's own pool ("Pay 1 resource from ~'s pool") offers that pool only.
  const payer = costPayer(state, resources, instance);
  if (payer === null) return null;
  if (payer !== undefined) {
    const held = state.cards[payer]?.resources ?? 0;
    return { seat, cardId, total: resources.amount, exact: true, pools: held > 0 ? [{ heroId: payer, max: held }] : [] };
  }
  return { seat, cardId, total: resources.amount, exact: true, pools: poolsFor(state, ctx, seat, costSphere(resources, instance, ctx)) };
}

/** A first guess the player can change: the pools in seat order, each giving what it holds until the total is met. */
export function firstShares(request: PayRequest): Share[] {
  const shares: Share[] = [];
  let left = request.exact ? request.total : 0;
  for (const pool of request.pools) {
    if (left <= 0) break;
    const amount = Math.min(left, pool.max);
    shares.push({ id: pool.heroId, amount });
    left -= amount;
  }
  return shares;
}

export function shareSum(shares: readonly Share[]): number {
  return shares.reduce((sum, share) => sum + share.amount, 0);
}

export function shareOf(shares: readonly Share[], id: string): number {
  return shares.find((share) => share.id === id)?.amount ?? 0;
}

/**
 * One tap on a recipient: it takes one more, up to its cap and, for a fixed total, while the total is not met; at its cap
 * (or when the total is met) it goes back to none. No number is typed.
 */
export function tapShare(shares: readonly Share[], id: string, cap: number, total: number | null): Share[] {
  const current = shareOf(shares, id);
  const full = total != null && shareSum(shares) >= total;
  const next = current >= cap || full ? 0 : current + 1;
  const rest = shares.filter((share) => share.id !== id);
  return next > 0 ? [...rest, { id, amount: next }] : rest;
}

/** True when the shares may be confirmed: the exact total for a fixed cost or split, any amount for an X cost. */
export function sharesReady(shares: readonly Share[], total: number, exact: boolean): boolean {
  return exact ? shareSum(shares) === total : true;
}

export function toPayments(shares: readonly Share[]): Payment[] {
  return shares.filter((share) => share.amount > 0).map((share) => ({ heroId: share.id, amount: share.amount }));
}

/**
 * The pay request for a paid cancel (rr.cancel): the first player pays the amount the effect record names, from the heroes
 * that may pay its sphere, granted icons included. The same check the reducer makes (validatePayments, seat firstPlayer).
 */
export function cancelRequest(state: ScenarioState, ctx: ReduceContext, cardId: string): PayRequest | null {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect" || !data.cancel) return null;
  const seat = state.firstPlayer;
  return { seat, cardId, total: data.cancel.amount, exact: true, pools: poolsFor(state, ctx, seat, data.cancel.sphere) };
}
