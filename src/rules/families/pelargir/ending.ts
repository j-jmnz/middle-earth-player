// Rules: rr.cannot, rr.winning-the-game, rr.player-elimination (data/rules/entries.json); ledger lines 06070:A:3, 06071:A:3.
// The loss of Lord Alcaron: "If Lord Alcaron leaves play, the players have lost the game", held while Ghulat is in play ("While Ghulat is in play, the game cannot end"). His record sets the table's `endingLost` when he leaves play; the players lose once that flag is set and Ghulat is not in play, whenever that
// moment comes (at once when Ghulat is not in play, or when he is destroyed later). The comparison of the two objectives is read by their own constants (the records of Rescued Villagers and Dead Villagers).
import { gameReads } from "../../core/game-reads.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { cardInPlay } from "./villagers.ts";

const GHULAT = "06071";

/** The settle sweep: the players lose when `endingLost` is set and no card with Ghulat's code is in play. Inert unless the game reads the flag and a modifier exists. */
export function alcaronLoss(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (state.modifiers.length === 0 || state.lost || state.stageCleared || state.failure || state.stack.length > 0 || !flagged(state, "table", "endingLost") || !gameReads(state, ctx, '"endingLost"')) return state;
  if (cardInPlay(state, GHULAT)) return state;
  return { ...state, lost: true, lossReason: "Lord Alcaron left play", window: null, pendingAttack: null };
}
