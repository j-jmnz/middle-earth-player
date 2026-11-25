// Rules: rr.reveal, rr.step-5-2, faq.reveal-and-add (data/rules/entries.json); ledger line 05067:B:2.
// What the engine notes for Escape to the Quays: the first enemy the encounter deck reveals each round. It is noted only in a game with a record that reads it, so no other game's state moves.
import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";

/** A card was revealed (the `revealed` hook): the first enemy the encounter deck itself reveals in a round is marked `firstEnemy` until the phase ends, and the table remembers one was revealed until the round ends. An enemy a search, a shadow card or a discard added is no reveal. */
export function noteFirstEnemy(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  const top = topFrame(state);
  if (!card || top?.data.kind !== "reveal" || top.data.fromDeck !== true || top.cardId !== cardId) return state;
  if (printedOf(ctx.cards, card.code).type !== "enemy" || flagged(state, "table", "firstEnemyNoted") || !gameReads(state, ctx, '"kind":"firstEnemy"')) return state;
  const mark = (instanceId: string, stat: "firstEnemy" | "firstEnemyNoted", until: "endOfPhase" | "endOfRound") => ({ instanceId, sourceId: cardId, stat, amount: 1, until });
  return { ...state, modifiers: [...state.modifiers, mark("table", "firstEnemyNoted", "endOfRound"), mark(cardId, "firstEnemy", "endOfPhase")] };
}
