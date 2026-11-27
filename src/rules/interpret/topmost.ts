// The card of a pile nearest its top that matches a printed type and Traits: the one reader behind "the topmost ..." of a player discard pile, the encounter discard pile and Beneath the Sands' AddTopmostFromDiscard.
import { printedOf } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";
import type { ReduceContext } from "./interpret.ts";

/** The card of `pile` (listed top first) nearest the top that matches the printed type and Traits of `match`: "the topmost Harad ally" is the Harad ally nearest the top, with plain allies above it (Kahliel's Headdress, 17010:A:3), "the topmost location in the encounter discard pile" (17079:A:1). */
export function topmostMatching(state: ScenarioState, ctx: ReduceContext, pile: readonly string[], match: { cardType?: string; trait?: string; traits?: readonly string[] }): string | null {
  return (
    pile.find((id) => {
      const instance = state.cards[id];
      if (instance == null) return false;
      const printed = printedOf(ctx.cards, instance.code);
      return (!match.cardType || printed.type === match.cardType) && (!match.trait || printed.traits.includes(match.trait)) && (!match.traits || match.traits.some((trait) => printed.traits.includes(trait)));
    }) ?? null
  );
}
