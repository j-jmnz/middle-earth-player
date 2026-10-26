// Rules: rr.setup, rr.initial-threat-level, rr.modifiers, rr.engagement-check (data/rules/entries.json).
//
// Numbers the costs family changes outside a card play: a hero's threat cost ("Each hero you control with a printed Lore
// resource icon gets -1 threat cost"), which setup adds up for the starting threat, and the engagement cost an enemy has while
// it makes an engagement check with one player ("While an Orc is making an engagement check with you, it gets +5 engagement
// cost").
import { resolveAmount } from "../amounts.ts";
import { constantInstructions } from "../constant-records.ts";
import type { ReduceContext } from "../interpret.ts";
import { pickCandidates } from "../pick.ts";
import { printedOf, type PrintedCard } from "../printed.ts";
import { engagementCostOf } from "../quest.ts";
import type { CardInstance, ScenarioState } from "../state.ts";
import { modifierActive } from "../state.ts";

// A hero's threat cost: its printed threat less each ThreatCost that applies to it, not below 0 (rr.modifiers).
export function threatCostOf(state: ScenarioState, heroId: string, ctx: ReduceContext): number {
  const hero = state.cards[heroId];
  if (!hero) return 0;
  const printed = printedOf(ctx.cards, hero.code);
  if (printed.type !== "hero") return 0;
  let cost = printed.threat ?? 0;
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "ThreatCost") continue;
    const seat = source.controller ?? state.firstPlayer;
    const applies = instruction.holders ? pickCandidates(state, instruction.holders, seat, [], source.id, ctx, undefined, undefined, true).includes(heroId) : source.id === heroId;
    if (applies) cost -= resolveAmount(state, instruction.less, { actor: seat, sourceId: source.id }, ctx);
  }
  return Math.max(0, cost);
}

// How much lower than their printed threat the seat's heroes' threat costs are: setup's starting threat drops by it.
export function threatCostCut(state: ScenarioState, seat: number, ctx: ReduceContext): number {
  if (!ctx.effects.some((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "ThreatCost"))) return 0;
  return (state.seats[seat]?.heroes ?? []).reduce((cut, id) => cut + (printedOf(ctx.cards, state.cards[id]?.code ?? "").threat ?? 0) - threatCostOf(state, id, ctx), 0);
}

// The engagement cost an enemy checks against this seat's threat: its engagement cost plus each engagementCheckCost it holds
// from a card that seat controls. Null for a card with no engagement cost.
export function checkCost(state: ScenarioState, instance: CardInstance, seat: number, cards: ReadonlyMap<string, PrintedCard>): number | null {
  const cost = engagementCostOf(state, instance, cards);
  if (cost == null) return null;
  let extra = 0;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "engagementCheckCost" || modifier.instanceId !== instance.id || !modifierActive(state, modifier)) continue;
    if (state.cards[modifier.sourceId]?.controller === seat) extra += modifier.amount;
  }
  return cost + extra;
}
