// Rules: rr.resource-match, rr.resources, rr.cancel, mec109.archery (data/rules/entries.json).
//
// Choosing which pools pay a cost, and how a fixed total is split (archery). The engine computed the total; the player
// only names where it comes from or goes, one token at a time, and the sheet confirms only when the shares sum to it.
// The reducer still checks every payment (validatePayments) and refuses a wrong one with a reason.
import type { Effect } from "../../catalog/boundary.ts";
import { costOfKind } from "../../catalog/costs.ts";
import { playCost } from "../../rules/player/attach.ts";
import type { Payment } from "../../rules/core/intents.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { allyPools, distinctRule } from "../../rules/families/costs/pay.ts";
import { openPools } from "../../rules/families/misc/guards.ts";
import { exhaustSlack } from "../../rules/families/costs/play.ts";
import { payingSlack } from "../../rules/families/deck/play.ts";
import { chosenX } from "../../rules/families/misc/cost.ts";
import { heroPays } from "../../rules/player/payments.ts";
import { printedOf, type Sphere } from "../../rules/core/printed.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { costPayer, costSphere } from "../../rules/player/usage.ts";
import { topFrame } from "../../rules/windows/windows.ts";

export type Share = { id: string; amount: number };

// What a pay sheet asks: the pools that may pay, what each holds, and the total. `exact` is false for an X cost, where the
// amount paid is X.
export type PayRequest = {
  seat: number;
  cardId: string;
  total: number;
  exact: boolean;
  pools: readonly { heroId: string; max: number }[];
  // The card's own rule on how many different pools pay (PayDistinctHeroes), which the first guess follows.
  distinct?: { min?: number; max?: number };
};

function poolsFor(state: ScenarioState, ctx: ReduceContext, seat: number, sphere: Sphere | null, forCard?: string): { heroId: string; max: number }[] {
  const pools: { heroId: string; max: number }[] = [];
  // An ally whose own pool pays for the card (Radagast for Creature cards) is a pool beside the heroes.
  for (const heroId of [...(state.seats[seat]?.heroes ?? []), ...allyPools(state, seat, forCard, ctx), ...openPools(state, seat, forCard, ctx)]) {
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
  const chosen = chosenX(state, cardId, ctx);
  if (!chosen && cost === 0) return null;
  // A cost that characters exhausted may pay in part (ExhaustToReduce) need not be met in resources: what is left unpaid is
  // paid by exhausting them, and the reducer checks there are enough.
  const distinct = distinctRule(state, cardId, ctx);
  // So may one a Response lowers as the card is played (Erebor Guard, families/deck/play.ts).
  return { seat, cardId, total: cost, exact: !chosen && exhaustSlack(state, seat, cardId, ctx) === 0 && payingSlack(state, seat, cardId, ctx) === 0, pools, ...(distinct ? { distinct } : {}) };
}

/** The pay request for an Action or Response with a resource cost, or null when its cost takes no resources. */
export function triggerRequest(state: ScenarioState, ctx: ReduceContext, cardId: string, effect: Effect): PayRequest | null {
  const seat = state.activeSeat;
  const instance = state.cards[cardId];
  if (!instance) return null;
  const printed = printedOf(ctx.cards, instance.code);
  if (costOfKind(effect, "playEvent")) {
    const cost = playCost(state, cardId, seat, ctx) ?? 0;
    const chosen = chosenX(state, cardId, ctx);
    if (!chosen && cost === 0) return null;
    const distinct = distinctRule(state, cardId, ctx);
    return { seat, cardId, total: cost, exact: !chosen, pools: poolsFor(state, ctx, seat, printed.sphere, cardId), ...(distinct ? { distinct } : {}) };
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
export function firstShares(request: Pick<PayRequest, "total" | "exact" | "pools" | "distinct">): Share[] {
  const total = request.exact ? request.total : 0;
  // "Paid from a single hero's resource pool": the first pool that holds it all.
  const single = request.distinct?.max === 1 ? request.pools.find((pool) => pool.max >= total) : undefined;
  if (single && total > 0) return [{ id: single.heroId, amount: total }];
  // "From 3 different heroes' pools": one from each of the first pools before any pool gives more.
  const given = new Map<string, number>();
  let left = total;
  for (const pool of request.pools.slice(0, Math.min(request.distinct?.min ?? 0, total))) {
    given.set(pool.heroId, 1);
    left -= 1;
  }
  for (const pool of request.pools) {
    if (left <= 0) break;
    const more = Math.min(left, pool.max - (given.get(pool.heroId) ?? 0));
    if (more <= 0) continue;
    given.set(pool.heroId, (given.get(pool.heroId) ?? 0) + more);
    left -= more;
  }
  return request.pools.filter((pool) => given.has(pool.heroId)).map((pool) => ({ id: pool.heroId, amount: given.get(pool.heroId) ?? 0 }));
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
