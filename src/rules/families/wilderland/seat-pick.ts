// Rules: (data/rules/entries.json) none; ledger lines 12191:A:1, 50818:A:2, 04106:A:1. The pick filter the wilderland family adds to a pick of players. A module of its own (it imports no rules code) so the core's pick can read it without a cycle.
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";
import { uniqueEnemiesEngaged } from "./engage.ts";

/** `engagedWithUnique` on a player pick: only a player with a unique enemy engaged with them (12191:A:1). Any other player pick keeps every seat. */
export function seatPickMatches(state: ScenarioState, seat: number, spec: PickSpec, ctx: ReduceContext): boolean {
  // `highestThreat`: the players with the highest threat among the living ones (10041:A:1); the chooser decides among those tied.
  if (spec.highestThreat) {
    const living = livingSeats(state);
    if (state.seats[seat]?.threat !== Math.max(...living.map((index) => state.seats[index]?.threat ?? 0))) return false;
  }
  // `canSpendResources`: the heroes the player controls hold that many resources between them (50818:A:2).
  if (spec.canSpendResources != null) {
    const held = (state.seats[seat]?.heroes ?? []).reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0), 0);
    if (held < spec.canSpendResources) return false;
  }
  // `deckHasCards`: the player's deck holds a card (04106:A:1).
  if (spec.deckHasCards === true && (state.seats[seat]?.deck.length ?? 0) === 0) return false;
  if (!spec.engagedWithUnique) return true;
  return uniqueEnemiesEngaged(state, seat, ctx.cards).length > 0;
}
