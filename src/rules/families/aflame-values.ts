// Rules: dcce.aflame, dcce.scalable-upgradable (data/rules/entries.json); ledger lines 11038:A:1, 11038:A:2, 11182:B:5. What the aflame family reads: the Aflame value of a location, The Havens Burn
// and the cards facedown underneath it, and a scalable card's level for an amount.
import type { Condition } from "../../catalog/boundary.ts";

import { printedOf } from "../printed.ts";
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";
import { livingSeats } from "../state.ts";
import { levelOfCard } from "./dreamchaser-facts.ts";
import { facedownCount, namedInPlay } from "./misc-amounts.ts";

/** The title of the objective the destroyed Aflame locations are placed underneath (dcce.aflame). */
export const HAVENS_BURN = "The Havens Burn";

/** The Aflame value a card prints, null for a card without the keyword. */
export function aflameOf(state: ScenarioState, id: string, ctx: Pick<ReduceContext, "cards">): number | null {
  const card = state.cards[id];
  return card ? printedOf(ctx.cards, card.code).keywords.aflame : null;
}

/** The Havens Burn in play, or null in a game without one. */
export function burnId(state: ScenarioState, ctx: ReduceContext): string | null {
  return namedInPlay(state, HAVENS_BURN, ctx);
}

/** The cards facedown underneath The Havens Burn (dcce.aflame: "Cards facedown underneath The Havens Burn are considered to be out of play"). */
export function underBurn(state: ScenarioState, ctx: ReduceContext): number {
  return facedownCount(state, burnId(state, ctx));
}

/** The `underBurn` condition: the cards underneath number at least `min` and at most `max`, each plus the number of players with `players`. */
export function underBurnHolds(state: ScenarioState, condition: Extract<Condition, { kind: "underBurn" }>, ctx: ReduceContext): boolean {
  const extra = condition.players ? livingSeats(state).length : 0;
  const count = underBurn(state, ctx);
  return (condition.min == null || count >= condition.min + extra) && (condition.max == null || count <= condition.max + extra);
}

/** The amount `level`: the level of the source card in the Campaign Log, or half of it rounded up with `halved` (11184:A:1, dcce.scalable-upgradable). */
export function levelAmount(state: ScenarioState, sourceId: string | null, halved: boolean): number {
  const code = sourceId ? state.cards[sourceId]?.code : undefined;
  const level = code ? levelOfCard(state, code) : 0;
  return halved ? Math.ceil(level / 2) : level;
}

/** The cards underneath The Havens Burn against the number that loses the game, for the card that is the Burn (null for any other card): the table's pill and the preview read it. */
export function burnTally(state: ScenarioState, id: string, ctx: ReduceContext): { count: number; limit: number } | null {
  const card = state.cards[id];
  if (!card || printedOf(ctx.cards, card.code).name !== HAVENS_BURN) return null;
  return { count: facedownCount(state, id), limit: livingSeats(state).length + 3 };
}

/** The Aflame line of a location in play for its preview: its value, the damage on it and what is left before it burns ("Aflame 5: 2 of 5 damage, 3 more destroys it"). Null for any other card. */
export function aflameLine(state: ScenarioState, id: string, ctx: Pick<ReduceContext, "cards">): string | null {
  const value = aflameOf(state, id, ctx);
  const card = state.cards[id];
  if (value == null || !card) return null;
  const left = Math.max(0, value - card.damage);
  return `Aflame ${value}: ${card.damage} of ${value} damage, ${left === 1 ? "1 more damage places it" : `${left} more damage place it`} underneath The Havens Burn`;
}
