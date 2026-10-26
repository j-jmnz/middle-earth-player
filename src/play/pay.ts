// Rules: rr.resource-match, rr.resources, rr.cancel, mec109.archery (data/rules/entries.json).
//
// Choosing which pools pay a cost, and how a fixed total is split (archery). The engine computed the total; the player
// only names where it comes from or goes, one token at a time, and the sheet confirms only when the shares sum to it.
// The reducer still checks every payment (validatePayments) and refuses a wrong one with a reason.
import type { Effect } from "../catalog/boundary.ts";
import { payFromHeroes, playCost } from "../rules/attach.ts";
import type { Payment } from "../rules/intents.ts";
import type { ReduceContext } from "../rules/interpret.ts";
import { heroPays } from "../rules/payments.ts";
import { printedOf, type Sphere } from "../rules/printed.ts";
import type { ScenarioState } from "../rules/state.ts";
import { topFrame } from "../rules/windows.ts";

export type Share = { id: string; amount: number };

// What a pay sheet asks: the pools that may pay, what each holds, and the total. `exact` is false for an X cost, where the
// amount paid is X. `spread` is the fewest different heroes the payment must come from (Thicket of Spears, 01036:A:1).
export type PayRequest = {
  seat: number;
  cardId: string;
  total: number;
  exact: boolean;
  pools: readonly { heroId: string; max: number }[];
  spread?: number;
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
export function playRequest(state: ScenarioState, ctx: ReduceContext, cardId: string): PayRequest | null {
  const seat = state.activeSeat;
  const instance = state.cards[cardId];
  if (!instance) return null;
  const printed = printedOf(ctx.cards, instance.code);
  const cost = playCost(state, cardId, seat, ctx) ?? 0;
  const pools = poolsFor(state, ctx, seat, printed.sphere, cardId);
  if (!printed.costX && cost === 0) return null;
  const spread = payFromHeroes(state, cardId, ctx);
  return { seat, cardId, total: cost, exact: !printed.costX, pools, ...(spread != null ? { spread } : {}) };
}

/** The pay request for an Action or Response with a resource cost, or null when its cost takes no resources. */
export function triggerRequest(state: ScenarioState, ctx: ReduceContext, cardId: string, effect: Effect): PayRequest | null {
  const seat = state.activeSeat;
  const instance = state.cards[cardId];
  if (!instance) return null;
  const printed = printedOf(ctx.cards, instance.code);
  if (effect.cost?.kind === "playEvent") {
    const cost = playCost(state, cardId, seat, ctx) ?? 0;
    if (!printed.costX && cost === 0) return null;
    const spread = payFromHeroes(state, cardId, ctx);
    return { seat, cardId, total: cost, exact: !printed.costX, pools: poolsFor(state, ctx, seat, printed.sphere, cardId), ...(spread != null ? { spread } : {}) };
  }
  if (effect.cost?.kind === "resources") {
    const sphere = effect.cost.sphere ?? printed.sphere;
    return { seat, cardId, total: effect.cost.amount, exact: true, pools: poolsFor(state, ctx, seat, sphere) };
  }
  return null;
}

/**
 * A first guess the player can change: the pools in seat order, each giving what it holds until the total is met. A cost
 * that must come from several different heroes (01036:A:1) takes one from each of the first of them before the rest.
 */
export function firstShares(request: Pick<PayRequest, "total" | "exact" | "pools" | "spread">): Share[] {
  const given = new Map<string, number>();
  let left = request.exact ? request.total : 0;
  for (const pool of request.pools.slice(0, request.spread ?? 0)) {
    if (left <= 0) break;
    given.set(pool.heroId, 1);
    left -= 1;
  }
  for (const pool of request.pools) {
    if (left <= 0) break;
    const amount = Math.min(left, pool.max - (given.get(pool.heroId) ?? 0));
    if (amount > 0) given.set(pool.heroId, (given.get(pool.heroId) ?? 0) + amount);
    left -= amount;
  }
  return request.pools.flatMap((pool) => (given.has(pool.heroId) ? [{ id: pool.heroId, amount: given.get(pool.heroId) ?? 0 }] : []));
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
