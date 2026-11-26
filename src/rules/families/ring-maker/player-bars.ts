// Rules: rr.cannot, rr.effects, rr.player-deck, rr.immune (data/rules/entries.json); ledger lines 08095:B:3, 08096:B:3.
// The table flags the stages 2 of The Nîn-in-Eilph hold while they are the current quest: a bar on what player card effects give (`cannotGainResourcesByPlayerCard`, `cannotDrawByPlayerCard`, read where a resource is gained and where cards are drawn: the framework's draws and the
// resource phase's collection are no card effect, so they stand) and the price of committing to the quest (`commitDiscardsRandom`: the player discards a card at random from his hand first, and with none cannot commit).
import type { ReduceContext } from "../../interpret/interpret.ts";
import { discardRandom } from "../../interpret/verbs.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";

/** "Player card effects cannot be used to gain resources" (08095:B:3): a resource a player card's effect would give is not gained. */
export function resourcesBarredByPlayerCard(state: ScenarioState): boolean {
  return state.modifiers.length > 0 && flagged(state, "table", "cannotGainResourcesByPlayerCard");
}

/** "Player card effects cannot be used to ... draw cards" (08095:B:3): the draw a player card's effect makes is not made. */
export function drawBarredByPlayerCard(state: ScenarioState, byPlayerCard: boolean): boolean {
  return byPlayerCard && state.modifiers.length > 0 && flagged(state, "table", "cannotDrawByPlayerCard");
}

/** "In order to commit characters to the quest, a player must first discard a card at random from his hand" (08096:B:3): a seat with no card in hand cannot commit. */
export function commitBarredByEmptyHand(state: ScenarioState, seat: number): boolean {
  return state.modifiers.length > 0 && flagged(state, "table", "commitDiscardsRandom") && (state.seats[seat]?.hand.length ?? 0) === 0;
}

/** The discard a commitment costs under `commitDiscardsRandom`: one card of the seat's hand, chosen with the game's seed, before its characters commit. */
export function discardToCommit(state: ScenarioState, seat: number, ctx: ReduceContext): ScenarioState {
  return state.modifiers.length > 0 && flagged(state, "table", "commitDiscardsRandom") ? discardRandom(state, seat, 1, state.questStage, ctx) : state;
}
