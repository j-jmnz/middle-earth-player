// Rules: rr.reveal, rr.step-5-2, faq.reveal-and-add (data/rules/entries.json); ledger line 05067:B:2.
// What the engine notes for Escape to the Quays: the first enemy the encounter deck reveals each round. It is noted only in a game with a record that reads it, so no other game's state moves.
import type { Condition } from "../../../catalog/boundary.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { Scope } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { someDeckEmpty } from "./empty-deck.ts";
import { underworldReleased } from "./underworld.ts";
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

/** The conditions `firstEnemy`, `underworldReleased`, `encounterCanReveal` and `deckEmpty`: the enemy the answered reveal is about is the first the encounter deck revealed this round. Null for any other condition. */
export function pelargirCondition(state: ScenarioState, condition: Condition, scope: Scope): boolean | null {
  if (condition.kind === "underworldReleased") return underworldReleased(state);
  if (condition.kind === "deckEmpty") return someDeckEmpty(state);
  // The encounter deck is reset from the discard pile in the quest phase only (rr.running-out-of-cards).
  if (condition.kind === "encounterCanReveal") return state.encounterDeck.length > 0 || (state.phase === "Quest" && state.encounterDiscard.length > 0);
  return condition.kind === "firstEnemy" ? scope.subject != null && flagged(state, scope.subject, "firstEnemy") : null;
}
