// Rules: rr.effects, mec108.side-quests (data/rules/entries.json); ledger line 09067:A:2. "Cards in each player's discard pile cannot leave that player's discard pile by player card effect": the table flag `discardLocked`, held while The Power of Angmar is in the staging area.
import { isPlayerCardEffect } from "../../core/keywords.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";

/** Whether the effect of this source cannot take a card out of a discard pile now: the table holds `discardLocked` and the source is a player card (an effect with no source card is not a player card effect). An encounter card's effect, Norbury Tombs' or The Power of Angmar's own, is not stopped. */
export function discardLockedFor(state: ScenarioState, sourceId: string | null, ctx: ReduceContext): boolean {
  return sourceId != null && flagged(state, "table", "discardLocked") && isPlayerCardEffect(state, ctx.cards, sourceId);
}

/** Whether the table holds the lock at all (the play of a card from the discard pile is a player card's own text). */
export function discardsLocked(state: ScenarioState): boolean {
  return flagged(state, "table", "discardLocked");
}
