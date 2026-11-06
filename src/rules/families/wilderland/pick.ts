// Rules: emce.evil-creatures-deck, rr.victory (data/rules/entries.json); ledger lines 18066:B:3, 18026:A:1, 18074:B:1, 18075:B:2, 18076:B:1, 19049:B:1, 19049:B:3, 19050:B:1. The wilderland family's pick filters: a card dealt into the Evil Creatures deck (`fromDeck`), and a card in a hand that player card effects cannot discard
// (the constant verb Undiscardable) when the pick feeds a discard.
import type { PickSpec } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import { isPlayerCardEffect } from "../../core/keywords.ts";
import { constantVerbCodes } from "../../interpret/constant-records.ts";
import type { PickContext } from "../../interpret/pick.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { cardsUnder, playerCardsUnder } from "../../core/zones.ts";
import { guardsTitled, isGuard } from "../objectives/pick.ts";
import { engagementBarred } from "../quest/engage.ts";
import { heroGuardedBy } from "./carried.ts";

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
  // Lost in Mirkwood's stages 3 and 4: an enemy that guards a hero, a card with a facedown player card under it, the nemesis.
  if (spec.guardsHero && heroGuardedBy(state, id) == null) return false;
  if (spec.hasFacedownUnder && playerCardsUnder(state, id).length === 0) return false;
  if (spec.nemesis && card.nemesis !== true) return false;
  // Roam Across Rhovanion: a card that guards a card (an objective's guard, or the keeper of a card held under it), a card that guards the objective with a title.
  if (spec.guardsCard && !isGuard(state, id) && cardsUnder(state, id).length === 0) return false;
  if (spec.guardsNamed != null && !guardsTitled(state, ctx, id, spec.guardsNamed)) return false;
  // Wild Creatures: an enemy a player cannot engage (cannotBeEngaged, or barred to this seat) is no enemy for them to choose (19046:A:1).
  if (spec.engageable && (flagged(state, id, "cannotBeEngaged") || engagementBarred(state, id, at.seat, "engage"))) return false;
  // "Cannot be discarded by player card effects": a pick from the hand that the effect discards leaves the card out. A pick that gives, swaps or moves a card still offers it.
  if (spec.from === "hand" && (at.discards || spec.discarded) && !at.counting && barredFromPlayerDiscard(state, ctx, id, at.sourceId)) return false;
  return true;
}
