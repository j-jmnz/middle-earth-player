// Rules: rr.attachment-cards, rr.modifiers (data/rules/entries.json).
//
// The amounts the misc family adds (effect-schema-amount.ts): the cards attached facedown to the source, and the resource
// tokens the other copies of the source card hold above the number on this one.
import type { AmountExpr } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import { victoryPointsOf } from "../../core/printed-stat.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats } from "../../core/state.ts";

// The facedown attachments of a card (AttachFacedown) are out of play under it: zone "under", hosted by the card.
export function facedownCount(state: ScenarioState, hostId: string | null): number {
  if (!hostId) return 0;
  return Object.values(state.cards).filter((card) => card.zone === "under" && card.host === hostId).length;
}

/** Whether the cards facedown under a host number at least `min` and at most `max`, each plus the number of players with `players` (the `underBurn` and `facedownUnder` conditions). */
export function facedownWithin(state: ScenarioState, hostId: string | null, bounds: { min?: number; max?: number; players?: true }): boolean {
  const extra = bounds.players ? livingSeats(state).length : 0;
  const count = facedownCount(state, hostId);
  return (bounds.min == null || count >= bounds.min + extra) && (bounds.max == null || count <= bounds.max + extra);
}

// Keeping Count (04005:A:2): for the copies of the source card in play, the most resource tokens one holds, less the number the
// source holds; never below 0.
export function resourcesAboveCopies(state: ScenarioState, sourceId: string | null): number {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source) return 0;
  let most = 0;
  for (const card of Object.values(state.cards)) {
    if (card.id === source.id || card.code !== source.code || card.zone === "discard" || card.zone === "hand" || card.zone === "deck") continue;
    most = Math.max(most, card.resources);
  }
  return Math.max(0, most - source.resources);
}

// The card in play (a hero first) with this printed title, or null.
export function namedInPlay(state: ScenarioState, name: string, ctx: ReduceContext): string | null {
  const found = Object.values(state.cards)
    .filter((card) => inPlay(card.zone) && printedOf(ctx.cards, card.code).name === name)
    .sort((left, right) => Number(right.zone === "heroes") - Number(left.zone === "heroes"));
  return found[0]?.id ?? null;
}

// The active location's quest points less its progress (901302:A:2): 0 with no active location, or one that prints no quest points.
function remainingQuestPoints(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): number {
  const location = state.activeLocation ? state.cards[state.activeLocation] : undefined;
  return location ? Math.max(0, modifiedStat(state, location, "questPoints", cards) - location.progress) : 0;
}

export function miscAmount(state: ScenarioState, amount: AmountExpr, sourceId: string | null, cards: ReadonlyMap<string, PrintedCard>): number {
  if (amount.remainingQuestPoints) return remainingQuestPoints(state, cards);
  if (amount.victoryPoints) return state.victory.reduce((sum, id) => sum + victoryPointsOf(state, id, cards), 0);
  if (amount.facedown) return facedownCount(state, sourceId);
  if (amount.resourcesAboveCopies) return resourcesAboveCopies(state, sourceId);
  return 0;
}
