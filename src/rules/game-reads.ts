import type { Effect } from "../catalog/boundary.ts";

import type { ReduceContext } from "./interpret.ts";
import type { ScenarioState } from "./state.ts";

// Card codes whose records mention a piece of vocabulary, per effect list.
const READERS = new WeakMap<readonly Effect[], Map<string, ReadonlySet<string>>>();

// Whether a card in the game has a record that reads this piece of vocabulary. What the engine remembers only for such a card
// (resources spent this round, who paid for a card, a successful quest) is kept only in a game that has one, so every other
// game's state stays as it was.
export function gameReads(state: ScenarioState, ctx: ReduceContext, needle: string): boolean {
  let byNeedle = READERS.get(ctx.effects);
  if (!byNeedle) {
    byNeedle = new Map();
    READERS.set(ctx.effects, byNeedle);
  }
  let codes = byNeedle.get(needle);
  if (!codes) {
    codes = new Set(ctx.effects.filter((effect) => JSON.stringify(effect).includes(needle)).map((effect) => effect.cardCode));
    byNeedle.set(needle, codes);
  }
  const found = codes;
  return found.size > 0 && Object.values(state.cards).some((card) => found.has(card.code));
}
