// Rules: dcce.stormcaller-elite (data/rules/entries.json); ledger lines 11078:A:3, 11076:A:2, 11188:A:2. What the aflame family adds to the attacks: a player attack declared against an enemy is heard once by that enemy
// (the event `enemyAttacked`), the damage a card pays for with its resources, and the limit of characters that can attack an enemy each round.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { gameReads } from "../../core/game-reads.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { PendingStrike, ScenarioState } from "../../core/state.ts";
import { flagged, heldAmount, livingSeats, updateCard } from "../../core/state.ts";

/** A player attack was declared against an enemy: the enemy hears it once, however many characters attack it ("When Na'asiyah ... defends", 11078:A:3). Queued only in a game with a card that hears it. */
export function announceEnemyAttacked(state: ScenarioState, seat: number, enemyId: string, attackerIds: readonly string[], ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, '"trigger":"enemyAttacked"')) return state;
  return queueEvent(state, { trigger: "enemyAttacked", seat, cardId: enemyId, participants: attackerIds });
}

/** "For each point of damage Captain Sahír would take, discard 1 resource from him and cancel that damage" (11076:A:2): the damage a card holding the flag resourceShield would take is paid for with its
 * resources first; what they cannot pay is placed. */
export function resourceShield(state: ScenarioState, id: string, amount: number): { state: ScenarioState; amount: number } {
  const card = state.cards[id];
  if (!card || amount <= 0 || !flagged(state, id, "resourceShield")) return { state, amount };
  const paid = Math.min(card.resources, amount);
  return paid > 0 ? { state: updateCard(state, id, { resources: card.resources - paid }), amount: amount - paid } : { state, amount };
}

/** Each seat collected its resources in the resource phase (rr.step-1-2): it hears `resourcesCollected` ("After the engaged player collects resources", 11065:A:2). The event is queued before the grant draws, and the
 * queue drains in settle after the draws, so the Forced effect resolves once they are done. Queued only in a game with a card that hears it. */
export function announceCollected(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, '"trigger":"resourcesCollected"')) return state;
  return livingSeats(state).reduce((next, seat) => queueEvent(next, { trigger: "resourcesCollected", seat, phase: "Resource" }), state);
}

/** "No more than 1 character can attack Graxar each round" (11188:A:2): the characters already declared against the enemy this round have used up its limit. */
export function attackerLimitReached(state: ScenarioState, enemyId: string): boolean {
  const limit = heldAmount(state, enemyId, "attackerLimit");
  return limit > 0 && heldAmount(state, enemyId, "attackersThisRound") >= limit;
}

/** The reason a declaration of `count` attackers against the enemy is refused by its limit, or null. */
export function attackerLimitReason(state: ScenarioState, enemyId: string, count: number): string | null {
  const limit = heldAmount(state, enemyId, "attackerLimit");
  if (limit <= 0) return null;
  return heldAmount(state, enemyId, "attackersThisRound") + count > limit ? `No more than ${limit} character${limit === 1 ? "" : "s"} can attack that enemy each round` : null;
}

/** The characters declared in a player attack are counted against the limit of the enemy they attack, until the end of the round. */
export function noteAttackers(state: ScenarioState, strike: PendingStrike): ScenarioState {
  if (heldAmount(state, strike.enemyId, "attackerLimit") <= 0) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: strike.enemyId, sourceId: strike.enemyId, stat: "attackersThisRound", amount: strike.attackerIds.length, until: "endOfRound" }] };
}
