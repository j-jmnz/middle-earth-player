// Rules: rr.resource-match, rr.resources (data/rules/entries.json).
//
// The constants and lasting effects that change what a card costs and who may pay for it: "Reduce the cost of the next Silvan
// ally you play this phase by 1" (ReduceNextCost, a discount on the state), "the first Rohan ally you play each round costs 1
// less" (ReduceCostOf), "does not require a resource match" (IgnoreResourceMatch), "You may use resources from ~'s pool to pay
// for Outlands allies of any sphere" (PaysFor), "You must use resources from 3 different heroes' pools" (PayDistinctHeroes).
import type { Instruction, PickSpec } from "../../catalog/boundary.ts";

import { resolveAmount } from "../interpret/amounts.ts";
import { constantInstructions } from "../interpret/constant-records.ts";
import { holds } from "../interpret/conditions.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { effectsOf } from "../windows/listen.ts";
import { spendsAsSphere } from "../families/misc/cost.ts";
import { hostDiscount } from "../families/sidequests/contract.ts";
import { matchesPick } from "../interpret/pick.ts";
import { printedOf } from "../core/printed.ts";
import type { Discount, ScenarioState } from "../core/state.ts";

// Whether the card in hand matches a cost rule's filter, read from the playing seat's side (its zone is not read).
function fits(state: ScenarioState, cardId: string, pick: PickSpec, seat: number, ctx: ReduceContext): boolean {
  return matchesPick(state, cardId, pick, { seat, sourceId: null, counting: true }, ctx);
}

// The seat already played a card this round that matched (so "the first ... each round" is spent).
// `thisPhase`: only the plays of the current phase count ("the first ... each planning phase").
// `anySeat`: the plays of every seat count, each read from its own seat ("the first ally played by the players each round", 12098:A:1).
function playedMatching(state: ScenarioState, seat: number, pick: PickSpec, cardId: string, ctx: ReduceContext, thisPhase = false, anySeat = false): boolean {
  return (state.played ?? []).some(
    (entry) =>
      entry.round === state.round && (!thisPhase || (entry.phase ?? "Planning") === state.phase) && (anySeat || entry.seat === seat) && entry.id !== cardId && state.cards[entry.id] != null && fits(state, entry.id, pick, anySeat ? entry.seat : seat, ctx),
  );
}

// The first discount of the seat the card would spend.
export function discountFor(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): Discount | undefined {
  return (state.discounts ?? []).find((discount) => (discount.seat === seat || discount.anySeat) && fits(state, cardId, discount.pick, seat, ctx));
}

type CostRule = Extract<Instruction, { verb: "ReduceCostOf" | "IgnoreResourceMatch" | "PaysFor" }>;

// The constant cost rules of the cards the seat controls in play, of one verb, that apply to this card now.
function rules(state: ScenarioState, verb: CostRule["verb"], cardId: string, seat: number, ctx: ReduceContext): { sourceId: string; rule: CostRule }[] {
  const found: { sourceId: string; rule: CostRule }[] = [];
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    // A rule of a card in the victory display belongs to no player: it applies to every seat (The Storm Comes, 16013:A:2).
    const anyPlayer = instruction.verb === "ReduceCostOf" && instruction.anyPlayer === true;
    if (instruction.verb !== verb || (source.zone !== "victory" && !anyPlayer && (source.controller ?? state.firstPlayer) !== seat)) continue;
    const rule = instruction as CostRule;
    if (!fits(state, cardId, rule.pick, seat, ctx)) continue;
    if (rule.verb !== "PaysFor" && rule.firstEachRound && playedMatching(state, seat, rule.pick, cardId, ctx, false, anyPlayer)) continue;
    if (rule.verb === "IgnoreResourceMatch" && rule.firstEachPhase && playedMatching(state, seat, rule.pick, cardId, ctx, true)) continue;
    found.push({ sourceId: source.id, rule });
  }
  return found;
}

// How much less the card costs from the discounts and ReduceCostOf constants, and the floor any of them names.
export function costReduction(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext, hostId?: string | null): { amount: number; min: number } {
  let amount = 0;
  let min = 0;
  const discount = discountFor(state, cardId, seat, ctx);
  if (discount) {
    amount += discount.amount;
    min = Math.max(min, discount.min ?? 0);
  }
  for (const { sourceId, rule } of rules(state, "ReduceCostOf", cardId, seat, ctx)) {
    if (rule.verb !== "ReduceCostOf") continue;
    const source = state.cards[sourceId];
    if (rule.onHost === "self" && hostId !== sourceId) continue;
    if (rule.onHost === "host" && (hostId == null || hostId !== source?.host)) continue;
    amount += resolveAmount(state, rule.amount, { actor: seat, sourceId }, ctx);
    min = Math.max(min, rule.min ?? 0);
  }
  // The first card played on each hero each round (the sidequests family's ReduceFirstOnEachHero).
  amount += hostDiscount(state, cardId, seat, ctx, hostId);
  return { amount, min };
}

// How much more the card costs from the IncreaseCost constants of the cards in play, every one of them (an encounter card's rule binds every player; 09066:A:2): each whose `pick` the card matches adds its amount, and each is read once.
export function costIncrease(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): number {
  let amount = 0;
  for (const { instruction } of constantInstructions(state, ctx)) if (instruction.verb === "IncreaseCost" && (instruction.fromHand !== true || state.cards[cardId]?.zone === "hand") && fits(state, cardId, instruction.pick, seat, ctx)) amount += instruction.amount;
  return amount;
}

// The card a seat just played spends the discount it used.
export function spendDiscount(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): ScenarioState {
  const discount = discountFor(state, cardId, seat, ctx);
  if (!discount) return state;
  return { ...state, discounts: (state.discounts ?? []).filter((entry) => entry !== discount) };
}

// Whether this hero's resources may pay for the card regardless of sphere: the card needs no resource match, or the hero
// pays for cards like it (of the spheres it names).
export function heroPaysFor(state: ScenarioState, heroId: string, cardId: string, ctx: ReduceContext): boolean {
  const hero = state.cards[heroId];
  if (!hero || hero.controller == null) return false;
  const seat = hero.controller;
  if (rules(state, "IgnoreResourceMatch", cardId, seat, ctx).length > 0) return true;
  // The discount the card would spend says it needs no resource match ("That ally does not require a resource match").
  if (discountFor(state, cardId, seat, ctx)?.noMatch) return true;
  const sphere = printedOf(ctx.cards, state.cards[cardId]?.code ?? "").sphere;
  // A lasting effect names a sphere: resources of any sphere pay for its cards (A Good Harvest, families/misc/cost.ts).
  if (spendsAsSphere(state, seat, sphere)) return true;
  return rules(state, "PaysFor", cardId, seat, ctx).some(
    ({ sourceId, rule }) => rule.verb === "PaysFor" && sourceId === heroId && (rule.spheres == null || (sphere != null && rule.spheres.includes(sphere))),
  );
}

// Why these payments break the card's own payment rule ("from 3 different heroes' pools"), or null.
/** The refusal for a card that must be paid from at least `need` different heroes' pools, and the number it names (null for any other refusal): one definition, so the player's words read the number back without matching the wording elsewhere. */
export const fewestHeroesReason = (need: number): string => `Pay from at least ${need} different heroes`;
export function fewestHeroesIn(reason: string): number | null {
  const found = /^Pay from at least (\d+) different heroes$/.exec(reason);
  return found ? Number(found[1]) : null;
}

export function distinctHeroesReason(state: ScenarioState, cardId: string, payments: readonly { heroId: string; amount: number }[], ctx: ReduceContext): string | null {
  const code = state.cards[cardId]?.code ?? "";
  const heroes = new Set(payments.filter((payment) => payment.amount > 0).map((payment) => payment.heroId)).size;
  const scope = { actor: state.activeSeat, sourceId: cardId, returned: 0 };
  for (const effect of effectsOf(ctx, code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb !== "PayDistinctHeroes" || (instruction.when && !holds(state, instruction.when, scope, ctx))) continue;
      if (instruction.min != null && heroes < instruction.min) return fewestHeroesReason(instruction.min);
      if (instruction.max != null && heroes > instruction.max) return instruction.max === 1 ? "Pay from a single hero" : `Pay from at most ${instruction.max} heroes`;
    }
  }
  return null;
}
