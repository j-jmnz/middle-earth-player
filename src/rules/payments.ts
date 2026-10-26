// Rules: rr.resource-match, rr.resources (data/rules/entries.json).
import { grantedIcons } from "./conditions.ts";
import { heroPaysFor } from "./cost-rules.ts";
import { deckPlayIcons } from "./deck-play.ts";
import { allyPools, cannotPay, flagIcons, payerOk, payingIcons } from "./families/costs-pay.ts";
import { openPools } from "./families/misc-guards.ts";
import type { Payment } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { printedOf, spherePays, type Sphere } from "./printed.ts";
import type { ScenarioState } from "./state.ts";

// A hero pays a sphere with its own icon or one an attachment gives it (Celebrían's Stone gives Aragorn a Spirit icon).
// `forCard` is the card being played: the top card of a deck is paid for by the hero that lets it be played (Gandalf).
export function heroPays(state: ScenarioState, heroId: string, sphere: Sphere | null, ctx: ReduceContext, forCard?: string): boolean {
  const hero = state.cards[heroId];
  if (!hero) return false;
  // Icons held as flags, icons a hero has while paying for some cards, pools that cannot pay for some (families/costs-pay.ts).
  if (forCard != null && cannotPay(state, heroId, forCard, ctx)) return false;
  if (spherePays(printedOf(ctx.cards, hero.code).sphere, sphere)) return true;
  if (grantedIcons(state, heroId, ctx).some((icon) => spherePays(icon, sphere))) return true;
  if (flagIcons(state, heroId).some((icon) => spherePays(icon, sphere))) return true;
  if (forCard != null && payingIcons(state, heroId, forCard, ctx).some((icon) => spherePays(icon, sphere))) return true;
  if (forCard != null && heroPaysFor(state, heroId, forCard, ctx)) return true;
  return forCard != null && deckPlayIcons(state, heroId, forCard, ctx).some((icon) => spherePays(icon, sphere));
}

// A card that belongs to a sphere needs a hero of the seat with that resource icon even when nothing is paid for it: a
// 0-cost card is no exception (rr.resource-match). A neutral card needs none. An ally whose pool pays for the card counts.
export function hasResourceMatch(state: ScenarioState, seat: number, sphere: Sphere | null, ctx: ReduceContext, forCard?: string): boolean {
  if (sphere == null || sphere === "neutral") return true;
  return [...(state.seats[seat]?.heroes ?? []), ...allyPools(state, seat, forCard, ctx), ...openPools(state, seat, forCard, ctx)].some((id) => heroPays(state, id, sphere, ctx, forCard));
}

// Checks an offered resource payment against a cost: whole numbers, heroes the seat controls, the sphere
// that may pay, what each hero holds (one hero can appear twice, so its payments are summed), and the
// exact total. Returns why it is refused, or null.
export function validatePayments(
  state: ScenarioState,
  payments: readonly Payment[],
  cost: { seat: number; sphere: Sphere | null; amount: number; forCard?: string },
  ctx: ReduceContext,
): string | null {
  const spent = new Map<string, number>();
  let sum = 0;
  for (const payment of payments) {
    if (!Number.isInteger(payment.amount) || payment.amount < 0) return "That payment is not a cost";
    sum += payment.amount;
    spent.set(payment.heroId, (spent.get(payment.heroId) ?? 0) + payment.amount);
  }
  for (const [heroId, amount] of spent) {
    const hero = state.cards[heroId];
    if (!hero || !payerOk(state, heroId, cost.seat, cost.forCard, ctx)) return "That hero cannot pay";
    if (!heroPays(state, heroId, cost.sphere, ctx, cost.forCard)) return "Wrong sphere";
    if (hero.resources < amount) return "That hero does not have those resources";
  }
  if (sum > cost.amount) return "Overpay";
  if (sum < cost.amount) return "Underpay";
  if (sum === 0 && !hasResourceMatch(state, cost.seat, cost.sphere, ctx, cost.forCard)) return "No hero matches that card's sphere";
  return null;
}
