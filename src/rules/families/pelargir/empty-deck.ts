// Rules: rr.constant-ability, rr.running-out-of-cards, rr.player-elimination (data/rules/entries.json); ledger line 06030:A:2.
// "If any player has no cards in his deck, the players have lost the game" (Up in Flames): a constant "if" that the table holds as `losesAtEmptyDeck`, checked at each settle once nothing is resolving, so the player whose last card was drawn or discarded loses
// when the effect that did it has finished, and a deck that is empty when the card enters play loses at once. A player already eliminated has no deck to count.
import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

/** The settle sweep: a living seat with an empty deck loses the game for the players. Inert in a game whose records do not name the flag. */
export function lossesAtEmptyDeck(state: ScenarioState, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState {
  if (state.modifiers.length === 0 || state.lost || state.stack.length > 0 || state.pendingAttack || state.pendingStrike || !gameReads(state, ctx, '"losesAtEmptyDeck"') || !flagged(state, "table", "losesAtEmptyDeck")) return state;
  const empty = state.seats.findIndex((seat, index) => index < state.seatCount && !seat.eliminated && seat.deck.length === 0);
  return empty < 0 ? state : { ...state, lost: true, lossReason: "A player has no cards in his deck", window: null };
}
