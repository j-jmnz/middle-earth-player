// Rules: rr.triggered-ability, rr.constant-ability, rr.player-elimination, rr.forced (data/rules/entries.json); ledger lines 143068:A:2, 143080:B:3.
//
// Pressure on the players' hands (The Road to Isengard): a card's own ability being triggered is announced to the cards that hear it (Saruman's Voice), and a player with no cards in hand is eliminated
// while the table holds `eliminatedAtEmptyHand` (stage 3B).
import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { eliminateSeat } from "../../core/eliminate.ts";
import { flagged } from "../../core/state.ts";

/** An Action or a Response a card's controller initiated, or a Forced effect of the card that triggered: the card hears it triggered, once. Only a game with a record on `abilityTriggered` announces it. */
export function announceAbility(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, '"trigger":"abilityTriggered"')) return state;
  const card = state.cards[cardId];
  return queueEvent(state, { trigger: "abilityTriggered", seat: card?.controller ?? seat, cardId });
}

/**
 * "If a player has 0 cards in his hand, he is eliminated from the game" (143080:B:3): a constant "if", checked at each settle, once the effect or the step that emptied the hand has finished (nothing is
 * resolving and no attack is under way), so a player who plays their last card is out when it has resolved. The seat's cards leave play with it (clearEliminated).
 */
export function eliminateEmptyHands(state: ScenarioState, _ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.modifiers.length === 0 || state.lost || state.stack.length > 0 || state.pendingAttack || state.pendingStrike || !flagged(state, "table", "eliminatedAtEmptyHand")) return state;
  let next = state;
  for (let index = 0; index < next.seatCount; index += 1) {
    const seat = next.seats[index];
    if (!seat || seat.eliminated || seat.hand.length > 0) continue;
    next = eliminateSeat(next, index, steps);
  }
  return next;
}
