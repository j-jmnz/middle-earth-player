// Rules: emce.evil-creatures-deck (data/rules/entries.json); ledger lines 18066:B:3, 18026:A:1. The wilderland family's pick filters: a card dealt into the Evil Creatures deck (`fromDeck`), and a card in a hand that player card effects cannot discard
// (the constant verb Undiscardable).
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { PickContext } from "../../interpret/pick.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { isPlayerType, printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";

// The codes of the cards with a record that names the marker Undiscardable, found by card code and kept for the effect list (which is never changed after the reducer is handed it).
const UNDISCARDABLE = new WeakMap<ReduceContext["effects"], ReadonlySet<string>>();

function undiscardable(ctx: ReduceContext): ReadonlySet<string> {
  let codes = UNDISCARDABLE.get(ctx.effects);
  if (!codes) {
    codes = new Set(ctx.effects.filter((effect) => effect.instructions.some((instruction) => instruction.verb === "Undiscardable")).map((effect) => effect.cardCode));
    UNDISCARDABLE.set(ctx.effects, codes);
  }
  return codes;
}

/** Whether a card in a hand is barred from the discards a player card makes (the Undiscardable marker) and `sourceId` is a player card: its effect, a cost it takes or a random discard. A game rule or an encounter card's effect is not barred. */
export function barredFromPlayerDiscard(state: ScenarioState, ctx: ReduceContext, id: string, sourceId: string | null): boolean {
  const card = state.cards[id];
  const source = sourceId ? state.cards[sourceId] : undefined;
  return card != null && source != null && isPlayerType(printedOf(ctx.cards, source.code)) && undiscardable(ctx).has(card.code);
}

/** False when the card is not one the filter allows: not from the named deck, or a card in hand a player card cannot discard. True leaves the other filters to decide. */
export function wilderlandPickMatches(state: ScenarioState, id: string, spec: PickSpec, at: PickContext, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  if (!card) return true;
  if (spec.fromDeck != null && card.deck !== spec.fromDeck) return false;
  // "Cannot be discarded by player card effects": a pick from the hand made for a player card's effect leaves the card out.
  if (spec.from === "hand" && !at.counting && barredFromPlayerDiscard(state, ctx, id, at.sourceId)) return false;
  return true;
}
