// Rules: rr.resource-match, rr.resources (data/rules/entries.json).
import type { Payment } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { printedOf, spherePays, type Sphere } from "./printed.ts";
import type { ScenarioState } from "./state.ts";

// Checks an offered resource payment against a cost: whole numbers, heroes the seat controls, the sphere
// that may pay, what each hero holds (one hero can appear twice, so its payments are summed), and the
// exact total. Returns why it is refused, or null.
export function validatePayments(
  state: ScenarioState,
  payments: readonly Payment[],
  cost: { seat: number; sphere: Sphere | null; amount: number },
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
    if (!hero || hero.zone !== "heroes" || hero.controller !== cost.seat) return "That hero cannot pay";
    if (!spherePays(printedOf(ctx.cards, hero.code).sphere, cost.sphere)) return "Wrong sphere";
    if (hero.resources < amount) return "That hero does not have those resources";
  }
  if (sum > cost.amount) return "Overpay";
  if (sum < cost.amount) return "Underpay";
  return null;
}
