// Rules: rr.optional-engagement (data/rules/entries.json); ledger line 12192:A:1. The wilderland family's optional-engagement hook: an enemy that holds the flag optionalEngageUnique can be optionally engaged only by a player who has a
// unique enemy engaged with them ("cannot be optionally engaged except by a player who is engaged with a unique enemy"). An engagement check engages it as usual.
import type { PrintedCard } from "../../core/printed.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";

/** The unique enemies engaged with the seat, by id: a player "engaged with a unique enemy" (12191:A:1, 12192:A:1). */
export function uniqueEnemiesEngaged(state: ScenarioState, seat: number, cards: ReadonlyMap<string, PrintedCard>): string[] {
  return (state.seats[seat]?.engaged ?? []).filter((id) => printedOf(cards, state.cards[id]?.code ?? "").isUnique === true);
}

/** True when the enemy holds optionalEngageUnique and the seat has no unique enemy engaged with it. */
export function optionalEngageBarred(state: ScenarioState, enemyId: string, seat: number, cards: ReadonlyMap<string, PrintedCard>): boolean {
  if (!flagged(state, enemyId, "optionalEngageUnique")) return false;
  return uniqueEnemiesEngaged(state, seat, cards).length === 0;
}
