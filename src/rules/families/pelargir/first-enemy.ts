// Rules: rr.reveal, rr.optional-engagement, rr.step-5-2, rr.engaged, faq.reveal-and-add (data/rules/entries.json); ledger lines 05042:A:1, 05043:A:1, 05044:A:1, 05067:B:2.
// What the engine notes for the cards of Peril in Pelargir: the first enemy the encounter deck reveals each round, and an engagement the player chose in the optional engagement step. Each is noted only in a game with a record that reads it, so no other game's state moves.
import type { Condition } from "../../../catalog/boundary.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { Scope } from "../../interpret/conditions.ts";
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

/** The condition `firstEnemy`: the enemy the answered reveal is about is the first the encounter deck revealed this round. Null for any other condition. */
export function pelargirCondition(state: ScenarioState, condition: Condition, scope: Scope): boolean | null {
  return condition.kind === "firstEnemy" ? scope.subject != null && flagged(state, scope.subject, "firstEnemy") : null;
}

/** The player optionally engages the enemy (the `Engage` intent of the optional engagement step): the enemy is marked `engagedOptionally` until the phase ends, before the engagement is announced, in a game with a record that reads the flag. */
export function noteOptionalEngage(state: ScenarioState, enemyId: string, ctx: ReduceContext): ScenarioState {
  if (!state.cards[enemyId] || !gameReads(state, ctx, '"stat":"engagedOptionally"')) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: enemyId, sourceId: enemyId, stat: "engagedOptionally", amount: 1, until: "endOfPhase" }] };
}
