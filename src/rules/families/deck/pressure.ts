// Rules: rr.triggered-ability, rr.constant-ability, rr.player-elimination, rr.forced (data/rules/entries.json); ledger lines 143068:A:2, 143080:B:3, 09073:B:3, 09074:B:2.
//
// Pressure on the players' hands (The Road to Isengard): a card's own ability being triggered is announced to the cards that hear it (Saruman's Voice), and a player with no cards in hand is eliminated
// while the table holds `eliminatedAtEmptyHand` (stage 3B); a player with no cards in his deck is eliminated while the table holds `eliminatedAtEmptyDeck` (Deadmen's Dike).
import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { eliminateSeat } from "../../core/eliminate.ts";
import { flagged } from "../../core/state.ts";

/**
 * An Action or a Response a card's controller initiated, or a Forced effect of the card that triggered: the card hears it triggered, once (`abilityTriggered`). An Action or a Response a player triggered (`byPlayer`: the Action or Response of a card in play, an event
 * played for its Action or Response) is also announced as `playerAbilityTriggered` to the cards that hear "a player triggers an Action or Response effect" (09040:A:1; rr.triggered-ability). Only a game with a record on the trigger announces it.
 */
export function announceAbility(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext, byPlayer = false): ScenarioState {
  const card = state.cards[cardId];
  let next = state;
  if (gameReads(state, ctx, '"trigger":"abilityTriggered"')) next = queueEvent(next, { trigger: "abilityTriggered", seat: card?.controller ?? seat, cardId });
  if (byPlayer && gameReads(state, ctx, '"trigger":"playerAbilityTriggered"')) next = queueEvent(next, { trigger: "playerAbilityTriggered", seat: card?.controller ?? seat, cardId });
  return next;
}

/** An event played for its Action (09040:A:1): announced as a triggered Action to the cards that hear a player trigger one; the event's own `abilityTriggered` stays unannounced, so The Road to Isengard's Saruman's Voice hears what it always did. */
export function announceEventAction(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): ScenarioState {
  return gameReads(state, ctx, '"trigger":"playerAbilityTriggered"') ? queueEvent(state, { trigger: "playerAbilityTriggered", seat, cardId }) : state;
}

/** The first player discards cards from the top of a deck: one `deckTopDiscarded` event for the whole discard effect or cost (09038:A:2), when at least one card moved. */
export function announceTopDiscard(state: ScenarioState, seat: number, moved: number, ctx: ReduceContext): ScenarioState {
  return moved > 0 && gameReads(state, ctx, '"trigger":"deckTopDiscarded"') ? queueEvent(state, { trigger: "deckTopDiscarded", seat }) : state;
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

/**
 * "If a player has no cards in his deck, he is eliminated from the game" (09073:B:3, 09074:B:2): the same constant "if" as the empty hand, checked at each settle once nothing is resolving, so the player whose last card was drawn or discarded
 * is out when the effect has finished (rr.constant-ability, rr.player-elimination). The seat's cards, enemies and first player token follow the elimination rule (eliminateSeat).
 */
export function eliminateEmptyDecks(state: ScenarioState, _ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.modifiers.length === 0 || state.lost || state.stack.length > 0 || state.pendingAttack || state.pendingStrike || !flagged(state, "table", "eliminatedAtEmptyDeck")) return state;
  let next = state;
  for (let index = 0; index < next.seatCount; index += 1) {
    const seat = next.seats[index];
    if (!seat || seat.eliminated || seat.deck.length > 0) continue;
    next = eliminateSeat(next, index, steps);
  }
  return next;
}

/** Both empty-pile sweeps of this family, in one settle step. */
export function eliminateEmptyPiles(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  return eliminateEmptyDecks(eliminateEmptyHands(state, ctx, steps), ctx, steps);
}
