// Rules: rr.play-and-put-into-play (data/rules/entries.json); ledger line 02128:B:1.
//
// "The player guarding Gollum cannot play cards from his hand": a card put into play is not played, so only a play is barred. The rule is `Restrict playFromHand` with `guardian` (seatBarred, interpret/restrictions.ts).
import type { PlayHow } from "../../interpret/family-manifest.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { seatBarred } from "../../interpret/restrictions.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";

/** Whether the seat that plays the card is barred from playing cards from its hand. */
export function guardBarsPlay(state: ScenarioState, ctx: ReduceContext, how: PlayHow): boolean {
  return how.putting !== true && seatBarred(state, ctx, how.seat ?? state.activeSeat, "playFromHand");
}

/** The words for a refused play of the guard, naming the card. */
export function guardBarsPlayReason(state: ScenarioState, cardId: string, ctx: ReduceContext): string | null {
  const card = state.cards[cardId];
  if (!card || !seatBarred(state, ctx, state.activeSeat, "playFromHand")) return null;
  const who = state.seatCount > 1 ? `Player ${state.activeSeat + 1} cannot` : "You cannot";
  return `${who} play ${printedOf(ctx.cards, card.code).name} or any card from their hand while guarding Gollum.`;
}
