// Rules: mec108.side-quests-in-play, faq.triggering-forced-effects (data/rules/entries.json); ledger lines 10081:A:1, 10130:A:2. "If no progress was placed on Lie Low this round": in a game with a card that reads it (`progressNoted`, set at the start), each progress token placed on a side quest is noted as a modifier
// `progressPlacedHere` on that card until the end of the round (once a round), which a record reads with the condition `flag` (`holder: self`). Every other game's state is as it was.
import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { flagged, heldAmount, type ScenarioState } from "../../core/state.ts";

/** The start of a game with a card that reads `progressPlacedHere` notes it; every other game is left as it is. */
export function markProgressNoted(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  return state.progressNoted === true || !gameReads(state, ctx, '"progressPlacedHere"') ? state : { ...state, progressNoted: true };
}

/** The progress `placed` (more than 0) went on the side quest: in a game that notes it, the card holds `progressPlacedHere` until the end of the round. */
export function noteProgressPlaced(state: ScenarioState, id: string, placed: number): ScenarioState {
  if (state.progressNoted !== true || placed <= 0 || flagged(state, id, "progressPlacedHere")) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat: "progressPlacedHere", amount: 1, until: "endOfRound" }] };
}

/** `amount` progress is about to be placed on the current quest (after the active location and a sponge took theirs): each Orc Grunts in play reduces it by 1 (`questProgressReduced`, 10130:A:2), to 0 at the least. The amount is as it was while no Orc Grunts is in play. */
export function reduceQuestProgress(state: ScenarioState, amount: number): number {
  return amount <= 0 || state.modifiers.length === 0 ? amount : Math.max(0, amount - heldAmount(state, "table", "questProgressReduced"));
}
