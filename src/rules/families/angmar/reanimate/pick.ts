// Rules: mec108.reanimated-dead, rr.in-play-and-out-of-play, rr.unique-cards (data/rules/entries.json); ledger lines 10153:A:2, 101160:A:1, 101160:A:2.
// The pick filters of The Dread Realm: a Reanimated Dead (`reanimated`), every card in play of any kind (`allInPlay`: the pool "Sorcery cards in play" counts) and a copy of the defending character (`copyOfDefender`).
import type { PickSpec } from "../../../../catalog/boundary.ts";

import { isReanimatedCode, printedOf } from "../../../core/printed.ts";
import { inPlay, type ScenarioState } from "../../../core/state.ts";
import type { ReduceContext } from "../../../interpret/interpret.ts";

/** False for a card the filters `reanimated` or `copyOfDefender` rule out; true when the pick asks neither. */
export function reanimatedPickMatches(state: ScenarioState, id: string, spec: PickSpec, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  if (spec.reanimated === true && !(card != null && isReanimatedCode(card.code))) return false;
  if (spec.copyOfDefender !== true) return true;
  const defenderId = state.pendingAttack?.defenderId;
  const defender = defenderId && !state.pendingAttack?.undefended ? state.cards[defenderId] : undefined;
  return card != null && defender != null && card.id !== defender.id && printedOf(ctx.cards, card.code).name === printedOf(ctx.cards, defender.code).name;
}

/** The pool of `allInPlay`: the heroes and allies, their attachments, the enemies, the locations, the quest cards and everything attached to any of them. Null when the pick is not asking for it. */
export function allInPlayPool(state: ScenarioState, spec: PickSpec): string[] | null {
  if (spec.allInPlay !== true) return null;
  return Object.values(state.cards)
    .filter((card) => inPlay(card.zone) && card.zone !== "campaign" && card.zone !== "nightmare" && card.zone !== "modeCard" && card.zone !== "seatStaging")
    .map((card) => card.id);
}
