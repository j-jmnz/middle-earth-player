// Rules: docs/scenarios/standalone-scenarios/the-hunt-for-the-dreadnaught.md (The Hunt for the Dreadnaught, reading 21); ledger lines 40014:A:1, 40021:A:1 to 40023:A:1, 40034:A:2. Pillage X: after the enemy's attack on a player has resolved, defended or not, that player discards the top X cards
// of their deck, one at a time (all of them when fewer remain). An attack that was canceled makes none. The attack's end adds the instruction (combat/shadow.ts finishAttack); each event card discarded this way is announced as `pillaged`, which the
// Forced lines of Corsair Plunderer, Daring Buccaneer and Fierce Marauder hear, once for each card.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldAmount } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Focus } from "../index.ts";

/** The Pillage X the enemy has now: its printed keyword and what a card gave it ("gains Pillage 3"). 0 for an enemy with none. */
export function pillageAmount(state: ScenarioState, enemyId: string, ctx: ReduceContext): number {
  const enemy = state.cards[enemyId];
  if (!enemy) return 0;
  return (printedOf(ctx.cards, enemy.code).keywords.pillage ?? 0) + (state.modifiers.length > 0 ? Math.max(0, heldAmount(state, enemyId, "pillage")) : 0);
}

/** The instruction the end of an attack by this enemy leaves for Pillage, or null for an enemy with none. */
export function pillageAfter(state: ScenarioState, enemyId: string, ctx: ReduceContext): Instruction | null {
  const amount = pillageAmount(state, enemyId, ctx);
  return amount > 0 ? { verb: "Pillage", amount } : null;
}

/** Pillage: the actor discards the top `amount` cards of their deck, one at a time; each event card is announced as `pillaged` (the source enemy, the card as the other card). */
export function pillage(state: ScenarioState, instruction: Extract<Instruction, { verb: "Pillage" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  let next = state;
  for (let discarded = 0; discarded < amount; discarded += 1) {
    const top = next.seats[focus.seat]?.deck[0];
    if (!top) break;
    next = queueEvent(moveCard(next, top, { zone: "discard", seat: focus.seat }), { trigger: "discardedFromDeck", seat: focus.seat, cardId: top });
    if (focus.sourceId && printedOf(ctx.cards, next.cards[top]?.code ?? "").type === "event") next = queueEvent(next, { trigger: "pillaged", seat: focus.seat, cardId: focus.sourceId, other: top });
  }
  return next;
}
