// Rules: rr.constant-ability, rr.running-out-of-cards, rr.player-elimination (data/rules/entries.json); ledger line 06030:A:2.
// "If any player has no cards in his deck, the players have lost the game" (Up in Flames): a constant record whose condition is `deckEmpty` and whose instruction is LoseGame, which the core ends the game for as soon as nothing is resolving (interpret/constants.ts constantWin).
// A player already eliminated has no deck to count.
import type { ScenarioState } from "../../core/state.ts";

/** The condition `deckEmpty`: a seat still in the game has no card in its deck. */
export function someDeckEmpty(state: ScenarioState): boolean {
  return state.seats.some((seat, index) => index < state.seatCount && !seat.eliminated && seat.deck.length === 0);
}
