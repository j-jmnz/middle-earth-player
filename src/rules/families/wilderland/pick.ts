// Rules: emce.evil-creatures-deck, rr.victory (data/rules/entries.json); ledger lines 18066:B:3, 18026:A:1. The wilderland family's pick filters: a card dealt into the Evil Creatures deck (`fromDeck`), and a card in a hand that player card effects cannot discard
// (the constant verb Undiscardable) when the pick feeds a discard.
import type { PickSpec } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import { isPlayerCardEffect } from "../../core/keywords.ts";
import { constantVerbCodes } from "../../interpret/constant-records.ts";
import type { PickContext } from "../../interpret/pick.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";

/** Whether a card in a hand is barred from the discards a player card makes (the constant verb Undiscardable) and `sourceId` is a player card effect: its effect, a cost it takes or a random discard. A game rule or an encounter card's effect is not barred. */
export function barredFromPlayerDiscard(state: ScenarioState, ctx: ReduceContext, id: string, sourceId: string | null): boolean {
  const card = state.cards[id];
  return card != null && constantVerbCodes(ctx, "Undiscardable").has(card.code) && isPlayerCardEffect(state, ctx.cards, sourceId);
}

/** False when the card is not one the filter allows: not from the named deck, or a card in hand a player card cannot discard. True leaves the other filters to decide. */
export function wilderlandPickMatches(state: ScenarioState, id: string, spec: PickSpec, at: PickContext, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  if (!card) return true;
  if (spec.fromDeck != null && card.deck !== spec.fromDeck) return false;
  if (spec.objectiveLocation && !printedOf(ctx.cards, card.code).objectiveLocation) return false;
  if (spec.guardsObjectiveLocation) {
    const host = card.host ? state.cards[card.host] : undefined;
    if (!card.guard || !host || !printedOf(ctx.cards, host.code).objectiveLocation) return false;
  }
  // "Cannot be discarded by player card effects": a pick from the hand that the effect discards leaves the card out. A pick that gives, swaps or moves a card still offers it.
  if (spec.from === "hand" && (at.discards || spec.discarded) && !at.counting && barredFromPlayerDiscard(state, ctx, id, at.sourceId)) return false;
  return true;
}
